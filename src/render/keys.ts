import fs from "node:fs";
import path from "node:path";
import type { PgpKeySource } from "../types";
import { publicKeyBlock, type PublicKeyBlock } from "../pgp/armor";

export interface ArmoredKey {
  name: string;
  armored: string;
}

/** A key source as read: the public key block it holds, or why it holds none. */
export type LoadedKey = { name: string } & PublicKeyBlock;

const cache = new Map<string, { mtimeMs: number } & PublicKeyBlock>();

/**
 * The key sources a form encrypts to, read once per file and refreshed when the file changes (so
 * `quartz build --serve` picks up a new key without a restart). What comes back is the public key
 * block alone, never the file: level 1 refused anything else at build time, but the file may
 * change during serve, so the same extraction runs here and the emitter reports its problems.
 */
export function loadKeySources(
  sources: Record<string, PgpKeySource>,
  names: string[],
): LoadedKey[] {
  const out: LoadedKey[] = [];
  for (const name of names) {
    const src = sources[name];
    if (!src) continue;
    if (typeof src.armored === "string" && src.armored.trim()) {
      out.push({ name, ...publicKeyBlock(src.armored) });
      continue;
    }
    if (typeof src.file !== "string") continue;
    const abs = path.resolve(process.cwd(), src.file);
    try {
      const mtimeMs = fs.statSync(abs).mtimeMs;
      const hit = cache.get(abs);
      if (hit && hit.mtimeMs === mtimeMs) {
        const { mtimeMs: _, ...block } = hit;
        out.push({ name, ...block });
        continue;
      }
      const block = publicKeyBlock(fs.readFileSync(abs, "utf8"));
      cache.set(abs, { mtimeMs, ...block });
      out.push({ name, ...block });
    } catch {
      // Level 1 reported the missing file; a key that vanished during serve is simply left out.
    }
  }
  return out;
}

/** The armored public keys a form encrypts to; a source without a usable block is left out. */
export function loadKeys(sources: Record<string, PgpKeySource>, names: string[]): ArmoredKey[] {
  const out: ArmoredKey[] = [];
  for (const key of loadKeySources(sources, names))
    if (key.armored !== undefined) out.push({ name: key.name, armored: key.armored });
  return out;
}

/** Test helper. */
export function resetKeyCache(): void {
  cache.clear();
}
