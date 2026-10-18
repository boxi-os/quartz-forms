import fs from "node:fs";
import path from "node:path";
import type { PgpKeySource } from "../types";

export interface ArmoredKey {
  name: string;
  armored: string;
}

const cache = new Map<string, { mtimeMs: number; armored: string }>();

/**
 * The armored public keys a form encrypts to, read once per file and refreshed when the file
 * changes (so `quartz build --serve` picks up a new key without a restart). Level 1 has already
 * checked that each source exists and looks like a public key block.
 */
export function loadKeys(sources: Record<string, PgpKeySource>, names: string[]): ArmoredKey[] {
  const out: ArmoredKey[] = [];
  for (const name of names) {
    const src = sources[name];
    if (!src) continue;
    if (typeof src.armored === "string" && src.armored.trim()) {
      out.push({ name, armored: src.armored.trim() });
      continue;
    }
    if (typeof src.file !== "string") continue;
    const abs = path.resolve(process.cwd(), src.file);
    try {
      const mtimeMs = fs.statSync(abs).mtimeMs;
      const hit = cache.get(abs);
      if (hit && hit.mtimeMs === mtimeMs) {
        out.push({ name, armored: hit.armored });
        continue;
      }
      const armored = fs.readFileSync(abs, "utf8").trim();
      cache.set(abs, { mtimeMs, armored });
      out.push({ name, armored });
    } catch {
      // Level 1 reported the missing file; a key that vanished during serve is simply left out.
    }
  }
  return out;
}

/** Test helper. */
export function resetKeyCache(): void {
  cache.clear();
}
