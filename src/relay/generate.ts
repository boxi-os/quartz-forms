import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import type { ResolvedOptions, Text } from "../types";
import type { Message, MessageCode, Params } from "../messages";

/**
 * What the relay is told about the site: its origin and, for every form that sends through the
 * relay, the rules its fields carry. Written into `config.generated.php`; the same object is what
 * the hash below is taken over, so a caller can tell whether an uploaded relay is still current.
 */
export interface RelayData {
  siteOrigin: string | null;
  forms: Record<string, RelayForm>;
}

export interface RelayForm {
  recipient: string | null;
  subject: Text | null;
  title: Text | null;
  anonymous: boolean;
  pageContext: boolean;
  encryption: string;
  redirect: string | null;
  spam: Record<string, unknown>;
  fields: Record<string, unknown>[];
}

/**
 * What only the site's owner knows and the site never sees: the signing secret, the origins, the
 * sender, the recipient addresses and the captcha secrets. Passed by the caller (QuartzControl
 * keeps it encrypted) through the environment, never through argv; written into `config.php`.
 */
export interface RelayOperator {
  secret: string;
  allowedOrigins: string[];
  from: string;
  subjectPrefix?: string;
  captchaSecret?: string;
  captchaSecrets?: Record<string, string>;
  mailer: "mail" | { sendmail: string } | { file: string };
  recipients: Record<string, string>;
  /** An absolute path on the server; empty or missing: `counters/` next to send.php. */
  counterDir?: string;
}

/** PHP literal for a JSON-like value. */
export function php(value: unknown, indent = "    "): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string") return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  const inner = indent + "    ";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${inner}${php(v, inner)},`).join("\n")}\n${indent}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return "[]";
  return `[\n${keys.map((k) => `${inner}${php(k)} => ${php(record[k], inner)},`).join("\n")}\n${indent}]`;
}

/**
 * The site's origin and base path from `configuration.baseUrl`. A site built for a sub-path has
 * its pages below that path; the redirect of the plain-form path must carry it, as the script
 * does with the page's base path. Its origin is where the redirect goes when the request's Origin
 * is not on `allowedOrigins`: with an empty list the relay used to redirect to whatever Origin
 * arrived (review finding 11, 2026-10-19).
 */
export function siteLocation(baseUrl: unknown): { origin: string | null; basePath: string } {
  const raw = typeof baseUrl === "string" ? baseUrl : "";
  if (!raw) return { origin: null, basePath: "" };
  try {
    const url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
    return { origin: url.origin, basePath: url.pathname.replace(/\/+$/, "") };
  } catch {
    return { origin: null, basePath: "" };
  }
}

export function relayData(opts: ResolvedOptions, baseUrl: unknown): RelayData {
  const { origin, basePath } = siteLocation(baseUrl);
  const forms: Record<string, RelayForm> = {};
  for (const form of Object.values(opts.forms)) {
    if (form.transport.kind !== "relay") continue;
    forms[form.id] = {
      recipient: form.recipient ?? null,
      subject: form.subject ?? null,
      // The subject falls back to the title when the form has none.
      title: form.title ?? null,
      anonymous: form.anonymous,
      pageContext: form.pageContext,
      encryption: form.encryption.mode,
      redirect:
        form.success.mode === "redirect" && form.success.slug
          ? `${basePath}/${form.success.slug.replace(/^\/+/, "")}`
          : null,
      spam: {
        honeypot: form.spam.honeypot,
        minSeconds: form.spam.minSeconds,
        noScript: form.spam.noScript,
        pow: form.spam.pow,
        powDifficulty: form.spam.powDifficulty,
        // The provider's secret key never comes from the site: `captchaSecret` in config.php.
        captcha: form.anonymous ? "none" : form.spam.captcha,
        rateLimitPerHour: form.spam.rateLimitPerHour,
        maxBytes: form.spam.maxBytes,
      },
      fields: form.fields.map((f) => {
        const rule: Record<string, unknown> = {
          name: f.name,
          type: f.type,
          required: f.type === "consent" ? true : Boolean("required" in f && f.required),
        };
        rule.label = f.type === "consent" ? f.text : f.type === "hidden" ? f.name : f.label;
        switch (f.type) {
          case "textarea":
            rule.maxLength = f.maxLength ?? form.spam.maxTextareaLength;
            break;
          case "text":
          case "email":
          case "tel":
          case "url":
          case "number":
          case "date":
            rule.maxLength = f.maxLength ?? form.spam.maxFieldLength;
            if (f.min !== undefined) rule.min = f.min;
            if (f.max !== undefined) rule.max = f.max;
            if (f.pattern !== undefined) rule.pattern = f.pattern;
            break;
          case "select":
          case "radio":
          case "checkboxes":
            rule.options = f.options.map((o) => o.value);
            // label per value, as Text (string or by language), for the mail body
            rule.optionLabels = Object.fromEntries(f.options.map((o) => [o.value, o.label]));
            break;
          case "scale":
            rule.min = f.min;
            rule.max = f.max;
            break;
          case "pgpKey":
            rule.maxLength = form.spam.maxKeyLength;
            break;
          case "hidden":
            // The relay puts this value into the mail itself; what was posted does not count.
            rule.value = f.value;
            break;
        }
        return rule;
      }),
    };
  }
  return { siteOrigin: origin, forms };
}

