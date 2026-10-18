import type { Text } from "./types";

/**
 * Picks the wording for a language: exact code, then primary subtag, then the first value.
 * `lang` may be a locale (`de-DE`) or a code (`de`); record keys may be either, too.
 */
export function resolveText(text: Text | undefined, lang: string): string | undefined {
  if (text === undefined) return undefined;
  if (typeof text === "string") return text;
  const entries = Object.entries(text);
  if (entries.length === 0) return undefined;
  const want = lang.toLowerCase();
  const exact = entries.find(([k]) => k.toLowerCase() === want);
  if (exact) return exact[1];
  const primary = want.split(/[-_]/)[0];
  const sub = entries.find(([k]) => k.toLowerCase().split(/[-_]/)[0] === primary);
  if (sub) return sub[1];
  return entries[0]![1];
}

/** The language codes a record names, lower-cased; a plain string names none. */
export function textLanguages(text: Text | undefined): string[] {
  if (text === undefined || typeof text === "string") return [];
  return Object.keys(text).map((k) => k.toLowerCase());
}

/** `{name}` placeholders in a wording, replaced from `values`; unknown ones stay as written. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in values ? String(values[key]) : m,
  );
}
