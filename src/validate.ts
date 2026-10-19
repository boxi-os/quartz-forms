import fs from "node:fs";
import path from "node:path";
import type {
  FormDefinition,
  FormField,
  PgpKeySource,
  ResolvedForm,
  ResolvedOptions,
  SpamConfig,
  Text,
} from "./types";
import { availableLocales, textKeys } from "./i18n";
import { isTemplateName, templateOf } from "./templates";
import { publicKeyBlock } from "./pgp/armor";
import {
  formatMessage,
  messageText,
  type Message,
  type MessageCode,
  type Params,
} from "./messages";
import { CONTROLLER_TYPES, conditionOf, stepsOf } from "./conditions";

/**
 * Validation level 1 of three: the form definitions, at build time. The rules come from the
 * fields of the definition (src/types.ts); the browser (level 2) and the relay (level 3) derive
 * theirs from the same fields. A problem stops the build; a hint is logged once.
 */
export interface Validation {
  /** The problems as the build log prints them (English). */
  problems: string[];
  hints: string[];
  /** The same, as path, code and values, for another language (src/messages). */
  problemMessages: Message[];
  hintMessages: Message[];
}

function problem(out: Validation, path: string, code: MessageCode, params?: Params): void {
  const m: Message = { path, code, ...(params ? { params } : {}) };
  out.problemMessages.push(m);
  out.problems.push(formatMessage(m));
}

function hint(out: Validation, path: string, code: MessageCode, params?: Params): void {
  const m: Message = { path, code, ...(params ? { params } : {}) };
  out.hintMessages.push(m);
  out.hints.push(formatMessage(m));
}

export const FORM_ID = /^[a-z0-9][a-z0-9-]*$/;
export const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
export const LANGUAGE_OPTION = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]+)*$|^auto$/;

/**
 * The JavaScript regular-expression syntax no PCRE2 compiles, found with one walk over a pattern
 * `new RegExp(pattern, "u")` has accepted. The build and the browser read a pattern as
 * JavaScript, the relay applies it with PCRE and, fail-closed, refuses every value of a field
 * whose pattern PCRE cannot read: the visitor saw "use the requested format" for a value the
 * browser had just accepted, and only the server's error log said why (second review,
 * finding 3, 2026-10-19). What a particular PCRE version refuses beyond this list (a property
 * name it does not know, a lookbehind of bounded variable length before PCRE2 10.43) is asked of
 * the php on the owner's machine by `npm run relay:config`.
 *
 * After the `u` check every `\u` is a code point escape, every `{` a quantifier and every `[`
 * opens a class, so the walk needs no more than escapes, classes and the group depth.
 */
export function jsOnlyPattern(pattern: string): string | undefined {
  const code = jsOnlyPatternCode(pattern);
  return code ? messageText(code) : undefined;
}

/** jsOnlyPattern's answer as a message code. */
export function jsOnlyPatternCode(pattern: string): MessageCode | undefined {
  const lookbehinds: number[] = []; // the depth at which each open lookbehind began
  let depth = 0;
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      if (pattern[i + 1] === "u") return "patternJsU";
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    switch (c) {
      case "[":
        if (pattern.startsWith("[^]", i)) return "patternJsNegClass";
        if (pattern[i + 1] === "]") return "patternJsEmptyClass";
        inClass = true;
        break;
      case "(":
        depth++;
        if (pattern.startsWith("(?<=", i) || pattern.startsWith("(?<!", i)) lookbehinds.push(depth);
        if (pattern[i + 1] === "?") i++; // the `?` of a group prefix is no quantifier
        break;
      case ")":
        if (lookbehinds[lookbehinds.length - 1] === depth) lookbehinds.pop();
        depth--;
        break;
      case "*":
      case "+":
      case "{":
        if (lookbehinds.length > 0 && (c !== "{" || /^\{\d+,\}/.test(pattern.slice(i))))
          return "patternJsLookbehind";
        break;
    }
  }
  return undefined;
}

