import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOptions } from "../src/options";
import type { FormDefinition, FormField, QuartzFormsOptions } from "../src/types";
import { contact, options } from "./helpers";
import { tmpDir } from "./keys";

function problemsOf(extra: Partial<QuartzFormsOptions>): string[] {
  return resolveOptions(options(extra)).problems;
}
function formProblems(def: FormDefinition): string[] {
  return problemsOf({ forms: { f: def } });
}
function fieldProblems(field: FormField): string[] {
  return formProblems(contact({ fields: [field] }));
}

const ARMORED = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nabc\n-----END PGP PUBLIC KEY BLOCK-----";
const PRIVATE =
  "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nsecret\n-----END PGP PRIVATE KEY BLOCK-----";
const MESSAGE = "-----BEGIN PGP MESSAGE-----\n\nmsg\n-----END PGP MESSAGE-----";

describe("validate: forms and fields", () => {
  it("rejects a form id that is not lower-case letters, digits and dashes", () => {
    for (const id of ["Contact", "kontakt formular", "-x", "ä"])
      expect(problemsOf({ forms: { [id]: contact() } })[0]).toMatch(/form id must match/);
    expect(problemsOf({ forms: { "contact-2": contact() } })).toEqual([]);
  });

  it("rejects a form without fields and an unknown template", () => {
    expect(formProblems({ recipient: "o" })).toEqual([
      "forms.f: no fields (write fields or choose a template)",
    ]);
    expect(formProblems({ recipient: "o", template: "nope" as never })).toEqual([
      'forms.f.template: unknown template "nope"',
      "forms.f: no fields (write fields or choose a template)",
    ]);
  });

  it("rejects bad, reserved and duplicate field names", () => {
    expect(fieldProblems({ type: "text", name: "1st", label: "x" })[0]).toMatch(/must match/);
    expect(fieldProblems({ type: "text", name: "form", label: "x" })[0]).toMatch(/reserved/);
    expect(fieldProblems({ type: "text", name: "_hp", label: "x" })[0]).toMatch(/must match/);
    expect(fieldProblems({ type: "text", name: "ciphertext", label: "x" })[0]).toMatch(/reserved/);
    expect(
      formProblems(
        contact({
          fields: [
            { type: "text", name: "a", label: "x" },
            { type: "text", name: "a", label: "y" },
          ],
        }),
      ),
    ).toEqual(['forms.f.fields[1]: field name "a" twice']);
  });

  it("requires a label, non-empty texts and a sound text record", () => {
    expect(fieldProblems({ type: "text", name: "a" } as never)).toEqual([
      "forms.f.fields[0]: a text field needs a label",
    ]);
    expect(fieldProblems({ type: "text", name: "a", label: "  " })).toEqual([
      "forms.f.fields[0].label: empty text",
    ]);
    expect(fieldProblems({ type: "text", name: "a", label: {} })).toEqual([
      "forms.f.fields[0].label: empty text record",
    ]);
    expect(fieldProblems({ type: "text", name: "a", label: { de: "x", en: "" } })).toEqual([
      "forms.f.fields[0].label.en: empty text",
    ]);
  });

  it("checks choices, scales, consent, hidden and patterns", () => {
    expect(fieldProblems({ type: "select", name: "a", label: "x", options: [] })[0]).toMatch(
      /at least one option/,
    );
    expect(
      fieldProblems({
        type: "radio",
        name: "a",
        label: "x",
        options: [
          { value: "1", label: "one" },
          { value: "1", label: "uno" },
        ],
      }),
    ).toEqual(['forms.f.fields[0].options[1]: value "1" twice']);
    expect(fieldProblems({ type: "scale", name: "a", label: "x", min: 5, max: 1 })[0]).toMatch(
      /below max/,
    );
    expect(fieldProblems({ type: "scale", name: "a", label: "x", min: 0, max: 100 })[0]).toMatch(
      /at most 21 steps/,
    );
    expect(fieldProblems({ type: "consent", name: "a" } as never)).toEqual([
      "forms.f.fields[0]: a consent field needs a text",
    ]);
    expect(fieldProblems({ type: "hidden", name: "a" } as never)).toEqual([
      "forms.f.fields[0]: a hidden field needs a value",
    ]);
    expect(fieldProblems({ type: "text", name: "a", label: "x", pattern: "[" })[0]).toMatch(
      /pattern is not a regular expression/,
    );
    expect(fieldProblems({ type: "number", name: "a", label: "x", min: 3, max: 1 })[0]).toMatch(
      /min 3 is above max 1/,
    );
    expect(fieldProblems({ type: "wat", name: "a", label: "x" } as never)[0]).toMatch(
      /unknown field type/,
    );
  });

  it("allows at most one pgpKey field", () => {
    expect(
      formProblems(
        contact({
          fields: [
            { type: "pgpKey", name: "k1", label: "Key" },
            { type: "pgpKey", name: "k2", label: "Key" },
            { type: "textarea", name: "message", label: "M", required: true },
          ],
        }),
      ),
    ).toEqual(["forms.f: at most one pgpKey field"]);
  });
});

