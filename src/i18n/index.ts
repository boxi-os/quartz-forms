import enUS from "./locales/en-US";
import deDE from "./locales/de-DE";

export type Translation = typeof enUS;
export type TextKey = keyof Translation;

const locales: Record<string, Translation> = {
  "en-US": enUS,
  "de-DE": deDE,
};

/** Looks up by full locale, then by primary language subtag, then falls back to en-US. */
export function i18n(locale: string | undefined): Translation {
  if (!locale) return enUS;
  const exact = locales[locale];
  if (exact) return exact;
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  for (const [key, value] of Object.entries(locales)) {
    if (key.toLowerCase().split("-")[0] === primary) return value;
  }
  return enUS;
}

/**
 * The plugin's wording for a language with the site's own wording (`options.texts`) laid over
 * it: the locale's entry first, then the entry for the primary subtag.
 */
export function wording(
  locale: string | undefined,
  texts: Record<string, Record<string, string>>,
): Translation {
  const base = { ...i18n(locale) };
  if (!locale) return base;
  const primary = locale.toLowerCase().split(/[-_]/)[0]!;
  const layers = Object.entries(texts)
    .filter(([k]) => k.toLowerCase().split(/[-_]/)[0] === primary)
    // the primary-subtag entry below, the exact locale on top
    .sort(
      ([a], [b]) =>
        Number(a.toLowerCase() === locale.toLowerCase()) -
        Number(b.toLowerCase() === locale.toLowerCase()),
    );
  for (const [, entries] of layers)
    for (const [key, value] of Object.entries(entries))
      if (key in base && typeof value === "string") (base as Record<string, string>)[key] = value;
  return base;
}

export function availableLocales(): string[] {
  return Object.keys(locales);
}

export function textKeys(): TextKey[] {
  return Object.keys(enUS) as TextKey[];
}
