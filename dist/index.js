import { createRequire } from 'module';
import { resolveOrThrow, logHints, loadKeySources, warnOnce } from './chunk-WD3YRDBY.js';
export { FormBox_default as FormBox, Forms, defaultOptions, resolveOptions, resolveOrThrow, resolveText, templateNames, templateOf } from './chunk-WD3YRDBY.js';
import fs2 from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

createRequire(import.meta.url);
var BROWSER_FILES = [
  "openpgp.min.mjs",
  "argon2id.min.mjs",
  "legacy_ciphers.min.mjs",
  "nacl-fast.min.mjs",
  "noble_curves.min.mjs",
  "noble_hashes.min.mjs",
  "unbzip2-stream.min.mjs"
];
var NODE_FILE = "node/openpgp.min.mjs";
function pluginRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        if (JSON.parse(fs.readFileSync(pkg, "utf8")).name === "quartz-forms") return dir;
      } catch {
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error("[forms] cannot find the plugin root (no package.json named quartz-forms above)");
}
function vendorDir() {
  return path.join(pluginRoot(), "dist", "vendor", "openpgp");
}
var loaded;
function loadOpenpgp() {
  if (loaded) return loaded;
  loaded = (async () => {
    const vendored = path.join(vendorDir(), NODE_FILE);
    if (fs.existsSync(vendored) && !process.env.QUARTZ_FORMS_DEV_OPENPGP) {
      return await import(pathToFileURL(vendored).href);
    }
    const dev = ["open", "pgp"].join("");
    return await import(dev);
  })();
  return loaded;
}
function formatFingerprint(hex) {
  return (hex.toUpperCase().match(/.{1,4}/g) ?? []).join(" ");
}

// src/pgp/check.ts
async function checkKey(name, armored) {
  const openpgp = await loadOpenpgp();
  let key;
  try {
    key = await openpgp.readKey({ armoredKey: armored });
  } catch (e) {
    return {
      name,
      fingerprint: "",
      userIds: [],
      problem: `not a readable PGP key (${e.message})`
    };
  }
  const report = {
    name,
    fingerprint: formatFingerprint(key.getFingerprint()),
    userIds: key.getUserIDs()
  };
  if (key.isPrivate())
    return { ...report, problem: "this is a private key; the site needs the public key" };
  if (await key.isRevoked()) return { ...report, problem: "this key is revoked" };
  const expires = await key.getExpirationTime();
  if (expires instanceof Date && expires.getTime() < Date.now())
    return { ...report, problem: `this key expired on ${expires.toISOString().slice(0, 10)}` };
  try {
    await key.getEncryptionKey();
  } catch {
    return { ...report, problem: "this key cannot encrypt (no encryption subkey)" };
  }
  return report;
}

// src/emitter.ts
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
    await fs2.mkdir(target, { recursive: true });
    const out = [];
    const source = vendorDir();
    for (const file of [...BROWSER_FILES, "LICENSE"]) {
      const from = path.join(source, file);
      const to = path.join(target, file);
      try {
        await fs2.copyFile(from, to);
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