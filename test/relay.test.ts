// The PHP relay under `php -S`: every refusal, the accepted paths with the mail in an outbox
// file, the plain-form path of a browser without JavaScript, and the rate limit. The forms come
// from a quartz.config.yaml through scripts/relay-config.mjs, so the relay checks what the build
// resolved. Without a `php` on the PATH the suite is skipped and says so; "could not check" is
// not "all good".
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import YAML from "yaml";
import { tmpDir } from "./keys";

const root = path.resolve(__dirname, "..");
import { conditionCases, conditionFields, parityCases, parityFields } from "./parity-cases";

const ORIGIN = "https://site.test";
const ARMOR = "-----BEGIN PGP MESSAGE-----\n\nabc\n-----END PGP MESSAGE-----";

function phpAvailable(): boolean {
  try {
    execFileSync("php", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const php = phpAvailable();
if (!php) console.warn("relay tests not run: no `php` on the PATH (the relay is not checked)");

const siteOptions = {
  transport: { kind: "relay", url: "http://localhost:8080/send.php" },
  keys: { owner: { file: "public.asc" } },
  // One second, so the suite waits once for the stamp it fetched to come of age.
  spam: { minSeconds: 1 },
  forms: {
    contact: {
      recipient: "owner",
      subject: { de: "Kontakt", en: "Contact" },
      spam: { pow: true, powDifficulty: 8 },
      fields: [
        { type: "text", name: "name", label: "Name", autocomplete: "name" },
        { type: "email", name: "email", label: "E-Mail", required: true },
        {
          type: "select",
          name: "topic",
          label: "Topic",
          options: [
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ],
        },
        { type: "textarea", name: "message", label: "Message", required: true, maxLength: 500 },
        { type: "consent", name: "consent", text: "Agreed" },
      ],
      success: { mode: "redirect", slug: "danke" },
    },
    feedback: { template: "feedback", recipient: "owner" },
    survey: { template: "survey", recipient: "owner", spam: { noScript: false } },
    enc: {
      recipient: "owner",
      encryption: { mode: "required" },
      fields: [{ type: "text", name: "a", label: "A" }],
    },
    opt: {
      recipient: "owner",
      encryption: { mode: "optional" },
      fields: [{ type: "text", name: "a", label: "A" }],
    },
    multi: {
      recipient: "owner",
      fields: [
        {
          type: "checkboxes",
          name: "topics",
          label: "Topics",
          required: true,
          options: [
            { value: "news", label: "News" },
            { value: "guides", label: "Guides" },
          ],
        },
        { type: "text", name: "note", label: "Note" },
      ],
    },
    patterns: {
      recipient: "owner",
      fields: [
        { type: "text", name: "site", label: "Site", pattern: "https?:\\/\\/.+" },
        // Valid in JavaScript (the build and the browser), unreadable for PCRE: a property name
        // only JavaScript knows. The build refuses the syntax no PCRE2 reads, such as the
        // `(?<=a+)b` this field used to carry (second review, finding 3, 2026-10-19).
        { type: "text", name: "lb", label: "LB", pattern: "\\p{Assigned}+" },
      ],
    },
    captcha: {
      recipient: "owner",
      spam: { captcha: "turnstile", captchaSiteKey: "site-key" },
      fields: [{ type: "text", name: "a", label: "A" }],
    },
    limited: {
      recipient: "owner",
      spam: { rateLimitPerHour: 3 },
      fields: [{ type: "text", name: "x", label: "X" }],
    },
    gated: {
      recipient: "owner",
      spam: { pow: true, powDifficulty: 8, rateLimitPerHour: 2 },
      fields: [{ type: "text", name: "g", label: "G" }],
    },
    unsent: {
      recipient: "owner",
      spam: { pow: true, powDifficulty: 8, rateLimitPerHour: 2 },
      fields: [{ type: "text", name: "u", label: "U" }],
    },
    small: {
      recipient: "owner",
      spam: { maxBytes: 300 },
      fields: [{ type: "text", name: "s", label: "S" }],
    },
    links: {
      recipient: "owner",
      fields: [
        { type: "email", name: "mail", label: "Mail" },
        { type: "url", name: "site", label: "Site" },
      ],
    },
    friend: {
      recipient: "owner",
      fields: [
        { type: "email", name: "friend", label: "Friend's e-mail" },
        { type: "email", name: "own", label: "Your e-mail", autocomplete: "email" },
      ],
    },
    tagged: {
      recipient: "owner",
      fields: [
        { type: "hidden", name: "src", value: "web" },
        { type: "text", name: "note", label: "Note" },
        { type: "pgpKey", name: "key", label: "Key" },
      ],
    },
    encpage: {
      recipient: "owner",
      encryption: { mode: "required" },
      pageContext: true,
      fields: [{ type: "text", name: "a", label: "A" }],
    },
    anoncap: {
      recipient: "owner",
      anonymous: true,
      spam: { captcha: "turnstile", captchaSiteKey: "k" },
      fields: [{ type: "text", name: "a", label: "A" }],
    },
    parity: { recipient: "owner", fields: parityFields },
    cond: { recipient: "owner", spam: { rateLimitPerHour: 0 }, fields: conditionFields },
  },
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

let dir = "";
let base = "";
const relaySecret = `test-secret-${crypto.randomBytes(16).toString("hex")}`;
/** The hand-written config.php; PHP reads it per request, so a test may rewrite it. */
function writeConfig(
  options: { extra?: string; origins?: string[]; secret?: string | null; verifyUrl?: string } = {},
): void {
  const extra = options.extra ?? `'captchaSecret' => 'cap-secret',`;
  const origins = options.origins ?? [ORIGIN];
  const secret = options.secret === undefined ? relaySecret : options.secret;
  const verifyUrl = options.verifyUrl ?? `${base}/verify.php`;
  fs.writeFileSync(
    path.join(dir, "config.php"),
    `<?php
declare(strict_types=1);
$generated = require __DIR__ . '/config.generated.php';
return $generated + [
    ${secret === null ? "" : `'secret' => '${secret}',`}
    'allowedOrigins' => ${JSON.stringify(origins).replace(/"/g, "'")},
    'from' => 'forms@relay.test',
    'subjectPrefix' => '',
    'mailer' => ['file' => __DIR__ . '/outbox.txt'],
    'recipients' => ['owner' => 'owner@relay.test'],
    'counterDir' => __DIR__ . '/counters',
    'captchaVerifyUrls' => ['turnstile' => '${verifyUrl}'],
    ${extra}
];
`,
  );
}
let server: ChildProcess | undefined;
/**
 * A relay on this suite's directory. More than one worker: the captcha check calls verify.php
 * on this same server. No opcache: the captcha test rewrites config.php three times within
 * milliseconds, and opcache rechecks a cached file's time stamp only every revalidate_freq
 * seconds (2 by default), so the relay read the previous config (CI run 39215450865 and one
 * local run, 2026-10-19). Measured with an include aged past file_update_protection: stale with
 * opcache on, fresh with it off. `ini` adds `-d` settings, e.g. a hoster's allow_url_fopen=0.
 *
 * In a process group of its own, which stopRelay ends as a whole: the workers are php's children,
 * and a kill of the server alone left all four running, 20 per run of the suite, 1452 after a day
 * of runs (noticed beside the third review, 2026-10-19; measured: 5 processes, 4 after kill(),
 * 0 after a kill of the group).
 */
function spawnRelay(port: number, ini: string[] = []): ChildProcess {
  const log = fs.openSync(path.join(dir, "php.log"), "a");
  return spawn(
    "php",
    [
      "-S",
      `127.0.0.1:${port}`,
      "-t",
      dir,
      "-d",
      "opcache.enable=0",
      ...ini.flatMap((i) => ["-d", i]),
    ],
    {
      stdio: ["ignore", log, log],
      env: { ...process.env, PHP_CLI_SERVER_WORKERS: "4" },
      detached: true,
    },
  );
}
function stopRelay(proc: ChildProcess | undefined): void {
  if (proc?.pid === undefined) return;
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill(); // the group is gone already, or there is none to signal
  }
}
async function untilUp(at: string): Promise<Response> {
  const until = Date.now() + 10_000;
  for (;;) {
    try {
      return await fetch(`${at}/send.php?challenge=contact`, { headers: { Origin: ORIGIN } });
    } catch {
      if (Date.now() > until) throw new Error(`php -S did not answer on ${at}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
let challenge = "";
/**
 * The relay's signed stamps from the start of the suite, one per fixture form: old enough for
 * every form's minSeconds. A stamp is bound to its form (second review, finding 7).
 */
const stamps: Record<string, string> = {};

beforeAll(async () => {
  if (!php) return;
  const site = tmpDir("relay-php-site");
  fs.copyFileSync(path.join(root, "test", "fixtures", "public.asc"), path.join(site, "public.asc"));
  fs.writeFileSync(
    path.join(site, "quartz.config.yaml"),
    YAML.stringify({
      configuration: { pageTitle: "Test", locale: "de-DE", baseUrl: "example.org/site" },
      plugins: [{ source: "github:boxi-os/quartz-forms", enabled: true, options: siteOptions }],
    }),
  );
  dir = tmpDir("relay-php");
  // The generator compiles every pattern with this php and would stop at `patterns.lb`; the
  // flag is what an owner passes whose host reads more than this machine, and the relay must
  // refuse closed when the host's PCRE cannot read a pattern after all.
  execFileSync(
    "node",
    [path.join(root, "scripts", "relay-config.mjs"), site, "--out", dir, "--skip-pattern-check"],
    { cwd: root, stdio: "ignore" },
  );
  // The copy's clock moves with an `X-Shift` header (seconds), so a test can cross an hour
  // boundary; the one line that reads the clock is qf_now(), and the copy differs in nothing
  // else. A send.php without that line is not the relay this suite knows.
  const sendPhp = fs.readFileSync(path.join(root, "relay", "php", "send.php"), "utf8");
  const clock = "function qf_now(): int\n{\n    return time();\n}";
  if (sendPhp.split(clock).length !== 2)
    throw new Error("send.php: qf_now() not found as expected");
  fs.writeFileSync(
    path.join(dir, "send.php"),
    sendPhp.replace(
      clock,
      "function qf_now(): int\n{\n    return time() + (int) ($_SERVER['HTTP_X_SHIFT'] ?? 0);\n}",
    ),
  );
  // The generator copies counters/ with its .htaccess; the suite starts without them, so the
  // case below sees the relay write the .htaccess itself.
  fs.rmSync(path.join(dir, "counters"), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "counters"));
  // Stands in for the provider's siteverify endpoint: success for one secret and one token.
  fs.writeFileSync(
    path.join(dir, "verify.php"),
    `<?php
header('Content-Type: application/json');
file_put_contents(__DIR__ . '/verify.log', "x", FILE_APPEND);
echo json_encode(['success' => ($_POST['secret'] ?? '') === 'cap-secret' && ($_POST['response'] ?? '') === 'good']);
`,
  );
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  writeConfig();
  fs.writeFileSync(path.join(dir, "php.log"), "");
  server = spawnRelay(port);
  await untilUp(base);
  for (const form of Object.keys(siteOptions.forms)) {
    const r = await fetch(`${base}/send.php?challenge=${form}`, { headers: { Origin: ORIGIN } });
    stamps[form] = ((await r.json()) as { stamp?: string }).stamp ?? "";
  }
  // The stamp has to be minSeconds (one second) old before the relay accepts a submission.
  await new Promise((r) => setTimeout(r, 1100));
}, 30_000);

afterAll(() => {
  stopRelay(server);
});

interface Answer {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
  headers: Headers;
}
const errorsOf = (r: Answer) => (r.json?.errors ?? []) as { field: string; code: string }[];

async function post(
  body: unknown,
  opts: {
    origin?: string | null;
    headers?: Record<string, string>;
    raw?: boolean;
    at?: string;
  } = {},
): Promise<Answer> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
  const res = await fetch(`${opts.at ?? base}/send.php`, {
    method: "POST",
    headers,
    body: opts.raw ? (body as string) : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // an HTML answer
  }
  return { status: res.status, json, text, headers: res.headers };
}
/** The plain-form path: what a browser without JavaScript sends. */
function plain(fields: Record<string, string>, accept = "text/html,application/xhtml+xml") {
  return post(new URLSearchParams(fields).toString(), {
    raw: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: accept },
  });
}
async function get(
  query: string,
  origin: string | null = ORIGIN,
  headers: Record<string, string> = {},
): Promise<Answer> {
  const res = await fetch(`${base}/send.php?${query}`, {
    headers: origin ? { Origin: origin, ...headers } : headers,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, json, text, headers: res.headers };
}
const ts = (form: string) => stamps[form] ?? "";
const env = (
  form: string,
  fields: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  form,
  lang: "de-DE",
  ts: ts(form),
  encrypted: false,
  fields,
  ...extra,
});
/**
 * The used proofs the relay keeps, as paths under counters/. Files in the directory itself count
 * too, so the suite measures where the relay puts them instead of assuming it.
 */
function spentFiles(): string[] {
  const counters = path.join(dir, "counters");
  return fs.readdirSync(counters).flatMap((entry) => {
    const full = path.join(counters, entry);
    if (fs.statSync(full).isDirectory())
      return fs
        .readdirSync(full)
        .filter((f) => f.endsWith(".spent"))
        .map((f) => `${entry}/${f}`);
    return entry.endsWith(".spent") ? [entry] : [];
  });
}
function mails(): string[] {
  const file = path.join(dir, "outbox.txt");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\r\n----\r\n")
    .filter((m) => m.trim() !== "");
}
/** The last mail: headers and the body as the relay wrote them. */
/** The body as the recipient's mail program shows it: transfer encoding undone. */
function qpDecode(raw: string): string {
  const bytes: number[] = [];
  const joined = raw.replace(/=\r?\n/g, "");
  for (let i = 0; i < joined.length; i++) {
    const c = joined[i]!;
    if (c === "=" && /^[0-9A-F]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(c.charCodeAt(0));
  }
  return Buffer.from(bytes).toString("utf8");
}
function lastMail(): { headers: string; body: string; raw: string } {
  const m = mails().at(-1) ?? "";
  const i = m.indexOf("\r\n\r\n");
  const headers = m.slice(0, i);
  const raw = m.slice(i + 4);
  const body = /Content-Transfer-Encoding: quoted-printable/i.test(headers) ? qpDecode(raw) : raw;
  return { headers, body, raw };
}
/**
 * Solves like the browser: a random prefix, then counting from 0. The suite used to start at a
 * random number while the browser counted from 0, so it never saw that every visitor of an hour
 * found the same nonce (second review, finding 1, 2026-10-19).
 */
function solve(
  ch: string,
  difficulty: number,
  prefix = crypto.randomBytes(9).toString("base64url") + "-",
): { challenge: string; nonce: string } {
  const bits = (buf: Buffer) => {
    let n = 0;
    for (const b of buf) {
      if (b === 0) {
        n += 8;
        continue;
      }
      n += Math.clz32(b) - 24;
      break;
    }
    return n;
  };
  for (let i = 0; ; i++) {
    const nonce = prefix + i;
    if (bits(crypto.createHash("sha256").update(`${ch}:${nonce}`).digest()) >= difficulty)
      return { challenge: ch, nonce };
  }
}
const contactFields = {
  name: "Ada Lovelace",
  email: "ada@example.org",
  topic: "b",
  message: "Hello",
  consent: "yes",
};

describe.skipIf(!php)("relay: challenge and CORS", () => {
  it("answers a challenge for a proof-of-work form, with the allowed origin in CORS", async () => {
    const r = await get("challenge=contact");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ pow: true, difficulty: 8 });
    expect(r.json?.challenge).toMatch(/^[0-9a-f]{64}$/);
    // The stamp of the time the page was opened, signed by the relay: `issued.signature`.
    expect(r.json?.stamp).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(r.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(r.headers.has("x-powered-by")).toBe(false);
    challenge = r.json?.challenge as string;
  });
  it("says pow: false for a form without, 404 for an unknown form, 403 for a foreign origin", async () => {
    const feedback = await get("challenge=feedback");
    expect(feedback.json).toMatchObject({ pow: false });
    expect(feedback.json?.stamp).toMatch(/^\d+\.[0-9a-f]{64}$/);
    const unknown = await get("challenge=nope");
    expect([unknown.status, unknown.json?.error]).toEqual([404, "unknown_form"]);
    const foreign = await get("challenge=contact", "https://evil.test");
    expect([foreign.status, foreign.json?.error]).toEqual([403, "origin"]);
  });
  it("refuses to sign with the placeholder, a short or a missing secret, and tells the owner", async () => {
    // Review finding 21 (2026-10-19): a config.example.php copied by hand signed challenges and
    // stamps with 'REPLACE-WITH-A-LONG-RANDOM-STRING', a missing key with ''. Anyone who reads
    // the example can then forge a stamp. The owner's mistake, said as 500 like a missing address.
    const want = [500, "secret_config"];
    for (const secret of ["REPLACE-WITH-A-LONG-RANDOM-STRING", "short-secret", null]) {
      writeConfig({ secret });
      try {
        const ticket = await get("challenge=feedback");
        expect([String(secret), ticket.status, ticket.json?.error]).toEqual([
          String(secret),
          ...want,
        ]);
        expect(String(ticket.json?.message)).toContain("config.php");
        // A post that needs the secret (the time trap) is refused the same way, nothing is mailed.
        const before = mails().length;
        const r = await post(env("feedback", { rating: "4" }));
        expect([r.status, r.json?.error]).toEqual(want);
        expect(mails().length).toBe(before);
      } finally {
        writeConfig();
      }
    }
    // A form that needs no signature (no time trap, no proof of work) still works without one.
    writeConfig({ secret: null });
    try {
      expect((await plain({ form: "feedback", lang: "en-US", rating: "5" })).status).toBe(200);
    } finally {
      writeConfig();
    }
  });
  it("answers a preflight", async () => {
    const res = await fetch(`${base}/send.php`, {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });
});

describe.skipIf(!php)("relay: refusals", () => {
  it("says when a request names no origin at all: Origin: null, or neither Origin nor Referer", async () => {
    // Second review, aside 1 (2026-10-19), measured in Chrome: a site with `Referrer-Policy:
    // no-referrer` sends a plain form post with `Origin: null` (so does `same-origin` when the
    // relay is on another host), and a GET to a relay on the site's own host with neither header.
    // Nothing tells such a request from any other page's, so it stays refused, but the refusal
    // names the cause instead of "origin not allowed" for an origin that is the site's own.
    const fields = new URLSearchParams({ form: "feedback", lang: "en-US", rating: "4" }).toString();
    const plainNull = await post(fields, {
      raw: true,
      origin: "null",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    });
    expect(plainNull.status).toBe(403);
    expect(plainNull.text).toContain("Referrer-Policy");
    const jsonNull = await post(env("feedback", { rating: "4" }), { origin: "null" });
    expect([jsonNull.status, jsonNull.json?.error]).toEqual([403, "origin"]);
    expect(String(jsonNull.json?.message)).toContain("Referrer-Policy");
    const none = await get("challenge=contact", null);
    expect([none.status, none.json?.error]).toEqual([403, "origin"]);
    expect(String(none.json?.message)).toContain("Referrer-Policy");
    const foreign = await get("challenge=contact", "https://evil.test");
    expect([foreign.status, foreign.json?.message]).toEqual([403, "origin not allowed"]);
  });
  it("refuses what is not JSON, an unknown form and a foreign origin; a Referer of the site counts", async () => {
    expect((await post("not json", { raw: true })).json).toMatchObject({ error: "bad_json" });
    expect((await post(env("nope", {}))).status).toBe(404);
    const foreign = await post(env("feedback", { rating: "4" }), { origin: "https://evil.test" });
    expect([foreign.status, foreign.json?.error]).toEqual([403, "origin"]);
    const referer = await post(env("feedback", { rating: "4" }), {
      origin: null,
      headers: { Referer: `${ORIGIN}/site/feedback` },
    });
    expect(referer.status).toBe(200);
  });
  it("time trap: a stamp the relay issued just now is too fast; the page's clock, ts=1 and a tampered stamp are not the relay's", async () => {
    // The relay measures with its own clock on a stamp it signed when the page was opened. The
    // page's clock (Date.now()) locked out visitors whose clock ran ahead, and a made-up number
    // such as ts=1 passed (review findings 5b and 6, 2026-10-19).
    const fresh = (await get("challenge=feedback")).json?.stamp as string;
    const now = await post({ ...env("feedback", { rating: "4" }), ts: fresh });
    expect([now.status, now.json?.error]).toEqual([400, "too_fast"]);
    for (const bad of ["0", "1", String(Date.now() - 60_000), String(Date.now() + 120_000)]) {
      const r = await post({ ...env("feedback", { rating: "4" }), ts: bad });
      expect([bad, r.status, r.json?.error]).toEqual([bad, 400, "stamp"]);
    }
    const [issued, sig] = fresh.split(".");
    const tampered = await post({
      ...env("feedback", { rating: "4" }),
      ts: `${Number(issued) - 600}.${sig}`,
    });
    expect(tampered.json?.error).toBe("stamp");
  });
  it("a stamp is bound to its form: one fetched for another form is refused as `stamp`", async () => {
    // Second review, finding 7 (2026-10-19): the stamp was signed over its time alone, so one
    // ticket, aged once, served every form for a day (measured against the code before: a
    // stamp of another form was accepted here, and a mail went out).
    const before = mails().length;
    const foreign = await post({ ...env("feedback", { rating: "4" }), ts: ts("limited") });
    expect([foreign.status, foreign.json?.error]).toEqual([400, "stamp"]);
    const own = await post(env("feedback", { rating: "4" }));
    expect(own.json).toEqual({ ok: true });
    expect(mails().length).toBe(before + 1);
  });
  it("honeypot: a filled field is told ok, and nothing is mailed", async () => {
    const before = mails().length;
    const r = await post({ ...env("feedback", { rating: "4" }), _hp_website: "http://spam.test" });
    expect(r.json).toEqual({ ok: true });
    expect(mails().length).toBe(before);
  });
  it("a value of the wrong type anywhere in the envelope is refused as JSON, never with a PHP warning", async () => {
    // Review finding 17 (2026-10-19): `{"form":["x"]}` made `(string)` print "Warning: Array to
    // string conversion in /…/send.php on line 558" before the JSON, with the relay's path.
    const logBefore = fs.readFileSync(path.join(dir, "php.log"), "utf8").length;
    const cases: [string, Record<string, unknown>, number, string | null][] = [
      ["form is a list", { form: ["feedback"] }, 404, "unknown_form"],
      ["form is a number", { form: 7 }, 404, "unknown_form"],
      ["lang is a list", { ...env("feedback", { rating: "4" }), lang: ["de"] }, 200, null],
      ["ts is a list", { ...env("feedback", { rating: "4" }), ts: [ts("feedback")] }, 400, "stamp"],
      ["ts is a number", { ...env("feedback", { rating: "4" }), ts: 1 }, 400, "stamp"],
      [
        "pow parts are lists",
        {
          ...env("contact", { email: "a@b.cd", message: "x" }),
          pow: { challenge: ["a"], nonce: ["b"] },
        },
        400,
        "pow",
      ],
      [
        "pow is a string",
        { ...env("contact", { email: "a@b.cd", message: "x" }), pow: "abc" },
        400,
        "pow",
      ],
      [
        "encrypted is a list",
        { ...env("feedback", { rating: "4" }), encrypted: ["yes"] },
        400,
        "encryption",
      ],
      [
        "ciphertext is an object",
        { form: "enc", lang: "de", ts: ts("enc"), encrypted: true, ciphertext: { a: 1 } },
        400,
        "ciphertext",
      ],
      ["fields is a string", { ...env("feedback", {}), fields: "rating=4" }, 400, "fields"],
      ["fields is a list", { ...env("feedback", {}), fields: ["4"] }, 400, "invalid"],
      ["a field is an object", env("feedback", { rating: { a: 1 } }), 400, "invalid"],
      ["a field is a number", env("feedback", { rating: 4 }), 400, "invalid"],
      ["a field is true", env("feedback", { rating: true }), 400, "invalid"],
      [
        "the honeypot is a list",
        { ...env("feedback", { rating: "4" }), _hp_website: ["x"] },
        200,
        null,
      ],
      [
        "page and title are not strings",
        { ...env("feedback", { rating: "4" }), page: ["x"], pageTitle: 3 },
        200,
        null,
      ],
    ];
    for (const [name, body, status, code] of cases) {
      const r = await post(body);
      expect([name, r.json === null ? r.text.slice(0, 120) : "json"]).toEqual([name, "json"]);
      expect([name, r.status, r.json?.error ?? null]).toEqual([name, status, code]);
    }
    const challenge = await get("challenge[]=feedback");
    expect([challenge.status, challenge.json?.error]).toEqual([404, "unknown_form"]);
    const log = fs.readFileSync(path.join(dir, "php.log"), "utf8").slice(logBefore);
    expect(log.match(/Warning|Deprecated|Fatal|TypeError/g) ?? []).toEqual([]);
  });
  it("judges every case of the shared catalog as written there (test/parity-cases.ts); the script is measured against the same", async () => {
    const disagreements: string[] = [];
    for (const c of parityCases) {
      const r = await post(env("parity", { req: "x", consent: "yes", [c.field]: c.value }));
      const errors = errorsOf(r).filter((e) => e.field === c.field);
      const got =
        r.status === 200 && errors.length === 0
          ? "ok"
          : (errors[0]?.code ?? `status ${r.status} ${r.json?.error}`);
      if (got !== c.relay)
        disagreements.push(
          `${c.field} ${JSON.stringify(c.value)}: expected ${c.relay}, got ${got}`,
        );
    }
    expect(disagreements).toEqual([]);
  });
  it("decides which conditional fields count as the shared catalog says, by JSON and by a plain post", async () => {
    const disagreements: string[] = [];
    for (const c of conditionCases) {
      for (const way of ["json", "plain"] as const) {
        const before = mails().length;
        let r: Answer;
        if (way === "json") r = await post(env("cond", c.values));
        else {
          const body = new URLSearchParams({ form: "cond", lang: "en-US" });
          for (const [k, v] of Object.entries(c.values))
            for (const x of Array.isArray(v) ? v : [v]) body.append(k, x);
          r = await post(body.toString(), {
            raw: true,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
          });
        }
        const sent = mails().length > before;
        const body = sent ? lastMail().body : "";
        for (const [name, want] of Object.entries(c.expect)) {
          const error = errorsOf(r).find((e) => e.field === name)?.code;
          const label = conditionFields.find((f) => "name" in f && f.name === name)!;
          const line = "label" in label ? `${String(label.label)}:` : name;
          const got =
            error === "required"
              ? "required"
              : error
                ? `error ${error}`
                : // without an error a field counts if it shows in the mail, or if nothing was
                  // sent because another field was refused and this one was filled
                  sent
                  ? body.includes(line)
                    ? "ok"
                    : "dropped"
                  : c.values[name] !== undefined && want === "ok"
                    ? "ok"
                    : "dropped";
          if (got !== want)
            disagreements.push(
              `${way} ${JSON.stringify(c.values)} ${name}: expected ${want}, got ${got} (status ${r.status})`,
            );
        }
      }
    }
    expect(disagreements).toEqual([]);
  });
  it("fields: unknown, required, not an option, too long", async () => {
    const unknown = await post(env("feedback", { rating: "4", bogus: "1" }));
    expect(unknown.status).toBe(400);
    expect(errorsOf(unknown)).toContainEqual({ field: "bogus", code: "unknown_field" });
    expect(errorsOf(await post(env("feedback", { comment: "no rating" })))).toContainEqual({
      field: "rating",
      code: "required",
    });
    expect(errorsOf(await post(env("feedback", { rating: "9" })))).toContainEqual({
      field: "rating",
      code: "not_an_option",
    });
    const long = await post(env("feedback", { rating: "4", comment: "x".repeat(20_001) }));
    expect(errorsOf(long)).toContainEqual({ field: "comment", code: "too_long" });
  });
  it("e-mail and URL: the browser's rule, so an address or host with umlauts passes here as it did there", async () => {
    // Review finding 13 (2026-10-19): the script accepted `müller@münchen.de` and
    // `https://münchen.de`, FILTER_VALIDATE_EMAIL/URL refused them, and the visitor read "please
    // use the requested format" for a value the page had taken.
    const idn = await post(
      env("links", { mail: "müller@münchen.de", site: "https://münchen.de/weg?x=1" }),
    );
    expect(idn.json).toEqual({ ok: true });
    const { headers, body } = lastMail();
    expect(body).toContain("Mail: müller@münchen.de");
    expect(body).toContain("Site: https://münchen.de/weg?x=1");
    // A Reply-To header carries ASCII addresses only; this one stays in the body.
    expect(headers).not.toContain("Reply-To");
    const ascii = await post(env("links", { mail: "ada@example.org" }));
    expect(ascii.json).toEqual({ ok: true });
    expect(lastMail().headers).toContain("Reply-To: ada@example.org");
    // Third review, aside (2026-10-19): the first e-mail field became Reply-To, so with "a
    // friend's e-mail" before "your e-mail" the answer went to the friend. A field that says
    // `autocomplete: email` is the visitor's; only such fields are asked when there is one.
    expect(
      (await post(env("friend", { friend: "bob@example.org", own: "ada@example.org" }))).json,
    ).toEqual({ ok: true });
    expect(lastMail().headers).toContain("Reply-To: ada@example.org");
    expect((await post(env("friend", { friend: "bob@example.org" }))).json).toEqual({ ok: true });
    expect(lastMail().headers).not.toContain("Reply-To");
    // What both sides refuse: no dot in the domain, a space, no scheme, ftp.
    for (const mail of ["ada@localhost", "a b@example.org", "ada@example..org", "@example.org"]) {
      expect(errorsOf(await post(env("links", { mail })))).toContainEqual({
        field: "mail",
        code: "invalid",
      });
    }
    for (const site of ["example.org", "ftp://example.org", "https://exa mple.org", "https://"]) {
      expect(errorsOf(await post(env("links", { site })))).toContainEqual({
        field: "site",
        code: "invalid",
      });
    }
  });
  it("a hidden field carries the configured value, whatever was posted", async () => {
    // Review finding 14 (2026-10-19): a hidden field was checked on no level; 900 × "x" under
    // `src` was mailed as if the recipient saw the fixed value.
    const tampered = await post(env("tagged", { note: "hi", src: "x".repeat(900) }));
    expect(tampered.json).toEqual({ ok: true });
    expect(lastMail().body).toContain("src: web");
    expect(lastMail().body).not.toContain("xxx");
    const missing = await post(env("tagged", { note: "hi" }));
    expect(missing.json).toEqual({ ok: true });
    expect(lastMail().body).toContain("src: web");
    const posted = await plain({ form: "tagged", lang: "de-DE", note: "hi", src: "web" });
    expect(posted.status).toBe(200);
    expect(lastMail().body).toContain("src: web");
  });
  it("a visitor's key that holds a private key block is refused, so it never travels in a mail", async () => {
    // Review finding 25 (2026-10-19), the relay's share: it cannot parse a key, but it can see
    // the marker of a private block, which the browser's check lets through in a paste of both.
    const pub = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nabc\n-----END PGP PUBLIC KEY BLOCK-----";
    const priv =
      "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nabc\n-----END PGP PRIVATE KEY BLOCK-----";
    const before = mails().length;
    for (const key of [priv, `${pub}\n${priv}`]) {
      const r = await post(env("tagged", { note: "hi", key }));
      expect(errorsOf(r)).toContainEqual({ field: "key", code: "invalid" });
    }
    expect(mails().length).toBe(before);
    expect((await post(env("tagged", { note: "hi", key: pub }))).json).toEqual({ ok: true });
    expect(lastMail().body).toContain("Public key of the sender:");
  });
  it("proof of work: missing, unsolved or forged is refused before the fields are looked at", async () => {
    const bad = { ...contactFields, email: "not-an-address" };
    const missing = await post(env("contact", bad, { pow: null }));
    expect([missing.status, missing.json?.error]).toEqual([400, "pow"]);
    const unsolved = await post(env("contact", bad, { pow: { challenge, nonce: "abc" } }));
    expect(unsolved.json?.error).toBe("pow");
    const forged = await post(
      env("contact", bad, { pow: { challenge: "0".repeat(64), nonce: "abc" } }),
    );
    expect(forged.json?.error).toBe("pow");
    // A solved proof sends once: the second message with the same nonce is refused (review
    // finding 5a, 2026-10-19: the same nonce sent three times).
    const pow = solve(challenge, 8);
    const first = await post(env("contact", contactFields, { pow }));
    expect(first.json).toEqual({ ok: true });
    const again = await post(env("contact", contactFields, { pow }));
    expect([again.status, again.json?.error]).toEqual([400, "pow"]);
    expect(mails().filter((m) => m.includes("Name: Ada Lovelace")).length).toBe(1);
    // One directory per hour, removed as a whole once the hour's challenges have expired, so a
    // post lists the hours, not the proofs (second review, finding 6, 2026-10-19: 100 000 spent
    // files beside the counters cost every post of the relay a read of them all).
    const spent = spentFiles();
    expect(spent.length).toBeGreaterThan(0);
    for (const f of spent) expect(f).toMatch(/^pow-\d+\/[0-9a-f]{32}\.spent$/);
  });
  it("a proof is spent by the message it buys, not by a post the relay refuses", async () => {
    // Second review, finding 1 (2026-10-19): the proof was marked used before the captcha and
    // the fields were checked, so after a refusal (a field only the relay rejects, an expired
    // captcha token) the corrected message got "400 pow: already used", and the page's "please
    // try again" could not be followed until the hour changed. Two visitors who count from the
    // same start (the browsers did) find the same nonce; the relay must at least not burn it on
    // a refusal.
    const adaMails = () => mails().filter((m) => m.includes("Name: Ada Lovelace")).length;
    const pow = solve(challenge, 8, "same-start-");
    const before = spentFiles().length;
    const sent = adaMails();
    const refused = await post(
      env("contact", { ...contactFields, email: "not-an-address" }, { pow }),
    );
    expect([refused.status, refused.json?.error]).toEqual([400, "invalid"]);
    expect(spentFiles().length).toBe(before);
    const fixed = await post(env("contact", contactFields, { pow }));
    expect(fixed.json).toEqual({ ok: true });
    expect(spentFiles().length).toBe(before + 1);
    const again = await post(env("contact", contactFields, { pow }));
    expect([again.status, again.json?.error]).toEqual([400, "pow"]);
    expect(adaMails()).toBe(sent + 1);
  });
  it("a proof spent in one hour stays spent in the next, while its challenge is still accepted", async () => {
    // Second review, finding 5 (2026-10-19): the relay accepts the challenges of this hour and
    // the last, but named the spent file after the hour of the post, so the same proof sent
    // once more after the hour changed (measured: 200, 400, next hour 200, 400). The clock of
    // the suite's copy moves with X-Shift; the posts sit one minute into an hour, so the real
    // clock cannot change their window for the rest of this hour.
    const real = Math.floor(Date.now() / 1000);
    const shift = (Math.floor(real / 3600) + 1) * 3600 + 60 - real;
    const at = (seconds: number) => ({ headers: { "X-Shift": String(seconds) } });
    const ticket = (await get("challenge=contact", ORIGIN, at(shift).headers)).json as {
      challenge: string;
      stamp: string;
    };
    const pow = solve(ticket.challenge, 8);
    const message = (n: string) =>
      env("contact", { ...contactFields, message: n }, { pow, ts: ticket.stamp });
    const first = await post(message("hour H"), at(shift + 5));
    expect(first.json).toEqual({ ok: true });
    const again = await post(message("hour H, again"), at(shift + 6));
    expect([again.status, again.json?.error]).toEqual([400, "pow"]);
    const nextHour = await post(message("hour H+1"), at(shift + 3600));
    expect([nextHour.status, nextHour.json?.error]).toEqual([400, "pow"]);
    // Two hours on, the challenge itself has expired: refused as a wrong proof, not as a used one.
    const later = await post(message("hour H+2"), at(shift + 7200));
    expect([later.status, later.json?.message]).toEqual([
      400,
      "the proof of work is missing or wrong",
    ]);
    expect(mails().filter((m) => m.includes("hour H")).length).toBe(1);
    // The next proof that is spent clears the proofs of hour H, whose challenges have expired.
    const fresh = (await get("challenge=contact", ORIGIN, at(shift + 7200).headers)).json as {
      challenge: string;
    };
    const sent = await post(
      env(
        "contact",
        { ...contactFields, message: "H+2, fresh" },
        { pow: solve(fresh.challenge, 8), ts: ticket.stamp },
      ),
      at(shift + 7201),
    );
    expect(sent.json).toEqual({ ok: true });
    const hourH = Math.floor((real + shift) / 3600);
    expect(spentFiles().filter((f) => f.startsWith(`pow-${hourH}`))).toEqual([]);
  });
  it("the quota is read before the proof is spent: a refused post leaves no spent file, a replayed proof uses no quota", async () => {
    // Second review, finding 6 (2026-10-19): the spent files grew without bound. Finding 1 put
    // the marking behind the field checks; the quota was the one check still behind it, so a
    // bot with cheap proofs and valid fields left a file per post while every post got 429
    // (measured: three files for two mails). The quota is read first now, under its lock, and
    // the mail is counted last, so a replayed proof uses none of it either.
    const ticket = (await get("challenge=gated")).json as { challenge: string };
    const proof = (prefix: string) => solve(ticket.challenge, 8, prefix);
    const count = () => {
      const file = fs.readdirSync(path.join(dir, "counters")).find((f) => f.startsWith("gated-"));
      return file ? fs.readFileSync(path.join(dir, "counters", file), "utf8") : "none";
    };
    const before = spentFiles().length;
    const a = proof("a-");
    expect((await post(env("gated", { g: "1" }, { pow: a }))).json).toEqual({ ok: true });
    const replay = await post(env("gated", { g: "1 again" }, { pow: a }));
    expect([replay.status, replay.json?.error, count()]).toEqual([400, "pow", "1"]);
    expect((await post(env("gated", { g: "2" }, { pow: proof("b-") }))).json).toEqual({
      ok: true,
    });
    expect([spentFiles().length - before, count()]).toEqual([2, "2"]);
    const refused = await post(env("gated", { g: "3" }, { pow: proof("c-") }));
    expect([refused.status, refused.json?.error]).toEqual([429, "rate_limited"]);
    expect([spentFiles().length - before, count()]).toEqual([2, "2"]);
    // With the quota used up, a replay is told that first: the quota is the first thing read.
    const late = await post(env("gated", { g: "1 once more" }, { pow: a }));
    expect([late.status, late.json?.error]).toEqual([429, "rate_limited"]);
    expect(mails().filter((m) => m.includes("G: ")).length).toBe(2);
  });
  it("a mail that cannot be handed over gives back its place in the hour and its proof", async () => {
    // Third review, N2 (2026-10-19): the mail was counted before it was handed over, so a mailer
    // that failed closed the form for the rest of the hour although nothing went out (three
    // posts, three times 502, the counter at 3).
    const ticket = (await get("challenge=unsent")).json as { challenge: string };
    const proof = solve(ticket.challenge, 8);
    const count = () => {
      const file = fs.readdirSync(path.join(dir, "counters")).find((f) => f.startsWith("unsent-"));
      return file ? fs.readFileSync(path.join(dir, "counters", file), "utf8") : "none";
    };
    const before = spentFiles().length;
    writeConfig({
      extra: `'captchaSecret' => 'cap-secret', 'mailer' => ['file' => __DIR__ . '/no-such-dir/outbox.txt'],`,
    });
    try {
      for (const u of ["1", "2", "3"]) {
        const r = await post(env("unsent", { u }, { pow: proof }));
        expect([r.status, r.json?.error]).toEqual([502, "mail"]);
      }
      expect([count(), spentFiles().length - before]).toEqual(["0", 0]);
    } finally {
      writeConfig();
    }
    // The mailer is back: the same proof sends, and the hour has both its places.
    expect((await post(env("unsent", { u: "4" }, { pow: proof }))).json).toEqual({ ok: true });
    expect(
      (await post(env("unsent", { u: "5" }, { pow: solve(ticket.challenge, 8) }))).json,
    ).toEqual({ ok: true });
    expect([count(), spentFiles().length - before]).toEqual(["2", 2]);
  });
  it("encryption: plaintext to a required form, ciphertext to an off form, ciphertext without armor", async () => {
    const plainToEnc = await post(env("enc", { a: "x" }));
    expect([plainToEnc.status, plainToEnc.json?.error]).toEqual([400, "encryption"]);
    const cipherToOff = await post(env("feedback", {}, { encrypted: true, ciphertext: ARMOR }));
    expect(cipherToOff.json?.error).toBe("encryption");
    const noArmor = await post(env("enc", {}, { encrypted: true, ciphertext: "hello" }));
    expect(noArmor.json?.error).toBe("ciphertext");
  });
  it("pattern: a JavaScript pattern with escaped slashes is applied; what PCRE cannot read refuses, with a log line", async () => {
    const miss = await post(env("patterns", { site: "NOT A URL" }));
    expect(errorsOf(miss)).toContainEqual({ field: "site", code: "invalid" });
    expect((await post(env("patterns", { site: "https://example.org/x" }))).json).toEqual({
      ok: true,
    });
    const unreadable = await post(env("patterns", { lb: "ab" }));
    expect(errorsOf(unreadable)).toContainEqual({ field: "lb", code: "invalid" });
    expect(fs.readFileSync(path.join(dir, "php.log"), "utf8")).toContain(
      'the pattern of field "lb" cannot be applied',
    );
    // invalid UTF-8 reaches the relay only as a plain form post
    const bytes = await post("form=patterns&lang=de-DE&site=https%3A%2F%2Fx%FF", {
      raw: true,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    });
    expect(bytes.status).toBe(400);
    expect(bytes.text).toContain("<li>Site: Dieser Wert konnte nicht gelesen werden.</li>");
  });
  it("captcha: the secret from config.php is sent to the provider; without one the owner is told", async () => {
    const good = await post(env("captcha", { a: "x" }, { captcha: "good" }));
    expect(good.json).toEqual({ ok: true });
    const bad = await post(env("captcha", { a: "x" }, { captcha: "bad" }));
    expect([bad.status, bad.json?.error]).toEqual([400, "captcha"]);
    const none = await post(env("captcha", { a: "x" }));
    expect([none.status, none.json?.error]).toEqual([400, "captcha"]);
    writeConfig({ extra: "" });
    try {
      const unset = await post(env("captcha", { a: "x" }, { captcha: "good" }));
      expect([unset.status, unset.json?.error]).toEqual([500, "captcha_config"]);
    } finally {
      writeConfig();
    }
    writeConfig({ extra: `'captchaSecrets' => ['captcha' => 'cap-secret'],` });
    try {
      expect((await post(env("captcha", { a: "x" }, { captcha: "good" }))).json).toEqual({
        ok: true,
      });
    } finally {
      writeConfig();
    }
  });
  it("captcha: asks the provider only for a post that passed every check of its own", async () => {
    // Third review, aside (2026-10-19): every post with a token cost a call to the provider (up
    // to eight seconds of a worker) and spent the token, also when its fields, its encryption or
    // the relay's own address book refused it afterwards.
    const calls = () =>
      fs.existsSync(path.join(dir, "verify.log"))
        ? fs.statSync(path.join(dir, "verify.log")).size
        : 0;
    const before = calls();
    const unknown = await post(env("captcha", { a: "x", zzz: "1" }, { captcha: "good" }));
    expect(errorsOf(unknown)).toContainEqual({ field: "zzz", code: "unknown_field" });
    const sealed = await post(
      env("captcha", {}, { captcha: "good", encrypted: true, ciphertext: ARMOR }),
    );
    expect(sealed.json?.error).toBe("encryption");
    expect(calls()).toBe(before);
    expect((await post(env("captcha", { a: "x" }, { captcha: "good" }))).json).toEqual({
      ok: true,
    });
    expect(calls()).toBe(before + 1);
  });
  it("an anonymous form with a captcha configured asks for no token and never calls the provider", async () => {
    // What the README's `captcha` row says ("ignored when anonymous") and the build hints, held
    // at the relay too (second review, aside 4, 2026-10-19): no token, no provider call, and no
    // captchaSecret needed in config.php.
    const calls = () =>
      fs.existsSync(path.join(dir, "verify.log"))
        ? fs.statSync(path.join(dir, "verify.log")).size
        : 0;
    const before: [number, number] = [calls(), mails().length];
    expect((await post(env("anoncap", { a: "x" }))).json).toEqual({ ok: true });
    writeConfig({ extra: "" });
    try {
      expect((await post(env("anoncap", { a: "y" }))).json).toEqual({ ok: true });
    } finally {
      writeConfig();
    }
    expect([calls(), mails().length]).toEqual([before[0], before[1] + 2]);
    expect(lastMail().body).toContain("A: y");
  });
  it("size: a submission above maxBytes is 413, measured against the form's own limit", async () => {
    const r = await post(
      JSON.stringify(env("feedback", { rating: "4", comment: "x".repeat(140_000) })),
      {
        raw: true,
      },
    );
    expect([r.status, r.json?.error]).toEqual([413, "too_large"]);
    // Below the largest limit of any form, above this form's 300 bytes: refused all the same
    // (review finding 9, 2026-10-19: only the largest limit was applied).
    const small = await post(env("small", { s: "x".repeat(1000) }));
    expect([small.status, small.json?.error]).toEqual([413, "too_large"]);
    const fits = await post(env("small", { s: "ok" }));
    expect(fits.status).toBe(200);
  });
  it("size: a plain post is measured on its content, not on its URL encoding", async () => {
    // Second review, finding 8 (2026-10-19): maxBytes was applied to the raw body, and the URL
    // encoding of a plain post triples every non-ASCII byte, so 15 000 CJK characters in a
    // 20 000-character textarea (45 kB as JSON, 135 kB encoded) were refused as too large
    // (measured against the code before: 413 here, and the page for a body too large to read
    // was English for lang=de).
    const before = mails().length;
    const cjk = await plain({
      form: "feedback",
      lang: "de-DE",
      rating: "4",
      comment: "漢".repeat(15_000),
    });
    expect(cjk.status).toBe(200);
    expect(mails().length).toBe(before + 1);
    expect(lastMail().body).toContain("漢".repeat(15_000));
    // The decoded size still counts, against this form's own limit, in the submission's language.
    const over = await plain({ form: "small", lang: "de-DE", s: "x".repeat(1000) });
    expect(over.status).toBe(413);
    expect(over.text).toContain("<title>Nicht gesendet</title>");
    // A body beyond what the relay reads at all (three times the largest limit) is answered
    // before it is parsed; that page speaks the browser's language.
    const huge = await post(`form=feedback&lang=de-DE&rating=4&comment=${"x".repeat(400_000)}`, {
      raw: true,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
    });
    expect([huge.status, huge.text.includes("<title>Nicht gesendet</title>")]).toEqual([413, true]);
  });
});

describe.skipIf(!php)("relay: accepted submissions and their mail", () => {
  it("contact with a solved proof of work: To from the config, Reply-To from the e-mail field, labels not values", async () => {
    const r = await post(env("contact", contactFields, { pow: solve(challenge, 8) }));
    expect(r.json).toEqual({ ok: true });
    expect(r.headers.has("x-powered-by")).toBe(false);
    const { headers, body } = lastMail();
    expect(headers).toContain("To: owner@relay.test");
    expect(headers).toContain("From: forms@relay.test");
    expect(headers).toContain("Reply-To: ada@example.org");
    expect(headers).toContain("Subject: Kontakt");
    expect(headers).toContain("Content-Type: text/plain; charset=utf-8");
    expect(body).toContain("Topic: Beta");
    expect(body).toContain("Name: Ada Lovelace");
    expect(body).toMatch(/\[x\] Agreed/);
    expect(headers + body).not.toMatch(/X-Originating|User-Agent|127\.0\.0\.1/);
  });
  it("a long line is sent quoted-printable, so no line of the mail exceeds 76 octets", async () => {
    // Review finding 20 (2026-10-19): the body went out 8bit with the visitor's lines as they
    // were; a textarea line of thousands of characters breaks RFC 5322's 998-octet limit, and an
    // MTA wraps it where it likes, possibly inside a UTF-8 sequence, or refuses the mail.
    const line = "ä".repeat(1500) + "a".repeat(1500);
    const r = await post(env("feedback", { rating: "4", comment: `Erste Zeile\n${line}` }));
    expect(r.json).toEqual({ ok: true });
    const { headers, body, raw } = lastMail();
    expect(headers).toContain("Content-Transfer-Encoding: quoted-printable");
    expect(headers).toContain("Content-Type: text/plain; charset=utf-8");
    const longest = Math.max(...raw.split("\r\n").map((l) => Buffer.byteLength(l)));
    expect(longest).toBeLessThanOrEqual(76);
    // Decoded, the mail reads as before: the line whole, the umlauts intact.
    expect(body).toContain(`:\r\nErste Zeile\r\n${line}\r\n`);
    expect(body).toContain("Erste Zeile");
  });
  it("feedback with page context: the page line, no Reply-To without an e-mail field", async () => {
    const r = await post(
      env("feedback", { rating: "4", comment: "Gute Seite" }, { page: "site/feedback" }),
    );
    expect(r.json).toEqual({ ok: true });
    const { headers, body } = lastMail();
    expect(body).toContain("Page: site/feedback");
    expect(body).toContain("Gute Seite");
    expect(headers).not.toContain("Reply-To");
  });
  it("the page line reads as in an encrypted message: title and slug, control characters dropped", async () => {
    // Review finding 23 (2026-10-19): the plain mail showed "Page: <slug>", the encrypted text
    // "Page: <title> (<slug>)"; the title now travels with the slug, flat, on both paths.
    const r = await post(
      env(
        "feedback",
        { rating: "4", comment: "Mit Titel" },
        { page: "site/feedback", pageTitle: "Feed\r\nback\x00 page" },
      ),
    );
    expect(r.json).toEqual({ ok: true });
    expect(lastMail().body).toContain("Page: Feed back page (site/feedback)");
    const noScript = await plain({
      form: "feedback",
      lang: "de-DE",
      rating: "5",
      page: "site/feedback",
      pageTitle: "Feedback",
    });
    expect(noScript.status).toBe(200); // no success slug: the relay's own "sent" page
    expect(lastMail().body).toContain("Page: Feedback (site/feedback)");
    expect(lastMail().body).not.toContain("pageTitle");
  });
  it("an encrypted message carries its page inside the ciphertext only: nothing is written beside the armor", async () => {
    const r = await post(
      env("encpage", {}, { encrypted: true, ciphertext: ARMOR, page: "site/x", pageTitle: "X" }),
    );
    expect(r.json).toEqual({ ok: true });
    expect(lastMail().body.replace(/\r\n/g, "\n").trim()).toBe(ARMOR);
  });
  it("an anonymous form: neither Reply-To nor the page line, although a page was sent", async () => {
    const r = await post(
      env(
        "survey",
        { usage: "often", topics: ["news"], satisfaction: "4", comment: "Anonym." },
        { page: "site/survey" },
      ),
    );
    expect(r.json).toEqual({ ok: true });
    const { headers, body } = lastMail();
    expect(headers).not.toContain("Reply-To");
    expect(body).not.toContain("Page:");
    expect(body).toContain("Anonym.");
  });
  it("ciphertext: a real OpenPGP.js message passes; text beside the block, a second block or a header line do not", async () => {
    // Review finding 15 (2026-10-19): the armor check looked for the two markers and let anything
    // between and after them through; a phishing text beside the block was mailed as a message.
    const openpgp = await import("openpgp");
    const { generatePair } = await import("./keys");
    const key = await openpgp.readKey({ armoredKey: (await generatePair()).publicKey });
    const real = String(
      await openpgp.encrypt({
        message: await openpgp.createMessage({ text: "hi\nthere" }),
        encryptionKeys: key,
        format: "armored",
      }),
    );
    const r = await post(env("enc", {}, { encrypted: true, ciphertext: real }));
    expect(r.json).toEqual({ ok: true });
    expect(lastMail().body.replace(/\r\n/g, "\n").trim()).toBe(real.trim());
    const before = mails().length;
    for (const bad of [
      `${ARMOR}\nPlease wire 500 EUR to the account below.\n-----END PGP MESSAGE-----`,
      `${ARMOR}\n${ARMOR}`,
      "-----BEGIN PGP MESSAGE-----\nComment: wire 500 EUR\n\nabc\n-----END PGP MESSAGE-----",
      "-----BEGIN PGP MESSAGE-----\n\nabc def\n-----END PGP MESSAGE-----",
      "-----BEGIN PGP MESSAGE-----\n\n-----END PGP MESSAGE-----",
    ]) {
      const refused = await post(env("enc", {}, { encrypted: true, ciphertext: bad }));
      expect([refused.status, refused.json?.error]).toEqual([400, "ciphertext"]);
    }
    expect(mails().length).toBe(before);
  }, 15_000);
  it("an encrypted submission: the body is the armored message, unchanged", async () => {
    const r = await post(env("enc", {}, { encrypted: true, ciphertext: ARMOR }));
    expect(r.json).toEqual({ ok: true });
    expect(lastMail().body.replace(/\r\n/g, "\n").trim()).toBe(ARMOR);
  });
});

describe.skipIf(!php)("relay: a browser without JavaScript (plain form post)", () => {
  it("redirects to the site's thank-you page: absolute, with the request's origin and the base path", async () => {
    // Neither stamp nor proof: the plain post passes the time trap and the proof of work of this
    // form by design (finding 4 of the second review, 2026-10-19; the build says so).
    const r = await plain({ form: "contact", lang: "de-DE", ...contactFields });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`${ORIGIN}/site/danke`);
    expect(lastMail().body).toContain("Name: Ada Lovelace");
  });
  it("with an empty allowedOrigins the redirect goes to the site's address from baseUrl, never to the request's Origin", async () => {
    // Review finding 11 (2026-10-19): the redirect base came from the Origin header, which an
    // empty list accepted from anyone: an open redirect, on the honeypot path too.
    writeConfig({ origins: [] });
    try {
      const evil = { origin: "https://evil.test" };
      const r = await post(
        new URLSearchParams({ form: "contact", lang: "de-DE", ...contactFields }).toString(),
        {
          raw: true,
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
          ...evil,
        },
      );
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe("https://example.org/site/danke");
      const trapped = await post(
        new URLSearchParams({
          form: "contact",
          lang: "de-DE",
          ...contactFields,
          _hp_website: "http://spam.test",
        }).toString(),
        {
          raw: true,
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
          ...evil,
        },
      );
      expect(trapped.headers.get("location")).toBe("https://example.org/site/danke");
      // "Any origin" is said as such, not by echoing whatever Origin arrived.
      const cors = await get("challenge=contact", "https://evil.test");
      expect(cors.status).toBe(200);
      expect(cors.headers.get("access-control-allow-origin")).toBe("*");
    } finally {
      writeConfig();
    }
  });
  it("answers with a short page in the submission's language when there is no redirect", async () => {
    const de = await plain({ form: "feedback", lang: "de-DE", rating: "5" });
    expect(de.status).toBe(200);
    expect(de.text).toContain("<title>Gesendet</title>");
    expect(de.text).toContain("Danke, deine Nachricht wurde gesendet.");
    const en = await plain({ form: "feedback", lang: "en-US", rating: "5" });
    expect(en.text).toContain("<title>Sent</title>");
    const bad = await plain({ form: "feedback", lang: "de-DE", rating: "77" });
    expect(bad.status).toBe(400);
    expect(bad.text).toContain('lang="de"');
    expect(bad.text).toContain("<title>Nicht gesendet</title>");
    // Second review, aside 3 (2026-10-19): the page said only "some fields were not accepted",
    // in English, and named no field. It names each one by its label in the submission's
    // language, with the sentence the browser script would show at the field.
    expect(bad.text).toContain("Diese Angaben wurden nicht angenommen:");
    expect(bad.text).toContain("<li>Wie hilfreich war diese Seite?: Bitte wähle eine Option.</li>");
    expect(bad.text).not.toContain("some fields were not accepted");
    // Third review, aside (2026-10-19): a text field named twice arrives as a list, and the page
    // said "use the requested format" of a field that has no format.
    const twice = await post("form=feedback&lang=de-DE&rating=5&comment=a&comment=b", {
      raw: true,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    });
    expect(twice.status).toBe(400);
    expect(twice.text).toMatch(/<li>[^<]+: Dieser Wert konnte nicht gelesen werden\.<\/li>/);
    expect(twice.text).not.toContain("verlangte Format");
  });
  it("skips the time trap and the proof of work, which only the script can supply", async () => {
    const r = await plain({ form: "contact", lang: "de-DE", ...contactFields });
    expect(r.status).toBe(303);
  });
  it("counts a line break as one character, as the browser's maxlength does, not as the two bytes it posts", async () => {
    // Review finding 12 (2026-10-19): a form post carries CRLF, the browser counted LF; 250 short
    // lines (499 characters in the browser) came as 748 and were refused as too long.
    const lines = "a\r\n".repeat(250).trimEnd();
    const r = await plain({ form: "contact", lang: "de-DE", ...contactFields, message: lines });
    expect(r.status).toBe(303);
    expect(lastMail().body.replace(/\r\n/g, "\n")).toContain("Message:\na\na\na\n");
    expect(lastMail().body).not.toContain("\r\r");
  });
  it("collects the boxes of a checkboxes field, which share one name, into a list", async () => {
    // The browser sends topics=news&topics=guides; parse_str kept only the last one.
    const two = await post("form=multi&lang=de-DE&topics=news&topics=guides&note=x", {
      raw: true,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    });
    expect(two.status).toBe(200);
    expect(lastMail().body).toContain("Topics: News, Guides");
    const one = await plain({ form: "multi", lang: "de-DE", topics: "news" });
    expect(one.status).toBe(200);
    expect(lastMail().body).toContain("Topics: News");
    const none = await plain({ form: "multi", lang: "de-DE", note: "x" });
    expect(none.status).toBe(400);
    expect(none.text).toContain("<li>Topics: Dieses Feld ist ein Pflichtfeld.</li>");
    const noneEn = await plain({ form: "multi", lang: "en-US", note: "x", nope: "y" });
    expect(noneEn.status).toBe(400);
    expect(noneEn.text).toContain('lang="en"');
    expect(noneEn.text).toContain("These entries were not accepted:");
    expect(noneEn.text).toContain("<li>Topics: This field is required.</li>");
    expect(noneEn.text).toContain("<li>nope: This field is not part of the form.</li>");
    const bad = await plain({ form: "multi", lang: "de-DE", topics: "spam" });
    expect(bad.status).toBe(400);
  });
  it("refuses a form with noScript: false, which the script may still use", async () => {
    const r = await plain({ form: "survey", lang: "de-DE", usage: "often" });
    expect(r.status).toBe(400);
    expect(r.text).toContain("Nicht gesendet");
    expect(r.text).toContain("needs JavaScript");
    expect((await post(env("survey", { usage: "often" }))).json).toEqual({ ok: true });
  });
  it("refuses a post that asks for encryption: only the script can encrypt, so nothing is mailed", async () => {
    const before = mails().length;
    const r = await plain({ form: "opt", lang: "de-DE", a: "geheim", _encrypt: "yes" });
    expect(r.status).toBe(400);
    expect(r.text).toContain("sending encrypted needs JavaScript");
    expect(mails().length).toBe(before);
    const honest = await plain({ form: "opt", lang: "de-DE", a: "klartext" });
    expect(honest.status).toBe(200);
    expect(lastMail().body).toContain("A: klartext");
  });
});

describe.skipIf(!php)("relay: captcha verification on a host without allow_url_fopen", () => {
  // Review finding 24 (2026-10-19): the provider was asked with file_get_contents, which needs
  // allow_url_fopen; hosters switch it off, and every captcha form then failed as "not solved".
  // Two more relays on this suite's directory, verify.php stays on the first one.
  let noFopen = "";
  let noFopenNoCurl = "";
  const procs: ChildProcess[] = [];
  beforeAll(async () => {
    for (const [ini, set] of [
      [["allow_url_fopen=0"], (b: string) => (noFopen = b)],
      [["allow_url_fopen=0", "disable_functions=curl_init"], (b: string) => (noFopenNoCurl = b)],
    ] as const) {
      const port = await freePort();
      procs.push(spawnRelay(port, [...ini]));
      set(`http://127.0.0.1:${port}`);
      await untilUp(`http://127.0.0.1:${port}`);
    }
  }, 30_000);
  afterAll(() => procs.forEach(stopRelay));

  it("asks the provider through cURL when allow_url_fopen is off", async () => {
    const good = await post(env("captcha", { a: "x" }, { captcha: "good" }), { at: noFopen });
    expect(good.json).toEqual({ ok: true });
    const bad = await post(env("captcha", { a: "x" }, { captcha: "bad" }), { at: noFopen });
    expect([bad.status, bad.json?.error]).toEqual([400, "captcha"]);
  });
  it("tells the owner when neither allow_url_fopen nor cURL is there, instead of blaming the visitor", async () => {
    const r = await post(env("captcha", { a: "x" }, { captcha: "good" }), { at: noFopenNoCurl });
    expect([r.status, r.json?.error]).toEqual([500, "captcha_config"]);
    expect(String(r.json?.message)).toContain("allow_url_fopen");
  });
  it("a provider that cannot be reached is 502 captcha_verify, not 'not solved'", async () => {
    writeConfig({ verifyUrl: "http://127.0.0.1:9/verify.php" });
    try {
      const r = await post(env("captcha", { a: "x" }, { captcha: "good" }));
      expect([r.status, r.json?.error]).toEqual([502, "captcha_verify"]);
    } finally {
      writeConfig();
    }
  });
});

describe.skipIf(!php)("relay: a PHP without mbstring", () => {
  // Second review, aside 2 (2026-10-19): the README said "no dependencies", but five calls need
  // the mbstring extension, which a PHP built from source has only with --enable-mbstring and
  // Debian ships as its own package. Without it a post died with "Call to undefined function
  // mb_check_encoding()" in the middle of the field checks (a bare 500 with display_errors off).
  // Simulated with disable_functions: the functions are undefined the same way.
  let noMb = "";
  let proc: ChildProcess | undefined;
  beforeAll(async () => {
    const port = await freePort();
    proc = spawnRelay(port, [
      "disable_functions=mb_check_encoding,mb_convert_encoding,mb_encode_mimeheader,mb_substr",
    ]);
    noMb = `http://127.0.0.1:${port}`;
    await untilUp(noMb);
  }, 30_000);
  afterAll(() => stopRelay(proc));

  it("tells the owner that mbstring is missing, on the ticket GET and on a post alike", async () => {
    const ticket = await fetch(`${noMb}/send.php?challenge=contact`, {
      headers: { Origin: ORIGIN },
    });
    const ticketJson = (await ticket.json()) as { error?: string; message?: string };
    expect([ticket.status, ticketJson.error]).toEqual([500, "mbstring_config"]);
    const sent = mails().length;
    const r = await post(env("feedback", { rating: "4" }), { at: noMb });
    expect([r.status, r.json?.error]).toEqual([500, "mbstring_config"]);
    expect(String(r.json?.message)).toContain("mbstring");
    expect(mails().length).toBe(sent);
  });
});

describe.skipIf(!php)("relay: a host without PCRE JIT", () => {
  // Second review, finding 2 (2026-10-19): qf_trim was `^\s+|\s+$`, and without the JIT PCRE
  // retries `\s+$` at every position of a whitespace run, each try walking to the run's end:
  // quadratic. A value with 40 000 spaces inside took the relay 8.2 s (the reviewer, php -S with
  // pcre.jit=0; 0.5 s at 10 000, 2.0 s at 20 000 in a direct call), before any limit was
  // checked. Hosts switch the JIT off where executable memory is denied (SELinux, W^X).
  let noJit = "";
  let proc: ChildProcess | undefined;
  beforeAll(async () => {
    const port = await freePort();
    proc = spawnRelay(port, ["pcre.jit=0"]);
    noJit = `http://127.0.0.1:${port}`;
    await untilUp(noJit);
  }, 30_000);
  afterAll(() => stopRelay(proc));

  it("trims a value with a long run of whitespace in linear time, inside and at the end", async () => {
    const sent = mails().length;
    const t0 = performance.now();
    const inner = await post(env("tagged", { note: "a" + " ".repeat(40_000) + "b" }), {
      at: noJit,
    });
    const trailing = await post(env("tagged", { note: "x" + " \n".repeat(20_000) }), {
      at: noJit,
    });
    const ms = performance.now() - t0;
    // The inner run stays, and the value is longer than the field's limit: refused, but only
    // after the trim, which is where the time went.
    expect([inner.status, errorsOf(inner)]).toEqual([400, [{ field: "note", code: "too_long" }]]);
    expect(trailing.json).toEqual({ ok: true });
    expect(mails().length).toBe(sent + 1);
    expect(lastMail().body).toContain("Note: x\r\n");
    expect(lastMail().body).not.toContain("Note: x ");
    // 7966 ms before the fix (this test against the old code); linear is a few milliseconds
    // plus the transfer.
    expect(ms).toBeLessThan(2000);
  }, 30_000);
});

describe.skipIf(!php)("relay: rate limit", () => {
  it("counts only what is mailed: refused posts do not use up the hour, the fourth mail is 429", async () => {
    // Two refused posts first (an unknown field): before the fix they counted, and the hour's
    // three were spent after one mail (review finding 10, 2026-10-19).
    const statuses: number[] = [];
    for (let i = 0; i < 2; i++)
      statuses.push((await post(env("limited", { x: "a", nope: "b" }))).status);
    for (let i = 0; i < 4; i++)
      statuses.push((await post(env("limited", { x: String(i) }))).status);
    expect(statuses).toEqual([400, 400, 200, 200, 200, 429]);
    expect(mails().filter((m) => m.includes("X: ")).length).toBe(3);
    const counters = fs.readdirSync(path.join(dir, "counters")).filter((f) => f.endsWith(".count"));
    const limited = counters.find((f) => f.startsWith("limited-"));
    expect(limited).toMatch(/^limited-\d{10}\.count$/);
    expect(fs.readFileSync(path.join(dir, "counters", limited!), "utf8")).toBe("3");
    // The directory ships inside the web root and its files tell the counts: the relay keeps a
    // .htaccess there that denies the web (review finding 16, 2026-10-19; measured with Apache
    // 2.4.67: 200 and "3" without it, 403 with it). The suite made the directory empty above.
    const htaccess = fs.readFileSync(path.join(dir, "counters", ".htaccess"), "utf8");
    expect(htaccess).toContain("Require all denied");
    expect(htaccess).toContain("Deny from all");
  });
});
