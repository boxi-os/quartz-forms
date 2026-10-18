import type { QuartzFormsOptions, ResolvedOptions } from "./types";

/** Defaults live only here; the manifest's `defaultOptions` mirrors them for editors. */
export const defaultOptions: QuartzFormsOptions = {
  forms: {},
  frontmatterKey: "form",
  codeBlockLang: "quartz-form",
  language: "auto",
};

/**
 * Quartz passes the raw YAML `options` of the entry; manifest defaults are not merged in.
 * Every factory of this plugin runs the raw options through here.
 */
export function resolveOptions(userOpts?: Partial<QuartzFormsOptions>): ResolvedOptions {
  const opts = { ...defaultOptions, ...(userOpts ?? {}) };
  return { ...opts, forms: opts.forms ?? {} };
}
