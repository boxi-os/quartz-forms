import fs from "node:fs";
import path from "node:path";
import * as openpgp from "openpgp";

export interface TestKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
}

/** A fresh key pair per test run; the public key also lands in test/.tmp/ for file-based cases. */
export async function generatePair(
  args: { expired?: boolean; name?: string; nist?: boolean; v6?: boolean } = {},
): Promise<TestKeyPair> {
  const base = {
    // OpenPGP.js 6's curve25519 is the RFC 9580 X25519, which GnuPG cannot read; `nist` gives a
    // key both read (ECDH on P-256). `v6` writes the key in RFC 9580's version 6, which GnuPG
    // reads with no algorithm.
    ...(args.nist
      ? { type: "ecc" as const, curve: "nistP256" as const }
      : { type: "curve25519" as const }),
    ...(args.v6 ? { config: { v6Keys: true } } : {}),
    userIDs: [{ name: args.name ?? "Form Owner", email: "owner@example.org" }],
    format: "armored" as const,
  };
  // An expired key: created a year ago, valid for one day.
  const { publicKey, privateKey } = args.expired
    ? await openpgp.generateKey({
        ...base,
        date: new Date(Date.now() - 365 * 86400_000),
        keyExpirationTime: 86400,
      })
    : await openpgp.generateKey(base);
  const key = await openpgp.readKey({ armoredKey: publicKey });
  return { publicKey, privateKey, fingerprint: key.getFingerprint() };
}

export function tmpDir(name: string): string {
  const dir = path.join(process.cwd(), "test", ".tmp", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function decrypt(armoredMessage: string, privateKey: string): Promise<string> {
  const message = await openpgp.readMessage({ armoredMessage });
  const key = await openpgp.readPrivateKey({ armoredKey: privateKey });
  const { data } = await openpgp.decrypt({ message, decryptionKeys: key });
  return String(data);
}