/** The recipient names the relay forms use, each once, in order of appearance. */
export function recipientNames(data: RelayData): string[] {
  return [
    ...new Set(
      Object.values(data.forms)
        .map((f) => f.recipient)
        .filter((r): r is string => !!r),
    ),
  ];
}

/**
 * A hash over what `config.generated.php` says, without its header (which carries the date): two
 * runs over the same definitions give the same hash, so a caller can tell an uploaded relay that
 * is still current from one the site has moved past.
 */
export function relayHash(data: RelayData): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export function generatedPhp(data: RelayData, source: string): string {
  return `<?php
/**
 * Generated by quartz-forms on ${new Date().toISOString().slice(0, 10)} from ${source}.
 * Do not edit: generate it again instead (\`npm run relay:config\`, or QuartzControl).
 * Hand-edited settings (addresses, origins, secret) live in config.php.
 */

declare(strict_types=1);

return [
    'siteOrigin' => ${php(data.siteOrigin)},
    'forms' => ${php(data.forms)},
];
`;
}

/** Why an operator record cannot become a config.php, one message per problem. */
export function operatorProblems(op: unknown): Message[] {
  const out: Message[] = [];
  const add = (code: MessageCode, params?: Params): void => {
    out.push({ path: "", code, ...(params ? { params } : {}) });
  };
  if (!op || typeof op !== "object" || Array.isArray(op)) {
    add("operatorNotObject");
    return out;
  }
  const o = op as Record<string, unknown>;
  if (typeof o.secret !== "string" || o.secret.length < 32) add("operatorSecret");
  if (!Array.isArray(o.allowedOrigins) || o.allowedOrigins.some((x) => typeof x !== "string"))
    add("operatorOrigins");
  if (typeof o.from !== "string" || !o.from.includes("@")) add("operatorFrom");
  const mailer = o.mailer;
  const filled = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";
  const mailerOk =
    mailer === "mail" ||
    (!!mailer &&
      typeof mailer === "object" &&
      (filled((mailer as Record<string, unknown>).sendmail) ||
        filled((mailer as Record<string, unknown>).file)));
  if (!mailerOk) add("operatorMailer");
  for (const key of ["recipients", "captchaSecrets"] as const) {
    const v = o[key];
    if (v === undefined && key === "captchaSecrets") continue;
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.values(v).some((x) => typeof x !== "string")
    )
      add("operatorRecord", { key });
  }
  for (const key of ["subjectPrefix", "captchaSecret", "counterDir"] as const)
    if (o[key] !== undefined && typeof o[key] !== "string") add("operatorText", { key });
  if (typeof o.counterDir === "string" && o.counterDir && !o.counterDir.startsWith("/"))
    add("operatorCounterDir");
  return out;
}

/**
 * config.php from the operator's values. Rewritten on every run that carries them: the values
 * live with the caller, and this file is only their copy for the server.
 */
