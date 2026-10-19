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
        // valid in JavaScript (the build and the browser), unreadable for PCRE
        { type: "text", name: "lb", label: "LB", pattern: "(?<=a+)b" },
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
    small: {
      recipient: "owner",
      spam: { maxBytes: 300 },
      fields: [{ type: "text", name: "s", label: "S" }],
    },
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
  extra = `'captchaSecret' => 'cap-secret',`,
  origins: string[] = [ORIGIN],
): void {
  fs.writeFileSync(
    path.join(dir, "config.php"),
    `<?php
declare(strict_types=1);
$generated = require __DIR__ . '/config.generated.php';
return $generated + [
    'secret' => '${relaySecret}',
    'allowedOrigins' => ${JSON.stringify(origins).replace(/"/g, "'")},
    'from' => 'forms@relay.test',
    'subjectPrefix' => '',
    'mailer' => ['file' => __DIR__ . '/outbox.txt'],
    'recipients' => ['owner' => 'owner@relay.test'],
    'counterDir' => __DIR__ . '/counters',
    'captchaVerifyUrls' => ['turnstile' => '${base}/verify.php'],
    ${extra}
];
`,
  );
}
let server: ChildProcess | undefined;
let challenge = "";
/** The relay's signed stamp from the start of the suite: old enough for every form's minSeconds. */
let stamp = "";

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
  execFileSync("node", [path.join(root, "scripts", "relay-config.mjs"), site, "--out", dir], {
    cwd: root,
    stdio: "ignore",
  });
  fs.copyFileSync(path.join(root, "relay", "php", "send.php"), path.join(dir, "send.php"));
  fs.mkdirSync(path.join(dir, "counters"));
  // Stands in for the provider's siteverify endpoint: success for one secret and one token.
  fs.writeFileSync(
    path.join(dir, "verify.php"),
    `<?php
header('Content-Type: application/json');
echo json_encode(['success' => ($_POST['secret'] ?? '') === 'cap-secret' && ($_POST['response'] ?? '') === 'good']);
`,
  );
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  writeConfig();
  const log = fs.openSync(path.join(dir, "php.log"), "w");
  // More than one worker: the captcha check calls verify.php on this same server. No opcache:
  // the captcha test rewrites config.php three times within milliseconds, and opcache rechecks a
  // cached file's time stamp only every revalidate_freq seconds (2 by default), so the relay
  // read the previous config (CI run 39215450865 and one local run, 2026-10-19). Measured with
  // an include aged past file_update_protection: stale with opcache on, fresh with it off.
  server = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", dir, "-d", "opcache.enable=0"], {
    stdio: ["ignore", log, log],
    env: { ...process.env, PHP_CLI_SERVER_WORKERS: "4" },
  });
  const until = Date.now() + 10_000;
  for (;;) {
    try {
      const res = await fetch(`${base}/send.php?challenge=contact`, {
        headers: { Origin: ORIGIN },
      });
      stamp = ((await res.json()) as { stamp?: string }).stamp ?? "";
      break;
    } catch {
      if (Date.now() > until) throw new Error(`php -S did not answer on ${base}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // The stamp has to be minSeconds (one second) old before the relay accepts a submission.
  await new Promise((r) => setTimeout(r, 1100));
}, 30_000);

afterAll(() => {
  server?.kill();
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
  opts: { origin?: string | null; headers?: Record<string, string>; raw?: boolean } = {},
): Promise<Answer> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.origin !== null) headers.Origin = opts.origin ?? ORIGIN;
  const res = await fetch(`${base}/send.php`, {
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
async function get(query: string, origin: string | null = ORIGIN): Promise<Answer> {
  const res = await fetch(`${base}/send.php?${query}`, {
    headers: origin ? { Origin: origin } : {},
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
const ts = () => stamp;
const env = (
  form: string,
  fields: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  form,
  lang: "de-DE",
  ts: ts(),
  encrypted: false,
  fields,
  ...extra,
});
function mails(): string[] {
  const file = path.join(dir, "outbox.txt");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\r\n----\r\n")
    .filter((m) => m.trim() !== "");
}
/** The last mail: headers and the body as the relay wrote them. */
function lastMail(): { headers: string; body: string } {
  const m = mails().at(-1) ?? "";
  const i = m.indexOf("\r\n\r\n");
  return { headers: m.slice(0, i), body: m.slice(i + 4) };
}
function solve(ch: string, difficulty: number): { challenge: string; nonce: string } {
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
  for (let i = Math.floor(Math.random() * 2 ** 40); ; i++) {
    const nonce = i.toString(36);
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
  it("honeypot: a filled field is told ok, and nothing is mailed", async () => {
    const before = mails().length;
    const r = await post({ ...env("feedback", { rating: "4" }), _hp_website: "http://spam.test" });
    expect(r.json).toEqual({ ok: true });
    expect(mails().length).toBe(before);
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
    const spent = fs.readdirSync(path.join(dir, "counters")).filter((f) => f.endsWith(".spent"));
    expect(spent.length).toBeGreaterThan(0);
    expect(spent[0]).toMatch(/^pow-\d+-[0-9a-f]{32}\.spent$/);
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
    expect(bytes.text).toContain("some fields were not accepted");
  });
  it("captcha: the secret from config.php is sent to the provider; without one the owner is told", async () => {
    const good = await post(env("captcha", { a: "x" }, { captcha: "good" }));
    expect(good.json).toEqual({ ok: true });
    const bad = await post(env("captcha", { a: "x" }, { captcha: "bad" }));
    expect([bad.status, bad.json?.error]).toEqual([400, "captcha"]);
    const none = await post(env("captcha", { a: "x" }));
    expect([none.status, none.json?.error]).toEqual([400, "captcha"]);
    writeConfig("");
    try {
      const unset = await post(env("captcha", { a: "x" }, { captcha: "good" }));
      expect([unset.status, unset.json?.error]).toEqual([500, "captcha_config"]);
    } finally {
      writeConfig();
    }
    writeConfig(`'captchaSecrets' => ['captcha' => 'cap-secret'],`);
    try {
      expect((await post(env("captcha", { a: "x" }, { captcha: "good" }))).json).toEqual({
        ok: true,
      });
    } finally {
      writeConfig();
    }
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
  it("an encrypted submission: the body is the armored message, unchanged", async () => {
    const r = await post(env("enc", {}, { encrypted: true, ciphertext: ARMOR }));
    expect(r.json).toEqual({ ok: true });
    expect(lastMail().body.replace(/\r\n/g, "\n").trim()).toBe(ARMOR);
  });
});

describe.skipIf(!php)("relay: a browser without JavaScript (plain form post)", () => {
  it("redirects to the site's thank-you page: absolute, with the request's origin and the base path", async () => {
    const r = await plain({ form: "contact", lang: "de-DE", ...contactFields });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`${ORIGIN}/site/danke`);
    expect(lastMail().body).toContain("Name: Ada Lovelace");
  });
  it("with an empty allowedOrigins the redirect goes to the site's address from baseUrl, never to the request's Origin", async () => {
    // Review finding 11 (2026-10-19): the redirect base came from the Origin header, which an
    // empty list accepted from anyone: an open redirect, on the honeypot path too.
    writeConfig(undefined, []);
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
    expect(de.text).toContain("Danke, Ihre Nachricht wurde gesendet.");
    const en = await plain({ form: "feedback", lang: "en-US", rating: "5" });
    expect(en.text).toContain("<title>Sent</title>");
    const bad = await plain({ form: "feedback", lang: "de-DE", rating: "77" });
    expect(bad.status).toBe(400);
    expect(bad.text).toContain('lang="de"');
    expect(bad.text).toContain("<title>Nicht gesendet</title>");
    expect(bad.text).toContain("<small>some fields were not accepted</small>");
  });
  it("skips the time trap and the proof of work, which only the script can supply", async () => {
    const r = await plain({ form: "contact", lang: "de-DE", ...contactFields });
    expect(r.status).toBe(303);
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
    expect(none.text).toContain("some fields were not accepted");
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
  });
});
