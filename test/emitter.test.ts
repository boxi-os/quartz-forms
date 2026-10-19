import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { BuildCtx } from "@quartz-community/types";
import { FormsAssets, OPENPGP_SITE_DIR, keysInUse, needsOpenpgp } from "../src/emitter";
import { resolveOptions } from "../src/options";
import { checkKey } from "../src/pgp/check";
import { BROWSER_FILES, formatFingerprint, pluginRoot } from "../src/pgp/load";
import { loadKeySources, loadKeys, resetKeyCache } from "../src/render/keys";
import { resetWarnings } from "../src/util/warn";
import { contact, options } from "./helpers";
import { generatePair, tmpDir, type TestKeyPair } from "./keys";

let pair: TestKeyPair;
let expired: TestKeyPair;

beforeAll(async () => {
  [pair, expired] = await Promise.all([generatePair(), generatePair({ expired: true })]);
}, 30_000);

afterEach(() => {
  resetWarnings();
  vi.restoreAllMocks();
});

function ctx(output: string, serve = false): BuildCtx {
  return {
    buildId: "t",
    argv: { directory: "content", verbose: false, output, serve, watch: false, port: 1, wsPort: 2 },
    cfg: { configuration: { locale: "en-US" } },
    allSlugs: [],
    allFiles: [],
    incremental: false,
  } as unknown as BuildCtx;
}

describe("key check", () => {
  it("accepts a fresh public key and reports its fingerprint and user id", async () => {
    const report = await checkKey("k", pair.publicKey);
    expect(report.problem).toBeUndefined();
    expect(report.fingerprint).toBe(formatFingerprint(pair.fingerprint));
    expect(report.fingerprint).toMatch(/^([0-9A-F]{4} ){9}[0-9A-F]{4}$/);
    expect(report.userIds[0]).toBe("Form Owner <owner@example.org>");
  });

  it("refuses a private key, an expired key and garbage", async () => {
    expect((await checkKey("k", pair.privateKey)).problem).toMatch(/private key/);
    expect((await checkKey("k", expired.publicKey)).problem).toMatch(
      /expired on \d{4}-\d{2}-\d{2}/,
    );
    expect(
      (
        await checkKey(
          "k",
          "-----BEGIN PGP PUBLIC KEY BLOCK-----\nnope\n-----END PGP PUBLIC KEY BLOCK-----",
        )
      ).problem,
    ).toMatch(/not a readable PGP key/);
  });
});

describe("key sources", () => {
  it("gives the page the public key block alone, never the file around it", () => {
    const sources = {
      inline: { armored: `Comment above\n${pair.publicKey}\ntrailing text\n` },
      withPrivate: { armored: `${pair.publicKey}\n${pair.privateKey}` },
      two: { armored: `${pair.publicKey}\n${pair.publicKey}` },
    };
    const loaded = loadKeySources(sources, ["inline", "withPrivate", "two", "missing"]);
    expect(loaded.map((k) => k.name)).toEqual(["inline", "withPrivate", "two"]);
    expect(loaded[0]?.armored).toBe(pair.publicKey.trim());
    expect(loaded[1]?.problem).toMatch(/private key block/);
    expect(loaded[2]?.problem).toMatch(/2 key blocks/);
    const forPage = loadKeys(sources, ["inline", "withPrivate", "two"]);
    expect(forPage).toEqual([{ name: "inline", armored: pair.publicKey.trim() }]);
    expect(JSON.stringify(forPage)).not.toContain("PRIVATE");
  });
});

