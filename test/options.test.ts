import { describe, expect, it } from "vitest";
import { defaultSpam, resolveOptions, resolveOrThrow } from "../src/options";
import { contact, options } from "./helpers";

describe("resolveOptions", () => {
  it("applies the defaults and keeps a valid form free of problems", () => {
    const opts = resolveOptions(options());
    expect(opts.problems).toEqual([]);
    expect(opts.frontmatterKey).toBe("form");
    expect(opts.codeBlockLang).toBe("quartz-form");
    expect(opts.language).toBe("auto");
    const form = opts.forms.contact!;
    expect(form.id).toBe("contact");
    expect(form.transport).toEqual({ kind: "relay", url: "https://example.org/forms/send.php" });
    expect(form.encryption).toEqual({ mode: "off", keys: [], showFingerprint: true });
    expect(form.spam).toEqual(defaultSpam);
    expect(form.success).toEqual({ mode: "inline" });
    expect(form.anonymous).toBe(false);
    expect(form.pageContext).toBe(false);
  });

  it("lets a form override single transport and spam fields", () => {
    const opts = resolveOptions(
      options({
        forms: {
          contact: contact({
            transport: { url: "https://other.example/send.php" },
            spam: { minSeconds: 10 },
          }),
        },
      }),
    );
    const form = opts.forms.contact!;
    expect(form.transport).toEqual({ kind: "relay", url: "https://other.example/send.php" });
    expect(form.spam.minSeconds).toBe(10);
    expect(form.spam.honeypot).toBe(true);
  });

  it("treats a key written without a value as not written", () => {
    const opts = resolveOptions({
      ...options(),
      frontmatterKey: null as unknown as string,
      forms: { contact: contact({ title: null as unknown as string, spam: null as never }) },
    });
    expect(opts.problems).toEqual([]);
    expect(opts.frontmatterKey).toBe("form");
    expect(opts.forms.contact!.title).toBeUndefined();
    expect(opts.forms.contact!.spam).toEqual(defaultSpam);
  });

  it("starts a form from a template and lets own fields replace the template's", () => {
    const fromTemplate = resolveOptions(
      options({ forms: { fb: { template: "feedback", recipient: "owner" } } }),
    ).forms.fb!;
    expect(fromTemplate.fields.map((f) => ("name" in f ? f.name : f.type))).toEqual([
      "rating",
      "comment",
    ]);
    expect(fromTemplate.pageContext).toBe(true);
    expect(fromTemplate.title).toEqual({
      en: "Feedback on this page",
      de: "Feedback zu dieser Seite",
    });

    const own = resolveOptions(
      options({
        forms: {
          fb: {
            template: "feedback",
            recipient: "owner",
            fields: [{ type: "textarea", name: "comment", label: "Comment", required: true }],
          },
        },
      }),
    ).forms.fb!;
    expect(own.fields.map((f) => ("name" in f ? f.name : f.type))).toEqual(["comment"]);
  });

  it("does not let one form's changes leak into the next form's template", () => {
    const opts = resolveOptions(
      options({
        forms: {
          a: { template: "contact", recipient: "owner" },
          b: { template: "contact", recipient: "owner" },
        },
      }),
    );
    (opts.forms.a!.fields[0] as { label: string }).label = "changed";
    expect(opts.forms.b!.fields[0]!).toHaveProperty("label", { en: "Name", de: "Name" });
  });

  it("encrypts to every configured key unless the form names some", () => {
    const keys = {
      a: { armored: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nx\n-----END PGP PUBLIC KEY BLOCK-----" },
      b: { armored: "-----BEGIN PGP PUBLIC KEY BLOCK-----\ny\n-----END PGP PUBLIC KEY BLOCK-----" },
    };
    const all = resolveOptions(
      options({ keys, forms: { c: contact({ encryption: { mode: "required" } }) } }),
    );
    expect(all.problems).toEqual([]);
    expect(all.forms.c!.encryption.keys).toEqual(["a", "b"]);
    const some = resolveOptions(
      options({ keys, forms: { c: contact({ encryption: { mode: "optional", keys: ["b"] } }) } }),
    );
    expect(some.forms.c!.encryption.keys).toEqual(["b"]);
  });

  it("keeps the anonymous promise: personal fields become optional, the page is not sent", () => {
    const opts = resolveOptions(
      options({
        forms: {
          anon: contact({
            anonymous: true,
            pageContext: true,
            fields: [
              { type: "email", name: "email", label: "E-mail", required: true },
              { type: "text", name: "name", label: "Name", required: true, autocomplete: "name" },
              { type: "text", name: "topic", label: "Topic", required: true },
              { type: "textarea", name: "message", label: "Message", required: true },
            ],
          }),
        },
      }),
    );
    const form = opts.forms.anon!;
    expect(form.pageContext).toBe(false);
    expect(form.fields.map((f) => "required" in f && f.required)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(opts.hints.filter((h) => h.includes("made optional"))).toHaveLength(2);
    expect(opts.hints.some((h) => h.includes("pageContext"))).toBe(true);
  });
});

describe("resolveOrThrow", () => {
  it("throws one error naming every problem", () => {
    expect(() =>
      resolveOrThrow(
        options({
          forms: {
            "Bad Id": { fields: [] },
            ok: contact({ transport: { kind: "mailto" } }),
          },
        }),
      ),
    ).toThrowError(
      /4 problem\(s\)[\s\S]*Bad Id: form id[\s\S]*Bad Id: no fields[\s\S]*Bad Id\.recipient[\s\S]*forms\.ok\.recipient: mailto/,
    );
  });

  it("returns the options when there is nothing to report", () => {
    expect(resolveOrThrow(options()).forms.contact).toBeDefined();
  });
});
