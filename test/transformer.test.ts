import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import { Forms, codeBlockId, frontmatterForms, type FormsFileData } from "../src/transformer";
import type { QuartzFormsOptions } from "../src/types";
import { contact, options } from "./helpers";

function buildCtx(extra: Partial<BuildCtx["argv"]> = {}, slugs: string[] = []): BuildCtx {
  return {
    buildId: "test",
    argv: {
      directory: "content",
      verbose: false,
      output: "public",
      serve: false,
      watch: false,
      port: 8080,
      wsPort: 3001,
      ...extra,
    },
    cfg: { configuration: { locale: "en-US" } },
    allSlugs: slugs as BuildCtx["allSlugs"],
    allFiles: [],
    incremental: false,
  } as BuildCtx;
}

/** Runs the page the way Quartz does: markdown plugins, remark-rehype with raw HTML, html plugins. */
async function transform(
  markdown: string,
  opts: Partial<QuartzFormsOptions>,
  data: Record<string, unknown> = {},
  ctx: BuildCtx = buildCtx(),
) {
  const plugin = Forms(opts);
  const file = new VFile({ value: markdown, path: "content/page.md" });
  Object.assign(file.data, {
    slug: "page",
    filePath: "content/page.md",
    frontmatter: { title: "A page" },
    ...data,
  });
  const processor = unified()
    .use(remarkParse)
    .use(plugin.markdownPlugins!(ctx))
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(plugin.htmlPlugins!(ctx))
    .use(rehypeStringify);
  const out = await processor.process(file);
  return {
    html: String(out),
    data: out.data as Record<string, unknown> & { quartzForms?: FormsFileData },
  };
}

describe("code block", () => {
  it("replaces a ```quartz-form block by the form, at that place in the text", async () => {
    const { html, data } = await transform(
      "# Hi\n\nBefore.\n\n```quartz-form\ncontact\n```\n\nAfter.\n",
      options(),
    );
    expect(html).toMatch(
      /<p>Before\.<\/p>\s*<form class="quartz-form" data-form="contact"[\s\S]*<\/form>\s*<p>After\.<\/p>/,
    );
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("data-quartz-form");
    expect(data.quartzForms).toEqual({ rendered: ["contact"], hideLayout: false });
  });

  it("leaves other code blocks alone and reads the configured language tag", async () => {
    const { html } = await transform(
      "```js\nlet x\n```\n\n```myform\ncontact\n```\n",
      options({ codeBlockLang: "myform" }),
    );
    expect(html).toContain('<pre><code class="language-js">let x\n</code></pre>');
    expect(html).toContain('data-form="contact"');
  });

  it("reads the id from the first non-empty line", () => {
    expect(codeBlockId("\n  contact \n")).toBe("contact");
    expect(codeBlockId("")).toBeUndefined();
  });

  it("numbers the element ids when the same form appears twice", async () => {
    const { html } = await transform(
      "```quartz-form\ncontact\n```\n\n```quartz-form\ncontact\n```\n",
      options(),
    );
    expect(html).toContain('id="qf-contact-name"');
    expect(html).toContain('id="qf-contact-2-name"');
  });
});

describe("placeholder", () => {
  it("leaves a placeholder in inline code and in a code block alone", async () => {
    const { html } = await transform(
      "Write `{{form:example}}` into a page.\n\n```\n{{form:other}}\n```\n",
      options(),
    );
    expect(html).toContain("<code>{{form:example}}</code>");
    expect(html).toContain("{{form:other}}");
    expect(html).not.toContain("quartz-form");
  });

  it("replaces a paragraph that is only {{form:id}} by the form", async () => {
    const { html } = await transform("Text.\n\n{{form:contact}}\n\nMore.\n", options());
    expect(html).toMatch(
      /<p>Text\.<\/p>\s*<form class="quartz-form"[\s\S]*<\/form>\s*<p>More\.<\/p>/,
    );
    expect(html).not.toContain("<p></p>");
    expect(html).not.toContain("{{");
  });

  it("puts the form after a paragraph that holds more than the placeholder", async () => {
    const { html } = await transform("Write to us {{ form:contact }} today.\n", options());
    expect(html).toMatch(/<p>Write to us {2}today\.<\/p>\s*<form class="quartz-form"/);
  });

  it("also reads the percent-encoded form a Markdown link leaves behind", async () => {
    const { html } = await transform("%7B%7Bform:contact%7D%7D\n", options());
    expect(html).toContain('data-form="contact"');
  });
});

