import fs from "node:fs";
import path from "node:path";
import type {
  FormDefinition,
  FormField,
  PgpKeySource,
  ResolvedForm,
  ResolvedOptions,
  Text,
} from "./types";
import { availableLocales, textKeys } from "./i18n";
import { isTemplateName, templateOf } from "./templates";
import { publicKeyBlock } from "./pgp/armor";

/**
 * Validation level 1 of three: the form definitions, at build time. The rules come from the
 * fields of the definition (src/types.ts); the browser (level 2) and the relay (level 3) derive
 * theirs from the same fields. A problem stops the build; a hint is logged once.
 */
export interface Validation {
  problems: string[];
  hints: string[];
}

export const FORM_ID = /^[a-z0-9][a-z0-9-]*$/;
export const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
export const LANGUAGE_OPTION = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]+)*$|^auto$/;

/** Names the submission envelope uses itself; a field may not take them. */
export const RESERVED_NAMES = new Set([
  "form",
  "lang",
  "page",
  "ts",
  "pow",
  "captcha",
  "encrypted",
  "ciphertext",
  "fields",
]);

/** Autocomplete tokens that name a person; required fields with them break `anonymous`. */
const PERSONAL_AUTOCOMPLETE = new Set([
  "name",
  "given-name",
  "family-name",
  "additional-name",
  "honorific-prefix",
  "honorific-suffix",
  "nickname",
  "username",
  "street-address",
  "address-line1",
  "address-line2",
  "postal-code",
  "tel",
  "email",
  "bday",
  "organization",
]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function textProblem(text: Text | undefined, at: string): string | undefined {
  if (text === undefined) return undefined;
  if (typeof text === "string") return text.trim() ? undefined : `${at}: empty text`;
  if (!isObject(text)) return `${at}: a text is a string or a record of language → string`;
  const entries = Object.entries(text);
  if (entries.length === 0) return `${at}: empty text record`;
  for (const [lang, value] of entries) {
    if (typeof value !== "string" || !value.trim()) return `${at}.${lang}: empty text`;
  }
  return undefined;
}

function checkField(field: FormField, at: string, out: Validation): void {
  if (!isObject(field)) {
    out.problems.push(`${at}: a field is an object with a type and a name`);
    return;
  }
  if (typeof field.name !== "string" || !FIELD_NAME.test(field.name)) {
    out.problems.push(
      `${at}: field name ${JSON.stringify(field.name)} must match ${FIELD_NAME} (a letter, then letters, digits, _ or -)`,
    );
  } else if (RESERVED_NAMES.has(field.name) || field.name.startsWith("_")) {
    out.problems.push(`${at}: field name "${field.name}" is reserved by the submission envelope`);
  }

  const texts: [string, Text | undefined][] = [];
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "url":
    case "number":
    case "date":
    case "textarea":
      texts.push(["label", field.label], ["placeholder", field.placeholder], ["hint", field.hint]);
      if (field.min !== undefined && field.max !== undefined && field.min > field.max)
        out.problems.push(`${at}: min ${field.min} is above max ${field.max}`);
      if (field.maxLength !== undefined && field.maxLength < 1)
        out.problems.push(`${at}: maxLength must be at least 1`);
      if (field.pattern !== undefined) {
        try {
          new RegExp(field.pattern, "u");
        } catch (e) {
          out.problems.push(`${at}: pattern is not a regular expression (${(e as Error).message})`);
        }
      }
      break;
    case "select":
    case "radio":
    case "checkboxes": {
      texts.push(["label", field.label], ["hint", field.hint]);
      if (!Array.isArray(field.options) || field.options.length === 0) {
        out.problems.push(`${at}: a ${field.type} field needs at least one option`);
        break;
      }
      const seen = new Set<string>();
      field.options.forEach((opt, i) => {
        if (!isObject(opt) || typeof opt.value !== "string" || !opt.value.length) {
          out.problems.push(`${at}.options[${i}]: an option is { value, label } with a value`);
          return;
        }
        if (seen.has(opt.value))
          out.problems.push(`${at}.options[${i}]: value "${opt.value}" twice`);
        seen.add(opt.value);
        texts.push([`options[${i}].label`, opt.label]);
      });
      break;
    }
    case "checkbox":
      texts.push(["label", field.label], ["hint", field.hint]);
      break;
    case "scale":
      texts.push(
        ["label", field.label],
        ["hint", field.hint],
        ["minLabel", field.minLabel],
        ["maxLabel", field.maxLabel],
      );
      if (!Number.isInteger(field.min) || !Number.isInteger(field.max))
        out.problems.push(`${at}: a scale has integer min and max`);
      else if (field.min >= field.max)
        out.problems.push(`${at}: scale min ${field.min} must be below max ${field.max}`);
      else if (field.max - field.min > 20)
        out.problems.push(`${at}: a scale spans at most 21 steps`);
      break;
    case "consent":
      texts.push(["text", field.text], ["linkLabel", field.linkLabel]);
      if (field.text === undefined) out.problems.push(`${at}: a consent field needs a text`);
      break;
    case "pgpKey":
      texts.push(["label", field.label], ["hint", field.hint]);
      break;
    case "hidden":
      if (typeof field.value !== "string") out.problems.push(`${at}: a hidden field needs a value`);
      break;
    default:
      out.problems.push(
        `${at}: unknown field type ${JSON.stringify((field as { type?: unknown }).type)}`,
      );
      return;
  }
  if (field.type !== "hidden" && field.type !== "consent" && field.label === undefined)
    out.problems.push(`${at}: a ${field.type} field needs a label`);
  for (const [key, text] of texts) {
    const p = textProblem(text, `${at}.${key}`);
    if (p) out.problems.push(p);
  }
}

