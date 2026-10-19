#!/usr/bin/env node
// Writes relay/php/config.generated.php from a site's quartz.config.yaml: the forms, their
// fields and spam settings, so the relay checks what the build and the browser check. Creates
// relay/php/config.php once (with a fresh secret) and never touches it again: addresses and
// origins are yours.
//
//   npm run relay:config -- /path/to/site [--out relay/php]
//
// Needs the plugin built (`npm run build`): the resolver comes from dist/.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function usage(message) {
  console.error(message);
  console.error("usage: npm run relay:config -- <site directory> [--out <directory>]");
  process.exit(2);
}

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outDir =
  outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "") : path.join(root, "relay", "php");
const site = args.filter((a, i) => a !== "--out" && i !== outIndex + 1)[0];
if (!site) usage("no site directory given");

const configPath = path.join(path.resolve(site), "quartz.config.yaml");

/** A path as the message names it: relative while it stays below the cwd, else absolute. */
function shown(file) {
  const rel = path.relative(process.cwd(), file);
  return rel.startsWith("..") ? file : rel;
}
if (!fs.existsSync(configPath)) usage(`${configPath} not found`);

const { resolveOrThrow } = await import(path.join(root, "dist", "index.js"));
const yaml = YAML.parse(fs.readFileSync(configPath, "utf8"));
const entries = (yaml?.plugins ?? []).filter((p) => {
  const source = String(p?.source ?? "");
  return /(^|[/:])quartz-forms(\.git)?(#.*)?$/.test(source) || p?.name === "quartz-forms";
});
if (entries.length === 0) usage(`no quartz-forms entry in ${configPath}`);
if (entries.length > 1)
  console.warn(`relay-config: ${entries.length} quartz-forms entries; taking the first`);

// Keys may name files relative to the site; resolve them from there.
const cwd = process.cwd();
process.chdir(path.resolve(site));
const opts = resolveOrThrow(entries[0].options ?? {});
process.chdir(cwd);

/** PHP literal for a JSON-like value. */
function php(value, indent = "    ") {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string") return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  const inner = indent + "    ";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${inner}${php(v, inner)},`).join("\n")}\n${indent}]`;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return "[]";
  return `[\n${keys.map((k) => `${inner}${php(k)} => ${php(value[k], inner)},`).join("\n")}\n${indent}]`;
}

// A site built for a sub-path (baseUrl with a path) has its pages below that path; the redirect
// of the plain-form path must carry it, as the script does with the page's base path.
const basePath = (() => {
  const baseUrl = String(yaml?.configuration?.baseUrl ?? "");
  if (!baseUrl) return "";
  try {
    return new URL(/^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`).pathname.replace(
      /\/+$/,
      "",
    );
  } catch {
    return "";
  }
})();

const forms = {};
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
      captcha: form.anonymous ? "none" : form.spam.captcha,
      // The provider's secret key is yours; set it in config.php under forms.<id>.spam.captchaSecret
      // or here once you have it. It never comes from the site.
      captchaSecret: "",
      rateLimitPerHour: form.spam.rateLimitPerHour,
      maxBytes: form.spam.maxBytes,
    },
    fields: form.fields.map((f) => {
      const rule = {
        name: f.name,
        type: f.type,
        required: f.type === "consent" ? true : Boolean(f.required),
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
      }
      return rule;
    }),
  };
}

const recipients = [
  ...new Set(
    Object.values(forms)
      .map((f) => f.recipient)
      .filter(Boolean),
  ),
];
const generated = `<?php
/**
 * Generated by quartz-forms (scripts/relay-config.mjs) on ${new Date().toISOString().slice(0, 10)}
 * from ${configPath}. Do not edit: run \`npm run relay:config\` again instead.
 * Hand-edited settings (addresses, origins, secret) live in config.php.
 */

declare(strict_types=1);

return [
    'forms' => ${php(forms)},
];
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "config.generated.php"), generated);
console.log(
  `wrote ${shown(path.join(outDir, "config.generated.php"))} (${Object.keys(forms).length} form(s) on the relay)`,
);

const configFile = path.join(outDir, "config.php");
if (!fs.existsSync(configFile)) {
  const example = fs.readFileSync(path.join(root, "relay", "php", "config.example.php"), "utf8");
  const secret = crypto.randomBytes(32).toString("base64url");
  const lines =
    recipients.map((r) => `        ${php(r)} => 'you@example.org',`).join("\n") ||
    "        'owner' => 'you@example.org',";
  const filled = example
    .replace("'REPLACE-WITH-A-LONG-RANDOM-STRING'", php(secret))
    .replace(/'recipients' => \[\n[\s\S]*?\n {4}\],/, `'recipients' => [\n${lines}\n    ],`);
  fs.writeFileSync(configFile, filled);
  console.log(
    `created ${shown(configFile)} with a fresh secret; fill in origins, from and the ${recipients.length} recipient address(es)`,
  );
} else {
  console.log(`${shown(configFile)} kept (addresses and secret are yours)`);
}
