import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import { resolveOrThrow, logHints } from "../options";
import type { QuartzFormsOptions } from "../types";
import style from "./styles/forms.scss";
// @ts-expect-error: bundled to a browser-ready string by the inline-script loader in tsup.config.ts
import script from "../scripts/forms.inline";

/**
 * The form placed through the layout (`layout.position`). Rendering is filled in with the
 * data model; this constructor already wires the stylesheet and the browser script.
 */
export default ((userOpts?: Partial<QuartzFormsOptions>) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);

  const FormBox: QuartzComponent = (_props: QuartzComponentProps) => {
    if (Object.keys(opts.forms).length === 0) return null;
    return null;
  };

  FormBox.css = style;
  FormBox.afterDOMLoaded = script;
  return FormBox;
}) satisfies QuartzComponentConstructor<Partial<QuartzFormsOptions>>;
