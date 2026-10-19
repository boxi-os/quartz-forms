/**
 * The armor blocks a text holds: `-----BEGIN PGP <kind>-----` … `-----END PGP <kind>-----`.
 * Non-greedy, so two blocks in a row are two matches, not one.
 */
const BLOCK = /-----BEGIN PGP ([A-Z ]+?)-----[\s\S]*?-----END PGP \1-----/g;
const PUBLIC = "PUBLIC KEY BLOCK";

export type PublicKeyBlock =
  { armored: string; problem?: undefined } | { armored?: undefined; problem: string };

/**
 * The one public key block a key source may hold; only that block goes into the page. Before
 * 0.1.2 a source was accepted when a public key block occurred anywhere in it, and the whole text
 * went into the page: an export with the secret key appended (`gpg --export-secret-keys >>
 * owner.asc`) read as a valid public key and published the private key on every form page
 * (review finding, 2026-10-19). Now anything besides exactly one public key block is a problem,
 * and the page gets the block, never the file.
 */
export function publicKeyBlock(text: string): PublicKeyBlock {
  if (/-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(text))
    return {
      problem: "holds a private key block; export only the public key (gpg --export --armor)",
    };
  const blocks = [...text.matchAll(BLOCK)];
  const begins = text.match(/-----BEGIN PGP /g)?.length ?? 0;
  const first = blocks[0];
  if (!first) return { problem: "not an armored PGP public key block" };
  if (begins > blocks.length) return { problem: "holds an incomplete armor block" };
  const other = blocks.find((b) => b[1] !== PUBLIC);
  if (other) return { problem: `holds a PGP ${other[1]} besides the public key` };
  if (blocks.length > 1)
    return { problem: `holds ${blocks.length} key blocks; one public key per source` };
  return { armored: first[0] };
}