/** Does this field, as written, ask for something that identifies a person? */
export function isPersonalField(field: FormField): boolean {
  switch (field.type) {
    case "email":
    case "tel":
      return true;
    case "text":
    case "textarea":
    case "url":
    case "date":
    case "number":
      return field.autocomplete !== undefined && PERSONAL_AUTOCOMPLETE.has(field.autocomplete);
    case "pgpKey":
      return true;
    default:
      return false;
  }
}

function checkKeySource(name: string, src: PgpKeySource, out: Validation): void {
  const at = `keys.${name}`;
  if (!isObject(src)) {
    out.problems.push(`${at}: a key is { file } or { armored }`);
    return;
  }
  const file = typeof src.file === "string" && src.file.trim() !== "" ? src.file : undefined;
  const armored =
    typeof src.armored === "string" && src.armored.trim() !== "" ? src.armored : undefined;
  if ((file === undefined) === (armored === undefined)) {
    out.problems.push(`${at}: exactly one of file or armored`);
    return;
  }
  if (armored !== undefined) {
    const block = publicKeyBlock(armored);
    if (block.problem) out.problems.push(`${at}.armored: ${block.problem}`);
    return;
  }
  const abs = path.resolve(process.cwd(), file!);
  if (!abs.startsWith(process.cwd() + path.sep)) {
    out.problems.push(`${at}.file: ${src.file} lies outside the site`);
    return;
  }
  let text: string;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    out.problems.push(`${at}.file: ${src.file} not found or not readable`);
    return;
  }
  const block = publicKeyBlock(text);
  if (block.problem) out.problems.push(`${at}.file: ${src.file}: ${block.problem}`);
}

/**
 * Rough upper bound of a submission's size in bytes: every field filled to its length limit with
 * three-byte characters (CJK), the envelope on top, and for an encrypting form the armor's
 * four-thirds. The review of 0.1.1 found the defaults did not fit together (a 20 000-character
 * textarea in CJK is about 60 kB, armored about 81 kB, the limit was 65 536).
 */
export function submissionCapacity(form: ResolvedForm): number {
  let chars = 0;
  for (const f of form.fields) {
    switch (f.type) {
      case "textarea":
        chars += f.maxLength ?? form.spam.maxTextareaLength;
        break;
      case "text":
      case "email":
      case "tel":
      case "url":
      case "number":
      case "date":
        chars += f.maxLength ?? form.spam.maxFieldLength;
        break;
      case "pgpKey":
        chars += form.spam.maxKeyLength;
        break;
      default:
        chars += 64; // options, scales, boxes, hidden values: short by construction
    }
  }
  const bytes = chars * 3 + 1024;
  return form.encryption.mode === "off" ? bytes : Math.ceil((bytes * 4) / 3) + 1024;
}

