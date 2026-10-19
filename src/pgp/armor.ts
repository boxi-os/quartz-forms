/**
 * The armor blocks a text holds: `-----BEGIN PGP <kind>-----` … `-----END PGP <kind>-----`.
 * Non-greedy, so two blocks in a row are two matches, not one.
 */
const BLOCK = /-----BEGIN PGP ([A-Z ]+?)-----[\s\S]*?-----END PGP \1-----/g;
const PUBLIC = "PUBLIC KEY BLOCK";

import { messageText, type MessageCode, type Params } from "../messages";

/** The block, or why there is none: `problem` in English for the log, `code` for another language. */
export type PublicKeyBlock =
  | { armored: string; problem?: undefined; code?: undefined; params?: undefined }
  | { armored?: undefined; problem: string; code: MessageCode; params?: Params };

function refused(code: MessageCode, params?: Params): PublicKeyBlock {
  return { problem: messageText(code, params), code, ...(params ? { params } : {}) };
}

/**
 * The one public key block a key source may hold; only that block goes into the page. Before
 * 0.1.2 a source was accepted when a public key block occurred anywhere in it, and the whole text
 * went into the page: an export with the secret key appended (`gpg --export-secret-keys >>
 * owner.asc`) read as a valid public key and published the private key on every form page
 * (review finding, 2026-10-19). Now anything besides exactly one public key block is a problem,
 * and the page gets the block, never the file.
 */
export function publicKeyBlock(text: string): PublicKeyBlock {
  if (/-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(text)) return refused("armorPrivate");
  const blocks = [...text.matchAll(BLOCK)];
  const begins = text.match(/-----BEGIN PGP /g)?.length ?? 0;
  const first = blocks[0];
  if (!first) return refused("armorNone");
  if (begins > blocks.length) return refused("armorIncomplete");
  const other = blocks.find((b) => b[1] !== PUBLIC);
  if (other) return refused("armorOther", { kind: other[1] });
  if (blocks.length > 1) return refused("armorMany", { count: blocks.length });
  return { armored: first[0] };
}
