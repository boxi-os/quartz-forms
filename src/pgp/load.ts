import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The part of OpenPGP.js the build step uses; typed loosely so the vendor copy needs no types. */
export interface OpenpgpKey {
  getFingerprint(): string;
  isPrivate(): boolean;
  getExpirationTime(): Promise<Date | null | typeof Infinity>;
  isRevoked(): Promise<boolean>;
  getEncryptionKey(): Promise<unknown>;
  getUserIDs(): string[];
}

export interface OpenpgpModule {
  readKey(args: { armoredKey: string }): Promise<OpenpgpKey>;
  readPrivateKey(args: { armoredKey: string }): Promise<unknown>;
  readMessage(args: { armoredMessage: string }): Promise<unknown>;
  createMessage(args: { text: string }): Promise<unknown>;
  encrypt(args: { message: unknown; encryptionKeys: unknown; format?: string }): Promise<string>;
  decrypt(args: { message: unknown; decryptionKeys: unknown }): Promise<{ data: string }>;
}

/** Files the build copies from `node_modules/openpgp/dist/lightweight/` for the browser. */
export const BROWSER_FILES = [
  "openpgp.min.mjs",
  "argon2id.min.mjs",
  "legacy_ciphers.min.mjs",
  "nacl-fast.min.mjs",
  "noble_curves.min.mjs",
  "noble_hashes.min.mjs",
  "unbzip2-stream.min.mjs",
] as const;

/** The Node build the emitter uses to check keys, copied next to the browser files. */
export const NODE_FILE = "node/openpgp.min.mjs";

/**
 * The plugin's root: the nearest directory above this module that holds a `package.json`
 * named quartz-forms. In `dist/` that is one level up; in `src/` (tests) the same.
 */
export function pluginRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        if (JSON.parse(fs.readFileSync(pkg, "utf8")).name === "quartz-forms") return dir;
      } catch {
        // not ours
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error("[forms] cannot find the plugin root (no package.json named quartz-forms above)");
}

export function vendorDir(): string {
  return path.join(pluginRoot(), "dist", "vendor", "openpgp");
}

let loaded: Promise<OpenpgpModule> | undefined;

/**
 * OpenPGP.js for the build step. Quartz installs the plugin from `dist/` without `npm install`,
 * so the library comes from the vendor copy; a development checkout before its first build falls
 * back to the dev dependency. The specifier is assembled so the bundler leaves it alone.
 */
export function loadOpenpgp(): Promise<OpenpgpModule> {
  if (loaded) return loaded;
  loaded = (async () => {
    const vendored = path.join(vendorDir(), NODE_FILE);
    // The test run takes the dev dependency: same code, but with the source map Vitest asks for.
    if (fs.existsSync(vendored) && !process.env.QUARTZ_FORMS_DEV_OPENPGP) {
      return (await import(pathToFileURL(vendored).href)) as OpenpgpModule;
    }
    const dev = ["open", "pgp"].join("");
    return (await import(dev)) as OpenpgpModule;
  })();
  return loaded;
}

/** `AB12 CD34 …`: the fingerprint as people compare it. */
export function formatFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/.{1,4}/g) ?? []).join(" ");
}