/**
 * Names the submission envelope uses itself; a field may not take them. The last three travel
 * flat beside the fields on the plain path (the hidden page title, the captcha widgets' tokens),
 * and the relay lifts them out of the fields, so a field of that name would arrive empty
 * (second review, finding 9, 2026-10-19). The honeypot's name starts with "_", which FIELD_NAME
 * does not allow.
 */
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
  "pageTitle",
  "cf-turnstile-response",
  "h-captcha-response",
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

function checkText(text: Text | undefined, at: string, out: Validation): void {
  if (text === undefined) return;
  if (typeof text === "string") {
    if (!text.trim()) problem(out, at, "textEmpty");
    return;
  }
  if (!isObject(text)) return problem(out, at, "textShape");
  const entries = Object.entries(text);
  if (entries.length === 0) return problem(out, at, "textRecordEmpty");
  for (const [lang, value] of entries) {
    if (typeof value !== "string" || !value.trim())
      return problem(out, `${at}.${lang}`, "textEmpty");
  }
}

function checkField(field: FormField, at: string, out: Validation): void {
  if (!isObject(field)) {
    problem(out, at, "fieldShape");
    return;
  }
  // A page break has no name and no label; its title is a text, its condition is checked with the
  // fields' (checkConditions), its place with the form (checkSteps).
  if (field.type === "pageBreak") {
    checkText(field.title, `${at}.title`, out);
    return;
  }
  if (typeof field.name !== "string" || !FIELD_NAME.test(field.name)) {
    problem(out, at, "fieldNamePattern", {
      name: JSON.stringify(field.name),
      pattern: String(FIELD_NAME),
    });
  } else if (RESERVED_NAMES.has(field.name) || field.name.startsWith("_")) {
    problem(out, at, "fieldNameReserved", { name: field.name });
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
        problem(out, at, "minAboveMax", { min: field.min, max: field.max });
      if (field.maxLength !== undefined && field.maxLength < 1) problem(out, at, "maxLengthMin");
      if (field.pattern !== undefined) {
        try {
          new RegExp(field.pattern, "u");
          const jsOnly = jsOnlyPatternCode(field.pattern);
          if (jsOnly) problem(out, `${at}.pattern`, jsOnly);
        } catch (e) {
          problem(out, at, "patternInvalid", { error: (e as Error).message });
        }
      }
      break;
    case "select":
    case "radio":
    case "checkboxes": {
      texts.push(["label", field.label], ["hint", field.hint]);
      if (!Array.isArray(field.options) || field.options.length === 0) {
        problem(out, at, "optionsNeeded", { type: field.type });
        break;
      }
      const seen = new Set<string>();
      field.options.forEach((opt, i) => {
        if (!isObject(opt) || typeof opt.value !== "string" || !opt.value.length) {
          problem(out, `${at}.options[${i}]`, "optionShape");
          return;
        }
        if (seen.has(opt.value))
          problem(out, `${at}.options[${i}]`, "optionTwice", { value: opt.value });
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
        problem(out, at, "scaleInteger");
      else if (field.min >= field.max)
        problem(out, at, "scaleOrder", { min: field.min, max: field.max });
      else if (field.max - field.min > 20) problem(out, at, "scaleSpan");
      break;
    case "consent":
      texts.push(["text", field.text], ["linkLabel", field.linkLabel]);
      if (field.text === undefined) problem(out, at, "consentText");
      break;
    case "pgpKey":
      texts.push(["label", field.label], ["hint", field.hint]);
      break;
    case "hidden":
      if (typeof field.value !== "string") problem(out, at, "hiddenValue");
      break;
    default:
      problem(out, at, "fieldTypeUnknown", {
        type: JSON.stringify((field as { type?: unknown }).type),
      });
      return;
  }
  // Width and arrangement: the schema names the values, the build holds a typo to them.
  if (field.type !== "hidden") {
    const width = (field as { width?: unknown }).width;
    if (width !== undefined && width !== "full" && width !== "half" && width !== "third")
      problem(out, `${at}.width`, "widthValue");
  }
  if (field.type === "select" || field.type === "radio" || field.type === "checkboxes") {
    const layout = (field as { layout?: unknown }).layout;
    if (layout !== undefined && layout !== "stacked" && layout !== "inline")
      problem(out, `${at}.layout`, "layoutValue");
    else if (layout === "inline" && field.type === "select")
      hint(out, `${at}.layout`, "layoutSelect");
  }
  if (field.type !== "hidden" && field.type !== "consent" && field.label === undefined)
    problem(out, at, "labelNeeded", { type: field.type });
  for (const [key, text] of texts) checkText(text, `${at}.${key}`, out);
}

/**
 * The conditions of a form's fields (`showIf`): well formed, naming an earlier field of a type
 * with values to compare, with values that field can have. "Earlier" also rules out a field that
 * names itself and any cycle, and lets browser and relay decide in one pass in form order.
 */
function checkConditions(fields: FormField[], at: string, out: Validation): void {
  const seen = new Map<string, FormField>();
  fields.forEach((field, i) => {
    if (!isObject(field)) return;
    const raw = (field as { showIf?: unknown }).showIf;
    const here = `${at}.fields[${i}].showIf`;
    if (raw !== undefined) {
      if (field.type === "hidden" || field.type === "consent")
        problem(out, here, "showIfNotAllowed", { type: field.type });
      else {
        const condition = conditionOf(field);
        const name = isObject(raw) ? raw.field : undefined;
        if (!condition) problem(out, here, "showIfShape");
        else if (!fields.some((f) => isObject(f) && f.name === condition.field))
          problem(out, here, "showIfUnknown", { field: String(name) });
        else if (!seen.has(condition.field))
          problem(out, here, "showIfLater", { field: condition.field });
        else {
          const controller = seen.get(condition.field)!;
          if (!(CONTROLLER_TYPES as readonly string[]).includes(controller.type))
            problem(out, here, "showIfController", {
              field: condition.field,
              type: controller.type,
            });
          else
            for (const value of condition.equals)
              if (!controllerHas(controller, value))
                problem(out, here, "showIfValue", { field: condition.field, value });
        }
      }
    }
    if (typeof field.name === "string") seen.set(field.name, field);
  });
}

/**
 * Where page breaks may stand: not first and not last (a step without fields would be a page with
 * nothing but "Next"), never two in a row. A consent field does not stand in a step with a
 * condition: the step's condition reaches each of its fields (conditionsOf), so a skipped step
 * would send the message without the consent, and drop one that was given (third review, H1,
 * 2026-10-19). A step that holds nothing but hidden values shows the visitor nothing either; that
 * is said, not refused.
 */
function checkSteps(fields: FormField[], at: string, out: Validation): void {
  if (!fields.some((f) => isObject(f) && f.type === "pageBreak")) return;
  let conditional = false;
  fields.forEach((field, i) => {
    if (!isObject(field)) return;
    if (field.type === "consent" && conditional)
      problem(out, `${at}.fields[${i}]`, "consentInConditionalStep");
    if (field.type !== "pageBreak") return;
    conditional = (field as { showIf?: unknown }).showIf !== undefined;
    if (i === 0 || i === fields.length - 1) problem(out, `${at}.fields[${i}]`, "pageBreakEdge");
    else if (isObject(fields[i - 1]) && fields[i - 1]!.type === "pageBreak")
      problem(out, `${at}.fields[${i}]`, "pageBreakTwice");
  });
  stepsOf(fields).forEach((step, i) => {
    if (step.fields.length > 0 && step.fields.every((f) => f.type === "hidden"))
      hint(out, at, "stepOnlyHidden", { step: i + 1 });
  });
}

/** Can the controlling field have this value? */
function controllerHas(field: FormField, value: string): boolean {
  switch (field.type) {
    case "select":
    case "radio":
    case "checkboxes":
      return (
        Array.isArray(field.options) && field.options.some((o) => isObject(o) && o.value === value)
      );
    case "checkbox":
      return value === "yes";
    case "scale": {
      const n = Number(value);
      return /^-?\d+$/.test(value) && n >= field.min && n <= field.max;
    }
    default:
      return false;
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
    problem(out, at, "keyShape");
    return;
  }
  const file = typeof src.file === "string" && src.file.trim() !== "" ? src.file : undefined;
  const armored =
    typeof src.armored === "string" && src.armored.trim() !== "" ? src.armored : undefined;
  if ((file === undefined) === (armored === undefined)) {
    problem(out, at, "keyExactlyOne");
    return;
  }
  if (armored !== undefined) {
    const block = publicKeyBlock(armored);
    if (block.problem) problem(out, `${at}.armored`, block.code, block.params);
    return;
  }
  const abs = path.resolve(process.cwd(), file!);
  if (!abs.startsWith(process.cwd() + path.sep)) {
    problem(out, `${at}.file`, "keyOutside", { file: String(src.file) });
    return;
  }
  let text: string;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    problem(out, `${at}.file`, "keyUnreadable", { file: String(src.file) });
    return;
  }
  const block = publicKeyBlock(text);
  if (block.problem)
    problem(out, `${at}.file`, "keyFileBlock", {
      file: String(src.file),
      problem: block.code,
      ...block.params,
    });
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
      case "pageBreak":
        break;
      default:
        chars += 64; // options, scales, boxes, hidden values: short by construction
    }
  }
  const bytes = chars * 3 + 1024;
  return form.encryption.mode === "off" ? bytes : Math.ceil((bytes * 4) / 3) + 1024;
}

