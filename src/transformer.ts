import type { QuartzTransformerPlugin } from "@quartz-community/types";
import { resolveOrThrow, logHints } from "./options";
import type { QuartzFormsOptions } from "./types";

/**
 * Embeds forms into pages: the ```quartz-form code block (mdast), the `{{form:id}}` placeholder
 * and the frontmatter key (hast). Filled in with the data model.
 */
export const Forms: QuartzTransformerPlugin<Partial<QuartzFormsOptions>> = (userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  return {
    name: "Forms",
    markdownPlugins() {
      void opts;
      return [];
    },
    htmlPlugins() {
      return [];
    },
  };
};
