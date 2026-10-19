import type { Element, ElementContent, Root, Text as HastText } from "hast";
import type { Code, Html, Root as MdRoot } from "mdast";
import type { BuildCtx, QuartzTransformerPlugin } from "@quartz-community/types";
import { visit, SKIP } from "unist-util-visit";
import { logHints, resolveOrThrow } from "./options";
import type { QuartzFormsOptions, ResolvedOptions } from "./types";
import { makeContext, pageLanguage, type PageInfo } from "./render/context";
import { renderForm, renderMissing } from "./render/form";
import { warnOnce } from "./util/warn";
import style from "./components/styles/forms.scss";
// @ts-expect-error: bundled to a browser-ready string by the inline-script loader in tsup.config.ts
import script from "./scripts/forms.inline";

/** What the transformer leaves on `file.data` for the component and the emitter. */
export interface FormsFileData {
  /** Ids of the forms rendered into this page, in order of appearance. */
  rendered: string[];
  /** The page said `form: false`: the layout-placed form stays away. */
  hideLayout: boolean;
}

export const FORM_PLACEHOLDER =
  /\{\{\s*form:([A-Za-z0-9-]+)\s*\}\}|%7B%7Bform:([A-Za-z0-9-]+)%7D%7D/i;
const PLACEHOLDER_MARKER = "data-quartz-form";

type FileData = Record<string, unknown> & { frontmatter?: Record<string, unknown>; slug?: string };

function pageInfo(data: FileData): PageInfo {
  const fm = data.frontmatter ?? {};
  return {
    title: typeof fm.title === "string" ? fm.title : String(data.slug ?? ""),
    slug: String(data.slug ?? ""),
  };
}

/** Ids the frontmatter names: a string, a list of strings, or `false` to hide the layout form. */
export function frontmatterForms(
  frontmatter: Record<string, unknown> | undefined,
  key: string,
): { ids: string[]; hideLayout: boolean } {
  const value = frontmatter?.[key];
  if (value === false) return { ids: [], hideLayout: true };
  if (typeof value === "string" && value.trim()) return { ids: [value.trim()], hideLayout: false };
  if (Array.isArray(value))
    return {
      ids: value
        .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        .map((v) => v.trim()),
      hideLayout: false,
    };
  return { ids: [], hideLayout: false };
}

/** One rendering per page: counts occurrences so element ids stay unique on the page. */
class PageForms {
  rendered: string[] = [];
  private counts = new Map<string, number>();

  constructor(
    private opts: ResolvedOptions,
    private ctx: BuildCtx,
    private data: FileData,
    private lang: string,
  ) {}

  render(id: string): Element | null {
    const form = this.opts.forms[id];
    if (!form) {
      const where = String(this.data.filePath ?? this.data.slug ?? "a page");
      const message = `${where} embeds the form "${id}", which options.forms does not have`;
      if (!this.ctx.argv.serve) throw new Error(`[forms] ${message}`);
      warnOnce(`missing:${id}:${where}`, message);
      return renderMissing(id, true);
    }
    const n = (this.counts.get(id) ?? 0) + 1;
    this.counts.set(id, n);
    this.rendered.push(id);
    const context = makeContext(this.opts, form, {
      lang: this.lang,
      idPrefix: n === 1 ? `qf-${id}` : `qf-${id}-${n}`,
      page: pageInfo(this.data),
      serve: this.ctx.argv.serve,
    });
    return renderForm(form, context);
  }
}

/** The marker the markdown stage leaves for the html stage, as raw HTML remark-rehype keeps. */
export function codeBlockMarker(id: string): string {
  return `<div ${PLACEHOLDER_MARKER}="${id.replace(/[^A-Za-z0-9-]/g, "")}"></div>`;
}

/** First non-empty line of the block is the id; nothing else is read yet. */
export function codeBlockId(value: string): string | undefined {
  const line = value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line;
}

function checkRedirects(opts: ResolvedOptions, ctx: BuildCtx): void {
  const slugs = new Set<string>(ctx.allSlugs);
  for (const form of Object.values(opts.forms)) {
    if (form.success.mode !== "redirect" || !form.success.slug) continue;
    const slug = form.success.slug.replace(/^\/+|\/+$/g, "");
    if (slugs.has(slug) || slugs.has(`${slug}/index`)) continue;
    const message = `forms.${form.id}.success.slug: no page "${form.success.slug}" in the site`;
    if (!ctx.argv.serve) throw new Error(`[forms] ${message}`);
    warnOnce(`redirect:${form.id}`, message);
  }
}

