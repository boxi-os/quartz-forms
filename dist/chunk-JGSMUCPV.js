import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

createRequire(import.meta.url);

// src/templates/index.ts
var t = (en, de) => ({ en, de });
var templates = {
  contact: {
    title: t("Contact", "Kontakt"),
    fields: [
      { type: "text", name: "name", label: t("Name", "Name"), autocomplete: "name" },
      {
        type: "email",
        name: "email",
        label: t("E-mail", "E-Mail"),
        hint: t("Only if you want a reply.", "Nur, wenn Sie eine Antwort m\xF6chten."),
        autocomplete: "email"
      },
      { type: "textarea", name: "message", label: t("Message", "Nachricht"), required: true },
      {
        type: "consent",
        name: "consent",
        text: t(
          "I agree that my message is processed to answer it.",
          "Ich bin einverstanden, dass meine Nachricht zur Beantwortung verarbeitet wird."
        )
      }
    ]
  },
  feedback: {
    title: t("Feedback on this page", "Feedback zu dieser Seite"),
    pageContext: true,
    fields: [
      {
        type: "scale",
        name: "rating",
        label: t("How helpful was this page?", "Wie hilfreich war diese Seite?"),
        min: 1,
        max: 5,
        minLabel: t("Not at all", "Gar nicht"),
        maxLabel: t("Very", "Sehr"),
        required: true
      },
      {
        type: "textarea",
        name: "comment",
        label: t("What could be better?", "Was k\xF6nnte besser sein?"),
        rows: 4
      }
    ]
  },
  rsvp: {
    title: t("Sign up", "Anmeldung"),
    fields: [
      {
        type: "text",
        name: "name",
        label: t("Name", "Name"),
        required: true,
        autocomplete: "name"
      },
      {
        type: "email",
        name: "email",
        label: t("E-mail", "E-Mail"),
        required: true,
        autocomplete: "email"
      },
      {
        type: "select",
        name: "choice",
        label: t("Date", "Termin"),
        required: true,
        options: [
          { value: "1", label: t("First date", "Erster Termin") },
          { value: "2", label: t("Second date", "Zweiter Termin") }
        ]
      },
      {
        type: "number",
        name: "guests",
        label: t("Number of people", "Anzahl Personen"),
        min: 1,
        max: 10,
        required: true
      },
      { type: "textarea", name: "note", label: t("Note", "Anmerkung"), rows: 3 },
      {
        type: "consent",
        name: "consent",
        text: t(
          "I agree that my details are stored to organise the event.",
          "Ich bin einverstanden, dass meine Angaben zur Organisation gespeichert werden."
        )
      }
    ]
  },
  survey: {
    title: t("Survey", "Umfrage"),
    anonymous: true,
    fields: [
      {
        type: "radio",
        name: "usage",
        label: t("How often do you visit this site?", "Wie oft besuchen Sie diese Website?"),
        required: true,
        options: [
          { value: "first", label: t("First time", "Zum ersten Mal") },
          { value: "sometimes", label: t("Now and then", "Gelegentlich") },
          { value: "often", label: t("Often", "Oft") }
        ]
      },
      {
        type: "checkboxes",
        name: "topics",
        label: t("Which topics interest you?", "Welche Themen interessieren Sie?"),
        options: [
          { value: "news", label: t("News", "Neuigkeiten") },
          { value: "guides", label: t("Guides", "Anleitungen") },
          { value: "background", label: t("Background", "Hintergrund") }
        ]
      },
      {
        type: "scale",
        name: "satisfaction",
        label: t("How satisfied are you overall?", "Wie zufrieden sind Sie insgesamt?"),
        min: 1,
        max: 5
      },
      { type: "textarea", name: "comment", label: t("Anything else?", "Noch etwas?"), rows: 3 }
    ]
  }
};
var templateNames = Object.keys(templates);
function templateOf(name) {
  return JSON.parse(JSON.stringify(templates[name]));
}
function isTemplateName(name) {
  return typeof name === "string" && name in templates;
}