function checkForm(
  form: ResolvedForm,
  raw: FormDefinition,
  rawSpam: Partial<SpamConfig>,
  keyNames: string[],
  out: Validation,
) {
  const at = `forms.${form.id}`;
  if (!FORM_ID.test(form.id)) problem(out, at, "formIdPattern", { pattern: String(FORM_ID) });

  if (raw.template !== undefined && !isTemplateName(raw.template))
    problem(out, `${at}.template`, "templateUnknown", { name: JSON.stringify(raw.template) });

  for (const [key, text] of [
    ["title", form.title],
    ["description", form.description],
    ["submitLabel", form.submitLabel],
    ["subject", form.subject],
    ["success.text", form.success.text],
  ] as [string, Text | undefined][])
    checkText(text, `${at}.${key}`, out);

  if (!Array.isArray(form.fields) || form.fields.length === 0) {
    problem(out, at, "noFields");
  } else {
    const names = new Set<string>();
    let keyFields = 0;
    form.fields.forEach((field, i) => {
      checkField(field, `${at}.fields[${i}]`, out);
      if (isObject(field) && typeof field.name === "string") {
        if (names.has(field.name))
          problem(out, `${at}.fields[${i}]`, "fieldNameTwice", { name: field.name });
        names.add(field.name);
      }
      if (isObject(field) && field.type === "pgpKey") keyFields++;
    });
    if (keyFields > 1) problem(out, at, "onePgpKey");
    checkConditions(form.fields, at, out);
    checkSteps(form.fields, at, out);
  }

  // Transport
  const tr = form.transport;
  switch (tr.kind) {
    case "relay":
    case "endpoint": {
      if (!tr.url) {
        problem(out, `${at}.transport.url`, "urlNeeded", { kind: tr.kind });
      } else if (!/^https?:\/\//.test(tr.url)) {
        problem(out, `${at}.transport.url`, "urlNotHttp", { url: tr.url });
      } else if (
        /^http:\/\//.test(tr.url) &&
        !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(tr.url)
      ) {
        hint(out, `${at}.transport.url`, "urlPlainHttp", { url: tr.url });
      }
      if (tr.kind === "relay" && !form.recipient) problem(out, `${at}.recipient`, "relayRecipient");
      break;
    }
    case "formspree":
    case "web3forms":
      if (!tr.url) problem(out, `${at}.transport.url`, "presetUrl", { kind: tr.kind });
      if (form.anonymous) hint(out, at, "anonymousService", { kind: tr.kind });
      break;
    case "mailto":
      if (!form.recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.recipient))
        problem(out, `${at}.recipient`, "mailtoRecipient");
      break;
    default:
      problem(out, `${at}.transport.kind`, "kindUnknown", { kind: JSON.stringify(tr.kind) });
  }
  if ((tr.kind === "relay" || tr.kind === "mailto") && Object.keys(tr.extra ?? {}).length > 0)
    hint(out, `${at}.transport.extra`, tr.kind === "relay" ? "extraRelay" : "extraMailto");
  if (tr.format !== undefined && tr.format !== "json" && tr.format !== "form")
    problem(out, `${at}.transport.format`, "formatValue");

  // Encryption
  const enc = form.encryption;
  if (!["required", "optional", "off"].includes(enc.mode))
    problem(out, `${at}.encryption.mode`, "modeValue");
  if (enc.mode !== "off") {
    if (enc.keys.length === 0) problem(out, `${at}.encryption`, "noKeys");
    for (const name of enc.keys)
      if (!keyNames.includes(name)) problem(out, `${at}.encryption.keys`, "keyUnknown", { name });
    if (tr.kind === "mailto") hint(out, at, "mailtoEncrypted");
  }

  // Spam
  const sp = form.spam;
  // The relay measures the stamp's age in whole seconds and casts the value to int, so 0.5 was
  // half a second in the browser and no trap at all there (second review, aside 5, 2026-10-19).
  if (!Number.isInteger(sp.minSeconds) || sp.minSeconds < 0)
    problem(out, `${at}.spam.minSeconds`, "minSecondsValue");
  // 20 bits take about 2 s in a Worker on a desktop and several times that on a phone; 24 bits
  // took minutes (review finding 18, measured in Chrome, 2026-10-19).
  if (!Number.isInteger(sp.powDifficulty) || sp.powDifficulty < 8 || sp.powDifficulty > 20)
    problem(out, `${at}.spam.powDifficulty`, "powDifficultyValue");
  if (!["none", "turnstile", "hcaptcha"].includes(sp.captcha))
    problem(out, `${at}.spam.captcha`, "captchaValue");
  if (sp.captcha !== "none" && !sp.captchaSiteKey && !form.anonymous)
    problem(out, `${at}.spam.captchaSiteKey`, "siteKeyNeeded", { provider: sp.captcha });
  if (sp.captcha !== "none" && form.anonymous)
    hint(out, at, "anonymousCaptcha", { provider: sp.captcha });
  if (tr.kind !== "relay") {
    if (sp.pow) hint(out, `${at}.spam.pow`, "noRelayEffect");
    // Written by the owner, globally or for the form; the default of 60 says nothing.
    if (
      sp.rateLimitPerHour > 0 &&
      (raw.spam?.rateLimitPerHour !== undefined || rawSpam.rateLimitPerHour !== undefined)
    )
      hint(out, `${at}.spam.rateLimitPerHour`, "noRelayEffect");
  } else if (sp.noScript) {
    // Only the script supplies a proof and a stamp, so a plain post walks past both (review
    // finding 5c; finding 4 of the second review, 2026-10-19). The default time trap is
    // documented and says nothing; a minSeconds the owner wrote, globally or here, is said.
    if (sp.pow) hint(out, `${at}.spam.pow`, "powNoScript");
    if (
      sp.minSeconds > 0 &&
      (raw.spam?.minSeconds !== undefined || rawSpam.minSeconds !== undefined)
    )
      hint(out, `${at}.spam.minSeconds`, "minSecondsNoScript");
  }
  // The quota counts a form's mails per hour with no address, so one client that sends them all
  // closes the form to everyone for the rest of the hour: 61 plain posts in 0.54 s with the
  // defaults (third review, M1, 2026-10-19). Only a captcha (which an anonymous form does not load)
  // or a proof of work the plain post cannot skip makes each of those posts cost something.
  if (
    tr.kind === "relay" &&
    sp.rateLimitPerHour > 0 &&
    (sp.captcha === "none" || form.anonymous) &&
    (!sp.pow || sp.noScript)
  )
    hint(out, `${at}.spam.rateLimitPerHour`, "rateLimitLever", { count: sp.rateLimitPerHour });
  if (sp.pow && tr.kind === "relay" && sp.powDifficulty >= 18 && sp.powDifficulty <= 20)
    hint(out, `${at}.spam.powDifficulty`, "powSlow", { bits: sp.powDifficulty });
  for (const key of ["maxFieldLength", "maxTextareaLength", "maxKeyLength", "maxBytes"] as const)
    if (!Number.isInteger(sp[key]) || sp[key] < 1)
      problem(out, `${at}.spam.${key}`, "positiveInteger");
  if (Number.isInteger(sp.maxBytes) && sp.maxBytes >= 1) {
    const capacity = submissionCapacity(form);
    if (capacity > sp.maxBytes)
      hint(out, `${at}.spam.maxBytes`, "maxBytesLow", {
        maxBytes: sp.maxBytes,
        capacity,
        encrypted: enc.mode !== "off",
      });
  }

  // Anonymous: judged on the fields as written (template + definition), because resolveForm
  // has already made the personal ones optional.
  if (form.anonymous) {
    if (raw.pageContext === true) hint(out, `${at}.pageContext`, "pageContextAnonymous");
    const written =
      raw.fields ?? (isTemplateName(raw.template) ? templateOf(raw.template).fields : undefined);
    written?.forEach((field, i) => {
      if (isObject(field) && "required" in field && field.required && isPersonalField(field))
        hint(out, `${at}.fields[${i}]`, "personalOptional", {
          name: String((field as { name?: unknown }).name),
          type: field.type,
        });
    });
  }

  // Success
  if (form.success.mode !== "inline" && form.success.mode !== "redirect")
    problem(out, `${at}.success.mode`, "successMode");
  if (form.success.mode === "redirect" && !form.success.slug)
    problem(out, `${at}.success.slug`, "successSlug");
}

