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
function options_(field: FormField): Partial<QuartzFormsOptions> {
  return options({ forms: { f: contact({ fields: [field] }) } });
}
function fieldProblems(field: FormField): string[] {
  return formProblems(contact({ fields: [field] }));
}

const ARMORED = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nabc\n-----END PGP PUBLIC KEY BLOCK-----";
const PRIVATE =
  "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nsecret\n-----END PGP PRIVATE KEY BLOCK-----";
const MESSAGE = "-----BEGIN PGP MESSAGE-----\n\nmsg\n-----END PGP MESSAGE-----";
// What the build says about every relay form with the default spam settings (third review, M1).
const LEVER =
  "forms.contact.spam.rateLimitPerHour: one client can send the hour's 60 mails by itself, and the form takes no more from anyone until the hour is over; a captcha, or pow with noScript: false, makes that cost something (see the README)";

describe("validate: forms and fields", () => {
  it("holds a condition to an earlier field of a kind with values, and to values it can have", () => {
    const topic: FormField = {
      type: "radio",
      name: "topic",
      label: "T",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    };
    const dep = (showIf: unknown): FormField =>
      ({ type: "text", name: "dep", label: "D", showIf }) as FormField;
    const of = (...fields: FormField[]) => formProblems(contact({ fields }));
    expect(of(topic, dep({ field: "topic", equals: "a" }))).toEqual([]);
    expect(of(topic, dep({ field: "topic", equals: ["a", "b"] }))).toEqual([]);
    expect(of(topic, dep({ field: "topic" }))).toEqual([
      "forms.f.fields[1].showIf: { field, equals } with the name of a field and one value or a list of them",
    ]);
    expect(of(topic, dep({ field: "nope", equals: "a" }))).toEqual([
      'forms.f.fields[1].showIf: no field "nope" in this form',
    ]);
    expect(of(dep({ field: "topic", equals: "a" }), topic)).toEqual([
      'forms.f.fields[0].showIf: "topic" must come before the field that depends on it',
    ]);
    expect(of(dep({ field: "dep", equals: "a" }))).toEqual([
      'forms.f.fields[0].showIf: "dep" must come before the field that depends on it',
    ]);
    const text: FormField = { type: "text", name: "free", label: "F" };
    expect(of(text, dep({ field: "free", equals: "x" }))).toEqual([
      'forms.f.fields[1].showIf: "free" is a text field; a condition needs a select, radio, checkboxes, checkbox or scale',
    ]);
    expect(of(topic, dep({ field: "topic", equals: ["a", "c"] }))).toEqual([
      'forms.f.fields[1].showIf: "topic" cannot have the value "c"',
    ]);
    const box: FormField = { type: "checkbox", name: "box", label: "B" };
    expect(of(box, dep({ field: "box", equals: "yes" }))).toEqual([]);
    expect(of(box, dep({ field: "box", equals: "on" }))).toEqual([
      'forms.f.fields[1].showIf: "box" cannot have the value "on"',
    ]);
    const scale: FormField = { type: "scale", name: "rate", label: "R", min: 1, max: 5 };
    expect(of(scale, dep({ field: "rate", equals: ["1", "5"] }))).toEqual([]);
    expect(of(scale, dep({ field: "rate", equals: "6" }))).toEqual([
      'forms.f.fields[1].showIf: "rate" cannot have the value "6"',
    ]);
    expect(
      of(topic, {
        type: "hidden",
        name: "h",
        value: "v",
        showIf: { field: "topic", equals: "a" },
      } as never),
    ).toEqual(["forms.f.fields[1].showIf: a hidden field cannot be conditional"]);
  });

  it("holds width and layout to their values, and says layout does nothing on a select", () => {
    expect(fieldProblems({ type: "text", name: "t", label: "T", width: "wide" as never })).toEqual([
      "forms.f.fields[0].width: full, half or third",
    ]);
    const options = [{ value: "a", label: "A" }];
    expect(
      fieldProblems({ type: "radio", name: "r", label: "R", options, layout: "row" as never }),
    ).toEqual(["forms.f.fields[0].layout: stacked or inline"]);
    const select = resolveOptions(
      options_({ type: "select", name: "s", label: "S", options, layout: "inline" }),
    );
    expect(select.problems).toEqual([]);
    expect(select.hints).toContain(
      "forms.f.fields[0].layout: has no effect on a select, whose options are a list to open",
    );
  });

  it("holds page breaks between fields, one at a time, and says a step of hidden values only", () => {
    const text = (name: string): FormField => ({ type: "text", name, label: name });
    const page = (extra: object = {}): FormField => ({ type: "pageBreak", ...extra }) as FormField;
    const of = (...fields: FormField[]) => formProblems(contact({ fields }));
    expect(of(text("a"), page({ title: "Two" }), text("b"))).toEqual([]);
    expect(of(text("a"), page({ title: { en: "Two", de: "Zwei" } }), text("b"))).toEqual([]);
    expect(of(page(), text("a"))).toEqual([
      "forms.f.fields[0]: a page break stands between fields, not first or last",
    ]);
    expect(of(text("a"), page())).toEqual([
      "forms.f.fields[1]: a page break stands between fields, not first or last",
    ]);
    expect(of(text("a"), page(), page(), text("b"))).toEqual([
      "forms.f.fields[2]: two page breaks in a row leave a step without fields",
    ]);
    expect(of(text("a"), page({ title: "" }), text("b"))).toEqual([
      "forms.f.fields[1].title: empty text",
    ]);
    // its condition is held like a field's: an earlier field of a kind with values
    const box: FormField = { type: "checkbox", name: "box", label: "B" };
    expect(of(box, page({ showIf: { field: "box", equals: "yes" } }), text("b"))).toEqual([]);
    expect(of(text("a"), page({ showIf: { field: "box", equals: "yes" } }), box)).toEqual([
      'forms.f.fields[1].showIf: "box" must come before the field that depends on it',
    ]);
    // a consent field never stands behind a step's condition, only in a step that always counts
    const consent: FormField = { type: "consent", name: "ok", text: "I agree" };
    expect(of(box, page({ showIf: { field: "box", equals: "yes" } }), text("b"), consent)).toEqual([
      "forms.f.fields[3]: a consent field cannot stand in a step with a condition: when the step is skipped, the message would go without it",
    ]);
    expect(
      of(box, page({ showIf: { field: "box", equals: "yes" } }), text("b"), page(), consent),
    ).toEqual([]);
    expect(of(box, consent, page({ showIf: { field: "box", equals: "yes" } }), text("b"))).toEqual(
      [],
    );
    const hiddenStep = resolveOptions(
      options({
        forms: {
          f: contact({
            fields: [
              text("a"),
              page(),
              { type: "hidden", name: "h", value: "v" },
              page(),
              text("b"),
            ],
          }),
        },
      }),
    );
    expect(hiddenStep.problems).toEqual([]);
    expect(hiddenStep.hints).toContain(
      "forms.f: step 2 holds only hidden values and shows the visitor nothing",
    );
  });

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
    // Second review, finding 9 (2026-10-19): the plain path lifts these three out of the fields
    // as well, so a field of that name arrived empty (measured against the code before: a required
    // field "pageTitle" built without objection, a plain post got 400 "pageTitle: required").
    for (const name of ["pageTitle", "cf-turnstile-response", "h-captcha-response"]) {
      expect(fieldProblems({ type: "text", name, label: "x" })[0]).toMatch(/reserved/);
    }
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
    // Trimmed on both sides before the lookup, so " a " was never chosen; " " is empty once sent.
    expect(
      fieldProblems({
        type: "checkboxes",
        name: "a",
        label: "x",
        options: [
          { value: " a ", label: "a" },
          { value: "b\t", label: "b" },
          { value: " ", label: "blank" },
          { value: "c d", label: "c" },
        ],
      }),
    ).toEqual([
      'forms.f.fields[0].options[0]: value " a " begins or ends with whitespace, which is trimmed from what is sent: it can never be chosen',
      'forms.f.fields[0].options[1]: value "b\t" begins or ends with whitespace, which is trimmed from what is sent: it can never be chosen',
      'forms.f.fields[0].options[2]: value " " begins or ends with whitespace, which is trimmed from what is sent: it can never be chosen',
    ]);
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
  });

  it("refuses a pattern only JavaScript reads: the relay's PCRE would refuse every value of the field", () => {
    // Second review, finding 3 (2026-10-19): the build and the browser read `[\u0041-\u005A]+`,
    // the relay got false from preg_match and, fail-closed since the first review, refused
    // "ABC" as invalid; the owner found the reason only in the server's error log.
    const pattern = (pattern: string) =>
      fieldProblems({ type: "text", name: "a", label: "x", pattern });
    expect(pattern("[\\u0041-\\u005A]+")).toEqual([
      "forms.f.fields[0].pattern: `\\u` escapes are JavaScript only, the relay's PCRE cannot read them: write the character itself, or `\\xHH` below U+0100",
    ]);
    expect(pattern("\\u{1F600}")[0]).toMatch(/`\\u` escapes are JavaScript only/);
    expect(pattern("[^]+")).toEqual([
      "forms.f.fields[0].pattern: `[^]` is JavaScript only, the relay's PCRE cannot read it: write `[\\s\\S]`",
    ]);
    expect(pattern("a[]b")).toEqual([
      "forms.f.fields[0].pattern: `[]` is JavaScript only (it matches nothing), the relay's PCRE cannot read it",
    ]);
    expect(pattern("(?<=a+)b")).toEqual([
      "forms.f.fields[0].pattern: a lookbehind of unlimited length is JavaScript only, the relay's PCRE cannot read it",
    ]);
    expect(pattern("(?<!(ab)*)c")[0]).toMatch(/lookbehind of unlimited length/);
    expect(pattern("(?<=a{2,})b")[0]).toMatch(/lookbehind of unlimited length/);
    // What both read passes: an escaped backslash before u, `]` and `^` inside a class, a
    // lookbehind of fixed length, a quantifier after the lookbehind, named groups, properties.
    for (const ok of [
      "https?:\\/\\/.+",
      "[A-Z]{3}",
      "\\\\u",
      "[\\]^]+",
      "(?<=ab)c",
      "(?<=a|bc)d+",
      "(?<=a)b+",
      "(?<n>a)\\k<n>",
      "\\p{Script=Latin}+",
      "a{2,}",
    ]) {
      expect([ok, pattern(ok)]).toEqual([ok, []]);
    }
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
    expect(local.hints).toEqual([LEVER]);
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
    // Second review, aside 5 (2026-10-19): the schema said `number`, the relay casts to int, so
    // 0.5 was half a second in the browser and no time trap at all in the relay.
    expect(problemsOf({ spam: { minSeconds: 0.5 } as never })).toEqual([
      "forms.contact.spam.minSeconds: a whole number of seconds, 0 or more",
    ]);
    expect(problemsOf({ spam: { minSeconds: -1 } as never })).toEqual([
      "forms.contact.spam.minSeconds: a whole number of seconds, 0 or more",
    ]);
    expect(problemsOf({ spam: { powDifficulty: 4 } as never })).toEqual([
      "forms.contact.spam.powDifficulty: an integer from 8 to 20",
    ]);
    // 24 bits took minutes on a desktop (review finding 18, 2026-10-19); from 18 the build warns.
    expect(problemsOf({ spam: { powDifficulty: 24 } as never })).toEqual([
      "forms.contact.spam.powDifficulty: an integer from 8 to 20",
    ]);
    expect(
      resolveOptions(options({ spam: { pow: true, powDifficulty: 18 } as never })).hints,
    ).toEqual([
      "forms.contact.spam.pow: a plain post without JavaScript (noScript: true) skips it; noScript: false requires the script",
      LEVER,
      "forms.contact.spam.powDifficulty: 18 bits take seconds on a phone before every message",
    ]);
    expect(
      resolveOptions(options({ spam: { pow: false, powDifficulty: 20 } as never })).hints,
    ).toEqual([LEVER]);
    // The quota is one for everyone; it is said unless a captcha, or a proof of work a plain post
    // cannot skip, makes each post cost something (third review, M1, 2026-10-19).
    const hintsOf = (spam: object, form: object = {}) =>
      resolveOptions(options({ spam: spam as never, forms: { contact: contact(form) } })).hints;
    expect(hintsOf({ pow: true, noScript: false })).toEqual([]);
    expect(hintsOf({ captcha: "turnstile", captchaSiteKey: "k" })).toEqual([]);
    expect(hintsOf({ rateLimitPerHour: 0 })).toEqual([]);
    expect(hintsOf({ rateLimitPerHour: 5 })).toEqual([LEVER.replace("60", "5")]);
    expect(hintsOf({ captcha: "turnstile" }, { anonymous: true })).toContain(LEVER);
    // `extra` goes to an endpoint or a service; the relay and mailto take no extra fields
    // (review finding 22, 2026-10-19).
    expect(
      resolveOptions(
        options({ transport: { kind: "relay", url: "https://r.example/x", extra: { to: "s" } } }),
      ).hints,
    ).toEqual(["forms.contact.transport.extra: has no effect with the relay", LEVER]);
    expect(
      resolveOptions(
        options({
          forms: { contact: contact({ recipient: "o@example.org" }) },
          transport: { kind: "mailto", extra: { to: "s" } },
        }),
      ).hints,
    ).toEqual(["forms.contact.transport.extra: has no effect with mailto"]);
    expect(
      resolveOptions(
        options({
          transport: { kind: "endpoint", url: "https://e.example/x", extra: { to: "s" } },
        }),
      ).hints,
    ).toEqual([]);
    // The demo sends nothing: a target, extra fields, a redirect and a captcha are said.
    expect(resolveOptions(options({ transport: { kind: "demo" } })).hints).toEqual([]);
    expect(resolveOptions(options({ transport: { kind: "demo" } })).problems).toEqual([]);
    expect(
      resolveOptions(
        options({
          forms: {
            contact: contact({
              success: { mode: "redirect", slug: "thanks" },
              spam: { captcha: "turnstile", captchaSiteKey: "k" },
            }),
          },
          transport: { kind: "demo", url: "https://e.example/x", extra: { to: "s" } },
        }),
      ).hints,
    ).toEqual([
      "forms.contact.transport.url: has no effect with demo, which sends nothing",
      "forms.contact.success: demo shows what would have been sent below the form and does not redirect",
      "forms.contact.spam.captcha: with demo the turnstile widget is not loaded: nothing is sent that it could protect",
      "forms.contact.transport.extra: has no effect with demo, which sends nothing",
    ]);
    // the owner's thank-you is not the demo's sentence (fiftieth review, N1)
    expect(
      resolveOptions(
        options({
          forms: { contact: contact({ success: { mode: "inline", text: "Danke!" } }) },
          transport: { kind: "demo" },
        }),
      ).hints,
    ).toContain("forms.contact.success.text: has no effect with demo, which sends nothing");
    // A demo form under a global relay inherits the relay's url and extra, which it did not write
    // (fifty-second review, side list); what it writes itself is still said.
    const underRelay = (own: Partial<FormDefinition["transport"]>) =>
      resolveOptions(
        options({
          forms: { contact: contact({ transport: { kind: "demo", ...own } }) },
          transport: { kind: "relay", url: "https://e.example/send.php", extra: { site: "x" } },
        }),
      ).hints.filter((h) => h.includes(".transport."));
    expect(underRelay({})).toEqual([]);
    expect(underRelay({ url: "https://e.example/other", extra: { to: "s" } })).toEqual([
      "forms.contact.transport.url: has no effect with demo, which sends nothing",
      "forms.contact.transport.extra: has no effect with demo, which sends nothing",
    ]);
    // A captcha the demo does not load needs no site key and reads no plaintext; a time trap the
    // demo does not set is said (fifty-first review, N3).
    const demoSpam = resolveOptions(
      options({
        forms: {
          contact: contact({
            spam: { captcha: "turnstile", minSeconds: 5 },
            encryption: { mode: "required", keys: ["owner"] },
          }),
        },
        keys: { owner: { armored: ARMORED } },
        transport: { kind: "demo" },
      }),
    );
    expect(demoSpam.problems).toEqual([]);
    expect(demoSpam.hints).toEqual([
      "forms.contact.spam.captcha: with demo the turnstile widget is not loaded: nothing is sent that it could protect",
      "forms.contact.spam.minSeconds: has no effect with demo, which sends nothing",
    ]);
    expect(
      resolveOptions(options({ spam: { minSeconds: 4 } as never, transport: { kind: "demo" } }))
        .hints,
    ).toEqual(["forms.contact.spam.minSeconds: has no effect with demo, which sends nothing"]);
    expect(problemsOf({ spam: { captcha: "turnstile" } as never })).toEqual([
      "forms.contact.spam.captchaSiteKey: turnstile needs the site key",
    ]);
    expect(problemsOf({ spam: { maxBytes: 0 } as never })).toEqual([
      "forms.contact.spam.maxBytes: a positive integer",
    ]);
    // The defaults fit together (no maxBytes hint, only the quota's); a limit below the fields'
    // capacity is said, and an encrypting form counts the armor (review finding 9, 2026-10-19).
    expect(resolveOptions(options({})).hints).toEqual([LEVER]);
    const tight = resolveOptions(options({ spam: { maxBytes: 1000 } as never }));
    expect(tight.hints).toEqual([
      LEVER,
      "forms.contact.spam.maxBytes: 1000 is below what the fields may hold (about 67024 bytes); a long message would be refused as too large",
    ]);
    const tightEnc = resolveOptions(
      options({
        spam: { maxBytes: 1000 } as never,
        forms: { contact: contact({ encryption: { mode: "required", keys: ["owner"] } }) },
      }),
    );
    expect(tightEnc.hints[1]).toMatch(/about 90390 bytes once encrypted/);
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
    // Written globally, the hint was missing: only the form's own spam block was looked at
    // (noticed beside the second review's finding 4, 2026-10-19).
    const globalRate = resolveOptions(
      options({
        transport: { kind: "endpoint", url: "https://e.example/x" },
        spam: { rateLimitPerHour: 5 } as never,
      }),
    );
    expect(globalRate.hints).toEqual([
      "forms.contact.spam.rateLimitPerHour: has no effect without the relay",
    ]);
    // With the relay, a plain post (noScript: true, the default) carries no proof: said.
    expect(resolveOptions(options({ spam: { pow: true } as never })).hints).toEqual([
      "forms.contact.spam.pow: a plain post without JavaScript (noScript: true) skips it; noScript: false requires the script",
      LEVER,
    ]);
    expect(
      resolveOptions(options({ spam: { pow: true, noScript: false } as never })).hints,
    ).toEqual([]);
    // Finding 4 of the second review (2026-10-19): the stamp too comes only from the script, so
    // a plain post skips the time trap as well. The default (3 s, noScript) is documented and
    // says nothing; a minSeconds the owner wrote, globally or for the form, is said.
    expect(resolveOptions(options()).hints).toEqual([LEVER]);
    expect(resolveOptions(options({ spam: { minSeconds: 10 } as never })).hints).toEqual([
      "forms.contact.spam.minSeconds: a plain post without JavaScript (noScript: true) carries no stamp and skips it; noScript: false requires the script",
      LEVER,
    ]);
    expect(
      resolveOptions(options({ forms: { contact: contact({ spam: { minSeconds: 10 } }) } })).hints,
    ).toEqual([
      "forms.contact.spam.minSeconds: a plain post without JavaScript (noScript: true) carries no stamp and skips it; noScript: false requires the script",
      LEVER,
    ]);
    expect(
      resolveOptions(options({ spam: { minSeconds: 10, noScript: false } as never })).hints,
    ).toEqual([LEVER]);
    expect(resolveOptions(options({ spam: { minSeconds: 0 } as never })).hints).toEqual([LEVER]);
    // Quartz lays the options over the manifest's defaultOptions, one level deep
    // (config-loader.ts: `{ ...manifest.defaultOptions, ...entry.options }`), so a site that
    // writes no `spam` hands the plugin the whole default block. It read as written: every form
    // without the relay said "rateLimitPerHour has no effect", every relay form "minSeconds ...
    // skips it" (measured in the handbook's build, 2026-10-19). A value equal to the default
    // says nothing, wherever it came from.
    const manifest = (
      JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")) as {
        quartz: { defaultOptions: Partial<QuartzFormsOptions> };
      }
    ).quartz.defaultOptions;
    const merged = (extra: Partial<QuartzFormsOptions>) =>
      resolveOptions({ ...manifest, ...options(extra) }).hints;
    expect(merged({})).toEqual([LEVER]);
    expect(merged({ transport: { kind: "endpoint", url: "https://e.example/x" } })).toEqual([]);
    expect(merged({ transport: { kind: "demo" } })).toEqual([]);
    expect(
      merged({
        transport: { kind: "endpoint", url: "https://e.example/x" },
        spam: { ...manifest.spam, rateLimitPerHour: 5 } as never,
      }),
    ).toEqual(["forms.contact.spam.rateLimitPerHour: has no effect without the relay"]);
    expect(merged({ spam: { ...manifest.spam, minSeconds: 10 } as never })).toEqual([
      "forms.contact.spam.minSeconds: a plain post without JavaScript (noScript: true) carries no stamp and skips it; noScript: false requires the script",
      LEVER,
    ]);
    expect(
      resolveOptions(
        options({
          transport: { kind: "endpoint", url: "https://e.example/x" },
          spam: { minSeconds: 10 } as never,
        }),
      ).hints,
    ).toEqual([]);
    const anonCaptcha = resolveOptions(
      options({
        spam: { captcha: "hcaptcha", captchaSiteKey: "k" } as never,
        forms: { contact: contact({ anonymous: true }) },
      }),
    );
    // Third review, M3 (2026-10-19): the provider's script runs on the page where the message is
    // typed before it is encrypted.
    const encCaptcha = (mode: "required" | "optional" | "off", anonymous = false) =>
      resolveOptions(
        options({
          spam: { captcha: "turnstile", captchaSiteKey: "k" } as never,
          forms: { contact: contact({ anonymous, encryption: { mode, keys: ["owner"] } }) },
        }),
      ).hints.filter((h) => h.includes("spam.captcha"));
    expect(encCaptcha("required")).toEqual([
      "forms.contact.spam.captcha: the turnstile script runs on the page where the message is typed before it is encrypted, and can read it (see the README)",
    ]);
    expect(encCaptcha("optional")).toHaveLength(1);
    expect(encCaptcha("off")).toEqual([]);
    expect(encCaptcha("required", true)).toEqual([]);
    expect(anonCaptcha.problems).toEqual([]);
    expect(anonCaptcha.hints).toEqual([
      "forms.contact: anonymous, so the hcaptcha captcha is not loaded",
      LEVER,
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
    // a written success without mode is inline, as the docs say (fiftieth review, N6)
    expect(formProblems(contact({ success: { text: "Danke!" } }))).toEqual([]);
    expect(
      resolveOptions(options({ forms: { f: contact({ success: { text: "Danke!" } }) } })).forms.f!
        .success,
    ).toEqual({ mode: "inline", text: "Danke!" });
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
      LEVER,
      "texts.de.nope: no such text key",
      "texts.fr: the plugin has no texts in this language; they are used as written",
    ]);
  });
});