// src/i18n/locales/en-US.ts
var en_US_default = {
  submit: "Send",
  sending: "Sending\u2026",
  sent: "Thank you, your message has been sent.",
  sentEncrypted: "Thank you, your message has been sent encrypted.",
  optional: "optional",
  requiredMark: "required",
  required: "This field is required.",
  invalidEmail: "Please enter a valid e-mail address.",
  invalidUrl: "Please enter a valid web address.",
  invalidTel: "Please enter a valid phone number.",
  invalidNumber: "Please enter a number.",
  invalidDate: "Please enter a date.",
  belowMin: "Please enter {min} or more.",
  aboveMax: "Please enter {max} or less.",
  tooLong: "Please use at most {max} characters.",
  patternMismatch: "Please use the requested format.",
  chooseOne: "Please choose one option.",
  chooseAtLeastOne: "Please choose at least one option.",
  consentRequired: "Please agree before sending.",
  privacyLink: "Privacy policy",
  selectPlaceholder: "Please choose",
  keyChooseFile: "Choose key file",
  keyPaste: "Or paste the armored key here.",
  keyInvalid: "This is not a PGP public key.",
  keyNotPublic: "This is a private key. Please provide your public key.",
  keyExpired: "This key has expired.",
  keyAccepted: "Key accepted, fingerprint {fingerprint}.",
  encryptToggle: "Send encrypted",
  encryptedFor: "Encrypted in your browser for the key {fingerprint}.",
  encryptedForMany: "Encrypted in your browser for {count} keys.",
  encryptionUnavailable: "Encryption could not be loaded; the message was not sent.",
  noScript: "This form sends encrypted and needs JavaScript to do so.",
  tooFast: "Please wait a moment before sending.",
  sendFailed: "The message could not be sent. Please try again later.",
  rejected: "The message was not accepted: {reason}",
  rateLimited: "Too many messages at the moment. Please try again later.",
  pageContextNote: "Refers to the page \u201C{title}\u201D.",
  anonymousNote: "This form is anonymous: nothing identifies you unless you write it.",
  mailtoNote: "Your mail program opens with the message.",
  errorSummary: "Please check {count} field(s).",
  errorSummaryOne: "Please check one field."
};

// src/i18n/locales/de-DE.ts
var deDE = {
  submit: "Senden",
  sending: "Wird gesendet \u2026",
  sent: "Danke, Ihre Nachricht wurde gesendet.",
  sentEncrypted: "Danke, Ihre Nachricht wurde verschl\xFCsselt gesendet.",
  optional: "optional",
  requiredMark: "Pflichtfeld",
  required: "Dieses Feld ist ein Pflichtfeld.",
  invalidEmail: "Bitte geben Sie eine g\xFCltige E-Mail-Adresse ein.",
  invalidUrl: "Bitte geben Sie eine g\xFCltige Webadresse ein.",
  invalidTel: "Bitte geben Sie eine g\xFCltige Telefonnummer ein.",
  invalidNumber: "Bitte geben Sie eine Zahl ein.",
  invalidDate: "Bitte geben Sie ein Datum ein.",
  belowMin: "Bitte geben Sie mindestens {min} ein.",
  aboveMax: "Bitte geben Sie h\xF6chstens {max} ein.",
  tooLong: "Bitte verwenden Sie h\xF6chstens {max} Zeichen.",
  patternMismatch: "Bitte verwenden Sie das verlangte Format.",
  chooseOne: "Bitte w\xE4hlen Sie eine Option.",
  chooseAtLeastOne: "Bitte w\xE4hlen Sie mindestens eine Option.",
  consentRequired: "Bitte stimmen Sie vor dem Senden zu.",
  privacyLink: "Datenschutzerkl\xE4rung",
  selectPlaceholder: "Bitte w\xE4hlen",
  keyChooseFile: "Schl\xFCsseldatei w\xE4hlen",
  keyPaste: "Oder f\xFCgen Sie den Schl\xFCssel hier ein.",
  keyInvalid: "Das ist kein \xF6ffentlicher PGP-Schl\xFCssel.",
  keyNotPublic: "Das ist ein privater Schl\xFCssel. Bitte geben Sie Ihren \xF6ffentlichen Schl\xFCssel an.",
  keyExpired: "Dieser Schl\xFCssel ist abgelaufen.",
  keyAccepted: "Schl\xFCssel \xFCbernommen, Fingerabdruck {fingerprint}.",
  encryptToggle: "Verschl\xFCsselt senden",
  encryptedFor: "In Ihrem Browser verschl\xFCsselt f\xFCr den Schl\xFCssel {fingerprint}.",
  encryptedForMany: "In Ihrem Browser verschl\xFCsselt f\xFCr {count} Schl\xFCssel.",
  encryptionUnavailable: "Die Verschl\xFCsselung konnte nicht geladen werden; die Nachricht wurde nicht gesendet.",
  noScript: "Dieses Formular sendet verschl\xFCsselt und braucht daf\xFCr JavaScript.",
  tooFast: "Bitte warten Sie einen Moment vor dem Senden.",
  sendFailed: "Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es sp\xE4ter noch einmal.",
  rejected: "Die Nachricht wurde nicht angenommen: {reason}",
  rateLimited: "Im Moment kommen zu viele Nachrichten. Bitte versuchen Sie es sp\xE4ter noch einmal.",
  pageContextNote: "Bezieht sich auf die Seite \u201E{title}\u201C.",
  anonymousNote: "Dieses Formular ist anonym: Nichts identifiziert Sie, au\xDFer Sie schreiben es.",
  mailtoNote: "Ihr Mailprogramm \xF6ffnet sich mit der Nachricht.",
  errorSummary: "Bitte pr\xFCfen Sie {count} Felder.",
  errorSummaryOne: "Bitte pr\xFCfen Sie ein Feld."
};
var de_DE_default = deDE;

