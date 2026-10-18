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
import style from "./styles/forms.scss";
// @ts-expect-error: bundled to a browser-ready string by the inline-script loader in tsup.config.ts
import script from "../scripts/forms.inline";

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

  FormBox.css = style;
  FormBox.afterDOMLoaded = script;
  return FormBox;
}) satisfies QuartzComponentConstructor<Partial<QuartzFormsOptions>>;
