import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { interpolate, resolveText, textLanguages } from "../src/text";
import { availableLocales, i18n, textKeys, wording } from "../src/i18n";
import { templateNames, templateOf } from "../src/templates";

describe("resolveText", () => {
  it("returns a string as is and picks a record entry by code, subtag, then first", () => {
    expect(resolveText("Name", "de")).toBe("Name");
    const text = { "de-DE": "Nachricht", en: "Message" };
    expect(resolveText(text, "de-DE")).toBe("Nachricht");
    expect(resolveText(text, "de")).toBe("Nachricht");
    expect(resolveText(text, "de-AT")).toBe("Nachricht");
    expect(resolveText(text, "en-GB")).toBe("Message");
    expect(resolveText(text, "fr")).toBe("Nachricht");
    expect(resolveText(undefined, "de")).toBeUndefined();
    expect(resolveText({}, "de")).toBeUndefined();
  });

  it("names the languages of a record", () => {
    expect(textLanguages({ "de-DE": "a", EN: "b" })).toEqual(["de-de", "en"]);
    expect(textLanguages("a")).toEqual([]);
  });

  it("interpolates known placeholders and leaves unknown ones", () => {
    expect(interpolate("at most {max} of {what}", { max: 3 })).toBe("at most 3 of {what}");
  });
});

describe("i18n", () => {
  it("is mirrored by the relay's page for a post without JavaScript, sentence for sentence", () => {
    // Second review, aside 3 (2026-10-19): the relay's page named no field and spoke English
    // only. It now names each refused field with the sentence the script shows at the field; the
    // sentences are a copy in send.php (`qf_words`), so this test holds the copy to the original.
    const php = fs.readFileSync(path.join(__dirname, "..", "relay", "php", "send.php"), "utf8");
    const words = (name: string): Record<string, string> => {
      const block = php.match(new RegExp(`\\$${name} = \\[([\\s\\S]*?)\\n {4}\\];`))?.[1] ?? "";
      return Object.fromEntries(
        [...block.matchAll(/'(\w+)' => '((?:[^'\\]|\\.)*)'/g)].map((m) => [
          m[1]!,
          m[2]!.replace(/\\(.)/g, "$1"),
        ]),
      );
    };
    const mirrored: Record<string, string> = { de: "de-DE", en: "en-US" };
    let compared = 0;
    for (const [name, locale] of Object.entries(mirrored)) {
      const relay = words(name);
      const t = i18n(locale) as Record<string, string>;
      expect(Object.keys(relay).length, name).toBeGreaterThan(10);
      for (const [key, sentence] of Object.entries(relay)) {
        if (!(key in t)) continue;
        expect(sentence, `${name}.${key}`).toBe(t[key]);
        compared++;
      }
    }
    expect(compared).toBeGreaterThanOrEqual(22);
  });

  it("addresses the visitor with du in German, in the texts and the templates", () => {
    // The user's choice (2026-10-19): du by default, Sie only through `texts` and own fields. The
    // relay's copy of the sentences is held to these by the test above.
    const formal = /\b(Sie|Ihr\w*|Ihnen)\b/;
    const t = i18n("de-DE") as Record<string, string>;
    for (const key of textKeys()) expect(t[key], key).not.toMatch(formal);
    const german = (value: unknown): string[] =>
      typeof value === "string"
        ? []
        : Array.isArray(value)
          ? value.flatMap(german)
          : value && typeof value === "object"
            ? Object.entries(value).flatMap(([k, v]) =>
                k === "de" && typeof v === "string" ? [v] : german(v),
              )
            : [];
    const texts = templateNames.flatMap((name) => german(templateOf(name)));
    expect(texts.length).toBeGreaterThan(20);
    for (const text of texts) expect(text).not.toMatch(formal);
  });

  it("ships the same keys and the same placeholders in every locale", () => {
    const en = i18n("en-US");
    for (const locale of availableLocales()) {
      const t = i18n(locale) as Record<string, string>;
      for (const key of textKeys()) {
        expect(typeof t[key], `${locale}.${key}`).toBe("string");
        const want = [...(en[key] as string).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const got = [...t[key]!.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(got, `${locale}.${key}`).toEqual(want);
      }
    }
  });

  it("falls back from locale to subtag to en-US", () => {
    expect(i18n("de-AT").submit).toBe("Senden");
    expect(i18n("fr").submit).toBe("Send");
    expect(i18n(undefined).submit).toBe("Send");
  });

  it("lays the site's own wording over the plugin's, exact locale on top", () => {
    const t = wording("de-DE", {
      de: { submit: "Abschicken", sent: "Danke!" },
      "de-DE": { submit: "Los" },
      en: { submit: "Go" },
    });
    expect(t.submit).toBe("Los");
    expect(t.sent).toBe("Danke!");
    expect(t.required).toBe("Dieses Feld ist ein Pflichtfeld.");
    expect(wording("en", { en: { submit: "Go", nope: "x" } }).submit).toBe("Go");
  });
});