// src/i18n/index.ts
var locales = {
  "en-US": en_US_default,
  "de-DE": de_DE_default
};
function availableLocales() {
  return Object.keys(locales);
}
function textKeys() {
  return Object.keys(en_US_default);
}

// src/validate.ts
var FORM_ID = /^[a-z0-9][a-z0-9-]*$/;
var FIELD_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
var LANGUAGE_OPTION = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]+)*$|^auto$/;
var PUBLIC_KEY_BLOCK = /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+-----END PGP PUBLIC KEY BLOCK-----/;
var RESERVED_NAMES = /* @__PURE__ */ new Set([
  "form",
  "lang",
  "page",
  "ts",
  "pow",
  "captcha",
  "encrypted",
  "ciphertext",
  "fields"
]);
var PERSONAL_AUTOCOMPLETE = /* @__PURE__ */ new Set([
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
  "organization"
]);
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function textProblem(text, at) {
  if (text === void 0) return void 0;
  if (typeof text === "string") return text.trim() ? void 0 : `${at}: empty text`;
  if (!isObject(text)) return `${at}: a text is a string or a record of language \u2192 string`;
  const entries = Object.entries(text);
  if (entries.length === 0) return `${at}: empty text record`;
  for (const [lang, value] of entries) {
    if (typeof value !== "string" || !value.trim()) return `${at}.${lang}: empty text`;
  }
  return void 0;
}
function checkField(field, at, out) {
  if (!isObject(field)) {
    out.problems.push(`${at}: a field is an object with a type and a name`);
    return;
  }
  if (typeof field.name !== "string" || !FIELD_NAME.test(field.name)) {
    out.problems.push(
      `${at}: field name ${JSON.stringify(field.name)} must match ${FIELD_NAME} (a letter, then letters, digits, _ or -)`
    );
  } else if (RESERVED_NAMES.has(field.name) || field.name.startsWith("_")) {
    out.problems.push(`${at}: field name "${field.name}" is reserved by the submission envelope`);
  }
  const texts = [];
  switch (field.type) {
    case "text":
    case "email":
    case "tel":
    case "url":
    case "number":
    case "date":
    case "textarea":
      texts.push(["label", field.label], ["placeholder", field.placeholder], ["hint", field.hint]);
      if (field.min !== void 0 && field.max !== void 0 && field.min > field.max)
        out.problems.push(`${at}: min ${field.min} is above max ${field.max}`);
      if (field.maxLength !== void 0 && field.maxLength < 1)
        out.problems.push(`${at}: maxLength must be at least 1`);
      if (field.pattern !== void 0) {
        try {
          new RegExp(field.pattern, "u");
        } catch (e) {
          out.problems.push(`${at}: pattern is not a regular expression (${e.message})`);
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
      const seen = /* @__PURE__ */ new Set();
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
        ["maxLabel", field.maxLabel]
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
      if (field.text === void 0) out.problems.push(`${at}: a consent field needs a text`);
      break;
    case "pgpKey":
      texts.push(["label", field.label], ["hint", field.hint]);
      break;
    case "hidden":
      if (typeof field.value !== "string") out.problems.push(`${at}: a hidden field needs a value`);
      break;
    default:
      out.problems.push(
        `${at}: unknown field type ${JSON.stringify(field.type)}`
      );
      return;
  }
  if (field.type !== "hidden" && field.type !== "consent" && field.label === void 0)
    out.problems.push(`${at}: a ${field.type} field needs a label`);
  for (const [key, text] of texts) {
    const p = textProblem(text, `${at}.${key}`);
    if (p) out.problems.push(p);
  }
}
function isPersonalField(field) {
  switch (field.type) {
    case "email":
    case "tel":
      return true;
    case "text":
    case "textarea":
    case "url":
    case "date":
    case "number":
      return field.autocomplete !== void 0 && PERSONAL_AUTOCOMPLETE.has(field.autocomplete);
    case "pgpKey":
      return true;
    default:
      return false;
  }
}
function checkKeySource(name, src, out) {
  const at = `keys.${name}`;
  if (!isObject(src)) {
    out.problems.push(`${at}: a key is { file } or { armored }`);
    return;
  }
  const file = typeof src.file === "string" && src.file.trim() !== "" ? src.file : void 0;
  const armored = typeof src.armored === "string" && src.armored.trim() !== "" ? src.armored : void 0;
  if (file === void 0 === (armored === void 0)) {
    out.problems.push(`${at}: exactly one of file or armored`);
    return;
  }
  if (armored !== void 0) {
    if (!PUBLIC_KEY_BLOCK.test(armored))
      out.problems.push(`${at}.armored: not an armored PGP public key block`);
    return;
  }
  const abs = path.resolve(process.cwd(), file);
  if (!abs.startsWith(process.cwd() + path.sep)) {
    out.problems.push(`${at}.file: ${src.file} lies outside the site`);
    return;
  }
  let text;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    out.problems.push(`${at}.file: ${src.file} not found or not readable`);
    return;
  }
  if (!PUBLIC_KEY_BLOCK.test(text))
    out.problems.push(`${at}.file: ${src.file} is not an armored PGP public key block`);
}
function checkForm(form, raw, keyNames, out) {
  const at = `forms.${form.id}`;
  if (!FORM_ID.test(form.id))
    out.problems.push(`${at}: form id must match ${FORM_ID} (lower-case letters, digits, -)`);
  if (raw.template !== void 0 && !isTemplateName(raw.template))
    out.problems.push(`${at}.template: unknown template ${JSON.stringify(raw.template)}`);
  for (const [key, text] of [
    ["title", form.title],
    ["description", form.description],
    ["submitLabel", form.submitLabel],
    ["subject", form.subject],
    ["success.text", form.success.text]
  ]) {
    const p = textProblem(text, `${at}.${key}`);
    if (p) out.problems.push(p);
  }
  if (!Array.isArray(form.fields) || form.fields.length === 0) {
    out.problems.push(`${at}: no fields (write fields or choose a template)`);
  } else {
    const names = /* @__PURE__ */ new Set();
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
  const tr = form.transport;
  switch (tr.kind) {
    case "relay":
    case "endpoint": {
      if (!tr.url) {
        out.problems.push(`${at}.transport.url: ${tr.kind} needs a URL`);
      } else if (!/^https?:\/\//.test(tr.url)) {
        out.problems.push(`${at}.transport.url: ${tr.url} is not an http(s) URL`);
      } else if (/^http:\/\//.test(tr.url) && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(tr.url)) {
        out.hints.push(
          `${at}.transport.url: ${tr.url} sends submissions unencrypted in transit (http)`
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
          `${at}: anonymous, but ${tr.kind} sees the sender's address; see the README`
        );
      break;
    case "mailto":
      if (!form.recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.recipient))
        out.problems.push(`${at}.recipient: mailto needs an e-mail address`);
      break;
    default:
      out.problems.push(`${at}.transport.kind: unknown kind ${JSON.stringify(tr.kind)}`);
  }
  if (tr.format !== void 0 && tr.format !== "json" && tr.format !== "form")
    out.problems.push(`${at}.transport.format: json or form`);
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
  const sp = form.spam;
  if (sp.minSeconds < 0) out.problems.push(`${at}.spam.minSeconds: not below 0`);
  if (!Number.isInteger(sp.powDifficulty) || sp.powDifficulty < 8 || sp.powDifficulty > 24)
    out.problems.push(`${at}.spam.powDifficulty: an integer from 8 to 24`);
  if (!["none", "turnstile", "hcaptcha"].includes(sp.captcha))
    out.problems.push(`${at}.spam.captcha: none, turnstile or hcaptcha`);
  if (sp.captcha !== "none" && !sp.captchaSiteKey && !form.anonymous)
    out.problems.push(`${at}.spam.captchaSiteKey: ${sp.captcha} needs the site key`);
  if (sp.captcha !== "none" && form.anonymous)
    out.hints.push(`${at}: anonymous, so the ${sp.captcha} captcha is not loaded`);
  if (tr.kind !== "relay") {
    if (sp.pow) out.hints.push(`${at}.spam.pow: has no effect without the relay`);
    if (sp.rateLimitPerHour > 0 && raw.spam?.rateLimitPerHour !== void 0)
      out.hints.push(`${at}.spam.rateLimitPerHour: has no effect without the relay`);
  }
  for (const key of ["maxFieldLength", "maxTextareaLength", "maxKeyLength", "maxBytes"])
    if (!Number.isInteger(sp[key]) || sp[key] < 1)
      out.problems.push(`${at}.spam.${key}: a positive integer`);
  if (form.anonymous) {
    if (raw.pageContext === true)
      out.hints.push(`${at}.pageContext: anonymous, so the page is not sent along`);
    const written = raw.fields ?? (isTemplateName(raw.template) ? templateOf(raw.template).fields : void 0);
    written?.forEach((field, i) => {
      if (isObject(field) && "required" in field && field.required && isPersonalField(field))
        out.hints.push(
          `${at}.fields[${i}]: anonymous, so "${field.name}" (${field.type}) cannot be required and is made optional`
        );
    });
  }
  if (form.success.mode !== "inline" && form.success.mode !== "redirect")
    out.problems.push(`${at}.success.mode: inline or redirect`);
  if (form.success.mode === "redirect" && !form.success.slug)
    out.problems.push(`${at}.success.slug: redirect needs the slug of a page`);
}
function validate(opts, rawForms) {
  const out = { problems: [], hints: [] };
  const keyNames = Object.keys(opts.keys);
  for (const [name, src] of Object.entries(opts.keys)) checkKeySource(name, src, out);
  for (const form of Object.values(opts.forms)) {
    const raw = rawForms[form.id];
    checkForm(form, isObject(raw) ? raw : {}, keyNames, out);
  }
  if (!LANGUAGE_OPTION.test(opts.language))
    out.problems.push(`language: "${opts.language}" is neither auto nor a language code`);
  if (!opts.frontmatterKey.trim()) out.problems.push("frontmatterKey: empty");
  if (!opts.codeBlockLang.trim() || /\s/.test(opts.codeBlockLang))
    out.problems.push("codeBlockLang: one word without spaces");
  const known = new Set(textKeys());
  const locales2 = availableLocales().map((l) => l.toLowerCase().split("-")[0]);
  for (const [locale, entries] of Object.entries(opts.texts)) {
    if (!locales2.includes(locale.toLowerCase().split(/[-_]/)[0]))
      out.hints.push(
        `texts.${locale}: the plugin has no texts in this language; they are used as written`
      );
    if (!isObject(entries)) {
      out.problems.push(`texts.${locale}: a record of text key \u2192 wording`);
      continue;
    }
    for (const key of Object.keys(entries))
      if (!known.has(key)) out.hints.push(`texts.${locale}.${key}: no such text key`);
  }
  return out;
}

// src/util/warn.ts
var warned = /* @__PURE__ */ new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[forms] ${message}`);
}

// src/options.ts
var defaultTransport = { kind: "relay" };
var defaultSpam = {
  honeypot: true,
  minSeconds: 3,
  pow: false,
  powDifficulty: 16,
  captcha: "none",
  captchaSiteKey: "",
  rateLimitPerHour: 60,
  maxFieldLength: 2e3,
  maxTextareaLength: 2e4,
  maxKeyLength: 16384,
  maxBytes: 65536
};
var defaultOptions = {
  forms: {},
  transport: defaultTransport,
  keys: {},
  spam: defaultSpam,
  frontmatterKey: "form",
  codeBlockLang: "quartz-form",
  language: "auto",
  texts: {}
};
var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function withoutNulls(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== void 0) out[k] = v;
  return out;
}
function resolveForm(id, def, global) {
  const user = withoutNulls(def);
  const base = isTemplateName(user.template) ? templateOf(user.template) : {};
  const merged = { ...base, ...user };
  const encryption = {
    mode: merged.encryption?.mode ?? "off",
    keys: merged.encryption?.keys ?? global.keyNames,
    showFingerprint: merged.encryption?.showFingerprint ?? true
  };
  const anonymous = merged.anonymous ?? false;
  const fields = (merged.fields ?? []).map(
    (field) => anonymous && isObject2(field) && "required" in field && field.required && isPersonalField(field) ? { ...field, required: false } : field
  );
  return {
    id,
    title: merged.title,
    description: merged.description,
    submitLabel: merged.submitLabel,
    fields,
    recipient: merged.recipient,
    subject: merged.subject,
    transport: { ...global.transport, ...withoutNulls(merged.transport ?? {}) },
    encryption,
    anonymous,
    pageContext: anonymous ? false : merged.pageContext ?? false,
    spam: { ...global.spam, ...withoutNulls(merged.spam ?? {}) },
    success: merged.success ?? { mode: "inline" },
    className: merged.className
  };
}
function resolveOptions(userOpts) {
  const user = withoutNulls(userOpts ?? {});
  const transport = {
    ...defaultTransport,
    ...withoutNulls(isObject2(user.transport) ? user.transport : {})
  };
  const spam = {
    ...defaultSpam,
    ...withoutNulls(isObject2(user.spam) ? user.spam : {})
  };
  const keys = isObject2(user.keys) ? withoutNulls(user.keys) : {};
  const keyNames = Object.keys(keys);
  const rawForms = isObject2(user.forms) ? withoutNulls(user.forms) : {};
  const forms = {};
  for (const [id, def] of Object.entries(rawForms)) {
    forms[id] = resolveForm(id, isObject2(def) ? def : {}, {
      transport,
      spam,
      keyNames
    });
  }
  const resolved = {
    forms,
    transport,
    keys,
    spam,
    frontmatterKey: typeof user.frontmatterKey === "string" ? user.frontmatterKey : "form",
    codeBlockLang: typeof user.codeBlockLang === "string" ? user.codeBlockLang : "quartz-form",
    language: typeof user.language === "string" ? user.language : "auto",
    texts: isObject2(user.texts) ? user.texts : {},
    problems: [],
    hints: []
  };
  const { problems, hints } = validate(resolved, rawForms);
  resolved.problems = problems;
  resolved.hints = hints;
  return resolved;
}
function resolveOrThrow(userOpts) {
  const opts = resolveOptions(userOpts);
  if (opts.problems.length > 0) {
    throw new Error(
      `[forms] ${opts.problems.length} problem(s) in the quartz-forms options:
` + opts.problems.map((p) => `  - ${p}`).join("\n")
    );
  }
  return opts;
}
function logHints(opts) {
  for (const hint of opts.hints) warnOnce(hint, hint);
}

// src/components/styles/forms.scss
var forms_default = ".quartz-form {\n  --quartz-forms-gap: 0.75rem;\n  display: flex;\n  flex-direction: column;\n  gap: var(--quartz-forms-gap);\n}";

// src/scripts/forms.inline.ts
var forms_inline_default = 'document.addEventListener("nav",()=>{let n=document.querySelectorAll("form.quartz-form");for(let e of n){let t=o=>{o.preventDefault()};e.addEventListener("submit",t),window.addCleanup(()=>e.removeEventListener("submit",t))}});\n';

// src/components/FormBox.tsx
var FormBox_default = ((userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  const FormBox = (_props) => {
    if (Object.keys(opts.forms).length === 0) return null;
    return null;
  };
  FormBox.css = forms_default;
  FormBox.afterDOMLoaded = forms_inline_default;
  return FormBox;
});

export { FormBox_default, defaultOptions, logHints, resolveOptions, resolveOrThrow, templateNames, templateOf };
//# sourceMappingURL=chunk-JGSMUCPV.js.map
//# sourceMappingURL=chunk-JGSMUCPV.js.map