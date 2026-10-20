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
  /** What the owner should know about a key that passes, in English; it does not stop the build. */
  notice?: string;
  noticeCode?: MessageCode;
  noticeParams?: Params;
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
  let algorithm: string;
  try {
    algorithm = (await key.getEncryptionKey()).getAlgorithmInfo().algorithm;
  } catch {
    return withProblem(report, "pgpNoEncrypt");
  }
  // Not a reason to stop the build, a reason to say it: the browser encrypts to these keys, but
  // GnuPG cannot decrypt (2.5.22, measured). A key of version 6 (RFC 9580) it refuses whatever
  // the algorithm, "Invalid keyring" for RSA and P-256 too (fifty-first review, N2); the version
  // is said first because it is the reason that stays when the algorithm is changed.
  if (key.keyPacket.version === 6) {
    return {
      ...report,
      notice: messageText("pgpVersion6"),
      noticeCode: "pgpVersion6",
    };
  }
  // X25519 and X448 under the ids RFC 9580 gave them (25, 26), as OpenPGP.js 6 writes them for
  // `curve25519` and `curve448`, in a version 4 key too (fiftieth review, M2).
  if (algorithm === "x25519" || algorithm === "x448") {
    const noticeParams = { algorithm: algorithm.toUpperCase() };
    return {
      ...report,
      notice: messageText("pgpNewAlgorithm", noticeParams),
      noticeCode: "pgpNewAlgorithm",
      noticeParams,
    };
  }
  return report;
}
