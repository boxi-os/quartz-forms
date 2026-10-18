import { describe, expect, it } from "vitest";
import { interpolate, resolveText, textLanguages } from "../src/text";
import { availableLocales, i18n, textKeys, wording } from "../src/i18n";

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
