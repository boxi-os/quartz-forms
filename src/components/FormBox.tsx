import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import { htmlToJsx } from "@quartz-community/utils/jsx";
import { logHints, resolveOrThrow } from "../options";
import type { QuartzFormsOptions } from "../types";
import { makeContext, pageLanguage } from "../render/context";
import { renderForm } from "../render/form";
import type { FormsFileData } from "../transformer";
import { frontmatterForms } from "../transformer";

/**
 * The form placed through the layout block of the plugin entry (`options.layoutForm`). A page
 * hides it with `form: false`. Language: `options.language`, `auto` = the page's.
 */
export default ((userOpts?: Partial<QuartzFormsOptions>) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  const form = opts.layoutForm ? opts.forms[opts.layoutForm] : undefined;

  const FormBox: QuartzComponent = (props: QuartzComponentProps) => {
    if (!form) return null;
    const data = props.fileData as Record<string, unknown> & {
      frontmatter?: Record<string, unknown>;
      slug?: string;
      quartzForms?: FormsFileData;
    };
    if (data.quartzForms?.hideLayout) return null;
    if (frontmatterForms(data.frontmatter, opts.frontmatterKey).hideLayout) return null;

    const lang =
      opts.language === "auto" ? pageLanguage(data.frontmatter, props.cfg.locale) : opts.language;
    const fm = data.frontmatter ?? {};
    const ctx = makeContext(opts, form, {
      lang,
      idPrefix: `qf-${form.id}-layout`,
      page: {
        title: typeof fm.title === "string" ? fm.title : String(data.slug ?? ""),
        slug: String(data.slug ?? ""),
      },
      serve: Boolean((props.ctx as { argv?: { serve?: boolean } } | undefined)?.argv?.serve),
    });
    const tree = renderForm(form, ctx);
    return (
      <div class={["quartz-form-box", props.displayClass].filter(Boolean).join(" ")}>
        {htmlToJsx(tree)}
      </div>
    );
  };

  // No css and no afterDOMLoaded of its own: the transformer brings stylesheet and script to every
  // page, and Quartz instantiates every category of an enabled plugin, so it runs wherever this
  // box can. Both copies went out on every page, the component's even without a layout form
  // (fiftieth review, side list: 6 KB of CSS and 20 KB of script twice).
  return FormBox;
}) satisfies QuartzComponentConstructor<Partial<QuartzFormsOptions>>;
