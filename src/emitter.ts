import type { QuartzEmitterPlugin } from "@quartz-community/types";
import { resolveOptions } from "./options";
import type { QuartzFormsOptions } from "./types";

/**
 * Copies the OpenPGP.js browser bundle into `static/quartz-forms/` when a rendered form
 * encrypts. Filled in with the encryption step.
 */
export const FormsAssets: QuartzEmitterPlugin<Partial<QuartzFormsOptions>> = (userOpts) => {
  const opts = resolveOptions(userOpts);
  return {
    name: "FormsAssets",
    async emit() {
      void opts;
      return [];
    },
  };
};
