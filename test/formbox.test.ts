import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import type { QuartzComponentProps } from "@quartz-community/types";
import FormBox from "../src/components/FormBox";
import { contact, options } from "./helpers";

function props(fileData: Record<string, unknown>, extra: Partial<QuartzComponentProps> = {}) {
  return {
    ctx: { argv: { serve: false } },
    externalResources: { css: [], js: [], additionalHead: [] },
    fileData: { slug: "docs/page", frontmatter: { title: "Page" }, ...fileData },
    cfg: { locale: "en-US" },
    children: null,
    tree: null,
    allFiles: [],
    ...extra,
  } as unknown as QuartzComponentProps;
}

describe("FormBox", () => {
  it("renders nothing without layoutForm", () => {
    const C = FormBox(options());
    expect(C(props({}))).toBeNull();
  });

  it("renders the layout form with the page language, leaving css and script to the transformer", () => {
    const C = FormBox(options({ layoutForm: "contact" }));
    const html = render(C(props({ frontmatter: { title: "Seite", lang: "de" } })) as never);
    expect(html).toContain('<div class="quartz-form-box">');
    expect(html).toContain('data-form="contact"');
    expect(html).toContain('id="qf-contact-layout-name"');
    expect(html).toContain(">Senden</button>");
    expect(html).toContain(
      '<script type="application/json" class="quartz-form-config">{"id":"contact"',
    );
    expect(html).not.toContain("&quot;id&quot;");
    expect(C.css).toBeUndefined();
    expect(C.afterDOMLoaded).toBeUndefined();
  });

  it("follows a fixed language option", () => {
    const C = FormBox(options({ layoutForm: "contact", language: "de-DE" }));
    const html = render(C(props({ frontmatter: { title: "Page", lang: "en" } })) as never);
    expect(html).toContain(">Senden</button>");
  });

  it("stays away when the page says form: false, through frontmatter or the transformer's data", () => {
    const C = FormBox(options({ layoutForm: "contact" }));
    expect(C(props({ frontmatter: { title: "P", form: false } }))).toBeNull();
    expect(C(props({ quartzForms: { rendered: [], hideLayout: true } }))).toBeNull();
    expect(C(props({ quartzForms: { rendered: ["contact"], hideLayout: false } }))).not.toBeNull();
  });

  it("refuses a layoutForm the options do not have", () => {
    expect(() => FormBox(options({ layoutForm: "nope", forms: { contact: contact() } }))).toThrow(
      /layoutForm: no form "nope"/,
    );
  });

  it("carries displayClass to the wrapper", () => {
    const C = FormBox(options({ layoutForm: "contact" }));
    const html = render(C(props({}, { displayClass: "desktop-only" })) as never);
    expect(html).toContain('<div class="quartz-form-box desktop-only">');
  });
});