describe("validate: transport, encryption, spam, success", () => {
  it("wants a URL for relay and endpoint, a recipient for relay and mailto", () => {
    expect(problemsOf({ transport: { kind: "relay" } })).toEqual([
      "forms.contact.transport.url: relay needs a URL",
    ]);
    expect(problemsOf({ transport: { kind: "endpoint", url: "ftp://x" } })).toEqual([
      "forms.contact.transport.url: ftp://x is not an http(s) URL",
    ]);
    expect(problemsOf({ forms: { contact: contact({ recipient: undefined }) } })).toEqual([
      "forms.contact.recipient: the relay needs the recipient's name",
    ]);
    expect(
      problemsOf({
        transport: { kind: "mailto" },
        forms: { contact: contact({ recipient: "owner" }) },
      }),
    ).toEqual(["forms.contact.recipient: mailto needs an e-mail address"]);
    expect(
      problemsOf({
        transport: { kind: "mailto" },
        forms: { contact: contact({ recipient: "owner@example.org" }) },
      }),
    ).toEqual([]);
    expect(problemsOf({ transport: { kind: "formspree" } })).toEqual([
      "forms.contact.transport.url: formspree needs the form id or access key",
    ]);
  });

  it("hints at http in transit but accepts localhost", () => {
    const http = resolveOptions(
      options({ transport: { kind: "relay", url: "http://example.org/s" } }),
    );
    expect(http.problems).toEqual([]);
    expect(http.hints[0]).toMatch(/unencrypted in transit/);
    const local = resolveOptions(
      options({ transport: { kind: "relay", url: "http://localhost:8080/s" } }),
    );
    expect(local.hints).toEqual([]);
  });

  it("checks key sources: one of file or armored, an armored block, a readable file inside the site", () => {
    expect(problemsOf({ keys: { k: {} } })).toEqual(["keys.k: exactly one of file or armored"]);
    expect(problemsOf({ keys: { k: { file: "a", armored: ARMORED } } })).toEqual([
      "keys.k: exactly one of file or armored",
    ]);
    expect(problemsOf({ keys: { k: { armored: "hello" } } })).toEqual([
      "keys.k.armored: not an armored PGP public key block",
    ]);
    expect(problemsOf({ keys: { k: { file: "test/fixtures/missing.asc" } } })).toEqual([
      "keys.k.file: test/fixtures/missing.asc not found or not readable",
    ]);
    expect(problemsOf({ keys: { k: { file: "test/helpers.ts" } } })).toEqual([
      "keys.k.file: test/helpers.ts: not an armored PGP public key block",
    ]);
    expect(problemsOf({ keys: { k: { file: "../outside.asc" } } })).toEqual([
      "keys.k.file: ../outside.asc lies outside the site",
    ]);
    expect(problemsOf({ keys: { k: { file: "test/fixtures/public.asc" } } })).toEqual([]);
  });

  it("refuses a key source that holds anything besides one public key block", () => {
    // gpg --export-secret-keys >> owner.asc: the private key behind the public one
    expect(problemsOf({ keys: { k: { armored: `${ARMORED}\n${PRIVATE}` } } })).toEqual([
      "keys.k.armored: holds a private key block; export only the public key (gpg --export --armor)",
    ]);
    expect(problemsOf({ keys: { k: { armored: `${ARMORED}\n${ARMORED}` } } })).toEqual([
      "keys.k.armored: holds 2 key blocks; one public key per source",
    ]);
    expect(problemsOf({ keys: { k: { armored: `${ARMORED}\n${MESSAGE}` } } })).toEqual([
      "keys.k.armored: holds a PGP MESSAGE besides the public key",
    ]);
    expect(
      problemsOf({
        keys: { k: { armored: `${ARMORED}\n-----BEGIN PGP PUBLIC KEY BLOCK-----\nx` } },
      }),
    ).toEqual(["keys.k.armored: holds an incomplete armor block"]);
    const dir = tmpDir("validate-privkey");
    fs.writeFileSync(path.join(dir, "owner.asc"), `${ARMORED}\n${PRIVATE}`);
    const rel = path.relative(process.cwd(), path.join(dir, "owner.asc"));
    expect(problemsOf({ keys: { k: { file: rel } } })).toEqual([
      `keys.k.file: ${rel}: holds a private key block; export only the public key (gpg --export --armor)`,
    ]);
  });

  it("wants keys when a form encrypts, and known ones", () => {
    expect(
      problemsOf({ forms: { contact: contact({ encryption: { mode: "required" } }) } }),
    ).toEqual(["forms.contact.encryption: no keys to encrypt to"]);
    expect(
      problemsOf({
        keys: { k: { armored: ARMORED } },
        forms: { contact: contact({ encryption: { mode: "optional", keys: ["nope"] } }) },
      }),
    ).toEqual(['forms.contact.encryption.keys: unknown key "nope"']);
    expect(
      problemsOf({ forms: { contact: contact({ encryption: { mode: "loud" as never } }) } })[0],
    ).toMatch(/required, optional or off/);
  });

  it("checks the spam settings and says what has no effect", () => {
    expect(problemsOf({ spam: { powDifficulty: 4 } as never })).toEqual([
      "forms.contact.spam.powDifficulty: an integer from 8 to 24",
    ]);
    expect(problemsOf({ spam: { captcha: "turnstile" } as never })).toEqual([
      "forms.contact.spam.captchaSiteKey: turnstile needs the site key",
    ]);
    expect(problemsOf({ spam: { maxBytes: 0 } as never })).toEqual([
      "forms.contact.spam.maxBytes: a positive integer",
    ]);
    const noRelay = resolveOptions(
      options({
        transport: { kind: "endpoint", url: "https://e.example/x" },
        spam: { pow: true } as never,
        forms: { contact: contact({ spam: { rateLimitPerHour: 5 } }) },
      }),
    );
    expect(noRelay.problems).toEqual([]);
    expect(noRelay.hints).toEqual([
      "forms.contact.spam.pow: has no effect without the relay",
      "forms.contact.spam.rateLimitPerHour: has no effect without the relay",
    ]);
    const anonCaptcha = resolveOptions(
      options({
        spam: { captcha: "hcaptcha", captchaSiteKey: "k" } as never,
        forms: { contact: contact({ anonymous: true }) },
      }),
    );
    expect(anonCaptcha.problems).toEqual([]);
    expect(anonCaptcha.hints).toEqual([
      "forms.contact: anonymous, so the hcaptcha captcha is not loaded",
    ]);
  });

  it("hints when an anonymous form uses a third-party service", () => {
    const opts = resolveOptions(
      options({
        transport: { kind: "web3forms", url: "key" },
        forms: { contact: contact({ anonymous: true }) },
      }),
    );
    expect(opts.hints).toEqual([
      "forms.contact: anonymous, but web3forms sees the sender's address; see the README",
    ]);
  });

  it("wants a slug for a redirect", () => {
    expect(formProblems(contact({ success: { mode: "redirect" } }))).toEqual([
      "forms.f.success.slug: redirect needs the slug of a page",
    ]);
    expect(formProblems(contact({ success: { mode: "elsewhere" as never } }))).toEqual([
      "forms.f.success.mode: inline or redirect",
    ]);
  });
});

describe("validate: plugin-wide options", () => {
  it("checks language, frontmatterKey, codeBlockLang and texts", () => {
    expect(problemsOf({ language: "all!" })).toEqual([
      'language: "all!" is neither auto nor a language code',
    ]);
    expect(problemsOf({ language: "de-DE" })).toEqual([]);
    expect(problemsOf({ frontmatterKey: " " })).toEqual(["frontmatterKey: empty"]);
    expect(problemsOf({ codeBlockLang: "quartz form" })).toEqual([
      "codeBlockLang: one word without spaces",
    ]);
    const texts = resolveOptions(
      options({ texts: { de: { submit: "Abschicken", nope: "x" }, fr: { submit: "Envoyer" } } }),
    );
    expect(texts.problems).toEqual([]);
    expect(texts.hints).toEqual([
      "texts.de.nope: no such text key",
      "texts.fr: the plugin has no texts in this language; they are used as written",
    ]);
  });
});