describe("FormsAssets", () => {
  it("knows which forms need the library and which keys are in use", () => {
    const none = resolveOptions(options());
    expect(needsOpenpgp(none)).toBe(false);
    const withKeyField = resolveOptions(
      options({
        forms: {
          f: contact({
            fields: [
              { type: "pgpKey", name: "k", label: "K" },
              { type: "textarea", name: "m", label: "M" },
            ],
          }),
        },
      }),
    );
    expect(needsOpenpgp(withKeyField)).toBe(true);
    expect(keysInUse(withKeyField)).toEqual([]);
    const enc = resolveOptions(
      options({
        keys: { a: { armored: pair.publicKey }, b: { armored: pair.publicKey } },
        forms: {
          f: contact({ encryption: { mode: "required", keys: ["a"] } }),
          g: contact({ encryption: { mode: "optional" } }),
        },
      }),
    );
    expect(keysInUse(enc)).toEqual(["a", "b"]);
  });

  it("emits nothing when no form encrypts", async () => {
    const out = tmpDir("emit-none");
    const files = await FormsAssets(options()).emit(ctx(out), [], {
      css: [],
      js: [],
      additionalHead: [],
    });
    expect(files).toEqual([]);
    expect(fs.existsSync(path.join(out, OPENPGP_SITE_DIR))).toBe(false);
  });

  it("copies the browser bundle with its licence and logs the key fingerprint", async () => {
    const out = tmpDir("emit-enc");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const files = (await FormsAssets(
      options({
        keys: { owner: { armored: pair.publicKey } },
        forms: { f: contact({ encryption: { mode: "required" } }) },
      }),
    ).emit(ctx(out), [], { css: [], js: [], additionalHead: [] })) as string[];
    expect(files.map((f) => path.basename(f)).sort()).toEqual([...BROWSER_FILES, "LICENSE"].sort());
    for (const f of files) expect(fs.statSync(f).size).toBeGreaterThan(100);
    const copied = fs.readFileSync(path.join(out, OPENPGP_SITE_DIR, "openpgp.min.mjs"), "utf8");
    const original = fs.readFileSync(
      path.join(pluginRoot(), "node_modules/openpgp/dist/lightweight/openpgp.min.mjs"),
      "utf8",
    );
    expect(copied).toBe(original);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `key "owner": ${formatFingerprint(pair.fingerprint)} (Form Owner <owner@example.org>)`,
      ),
    );
    // the test key is OpenPGP.js 6's curve25519: the build goes on and says what gpg cannot do
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("keys.owner: this key encrypts with X25519 as RFC 9580 writes it"),
    );
  });

  it("stops the build on an expired or private key, but only warns in serve mode", async () => {
    const out = tmpDir("emit-bad");
    const bad = options({
      keys: { owner: { armored: expired.publicKey } },
      forms: { f: contact({ encryption: { mode: "optional" } }) },
    });
    await expect(
      FormsAssets(bad).emit(ctx(out), [], { css: [], js: [], additionalHead: [] }),
    ).rejects.toThrow(/1 key problem\(s\):\n {2}- keys\.owner: this key expired on/);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await FormsAssets(bad).emit(ctx(out, true), [], { css: [], js: [], additionalHead: [] });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("keys.owner: this key expired"));
  });

  it("refuses a key file that gained a private key after the build started (serve)", async () => {
    // Level 1 saw a clean public key; the file changes while `quartz build --serve` runs.
    const dir = tmpDir("emit-privkey");
    const file = path.join(dir, "owner.asc");
    fs.writeFileSync(file, pair.publicKey);
    const rel = path.relative(process.cwd(), file);
    const plugin = FormsAssets(
      options({
        keys: { owner: { file: rel } },
        forms: { f: contact({ encryption: { mode: "required" } }) },
      }),
    );
    resetKeyCache();
    fs.writeFileSync(file, `${pair.publicKey}\n${pair.privateKey}`);
    await expect(
      plugin.emit(ctx(path.join(dir, "out")), [], { css: [], js: [], additionalHead: [] }),
    ).rejects.toThrow(/keys\.owner: holds a private key block/);
  });

  it("reads a key from a file inside the site", async () => {
    const dir = tmpDir("emit-file");
    fs.writeFileSync(path.join(dir, "owner.asc"), pair.publicKey);
    const rel = path.relative(process.cwd(), path.join(dir, "owner.asc"));
    const opts = options({
      keys: { owner: { file: rel } },
      forms: { f: contact({ encryption: { mode: "required" } }) },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const files = (await FormsAssets(opts).emit(ctx(path.join(dir, "out")), [], {
      css: [],
      js: [],
      additionalHead: [],
    })) as string[];
    expect(files.length).toBe(BROWSER_FILES.length + 1);
  });
});
