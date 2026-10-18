import { formatFingerprint, loadOpenpgp } from "./load";

export interface KeyReport {
  name: string;
  fingerprint: string;
  userIds: string[];
  problem?: string;
}

/**
 * The deep key check the build does once it can load OpenPGP.js: parsable, a public key, not
 * expired, not revoked, able to encrypt. Level 1 only looked at the armor; this is what the
 * visitor's browser will also do, so a key that fails here fails the build instead of the page.
 */
export async function checkKey(name: string, armored: string): Promise<KeyReport> {
  const openpgp = await loadOpenpgp();
  let key;
  try {
    key = await openpgp.readKey({ armoredKey: armored });
  } catch (e) {
    return {
      name,
      fingerprint: "",
      userIds: [],
      problem: `not a readable PGP key (${(e as Error).message})`,
    };
  }
  const report: KeyReport = {
    name,
    fingerprint: formatFingerprint(key.getFingerprint()),
    userIds: key.getUserIDs(),
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
