import { createRequire } from 'module';
import { loadKeySources } from './chunk-SOQLB6SB.js';
export { FormBox_default as FormBox, Forms, resolveText } from './chunk-SOQLB6SB.js';
import { vendorDir, BROWSER_FILES, checkKey } from './chunk-64PSLSFV.js';
import { resolveOrThrow, logHints, warnOnce } from './chunk-WJ7RKWLZ.js';
export { defaultOptions, resolveOptions, resolveOrThrow, templateNames, templateOf } from './chunk-WJ7RKWLZ.js';
import fs from 'fs/promises';
import path from 'path';

createRequire(import.meta.url);
var OPENPGP_SITE_DIR = "static/quartz-forms/openpgp";
function needsOpenpgp(opts) {
  return Object.values(opts.forms).some(
    (f) => f.encryption.mode !== "off" || f.fields.some((field) => field.type === "pgpKey")
  );
}
function keysInUse(opts) {
  const names = /* @__PURE__ */ new Set();
  for (const form of Object.values(opts.forms))
    if (form.encryption.mode !== "off") for (const k of form.encryption.keys) names.add(k);
  return [...names];
}
async function checkKeys(opts, serve) {
  const names = keysInUse(opts);
  if (names.length === 0) return;
  const problems = [];
  for (const { name, armored, problem } of loadKeySources(opts.keys, names)) {
    if (armored === void 0) {
      problems.push(`keys.${name}: ${problem}`);
      continue;
    }
    const report = await checkKey(name, armored);
    if (report.problem) {
      problems.push(`keys.${name}: ${report.problem}`);
      continue;
    }
    warnOnce(
      `key:${name}:${report.fingerprint}`,
      `key "${name}": ${report.fingerprint}${report.userIds[0] ? ` (${report.userIds[0]})` : ""}`
    );
    if (report.notice)
      warnOnce(`keynotice:${name}:${report.fingerprint}`, `keys.${name}: ${report.notice}`);
  }
  if (problems.length === 0) return;
  const message = `${problems.length} key problem(s):
${problems.map((p) => `  - ${p}`).join("\n")}`;
  if (!serve) throw new Error(`[forms] ${message}`);
  warnOnce(`keyproblems:${problems.join("|")}`, message);
}
var FormsAssets = (userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  async function emitAssets(ctx) {
    if (!needsOpenpgp(opts)) return [];
    await checkKeys(opts, ctx.argv.serve);
    const target = path.join(ctx.argv.output, OPENPGP_SITE_DIR);
    await fs.mkdir(target, { recursive: true });
    const out = [];
    const source = vendorDir();
    for (const file of [...BROWSER_FILES, "LICENSE"]) {
      const from = path.join(source, file);
      const to = path.join(target, file);
      try {
        await fs.copyFile(from, to);
      } catch (e) {
        throw new Error(
          `[forms] cannot copy ${file} from the plugin's dist/vendor/openpgp (${e.message}); the plugin is not built completely`
        );
      }
      out.push(to);
    }
    return out;
  }
  return {
    name: "FormsAssets",
    emit: emitAssets,
    // Content changes during serve do not change the library or the keys; nothing to redo.
    partialEmit: () => null
  };
};

export { FormsAssets };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map