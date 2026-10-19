import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
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
  if (expires instanceof Date && Number.isFinite(expires.getTime()))
    report.expires = expires.toISOString().slice(0, 10);
  if (expires instanceof Date && expires.getTime() < Date.now())
    return { ...report, problem: `this key expired on ${expires.toISOString().slice(0, 10)}` };
  try {
    await key.getEncryptionKey();
  } catch {
    return { ...report, problem: "this key cannot encrypt (no encryption subkey)" };
  }
  return report;
}

export { BROWSER_FILES, checkKey, pluginRoot, vendorDir };
//# sourceMappingURL=chunk-MCDXYOMA.js.map
//# sourceMappingURL=chunk-MCDXYOMA.js.map