export function operatorPhp(op: RelayOperator): string {
  const counterDir = op.counterDir?.trim() ? php(op.counterDir.trim()) : "__DIR__ . '/counters'";
  const lines = [
    `    'secret' => ${php(op.secret)},`,
    `    'allowedOrigins' => ${php(op.allowedOrigins, "    ")},`,
    `    'from' => ${php(op.from)},`,
    `    'subjectPrefix' => ${php(op.subjectPrefix ?? "")},`,
    `    'captchaSecret' => ${php(op.captchaSecret ?? "")},`,
  ];
  if (op.captchaSecrets && Object.keys(op.captchaSecrets).length > 0)
    lines.push(`    'captchaSecrets' => ${php(op.captchaSecrets, "    ")},`);
  lines.push(
    `    'mailer' => ${php(op.mailer, "    ")},`,
    `    'recipients' => ${php(op.recipients, "    ")},`,
    `    'counterDir' => ${counterDir},`,
  );
  return `<?php
/**
 * quartz-forms relay: the owner's settings (secret, origins, sender, addresses). Written by
 * quartz-forms from values its caller keeps; it is rewritten on the next upload, so a change made
 * here by hand does not last. Never put this file on the site.
 */

declare(strict_types=1);

$generated = require __DIR__ . '/config.generated.php';

return $generated + [
${lines.join("\n")}
];
`;
}

/** config.php from the example, once, with a fresh secret and the recipient names to fill in. */
export function examplePhp(example: string, recipients: string[]): string {
  const secret = crypto.randomBytes(32).toString("base64url");
  const lines =
    recipients.map((r) => `        ${php(r)} => 'you@example.org',`).join("\n") ||
    "        'owner' => 'you@example.org',";
  return example
    .replace("'REPLACE-WITH-A-LONG-RANDOM-STRING'", php(secret))
    .replace(/'recipients' => \[\n[\s\S]*?\n {4}\],/, `'recipients' => [\n${lines}\n    ],`);
}

export interface PatternError {
  form: string;
  field: string;
  pattern: string;
  why: string;
}

export type PatternCheck =
  | { status: "none" }
  | { status: "no-php"; count: number }
  | { status: "failed"; count: number; message: string }
  | { status: "checked"; count: number; pcre: string; php: string; errors: PatternError[] };

/**
 * The build and the browser read a pattern as JavaScript (`u`), the relay applies it with PCRE,
 * and a pattern PCRE cannot compile makes the relay refuse every value of its field (second
 * review, finding 3, 2026-10-19). The build refuses the syntax no PCRE2 reads (src/validate.ts);
 * what is left (a property name this PCRE does not know, a lookbehind of bounded variable length
 * before PCRE2 10.43) is asked of the php on this machine, compiled as send.php compiles it: the
 * same delimiter, the same anchors, the same flag. send.php first spells seven escapes out
 * (`qf_pcre_pattern`), which changes what they match, not whether PCRE can read the pattern.
 * The host's PCRE may still be older.
 */
export function checkPatterns(data: RelayData): PatternCheck {
  const patterns = Object.entries(data.forms).flatMap(([id, form]) =>
    form.fields
      .filter((rule) => typeof rule.pattern === "string")
      .map((rule) => ({ form: id, field: String(rule.name), pattern: String(rule.pattern) })),
  );
  if (patterns.length === 0) return { status: "none" };
  const probe = String.raw`
    $in = json_decode(stream_get_contents(STDIN), true);
    $errors = [];
    foreach ($in as $p) {
        $why = null;
        set_error_handler(function (int $no, string $message) use (&$why): bool {
            $why = preg_replace('/^preg_match\(\): /', '', $message);
            return true;
        });
        $m = preg_match("\x01^(?:" . $p['pattern'] . ")$\x01u", '');
        restore_error_handler();
        if ($m === false) {
            $errors[] = $p + ['why' => $why ?? preg_last_error_msg()];
        }
    }
    echo json_encode(['pcre' => explode(' ', PCRE_VERSION)[0], 'php' => PHP_VERSION, 'errors' => $errors]);
  `;
  const r = spawnSync("php", ["-r", probe], { input: JSON.stringify(patterns), encoding: "utf8" });
  if ((r.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT")
    return { status: "no-php", count: patterns.length };
  if (r.status !== 0)
    return { status: "failed", count: patterns.length, message: r.stderr || String(r.error) };
  const parsed = JSON.parse(r.stdout) as { pcre: string; php: string; errors: PatternError[] };
  return { status: "checked", count: patterns.length, ...parsed };
}
