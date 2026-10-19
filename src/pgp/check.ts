import { formatFingerprint, loadOpenpgp } from "./load";
import { messageText, type MessageCode, type Params } from "../messages";

export interface KeyReport {
  name: string;
  fingerprint: string;
  userIds: string[];
  /** The day the key expires (`YYYY-MM-DD`); missing when it never does or could not be read. */
  expires?: string;
  /** In English, for the build log. */
  problem?: string;
  /** The same as a message code, for another language. */
  code?: MessageCode;
  params?: Params;
}

function withProblem(report: KeyReport, code: MessageCode, params?: Params): KeyReport {
  return { ...report, problem: messageText(code, params), code, ...(params ? { params } : {}) };
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
    return withProblem({ name, fingerprint: "", userIds: [] }, "pgpUnreadable", {
      error: (e as Error).message,
    });
  }
  const report: KeyReport = {
    name,
    fingerprint: formatFingerprint(key.getFingerprint()),
    userIds: key.getUserIDs(),
  };
  if (key.isPrivate()) return withProblem(report, "pgpPrivate");
  if (await key.isRevoked()) return withProblem(report, "pgpRevoked");
  const expires = await key.getExpirationTime();
  if (expires instanceof Date && Number.isFinite(expires.getTime()))
    report.expires = expires.toISOString().slice(0, 10);
  if (expires instanceof Date && expires.getTime() < Date.now())
    return withProblem(report, "pgpExpired", { date: expires.toISOString().slice(0, 10) });
  try {
    await key.getEncryptionKey();
  } catch {
    return withProblem(report, "pgpNoEncrypt");
  }
  return report;
}