describe("frontmatter", () => {
  it("appends the form(s) named in the frontmatter at the end of the page", async () => {
    const two = options({ forms: { contact: contact(), other: contact({ title: "Other" }) } });
    const { html, data } = await transform("Body.\n", two, {
      frontmatter: { title: "T", form: ["contact", "other"] },
    });
    expect(html).toMatch(
      /<p>Body\.<\/p>\s*<form class="quartz-form" data-form="contact"[\s\S]*<form class="quartz-form" data-form="other"/,
    );
    expect(data.quartzForms?.rendered).toEqual(["contact", "other"]);
  });

  it("form: false hides the layout form and renders nothing", async () => {
    const { html, data } = await transform("Body.\n", options(), {
      frontmatter: { title: "T", form: false },
    });
    expect(html).not.toContain("<form");
    expect(data.quartzForms).toEqual({ rendered: [], hideLayout: true });
  });

  it("reads the configured key", () => {
    expect(frontmatterForms({ kontakt: "contact" }, "kontakt")).toEqual({
      ids: ["contact"],
      hideLayout: false,
    });
    expect(frontmatterForms({ form: ["a", 3, " b "] }, "form")).toEqual({
      ids: ["a", "b"],
      hideLayout: false,
    });
    expect(frontmatterForms(undefined, "form")).toEqual({ ids: [], hideLayout: false });
  });
});

describe("language and page", () => {
  it("takes the page language from frontmatter.lang, else the site locale", async () => {
    const de = await transform("{{form:contact}}\n", options(), {
      frontmatter: { title: "T", lang: "de-DE" },
    });
    expect(de.html).toContain('data-lang="de-DE"');
    expect(de.html).toContain(">Senden</button>");
    const en = await transform("{{form:contact}}\n", options());
    expect(en.html).toContain('data-lang="en-US"');
  });

  it("hands the page title and slug to a form with page context", async () => {
    const { html } = await transform(
      "{{form:fb}}\n",
      options({ forms: { fb: { template: "feedback", recipient: "o" } } }),
      {
        slug: "docs/intro",
        frontmatter: { title: "Intro" },
      },
    );
    expect(html).toContain('<input type="hidden" name="page" value="docs/intro">');
    expect(html).toContain("Refers to the page “Intro”.");
  });
});

describe("unknown forms and redirects", () => {
  it("stops the build when a page names a form the options do not have", async () => {
    await expect(transform("{{form:nope}}\n", options())).rejects.toThrow(
      /content\/page\.md embeds the form "nope", which options\.forms does not have/,
    );
  });

  it("shows a hint instead in serve mode", async () => {
    const { html } = await transform("{{form:nope}}\n", options(), {}, buildCtx({ serve: true }));
    expect(html).toContain('class="quartz-form quartz-form--missing"');
    expect(html).toContain("no form <code>nope</code>");
  });

  it("checks redirect slugs against the site's pages", () => {
    const redirect = options({
      forms: { contact: contact({ success: { mode: "redirect", slug: "thanks" } }) },
    });
    expect(() => Forms(redirect).htmlPlugins!(buildCtx({}, ["index", "page"]))).toThrow(
      /forms\.contact\.success\.slug: no page "thanks" in the site/,
    );
    expect(() => Forms(redirect).htmlPlugins!(buildCtx({}, ["thanks"]))).not.toThrow();
    expect(() => Forms(redirect).htmlPlugins!(buildCtx({}, ["thanks/index"]))).not.toThrow();
    expect(() => Forms(redirect).htmlPlugins!(buildCtx({ serve: true }, []))).not.toThrow();
  });

  it("ships the stylesheet and the script as resources", () => {
    const res = Forms(options()).externalResources!(buildCtx())!;
    expect(res.css?.[0]).toMatchObject({ inline: true });
    expect(String(res.css?.[0]?.content)).toContain(".quartz-form");
    expect(res.js?.[0]).toMatchObject({ loadTime: "afterDOMReady", contentType: "inline" });
  });
});