export function validate(
  opts: ResolvedOptions,
  rawForms: Record<string, unknown>,
  rawSpam: Partial<SpamConfig> = {},
): Validation {
  const out: Validation = { problems: [], hints: [], problemMessages: [], hintMessages: [] };
  const keyNames = Object.keys(opts.keys);

  for (const [name, src] of Object.entries(opts.keys)) checkKeySource(name, src, out);

  for (const form of Object.values(opts.forms)) {
    const raw = rawForms[form.id];
    checkForm(form, isObject(raw) ? (raw as FormDefinition) : {}, rawSpam, keyNames, out);
  }

  if (!LANGUAGE_OPTION.test(opts.language))
    problem(out, "language", "languageValue", { value: opts.language });
  if (!opts.frontmatterKey.trim()) problem(out, "frontmatterKey", "frontmatterKeyEmpty");
  if (opts.layoutForm && !(opts.layoutForm in opts.forms))
    problem(out, "layoutForm", "layoutFormUnknown", { id: opts.layoutForm });
  if (!opts.codeBlockLang.trim() || /\s/.test(opts.codeBlockLang))
    problem(out, "codeBlockLang", "codeBlockLangValue");

  const known = new Set<string>(textKeys());
  const locales = availableLocales().map((l) => l.toLowerCase().split("-")[0]);
  for (const [locale, entries] of Object.entries(opts.texts)) {
    if (!locales.includes(locale.toLowerCase().split(/[-_]/)[0]!))
      hint(out, `texts.${locale}`, "textsLocaleUnknown");
    if (!isObject(entries)) {
      problem(out, `texts.${locale}`, "textsShape");
      continue;
    }
    for (const key of Object.keys(entries))
      if (!known.has(key)) hint(out, `texts.${locale}.${key}`, "textsKeyUnknown");
  }

  return out;
}