function checkForm(form: ResolvedForm, raw: FormDefinition, keyNames: string[], out: Validation) {
  const at = `forms.${form.id}`;
  if (!FORM_ID.test(form.id))
    out.problems.push(`${at}: form id must match ${FORM_ID} (lower-case letters, digits, -)`);

  if (raw.template !== undefined && !isTemplateName(raw.template))
    out.problems.push(`${at}.template: unknown template ${JSON.stringify(raw.template)}`);

  for (const [key, text] of [
    ["title", form.title],
    ["description", form.description],
    ["submitLabel", form.submitLabel],
    ["subject", form.subject],
    ["success.text", form.success.text],
  ] as [string, Text | undefined][]) {
    const p = textProblem(text, `${at}.${key}`);
    if (p) out.problems.push(p);
  }

  if (!Array.isArray(form.fields) || form.fields.length === 0) {
    out.problems.push(`${at}: no fields (write fields or choose a template)`);
  } else {
    const names = new Set<string>();
    let keyFields = 0;
    form.fields.forEach((field, i) => {
      checkField(field, `${at}.fields[${i}]`, out);
      if (isObject(field) && typeof field.name === "string") {
        if (names.has(field.name))
          out.problems.push(`${at}.fields[${i}]: field name "${field.name}" twice`);
        names.add(field.name);
      }
      if (isObject(field) && field.type === "pgpKey") keyFields++;
    });
    if (keyFields > 1) out.problems.push(`${at}: at most one pgpKey field`);
  }

  // Transport
  const tr = form.transport;
  switch (tr.kind) {
    case "relay":
    case "endpoint": {
      if (!tr.url) {
        out.problems.push(`${at}.transport.url: ${tr.kind} needs a URL`);
      } else if (!/^https?:\/\//.test(tr.url)) {
        out.problems.push(`${at}.transport.url: ${tr.url} is not an http(s) URL`);
      } else if (
        /^http:\/\//.test(tr.url) &&
        !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(tr.url)
      ) {
        out.hints.push(
          `${at}.transport.url: ${tr.url} sends submissions unencrypted in transit (http)`,
        );
      }
      if (tr.kind === "relay" && !form.recipient)
        out.problems.push(`${at}.recipient: the relay needs the recipient's name`);
      break;
    }
    case "formspree":
    case "web3forms":
      if (!tr.url)
        out.problems.push(`${at}.transport.url: ${tr.kind} needs the form id or access key`);
      if (form.anonymous)
        out.hints.push(
          `${at}: anonymous, but ${tr.kind} sees the sender's address; see the README`,
        );
      break;
    case "mailto":
      if (!form.recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.recipient))
        out.problems.push(`${at}.recipient: mailto needs an e-mail address`);
      break;
    default:
      out.problems.push(`${at}.transport.kind: unknown kind ${JSON.stringify(tr.kind)}`);
  }
  if (tr.format !== undefined && tr.format !== "json" && tr.format !== "form")
    out.problems.push(`${at}.transport.format: json or form`);

  // Encryption
  const enc = form.encryption;
  if (!["required", "optional", "off"].includes(enc.mode))
    out.problems.push(`${at}.encryption.mode: required, optional or off`);
  if (enc.mode !== "off") {
    if (enc.keys.length === 0) out.problems.push(`${at}.encryption: no keys to encrypt to`);
    for (const name of enc.keys)
      if (!keyNames.includes(name))
        out.problems.push(`${at}.encryption.keys: unknown key "${name}"`);
    if (tr.kind === "mailto")
      out.hints.push(`${at}: encrypted mailto puts the whole ciphertext into the mail body`);
  }

  // Spam
  const sp = form.spam;
  if (sp.minSeconds < 0) out.problems.push(`${at}.spam.minSeconds: not below 0`);
  // 20 bits take about 2 s in a Worker on a desktop and several times that on a phone; 24 bits
  // took minutes (review finding 18, measured in Chrome, 2026-10-19).
  if (!Number.isInteger(sp.powDifficulty) || sp.powDifficulty < 8 || sp.powDifficulty > 20)
    out.problems.push(`${at}.spam.powDifficulty: an integer from 8 to 20`);
  if (!["none", "turnstile", "hcaptcha"].includes(sp.captcha))
    out.problems.push(`${at}.spam.captcha: none, turnstile or hcaptcha`);
  if (sp.captcha !== "none" && !sp.captchaSiteKey && !form.anonymous)
    out.problems.push(`${at}.spam.captchaSiteKey: ${sp.captcha} needs the site key`);
  if (sp.captcha !== "none" && form.anonymous)
    out.hints.push(`${at}: anonymous, so the ${sp.captcha} captcha is not loaded`);
  if (tr.kind !== "relay") {
    if (sp.pow) out.hints.push(`${at}.spam.pow: has no effect without the relay`);
    if (sp.rateLimitPerHour > 0 && raw.spam?.rateLimitPerHour !== undefined)
      out.hints.push(`${at}.spam.rateLimitPerHour: has no effect without the relay`);
  } else if (sp.pow && sp.noScript) {
    // Only the script supplies a proof, so a plain post walks past it (review finding 5c).
    out.hints.push(
      `${at}.spam.pow: a plain post without JavaScript (noScript: true) skips it; noScript: false requires the script`,
    );
  }
  if (sp.pow && tr.kind === "relay" && sp.powDifficulty >= 18 && sp.powDifficulty <= 20)
    out.hints.push(
      `${at}.spam.powDifficulty: ${sp.powDifficulty} bits take seconds on a phone before every message`,
    );
  for (const key of ["maxFieldLength", "maxTextareaLength", "maxKeyLength", "maxBytes"] as const)
    if (!Number.isInteger(sp[key]) || sp[key] < 1)
      out.problems.push(`${at}.spam.${key}: a positive integer`);
  if (Number.isInteger(sp.maxBytes) && sp.maxBytes >= 1) {
    const capacity = submissionCapacity(form);
    if (capacity > sp.maxBytes)
      out.hints.push(
        `${at}.spam.maxBytes: ${sp.maxBytes} is below what the fields may hold (about ${capacity} bytes` +
          `${enc.mode === "off" ? "" : " once encrypted"}); a long message would be refused as too large`,
      );
  }

  // Anonymous: judged on the fields as written (template + definition), because resolveForm
  // has already made the personal ones optional.
  if (form.anonymous) {
    if (raw.pageContext === true)
      out.hints.push(`${at}.pageContext: anonymous, so the page is not sent along`);
    const written =
      raw.fields ?? (isTemplateName(raw.template) ? templateOf(raw.template).fields : undefined);
    written?.forEach((field, i) => {
      if (isObject(field) && "required" in field && field.required && isPersonalField(field))
        out.hints.push(
          `${at}.fields[${i}]: anonymous, so "${field.name}" (${field.type}) cannot be required and is made optional`,
        );
    });
  }

  // Success
  if (form.success.mode !== "inline" && form.success.mode !== "redirect")
    out.problems.push(`${at}.success.mode: inline or redirect`);
  if (form.success.mode === "redirect" && !form.success.slug)
    out.problems.push(`${at}.success.slug: redirect needs the slug of a page`);
}

