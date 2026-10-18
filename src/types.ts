/**
 * Options of quartz-forms. This interface is the single source of truth: `quartz.configSchema`
 * in package.json is checked against it member by member (test/config-schema.test.ts), and
 * `defaultOptions` in src/options.ts must satisfy it.
 */
export interface QuartzFormsOptions {
  /** The forms of this site, by id. A page embeds a form by this id. */
  forms: Record<string, FormDefinition>;
  /**
   * Frontmatter key that embeds a form on a page (`form: contact`) or hides the form placed
   * through the layout on this page (`form: false`).
   */
  frontmatterKey: string;
  /** Language tag of the code block that embeds a form in the text (```quartz-form). */
  codeBlockLang: string;
  /**
   * Language of the form placed through the layout: `auto` takes the page language
   * (`frontmatter.lang`, else the site locale), or a language code.
   */
  language: string;
}

/** One form. Filled in with the data model in the next step. */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FormDefinition {}

export interface ResolvedOptions extends QuartzFormsOptions {
  forms: Record<string, FormDefinition>;
}
