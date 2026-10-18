import enUS from "./locales/en-US";
import deDE from "./locales/de-DE";

export type Translation = typeof enUS;

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

export function availableLocales(): string[] {
  return Object.keys(locales);
}
