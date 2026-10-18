import fs from "node:fs/promises";
import path from "node:path";
import type { BuildCtx, FilePath, QuartzEmitterPlugin } from "@quartz-community/types";
import { logHints, resolveOrThrow } from "./options";
import type { QuartzFormsOptions, ResolvedOptions } from "./types";
import { loadKeys } from "./render/keys";
import { checkKey } from "./pgp/check";
import { BROWSER_FILES, vendorDir } from "./pgp/load";
import { warnOnce } from "./util/warn";

/** Where the browser finds OpenPGP.js on the site, below the output directory. */
export const OPENPGP_SITE_DIR = "static/quartz-forms/openpgp";

/** Does any form need OpenPGP.js in the browser: to encrypt, or to read the visitor's key? */
export function needsOpenpgp(opts: ResolvedOptions): boolean {
  return Object.values(opts.forms).some(
    (f) => f.encryption.mode !== "off" || f.fields.some((field) => field.type === "pgpKey"),
  );
}

/** The names of the keys any encrypting form uses. */
export function keysInUse(opts: ResolvedOptions): string[] {
  const names = new Set<string>();
  for (const form of Object.values(opts.forms))
    if (form.encryption.mode !== "off") for (const k of form.encryption.keys) names.add(k);
  return [...names];
}

async function checkKeys(opts: ResolvedOptions, serve: boolean): Promise<void> {
  const names = keysInUse(opts);
  if (names.length === 0) return;
  const problems: string[] = [];
  for (const { name, armored } of loadKeys(opts.keys, names)) {
    const report = await checkKey(name, armored);
    if (report.problem) {
      problems.push(`keys.${name}: ${report.problem}`);
      continue;
    }
    warnOnce(
      `key:${name}:${report.fingerprint}`,
      `key "${name}": ${report.fingerprint}${report.userIds[0] ? ` (${report.userIds[0]})` : ""}`,
    );
  }
  if (problems.length === 0) return;
  const message = `${problems.length} key problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`;
  if (!serve) throw new Error(`[forms] ${message}`);
  warnOnce(`keyproblems:${problems.join("|")}`, message);
}

/**
 * Copies the OpenPGP.js browser bundle into the site when a form needs it, and checks the keys
 * the forms encrypt to (the deep check level 1 could not do without the library).
 */
export const FormsAssets: QuartzEmitterPlugin<Partial<QuartzFormsOptions>> = (userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);

  async function emitAssets(ctx: BuildCtx): Promise<FilePath[]> {
    if (!needsOpenpgp(opts)) return [];
    await checkKeys(opts, ctx.argv.serve);
    const target = path.join(ctx.argv.output, OPENPGP_SITE_DIR);
    await fs.mkdir(target, { recursive: true });
    const out: FilePath[] = [];
    const source = vendorDir();
    for (const file of [...BROWSER_FILES, "LICENSE"]) {
      const from = path.join(source, file);
      const to = path.join(target, file);
      try {
        await fs.copyFile(from, to);
      } catch (e) {
        throw new Error(
          `[forms] cannot copy ${file} from the plugin's dist/vendor/openpgp (${(e as Error).message}); ` +
            `the plugin is not built completely`,
        );
      }
      out.push(to as FilePath);
    }
    return out;
  }

  return {
    name: "FormsAssets",
    emit: emitAssets,
    // Content changes during serve do not change the library or the keys; nothing to redo.
    partialEmit: () => null,
  };
};