export function validate(opts: ResolvedOptions, rawForms: Record<string, unknown>): Validation {
  const out: Validation = { problems: [], hints: [] };
  const keyNames = Object.keys(opts.keys);

  for (const [name, src] of Object.entries(opts.keys)) checkKeySource(name, src, out);

  for (const form of Object.values(opts.forms)) {
    const raw = rawForms[form.id];
    checkForm(form, isObject(raw) ? (raw as FormDefinition) : {}, keyNames, out);
  }

  if (!LANGUAGE_OPTION.test(opts.language))
    out.problems.push(`language: "${opts.language}" is neither auto nor a language code`);
  if (!opts.frontmatterKey.trim()) out.problems.push("frontmatterKey: empty");
  if (opts.layoutForm && !(opts.layoutForm in opts.forms))
    out.problems.push(`layoutForm: no form "${opts.layoutForm}"`);
  if (!opts.codeBlockLang.trim() || /\s/.test(opts.codeBlockLang))
    out.problems.push("codeBlockLang: one word without spaces");

  const known = new Set<string>(textKeys());
  const locales = availableLocales().map((l) => l.toLowerCase().split("-")[0]);
  for (const [locale, entries] of Object.entries(opts.texts)) {
    if (!locales.includes(locale.toLowerCase().split(/[-_]/)[0]!))
      out.hints.push(
        `texts.${locale}: the plugin has no texts in this language; they are used as written`,
      );
    if (!isObject(entries)) {
      out.problems.push(`texts.${locale}: a record of text key → wording`);
      continue;
    }
    for (const key of Object.keys(entries))
      if (!known.has(key)) out.hints.push(`texts.${locale}.${key}: no such text key`);
  }

  return out;
}