export const Forms: QuartzTransformerPlugin<Partial<QuartzFormsOptions>> = (userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);

  return {
    name: "Forms",

    markdownPlugins() {
      return [
        () => (tree: MdRoot) => {
          visit(tree, "code", (node: Code, index, parent) => {
            if (node.lang !== opts.codeBlockLang || !parent || index === undefined) return;
            const id = codeBlockId(node.value);
            if (!id) return;
            const html: Html = { type: "html", value: codeBlockMarker(id) };
            parent.children.splice(index, 1, html);
            return SKIP;
          });
        },
      ];
    },

    htmlPlugins(ctx) {
      checkRedirects(opts, ctx);
      const siteLocale = ctx.cfg.configuration.locale;

      return [
        () => (tree: Root, file) => {
          const data = file.data as FileData;
          const lang = pageLanguage(data.frontmatter, siteLocale);
          const page = new PageForms(opts, ctx, data, lang);

          // 1. Code block markers.
          visit(tree, "element", (node: Element, index, parent) => {
            if (node.tagName !== "div" || !parent || index === undefined) return;
            const id = node.properties[PLACEHOLDER_MARKER] ?? node.properties.dataQuartzForm;
            if (typeof id !== "string") return;
            const form = page.render(id);
            if (form) parent.children.splice(index, 1, form);
            else parent.children.splice(index, 1);
            return SKIP;
          });

          // 2. `{{form:id}}` in the text. A paragraph that holds nothing else is replaced by the
          // form (a form inside <p> is not valid HTML); otherwise the form follows the paragraph.
          // Not inside code: `{{form:contact}}` in backticks or a code block is how a page writes
          // about the placeholder, and it used to be replaced - or stop the build for an id that
          // is only an example (found 2026-10-19 by a page of the measuring site).
          const inCode = new WeakSet<HastText>();
          visit(tree, "element", (node: Element) => {
            if (node.tagName !== "code" && node.tagName !== "pre") return;
            visit(node, "text", (t: HastText) => {
              inCode.add(t);
            });
            return SKIP;
          });
          visit(tree, "text", (node: HastText, index, parent) => {
            if (!parent || index === undefined || inCode.has(node)) return;
            if (!FORM_PLACEHOLDER.test(node.value)) return;
            const match = FORM_PLACEHOLDER.exec(node.value)!;
            const id = match[1] ?? match[2]!;
            const form = page.render(id);
            const before = node.value.slice(0, match.index);
            const after = node.value.slice(match.index + match[0].length);
            const rest: ElementContent[] = [];
            if (before) rest.push({ type: "text", value: before });
            if (after) rest.push({ type: "text", value: after });
            parent.children.splice(index, 1, ...rest);
            if (!form) return index;
            const parentEl = parent as Element;
            const onlyPlaceholder =
              parentEl.type === "element" &&
              parentEl.tagName === "p" &&
              parentEl.children.every((c) => c.type !== "text" || c.value.trim() === "");
            if (onlyPlaceholder) {
              // Replace the paragraph itself; the grandparent is found by a second visit.
              (parentEl as Element & { __replaceWith?: Element }).__replaceWith = form;
            } else {
              (parentEl as Element & { __insertAfter?: Element[] }).__insertAfter = [
                ...((parentEl as Element & { __insertAfter?: Element[] }).__insertAfter ?? []),
                form,
              ];
            }
            return index + rest.length;
          });
          visit(tree, "element", (node: Element, index, parent) => {
            const marked = node as Element & { __replaceWith?: Element; __insertAfter?: Element[] };
            if (!parent || index === undefined) return;
            if (marked.__replaceWith) {
              parent.children.splice(index, 1, marked.__replaceWith);
              return SKIP;
            }
            if (marked.__insertAfter) {
              const forms = marked.__insertAfter;
              delete marked.__insertAfter;
              parent.children.splice(index + 1, 0, ...forms);
              return index + 1 + forms.length;
            }
          });

          // 3. Frontmatter.
          const fm = frontmatterForms(data.frontmatter, opts.frontmatterKey);
          for (const id of fm.ids) {
            const form = page.render(id);
            if (form) tree.children.push(form);
          }

          const existing = data.quartzForms as FormsFileData | undefined;
          data.quartzForms = {
            rendered: [...(existing?.rendered ?? []), ...page.rendered],
            hideLayout: fm.hideLayout || existing?.hideLayout === true,
          } satisfies FormsFileData;
        },
      ];
    },

    externalResources() {
      return {
        css: [{ content: style, inline: true }],
        js: [{ loadTime: "afterDOMReady", contentType: "inline", script }],
      };
    },
  };
};
