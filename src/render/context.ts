import type { Translation } from "../i18n";
import { wording } from "../i18n";
import type { ResolvedForm, ResolvedOptions } from "../types";
import { loadKeys, type ArmoredKey } from "./keys";

/** What the page tells the form: used for the page context and the language. */
export interface PageInfo {
  title: string;
  slug: string;
}

export interface RenderContext {
  /** Language the texts are resolved in (a locale or a code, as the page says). */
  lang: string;
  t: Translation;
  /** Prefix of every element id, unique per form on the page. */
  idPrefix: string;
  keys: ArmoredKey[];
  page?: PageInfo;
  /** `quartz build --serve`: render problems visibly instead of failing silently. */
  serve: boolean;
}

/**
 * The page's language: `frontmatter.lang` (quartz-multilanguage fills it in for every page),
 * else the site locale. Same rule as quartz-layout-box.
 */
export function pageLanguage(
  frontmatter: Record<string, unknown> | undefined,
  siteLocale: string | undefined,
): string {
  const fm = frontmatter?.lang;
  if (typeof fm === "string" && fm.trim()) return fm.trim();
  return siteLocale ?? "en-US";
}

export function makeContext(
  opts: ResolvedOptions,
  form: ResolvedForm,
  args: { lang: string; idPrefix: string; page?: PageInfo; serve: boolean },
): RenderContext {
  return {
    lang: args.lang,
    t: wording(args.lang, opts.texts),
    idPrefix: args.idPrefix,
    keys: form.encryption.mode === "off" ? [] : loadKeys(opts.keys, form.encryption.keys),
    page: args.page,
    serve: args.serve,
  };
}
