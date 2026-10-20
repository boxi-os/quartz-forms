import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require$1 = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require$1 !== "undefined" ? require$1 : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require$1 !== "undefined" ? require$1 : a)[b]
}) : x)(function(x) {
  if (typeof require$1 !== "undefined") return require$1.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/templates/index.ts
var t = (en2, de2) => ({ en: en2, de: de2 });
var templates = {
  contact: {
    title: t("Contact", "Kontakt"),
    fields: [
      { type: "text", name: "name", label: t("Name", "Name"), autocomplete: "name" },
      {
        type: "email",
        name: "email",
        label: t("E-mail", "E-Mail"),
        hint: t("Only if you want a reply.", "Nur, wenn du eine Antwort m\xF6chtest."),
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
        label: t("How often do you visit this site?", "Wie oft besuchst du diese Website?"),
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
        label: t("Which topics interest you?", "Welche Themen interessieren dich?"),
        options: [
          { value: "news", label: t("News", "Neuigkeiten") },
          { value: "guides", label: t("Guides", "Anleitungen") },
          { value: "background", label: t("Background", "Hintergrund") }
        ]
      },
      {
        type: "scale",
        name: "satisfaction",
        label: t("How satisfied are you overall?", "Wie zufrieden bist du insgesamt?"),
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

// src/messages/en.ts
var s = (p, key) => String(p[key] ?? "");
var en = {
  // texts
  textEmpty: () => "empty text",
  textShape: () => "a text is a string or a record of language \u2192 string",
  textRecordEmpty: () => "empty text record",
  // fields
  fieldShape: () => "a field is an object with a type and a name",
  fieldNamePattern: (p) => `field name ${s(p, "name")} must match ${s(p, "pattern")} (a letter, then letters, digits, _ or -)`,
  fieldNameReserved: (p) => `field name "${s(p, "name")}" is reserved by the submission envelope`,
  minAboveMax: (p) => `min ${s(p, "min")} is above max ${s(p, "max")}`,
  maxLengthMin: () => "maxLength must be at least 1",
  patternJsU: () => "`\\u` escapes are JavaScript only, the relay's PCRE cannot read them: write the character itself, or `\\xHH` below U+0100",
  patternJsNegClass: () => "`[^]` is JavaScript only, the relay's PCRE cannot read it: write `[\\s\\S]`",
  patternJsEmptyClass: () => "`[]` is JavaScript only (it matches nothing), the relay's PCRE cannot read it",
  patternJsLookbehind: () => "a lookbehind of unlimited length is JavaScript only, the relay's PCRE cannot read it",
  patternInvalid: (p) => `pattern is not a regular expression (${s(p, "error")})`,
  optionsNeeded: (p) => `a ${s(p, "type")} field needs at least one option`,
  optionShape: () => "an option is { value, label } with a value",
  optionTwice: (p) => `value "${s(p, "value")}" twice`,
  optionSpace: (p) => `value "${s(p, "value")}" begins or ends with whitespace, which is trimmed from what is sent: it can never be chosen`,
  scaleInteger: () => "a scale has integer min and max",
  scaleOrder: (p) => `scale min ${s(p, "min")} must be below max ${s(p, "max")}`,
  scaleSpan: () => "a scale spans at most 21 steps",
  consentText: () => "a consent field needs a text",
  hiddenValue: () => "a hidden field needs a value",
  fieldTypeUnknown: (p) => `unknown field type ${s(p, "type")}`,
  labelNeeded: (p) => `a ${s(p, "type")} field needs a label`,
  widthValue: () => "full, half or third",
  layoutValue: () => "stacked or inline",
  layoutSelect: () => "has no effect on a select, whose options are a list to open",
  showIfNotAllowed: (p) => `a ${s(p, "type")} field cannot be conditional`,
  showIfShape: () => "{ field, equals } with the name of a field and one value or a list of them",
  showIfUnknown: (p) => `no field "${s(p, "field")}" in this form`,
  showIfLater: (p) => `"${s(p, "field")}" must come before the field that depends on it`,
  showIfController: (p) => `"${s(p, "field")}" is a ${s(p, "type")} field; a condition needs a select, radio, checkboxes, checkbox or scale`,
  showIfValue: (p) => `"${s(p, "field")}" cannot have the value "${s(p, "value")}"`,
  pageBreakEdge: () => "a page break stands between fields, not first or last",
  pageBreakTwice: () => "two page breaks in a row leave a step without fields",
  consentInConditionalStep: () => "a consent field cannot stand in a step with a condition: when the step is skipped, the message would go without it",
  stepOnlyHidden: (p) => `step ${s(p, "step")} holds only hidden values and shows the visitor nothing`,
  // keys in the options
  keyShape: () => "a key is { file } or { armored }",
  keyExactlyOne: () => "exactly one of file or armored",
  keyOutside: (p) => `${s(p, "file")} lies outside the site`,
  keyUnreadable: (p) => `${s(p, "file")} not found or not readable`,
  keyFileBlock: (p, t2) => `${s(p, "file")}: ${t2(s(p, "problem"), p)}`,
  // armor (src/pgp/armor.ts)
  armorPrivate: () => "holds a private key block; export only the public key (gpg --export --armor)",
  armorNone: () => "not an armored PGP public key block",
  armorIncomplete: () => "holds an incomplete armor block",
  armorOther: (p) => `holds a PGP ${s(p, "kind")} besides the public key`,
  armorMany: (p) => `holds ${s(p, "count")} key blocks; one public key per source`,
  // a key as OpenPGP.js reads it (src/pgp/check.ts)
  pgpUnreadable: (p) => `not a readable PGP key (${s(p, "error")})`,
  pgpPrivate: () => "this is a private key; the site needs the public key",
  pgpRevoked: () => "this key is revoked",
  pgpExpired: (p) => `this key expired on ${s(p, "date")}`,
  pgpNoEncrypt: () => "this key cannot encrypt (no encryption subkey)",
  pgpNewAlgorithm: (p) => `this key encrypts with ${s(p, "algorithm")} as RFC 9580 writes it, which GnuPG cannot read: gpg does not decrypt mails sent to it`,
  keyMissingSource: () => "neither file nor armored",
  keyFileUnreadable: () => "not found or not readable",
  // a form
  formIdPattern: (p) => `form id must match ${s(p, "pattern")} (lower-case letters, digits, -)`,
  templateUnknown: (p) => `unknown template ${s(p, "name")}`,
  noFields: () => "no fields (write fields or choose a template)",
  fieldNameTwice: (p) => `field name "${s(p, "name")}" twice`,
  onePgpKey: () => "at most one pgpKey field",
  // transport
  urlNeeded: (p) => `${s(p, "kind")} needs a URL`,
  urlNotHttp: (p) => `${s(p, "url")} is not an http(s) URL`,
  urlPlainHttp: (p) => `${s(p, "url")} sends submissions unencrypted in transit (http)`,
  relayRecipient: () => "the relay needs the recipient's name",
  presetUrl: (p) => `${s(p, "kind")} needs the form id or access key`,
  anonymousService: (p) => `anonymous, but ${s(p, "kind")} sees the sender's address; see the README`,
  mailtoRecipient: () => "mailto needs an e-mail address",
  kindUnknown: (p) => `unknown kind ${s(p, "kind")}`,
  extraRelay: () => "has no effect with the relay",
  extraMailto: () => "has no effect with mailto",
  demoNoEffect: () => "has no effect with demo, which sends nothing",
  demoRedirect: () => "demo shows what would have been sent below the form and does not redirect",
  demoCaptcha: (p) => `with demo the ${s(p, "provider")} widget is not loaded: nothing is sent that it could protect`,
  formatValue: () => "json or form",
  // encryption
  modeValue: () => "required, optional or off",
  noKeys: () => "no keys to encrypt to",
  keyUnknown: (p) => `unknown key "${s(p, "name")}"`,
  mailtoEncrypted: () => "encrypted mailto puts the whole ciphertext into the mail body",
  // spam
  minSecondsValue: () => "a whole number of seconds, 0 or more",
  powDifficultyValue: () => "an integer from 8 to 20",
  captchaValue: () => "none, turnstile or hcaptcha",
  siteKeyNeeded: (p) => `${s(p, "provider")} needs the site key`,
  anonymousCaptcha: (p) => `anonymous, so the ${s(p, "provider")} captcha is not loaded`,
  noRelayEffect: () => "has no effect without the relay",
  encryptionCaptcha: (p) => `the ${s(p, "provider")} script runs on the page where the message is typed before it is encrypted, and can read it (see the README)`,
  powNoScript: () => "a plain post without JavaScript (noScript: true) skips it; noScript: false requires the script",
  minSecondsNoScript: () => "a plain post without JavaScript (noScript: true) carries no stamp and skips it; noScript: false requires the script",
  rateLimitLever: (p) => `one client can send the hour's ${s(p, "count")} mails by itself, and the form takes no more from anyone until the hour is over; a captcha, or pow with noScript: false, makes that cost something (see the README)`,
  powSlow: (p) => `${s(p, "bits")} bits take seconds on a phone before every message`,
  positiveInteger: () => "a positive integer",
  maxBytesLow: (p) => `${s(p, "maxBytes")} is below what the fields may hold (about ${s(p, "capacity")} bytes${p.encrypted ? " once encrypted" : ""}); a long message would be refused as too large`,
  // anonymous
  pageContextAnonymous: () => "anonymous, so the page is not sent along",
  personalOptional: (p) => `anonymous, so "${s(p, "name")}" (${s(p, "type")}) cannot be required and is made optional`,
  // success
  successMode: () => "inline or redirect",
  successSlug: () => "redirect needs the slug of a page",
  // the entry
  languageValue: (p) => `"${s(p, "value")}" is neither auto nor a language code`,
  frontmatterKeyEmpty: () => "empty",
  layoutFormUnknown: (p) => `no form "${s(p, "id")}"`,
  codeBlockLangValue: () => "one word without spaces",
  textsLocaleUnknown: () => "the plugin has no texts in this language; they are used as written",
  textsShape: () => "a record of text key \u2192 wording",
  textsKeyUnknown: () => "no such text key",
  // the command line (src/cli.ts) and the relay generator (src/relay/generate.ts)
  cliNeedsValue: (p) => `${s(p, "arg")} needs a value`,
  cliUnknownArgument: (p) => `unknown argument ${s(p, "arg")}`,
  cliNoSite: () => "no site directory given (--site)",
  cliConfigMissing: (p) => `${s(p, "path")} not found`,
  // Quartz names a plugin by the end of its source, so a folder of another name is not this one.
  cliNoEntry: (p) => `no quartz-forms entry in ${s(p, "path")}: an entry's source must end in quartz-forms (github:boxi-os/quartz-forms, or a folder named quartz-forms)`,
  cliEntries: (p) => `${s(p, "count")} quartz-forms entries; taking the first`,
  cliNoOut: () => "no output directory given (--out)",
  cliUnknownCommand: (p) => `unknown command "${s(p, "command")}" (relay, check, key)`,
  cliNoKey: () => "no key given (--file, or the armored text in QF_KEY_ARMORED)",
  cliKeyUnreadable: (p) => `${s(p, "file")}: not found or not readable`,
  cliOperatorJson: () => "QF_RELAY_OPERATOR: not JSON",
  cliOperatorProblems: (p) => `${s(p, "count")} problem(s) in the operator values`,
  cliOptionProblems: (p) => `[forms] ${s(p, "count")} problem(s) in the quartz-forms options:`,
  cliNoPhp: (p) => `${s(p, "count")} pattern(s) not checked against PCRE: no php on the PATH. The relay refuses every value of a field whose pattern its PCRE cannot read.`,
  cliPhpFailed: (p) => `php could not check the patterns:
${s(p, "message")}`,
  cliPhpFailedShort: () => "php could not check the patterns",
  cliPatternUnreadable: (p) => `forms.${s(p, "form")} field "${s(p, "field")}": PCRE cannot read the pattern "${s(p, "pattern")}" (${s(p, "why")}); the relay would refuse every value of this field`,
  cliPatternRefusal: () => "a pattern PCRE cannot read",
  cliNothingWritten: () => "nothing written; fix the pattern, or pass --skip-pattern-check when the host's PCRE is newer than this machine's",
  cliWrittenAnyway: () => "written anyway (--skip-pattern-check)",
  cliMissingRecipient: (p) => `no address for the recipient "${s(p, "name")}"; the relay refuses its forms`,
  operatorNotObject: () => "operator: not an object",
  operatorSecret: () => "operator.secret: at least 32 characters",
  operatorOrigins: () => "operator.allowedOrigins: a list of origins",
  operatorFrom: () => "operator.from: the sender's e-mail address",
  operatorMailer: () => 'operator.mailer: "mail", { sendmail } or { file }',
  operatorRecord: (p) => `operator.${s(p, "key")}: a record of name \u2192 text`,
  operatorText: (p) => `operator.${s(p, "key")}: a text`,
  operatorCounterDir: () => "operator.counterDir: an absolute path on the server"
};
var en_default = en;

// src/messages/de.ts
var s2 = (p, key) => String(p[key] ?? "");
var de = {
  textEmpty: () => "leerer Text",
  textShape: () => "ein Text ist ein String oder ein Record Sprache \u2192 String",
  textRecordEmpty: () => "leerer Text-Record",
  fieldShape: () => "ein Feld ist ein Objekt mit type und name",
  fieldNamePattern: (p) => `der Feldname ${s2(p, "name")} muss ${s2(p, "pattern")} entsprechen (ein Buchstabe, dann Buchstaben, Ziffern, _ oder -)`,
  fieldNameReserved: (p) => `der Feldname \u201E${s2(p, "name")}\u201C ist f\xFCr die Sendung selbst reserviert`,
  minAboveMax: (p) => `min ${s2(p, "min")} liegt \xFCber max ${s2(p, "max")}`,
  maxLengthMin: () => "maxLength muss mindestens 1 sein",
  patternJsU: () => "`\\u`-Escapes gibt es nur in JavaScript, das PCRE des Relays kann sie nicht lesen: schreib das Zeichen selbst oder `\\xHH` unter U+0100",
  patternJsNegClass: () => "`[^]` gibt es nur in JavaScript, das PCRE des Relays kann es nicht lesen: schreib `[\\s\\S]`",
  patternJsEmptyClass: () => "`[]` gibt es nur in JavaScript (es trifft nichts), das PCRE des Relays kann es nicht lesen",
  patternJsLookbehind: () => "ein Lookbehind unbegrenzter L\xE4nge gibt es nur in JavaScript, das PCRE des Relays kann ihn nicht lesen",
  patternInvalid: (p) => `pattern ist kein regul\xE4rer Ausdruck (${s2(p, "error")})`,
  optionsNeeded: (p) => `ein Feld vom Typ ${s2(p, "type")} braucht mindestens eine Option`,
  optionShape: () => "eine Option ist { value, label } mit einem Wert",
  optionTwice: (p) => `Wert \u201E${s2(p, "value")}\u201C doppelt`,
  optionSpace: (p) => `Wert \u201E${s2(p, "value")}\u201C beginnt oder endet mit Leerraum, der beim Senden entfernt wird: er ist nie w\xE4hlbar`,
  scaleInteger: () => "eine Skala hat ganzzahlige min und max",
  scaleOrder: (p) => `min ${s2(p, "min")} der Skala muss unter max ${s2(p, "max")} liegen`,
  scaleSpan: () => "eine Skala umfasst h\xF6chstens 21 Stufen",
  consentText: () => "ein Einwilligungsfeld braucht einen Text",
  hiddenValue: () => "ein verborgenes Feld braucht einen Wert",
  fieldTypeUnknown: (p) => `unbekannter Feldtyp ${s2(p, "type")}`,
  labelNeeded: (p) => `ein Feld vom Typ ${s2(p, "type")} braucht eine Beschriftung (label)`,
  widthValue: () => "full, half oder third",
  layoutValue: () => "stacked oder inline",
  layoutSelect: () => "wirkt nicht bei select, dessen Optionen eine aufklappende Liste sind",
  showIfNotAllowed: (p) => `ein Feld vom Typ ${s2(p, "type")} kann nicht bedingt sein`,
  showIfShape: () => "{ field, equals } mit dem Namen eines Felds und einem Wert oder einer Liste davon",
  showIfUnknown: (p) => `kein Feld \u201E${s2(p, "field")}\u201C in diesem Formular`,
  showIfLater: (p) => `\u201E${s2(p, "field")}\u201C muss vor dem Feld stehen, das davon abh\xE4ngt`,
  showIfController: (p) => `\u201E${s2(p, "field")}\u201C ist ein Feld vom Typ ${s2(p, "type")}; eine Bedingung braucht select, radio, checkboxes, checkbox oder scale`,
  showIfValue: (p) => `\u201E${s2(p, "field")}\u201C kann den Wert \u201E${s2(p, "value")}\u201C nicht haben`,
  pageBreakEdge: () => "ein Seitenumbruch steht zwischen Feldern, nicht am Anfang oder Ende",
  pageBreakTwice: () => "zwei Seitenumbr\xFCche hintereinander lassen einen Schritt ohne Felder",
  consentInConditionalStep: () => "eine Einwilligung kann nicht in einem Schritt mit Bedingung stehen: Wird der Schritt \xFCbersprungen, ginge die Nachricht ohne sie hinaus",
  stepOnlyHidden: (p) => `Schritt ${s2(p, "step")} enth\xE4lt nur verborgene Werte und zeigt dem Besucher nichts`,
  keyShape: () => "ein Schl\xFCssel ist { file } oder { armored }",
  keyExactlyOne: () => "genau eines von file oder armored",
  keyOutside: (p) => `${s2(p, "file")} liegt au\xDFerhalb der Website`,
  keyUnreadable: (p) => `${s2(p, "file")} fehlt oder ist nicht lesbar`,
  keyFileBlock: (p, t2) => `${s2(p, "file")}: ${t2(s2(p, "problem"), p)}`,
  armorPrivate: () => "enth\xE4lt einen privaten Schl\xFCssel; exportiere nur den \xF6ffentlichen (gpg --export --armor)",
  armorNone: () => "kein \xF6ffentlicher PGP-Schl\xFCssel im Textformat",
  armorIncomplete: () => "enth\xE4lt einen unvollst\xE4ndigen Armor-Block",
  armorOther: (p) => `enth\xE4lt neben dem \xF6ffentlichen Schl\xFCssel einen PGP ${s2(p, "kind")}`,
  armorMany: (p) => `enth\xE4lt ${s2(p, "count")} Schl\xFCsselbl\xF6cke; ein \xF6ffentlicher Schl\xFCssel je Quelle`,
  pgpUnreadable: (p) => `kein lesbarer PGP-Schl\xFCssel (${s2(p, "error")})`,
  pgpPrivate: () => "das ist ein privater Schl\xFCssel; die Website braucht den \xF6ffentlichen",
  pgpRevoked: () => "dieser Schl\xFCssel ist widerrufen",
  pgpExpired: (p) => `dieser Schl\xFCssel ist am ${s2(p, "date")} abgelaufen`,
  pgpNoEncrypt: () => "dieser Schl\xFCssel kann nicht verschl\xFCsseln (kein Verschl\xFCsselungs-Unterschl\xFCssel)",
  pgpNewAlgorithm: (p) => `dieser Schl\xFCssel verschl\xFCsselt mit ${s2(p, "algorithm")} in der Form von RFC 9580, die GnuPG nicht lesen kann: Mails an ihn entschl\xFCsselt gpg nicht`,
  keyMissingSource: () => "weder file noch armored",
  keyFileUnreadable: () => "fehlt oder ist nicht lesbar",
  formIdPattern: (p) => `die Kennung des Formulars muss ${s2(p, "pattern")} entsprechen (Kleinbuchstaben, Ziffern, -)`,
  templateUnknown: (p) => `unbekannte Vorlage ${s2(p, "name")}`,
  noFields: () => "keine Felder (schreib Felder oder w\xE4hle eine Vorlage)",
  fieldNameTwice: (p) => `Feldname \u201E${s2(p, "name")}\u201C doppelt`,
  onePgpKey: () => "h\xF6chstens ein Feld vom Typ pgpKey",
  urlNeeded: (p) => `${s2(p, "kind")} braucht eine Adresse`,
  urlNotHttp: (p) => `${s2(p, "url")} ist keine http(s)-Adresse`,
  urlPlainHttp: (p) => `${s2(p, "url")} \xFCbertr\xE4gt Sendungen unverschl\xFCsselt (http)`,
  relayRecipient: () => "das Relay braucht den Namen des Empf\xE4ngers",
  presetUrl: (p) => `${s2(p, "kind")} braucht die Formular-ID oder den Zugangsschl\xFCssel`,
  anonymousService: (p) => `anonym, aber ${s2(p, "kind")} sieht die Adresse des Absenders; siehe README`,
  mailtoRecipient: () => "mailto braucht eine E-Mail-Adresse",
  kindUnknown: (p) => `unbekannter Versandweg ${s2(p, "kind")}`,
  extraRelay: () => "wirkt nicht beim Relay",
  extraMailto: () => "wirkt nicht bei mailto",
  demoNoEffect: () => "wirkt nicht bei demo, das nichts sendet",
  demoRedirect: () => "demo zeigt unter dem Formular, was gesendet worden w\xE4re, und leitet nicht weiter",
  demoCaptcha: (p) => `bei demo wird das Widget von ${s2(p, "provider")} nicht geladen: Es wird nichts gesendet, das es sch\xFCtzen k\xF6nnte`,
  formatValue: () => "json oder form",
  modeValue: () => "required, optional oder off",
  noKeys: () => "keine Schl\xFCssel, an die verschl\xFCsselt werden kann",
  keyUnknown: (p) => `unbekannter Schl\xFCssel \u201E${s2(p, "name")}\u201C`,
  mailtoEncrypted: () => "ein verschl\xFCsseltes mailto schreibt das ganze Chiffrat in die Mail",
  minSecondsValue: () => "eine ganze Zahl Sekunden, 0 oder mehr",
  powDifficultyValue: () => "eine ganze Zahl von 8 bis 20",
  captchaValue: () => "none, turnstile oder hcaptcha",
  siteKeyNeeded: (p) => `${s2(p, "provider")} braucht den Site-Key`,
  anonymousCaptcha: (p) => `anonym, deshalb wird das Captcha von ${s2(p, "provider")} nicht geladen`,
  encryptionCaptcha: (p) => `das Skript von ${s2(p, "provider")} l\xE4uft auf der Seite, auf der die Nachricht vor dem Verschl\xFCsseln getippt wird, und kann sie lesen (siehe README)`,
  noRelayEffect: () => "wirkt nur mit dem Relay",
  powNoScript: () => "ein einfacher Post ohne JavaScript (noScript: true) umgeht es; noScript: false verlangt das Skript",
  minSecondsNoScript: () => "ein einfacher Post ohne JavaScript (noScript: true) tr\xE4gt keinen Stempel und umgeht es; noScript: false verlangt das Skript",
  rateLimitLever: (p) => `ein einzelner Client kann die ${s2(p, "count")} Mails der Stunde selbst senden, danach nimmt das Formular bis zum Ende der Stunde von niemandem mehr etwas an; ein Captcha oder pow mit noScript: false macht das teuer (siehe README)`,
  powSlow: (p) => `${s2(p, "bits")} Bit dauern auf einem Telefon vor jeder Nachricht Sekunden`,
  positiveInteger: () => "eine positive ganze Zahl",
  maxBytesLow: (p) => `${s2(p, "maxBytes")} ist kleiner als das, was die Felder fassen (etwa ${s2(p, "capacity")} Bytes${p.encrypted ? " verschl\xFCsselt" : ""}); eine lange Nachricht w\xFCrde als zu gro\xDF abgewiesen`,
  pageContextAnonymous: () => "anonym, deshalb wird die Seite nicht mitgeschickt",
  personalOptional: (p) => `anonym, deshalb kann \u201E${s2(p, "name")}\u201C (${s2(p, "type")}) kein Pflichtfeld sein und wird optional`,
  successMode: () => "inline oder redirect",
  successSlug: () => "redirect braucht den Slug einer Seite",
  languageValue: (p) => `\u201E${s2(p, "value")}\u201C ist weder auto noch ein Sprachcode`,
  frontmatterKeyEmpty: () => "leer",
  layoutFormUnknown: (p) => `kein Formular \u201E${s2(p, "id")}\u201C`,
  codeBlockLangValue: () => "ein Wort ohne Leerzeichen",
  textsLocaleUnknown: () => "das Plugin hat keine Texte in dieser Sprache; sie gelten, wie sie dastehen",
  textsShape: () => "ein Record Textschl\xFCssel \u2192 Wortlaut",
  textsKeyUnknown: () => "diesen Textschl\xFCssel gibt es nicht",
  cliNeedsValue: (p) => `${s2(p, "arg")} braucht einen Wert`,
  cliUnknownArgument: (p) => `unbekanntes Argument ${s2(p, "arg")}`,
  cliNoSite: () => "kein Website-Ordner angegeben (--site)",
  cliConfigMissing: (p) => `${s2(p, "path")} fehlt`,
  cliNoEntry: (p) => `kein quartz-forms-Eintrag in ${s2(p, "path")}: die source eines Eintrags muss auf quartz-forms enden (github:boxi-os/quartz-forms oder ein Ordner namens quartz-forms)`,
  cliEntries: (p) => `${s2(p, "count")} Eintr\xE4ge von quartz-forms; es gilt der erste`,
  cliNoOut: () => "kein Ausgabeordner angegeben (--out)",
  cliUnknownCommand: (p) => `unbekannter Befehl \u201E${s2(p, "command")}\u201C (relay, check, key)`,
  cliNoKey: () => "kein Schl\xFCssel angegeben (--file oder der Text in QF_KEY_ARMORED)",
  cliKeyUnreadable: (p) => `${s2(p, "file")}: fehlt oder ist nicht lesbar`,
  cliOperatorJson: () => "QF_RELAY_OPERATOR: kein JSON",
  cliOperatorProblems: (p) => `${s2(p, "count")} Problem(e) in den Werten des Betreibers`,
  cliOptionProblems: (p) => `[forms] ${s2(p, "count")} Problem(e) in den Optionen von quartz-forms:`,
  cliNoPhp: (p) => `${s2(p, "count")} Muster nicht gegen PCRE gepr\xFCft: kein php im PATH. Das Relay weist jeden Wert eines Felds ab, dessen Muster sein PCRE nicht lesen kann.`,
  cliPhpFailed: (p) => `php konnte die Muster nicht pr\xFCfen:
${s2(p, "message")}`,
  cliPhpFailedShort: () => "php konnte die Muster nicht pr\xFCfen",
  cliPatternUnreadable: (p) => `forms.${s2(p, "form")} Feld \u201E${s2(p, "field")}\u201C: PCRE kann das Muster \u201E${s2(p, "pattern")}\u201C nicht lesen (${s2(p, "why")}); das Relay w\xFCrde jeden Wert dieses Felds abweisen`,
  cliPatternRefusal: () => "ein Muster, das PCRE nicht lesen kann",
  cliNothingWritten: () => "nichts geschrieben; korrigiere das Muster oder gib --skip-pattern-check an, wenn das PCRE des Hosts neuer ist als das dieses Rechners",
  cliWrittenAnyway: () => "trotzdem geschrieben (--skip-pattern-check)",
  cliMissingRecipient: (p) => `keine Adresse f\xFCr den Empf\xE4nger \u201E${s2(p, "name")}\u201C; das Relay weist seine Formulare ab`,
  operatorNotObject: () => "operator: kein Objekt",
  operatorSecret: () => "operator.secret: mindestens 32 Zeichen",
  operatorOrigins: () => "operator.allowedOrigins: eine Liste von Origins",
  operatorFrom: () => "operator.from: die E-Mail-Adresse des Absenders",
  operatorMailer: () => 'operator.mailer: "mail", { sendmail } oder { file }',
  operatorRecord: (p) => `operator.${s2(p, "key")}: ein Record Name \u2192 Text`,
  operatorText: (p) => `operator.${s2(p, "key")}: ein Text`,
  operatorCounterDir: () => "operator.counterDir: ein absoluter Pfad auf dem Server"
};
var de_default = de;

// src/messages/index.ts
var MESSAGE_LANGS = ["en", "de"];
var catalogs = {
  en: en_default,
  de: de_default
};
function messageLang(code) {
  const primary = (code ?? "").toLowerCase().split(/[-_]/)[0];
  return MESSAGE_LANGS.includes(primary ?? "") ? primary : "en";
}
function messageText(code, params = {}, lang = "en") {
  const catalog = catalogs[lang];
  const t2 = (c, p) => c in catalog ? catalog[c](p ?? {}, t2) : c;
  return catalog[code](params, t2);
}
function formatMessage(message, lang = "en") {
  const text = messageText(message.code, message.params, lang);
  return message.path ? `${message.path}: ${text}` : text;
}

// src/pgp/armor.ts
var BLOCK = /-----BEGIN PGP ([A-Z ]+?)-----[\s\S]*?-----END PGP \1-----/g;
var PUBLIC = "PUBLIC KEY BLOCK";
function refused(code, params) {
  return { problem: messageText(code, params), code, ...params ? { params } : {} };
}
function publicKeyBlock(text) {
  if (/-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(text)) return refused("armorPrivate");
  const blocks = [...text.matchAll(BLOCK)];
  const begins = text.match(/-----BEGIN PGP /g)?.length ?? 0;
  const first = blocks[0];
  if (!first) return refused("armorNone");
  if (begins > blocks.length) return refused("armorIncomplete");
  const other = blocks.find((b) => b[1] !== PUBLIC);
  if (other) return refused("armorOther", { kind: other[1] });
  if (blocks.length > 1) return refused("armorMany", { count: blocks.length });
  return { armored: first[0] };
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
  malformed: "This value could not be read.",
  keyNotPublic: "This is a private key. Please provide your public key.",
  keyExpired: "This key has expired.",
  keyAccepted: "Key accepted, fingerprint {fingerprint}.",
  keyUnchecked: "The key could not be checked; it is sent as pasted.",
  encryptToggle: "Send encrypted",
  encryptedFor: "Encrypted in your browser for the key {fingerprint}.",
  encryptedForMany: "Encrypted in your browser for {count} keys.",
  encryptionUnavailable: "Encryption could not be loaded; the message was not sent.",
  noScript: "This form sends encrypted and needs JavaScript to do so.",
  needsScript: "This form needs JavaScript to send.",
  noScriptPlain: "Without JavaScript this form sends unencrypted.",
  tooFast: "Please wait a moment before sending.",
  reloadPage: "Please reload the page and send again.",
  proofRejected: "The check before sending did not pass. Please try again.",
  captchaFailed: "The check could not be confirmed. Please complete it again.",
  captchaRequired: "Please complete the check below before sending.",
  sendFailed: "The message could not be sent. Please try again later.",
  rejected: "The message was not accepted: {reason}",
  rateLimited: "Too many messages at the moment. Please try again later.",
  tooLarge: "The message is too large to send. Please shorten it.",
  pageContextNote: "Refers to the page \u201C{title}\u201D.",
  anonymousNote: "This form is anonymous: nothing identifies you unless you write it.",
  mailtoNote: "Your mail program opens with the message.",
  demoNote: "A demonstration: this form sends nothing. After sending you see what would have been sent.",
  demoSent: "Nothing was sent. This is the message as it would have arrived:",
  demoSentEncrypted: "Nothing was sent. This is the message as it would have arrived, encrypted in your browser:",
  demoAgain: "Try again",
  demoNoScript: "This demonstration needs JavaScript to show what would have been sent.",
  messagePage: "Page: {page}",
  messageKey: "Public key of the sender:",
  errorSummary: "Please check {count} field(s).",
  errorSummaryOne: "Please check one field.",
  onlyWhen: "Only needed if \u201C{field}\u201D is {values}.",
  onlyWhenTicked: "Only needed if \u201C{field}\u201D is ticked.",
  quoted: "\u201C{text}\u201D",
  orWord: " or ",
  next: "Next",
  back: "Back",
  stepOf: "Step {current} of {total}",
  stepOfTitled: "Step {current} of {total}: {title}"
};

// src/i18n/locales/de-DE.ts
var deDE = {
  submit: "Senden",
  sending: "Wird gesendet \u2026",
  sent: "Danke, deine Nachricht wurde gesendet.",
  sentEncrypted: "Danke, deine Nachricht wurde verschl\xFCsselt gesendet.",
  optional: "optional",
  requiredMark: "Pflichtfeld",
  required: "Dieses Feld ist ein Pflichtfeld.",
  invalidEmail: "Bitte gib eine g\xFCltige E-Mail-Adresse ein.",
  invalidUrl: "Bitte gib eine g\xFCltige Webadresse ein.",
  invalidTel: "Bitte gib eine g\xFCltige Telefonnummer ein.",
  invalidNumber: "Bitte gib eine Zahl ein.",
  invalidDate: "Bitte gib ein Datum ein.",
  belowMin: "Bitte gib mindestens {min} ein.",
  aboveMax: "Bitte gib h\xF6chstens {max} ein.",
  tooLong: "Bitte verwende h\xF6chstens {max} Zeichen.",
  patternMismatch: "Bitte verwende das verlangte Format.",
  chooseOne: "Bitte w\xE4hle eine Option.",
  chooseAtLeastOne: "Bitte w\xE4hle mindestens eine Option.",
  consentRequired: "Bitte stimme vor dem Senden zu.",
  privacyLink: "Datenschutzerkl\xE4rung",
  selectPlaceholder: "Bitte w\xE4hlen",
  keyChooseFile: "Schl\xFCsseldatei w\xE4hlen",
  keyPaste: "Oder f\xFCge den Schl\xFCssel hier ein.",
  keyInvalid: "Das ist kein \xF6ffentlicher PGP-Schl\xFCssel.",
  malformed: "Dieser Wert konnte nicht gelesen werden.",
  keyNotPublic: "Das ist ein privater Schl\xFCssel. Bitte gib deinen \xF6ffentlichen Schl\xFCssel an.",
  keyExpired: "Dieser Schl\xFCssel ist abgelaufen.",
  keyAccepted: "Schl\xFCssel \xFCbernommen, Fingerabdruck {fingerprint}.",
  keyUnchecked: "Der Schl\xFCssel konnte nicht gepr\xFCft werden; er wird so gesendet, wie er eingef\xFCgt wurde.",
  encryptToggle: "Verschl\xFCsselt senden",
  encryptedFor: "In deinem Browser verschl\xFCsselt f\xFCr den Schl\xFCssel {fingerprint}.",
  encryptedForMany: "In deinem Browser verschl\xFCsselt f\xFCr {count} Schl\xFCssel.",
  encryptionUnavailable: "Die Verschl\xFCsselung konnte nicht geladen werden; die Nachricht wurde nicht gesendet.",
  noScript: "Dieses Formular sendet verschl\xFCsselt und braucht daf\xFCr JavaScript.",
  needsScript: "Dieses Formular braucht zum Senden JavaScript.",
  noScriptPlain: "Ohne JavaScript sendet dieses Formular unverschl\xFCsselt.",
  tooFast: "Bitte warte einen Moment vor dem Senden.",
  reloadPage: "Bitte lade die Seite neu und sende noch einmal.",
  proofRejected: "Die Pr\xFCfung vor dem Senden ist fehlgeschlagen. Bitte versuche es noch einmal.",
  captchaFailed: "Die Pr\xFCfung konnte nicht best\xE4tigt werden. Bitte best\xE4tige sie noch einmal.",
  captchaRequired: "Bitte best\xE4tige vor dem Senden die Pr\xFCfung unten.",
  sendFailed: "Die Nachricht konnte nicht gesendet werden. Bitte versuche es sp\xE4ter noch einmal.",
  rejected: "Die Nachricht wurde nicht angenommen: {reason}",
  rateLimited: "Im Moment kommen zu viele Nachrichten. Bitte versuche es sp\xE4ter noch einmal.",
  tooLarge: "Die Nachricht ist zu gro\xDF zum Senden. Bitte k\xFCrze sie.",
  pageContextNote: "Bezieht sich auf die Seite \u201E{title}\u201C.",
  anonymousNote: "Dieses Formular ist anonym: Nichts identifiziert dich, au\xDFer du schreibst es.",
  mailtoNote: "Dein Mailprogramm \xF6ffnet sich mit der Nachricht.",
  demoNote: "Eine Vorf\xFChrung: Dieses Formular sendet nichts. Nach dem Absenden siehst du, was gesendet worden w\xE4re.",
  demoSent: "Nichts wurde gesendet. So w\xE4re die Nachricht angekommen:",
  demoSentEncrypted: "Nichts wurde gesendet. So w\xE4re die Nachricht angekommen, in deinem Browser verschl\xFCsselt:",
  demoAgain: "Noch einmal",
  demoNoScript: "Diese Vorf\xFChrung braucht JavaScript, um zu zeigen, was gesendet worden w\xE4re.",
  messagePage: "Seite: {page}",
  messageKey: "\xD6ffentlicher Schl\xFCssel des Absenders:",
  errorSummary: "Bitte pr\xFCfe {count} Felder.",
  errorSummaryOne: "Bitte pr\xFCfe ein Feld.",
  onlyWhen: "Nur n\xF6tig, wenn bei \u201E{field}\u201C {values} gew\xE4hlt ist.",
  onlyWhenTicked: "Nur n\xF6tig, wenn \u201E{field}\u201C angehakt ist.",
  quoted: "\u201E{text}\u201C",
  orWord: " oder ",
  next: "Weiter",
  back: "Zur\xFCck",
  stepOf: "Schritt {current} von {total}",
  stepOfTitled: "Schritt {current} von {total}: {title}"
};
var de_DE_default = deDE;

// src/i18n/index.ts
var locales = {
  "en-US": en_US_default,
  "de-DE": de_DE_default
};
function i18n(locale) {
  if (!locale) return en_US_default;
  const exact = locales[locale];
  if (exact) return exact;
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  for (const [key, value] of Object.entries(locales)) {
    if (key.toLowerCase().split("-")[0] === primary) return value;
  }
  return en_US_default;
}
function wording(locale, texts) {
  const base = { ...i18n(locale) };
  if (!locale) return base;
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  const layers = Object.entries(texts).filter(([k]) => k.toLowerCase().split(/[-_]/)[0] === primary).sort(
    ([a], [b]) => Number(a.toLowerCase() === locale.toLowerCase()) - Number(b.toLowerCase() === locale.toLowerCase())
  );
  for (const [, entries] of layers)
    for (const [key, value] of Object.entries(entries))
      if (key in base && typeof value === "string") base[key] = value;
  return base;
}
function availableLocales() {
  return Object.keys(locales);
}
function textKeys() {
  return Object.keys(en_US_default);
}

// src/conditions.ts
function isNamed(field) {
  return field.type !== "pageBreak";
}
var CONTROLLER_TYPES = ["select", "radio", "checkboxes", "checkbox", "scale"];
function conditionOf(field) {
  const showIf = field.showIf;
  if (!showIf || typeof showIf !== "object" || Array.isArray(showIf)) return void 0;
  const { field: name, equals } = showIf;
  if (typeof name !== "string" || !name) return void 0;
  const list = typeof equals === "string" ? [equals] : Array.isArray(equals) ? equals : [];
  const values = list.filter((v) => typeof v === "string" && v !== "");
  return values.length ? { field: name, equals: values } : void 0;
}
function stepsOf(fields) {
  const steps = [{ fields: [] }];
  for (const field of fields) {
    if (field.type === "pageBreak") {
      const condition = conditionOf(field);
      steps.push({
        ...field.title !== void 0 ? { title: field.title } : {},
        ...condition ? { condition } : {},
        fields: []
      });
    } else steps[steps.length - 1].fields.push(field);
  }
  return steps;
}
function conditionsOf(fields) {
  const out = /* @__PURE__ */ new Map();
  for (const step of stepsOf(fields))
    for (const field of step.fields) {
      const fromStep = field.type === "hidden" ? void 0 : step.condition;
      const list = [fromStep, conditionOf(field)].filter((c) => !!c);
      if (list.length) out.set(field.name, list);
    }
  return out;
}

// src/validate.ts
function problem(out, path2, code, params) {
  const m = { path: path2, code, ...params ? { params } : {} };
  out.problemMessages.push(m);
  out.problems.push(formatMessage(m));
}
function hint(out, path2, code, params) {
  const m = { path: path2, code, ...params ? { params } : {} };
  out.hintMessages.push(m);
  out.hints.push(formatMessage(m));
}
var FORM_ID = /^[a-z0-9][a-z0-9-]*$/;
var FIELD_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
var LANGUAGE_OPTION = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]+)*$|^auto$/;
function jsOnlyPatternCode(pattern) {
  const lookbehinds = [];
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
        if (pattern[i + 1] === "?") i++;
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
  return void 0;
}
var RESERVED_NAMES = /* @__PURE__ */ new Set([
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
  "h-captcha-response"
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
function checkText(text, at, out) {
  if (text === void 0) return;
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
function checkField(field, at, out) {
  if (!isObject(field)) {
    problem(out, at, "fieldShape");
    return;
  }
  if (field.type === "pageBreak") {
    checkText(field.title, `${at}.title`, out);
    return;
  }
  if (typeof field.name !== "string" || !FIELD_NAME.test(field.name)) {
    problem(out, at, "fieldNamePattern", {
      name: JSON.stringify(field.name),
      pattern: String(FIELD_NAME)
    });
  } else if (RESERVED_NAMES.has(field.name) || field.name.startsWith("_")) {
    problem(out, at, "fieldNameReserved", { name: field.name });
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
        problem(out, at, "minAboveMax", { min: field.min, max: field.max });
      if (field.maxLength !== void 0 && field.maxLength < 1) problem(out, at, "maxLengthMin");
      if (field.pattern !== void 0) {
        try {
          new RegExp(field.pattern, "u");
          const jsOnly = jsOnlyPatternCode(field.pattern);
          if (jsOnly) problem(out, `${at}.pattern`, jsOnly);
        } catch (e) {
          problem(out, at, "patternInvalid", { error: e.message });
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
      const seen = /* @__PURE__ */ new Set();
      field.options.forEach((opt, i) => {
        if (!isObject(opt) || typeof opt.value !== "string" || !opt.value.length) {
          problem(out, `${at}.options[${i}]`, "optionShape");
          return;
        }
        if (opt.value.trim() !== opt.value)
          problem(out, `${at}.options[${i}]`, "optionSpace", { value: opt.value });
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
        ["maxLabel", field.maxLabel]
      );
      if (!Number.isInteger(field.min) || !Number.isInteger(field.max))
        problem(out, at, "scaleInteger");
      else if (field.min >= field.max)
        problem(out, at, "scaleOrder", { min: field.min, max: field.max });
      else if (field.max - field.min > 20) problem(out, at, "scaleSpan");
      break;
    case "consent":
      texts.push(["text", field.text], ["linkLabel", field.linkLabel]);
      if (field.text === void 0) problem(out, at, "consentText");
      break;
    case "pgpKey":
      texts.push(["label", field.label], ["hint", field.hint]);
      break;
    case "hidden":
      if (typeof field.value !== "string") problem(out, at, "hiddenValue");
      break;
    default:
      problem(out, at, "fieldTypeUnknown", {
        type: JSON.stringify(field.type)
      });
      return;
  }
  if (field.type !== "hidden") {
    const width = field.width;
    if (width !== void 0 && width !== "full" && width !== "half" && width !== "third")
      problem(out, `${at}.width`, "widthValue");
  }
  if (field.type === "select" || field.type === "radio" || field.type === "checkboxes") {
    const layout = field.layout;
    if (layout !== void 0 && layout !== "stacked" && layout !== "inline")
      problem(out, `${at}.layout`, "layoutValue");
    else if (layout === "inline" && field.type === "select")
      hint(out, `${at}.layout`, "layoutSelect");
  }
  if (field.type !== "hidden" && field.type !== "consent" && field.label === void 0)
    problem(out, at, "labelNeeded", { type: field.type });
  for (const [key, text] of texts) checkText(text, `${at}.${key}`, out);
}
function checkConditions(fields, at, out) {
  const seen = /* @__PURE__ */ new Map();
  fields.forEach((field, i) => {
    if (!isObject(field)) return;
    const raw = field.showIf;
    const here = `${at}.fields[${i}].showIf`;
    if (raw !== void 0) {
      if (field.type === "hidden" || field.type === "consent")
        problem(out, here, "showIfNotAllowed", { type: field.type });
      else {
        const condition = conditionOf(field);
        const name = isObject(raw) ? raw.field : void 0;
        if (!condition) problem(out, here, "showIfShape");
        else if (!fields.some((f) => isObject(f) && f.name === condition.field))
          problem(out, here, "showIfUnknown", { field: String(name) });
        else if (!seen.has(condition.field))
          problem(out, here, "showIfLater", { field: condition.field });
        else {
          const controller = seen.get(condition.field);
          if (!CONTROLLER_TYPES.includes(controller.type))
            problem(out, here, "showIfController", {
              field: condition.field,
              type: controller.type
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
function checkSteps(fields, at, out) {
  if (!fields.some((f) => isObject(f) && f.type === "pageBreak")) return;
  let conditional = false;
  fields.forEach((field, i) => {
    if (!isObject(field)) return;
    if (field.type === "consent" && conditional)
      problem(out, `${at}.fields[${i}]`, "consentInConditionalStep");
    if (field.type !== "pageBreak") return;
    conditional = field.showIf !== void 0;
    if (i === 0 || i === fields.length - 1) problem(out, `${at}.fields[${i}]`, "pageBreakEdge");
    else if (isObject(fields[i - 1]) && fields[i - 1].type === "pageBreak")
      problem(out, `${at}.fields[${i}]`, "pageBreakTwice");
  });
  stepsOf(fields).forEach((step, i) => {
    if (step.fields.length > 0 && step.fields.every((f) => f.type === "hidden"))
      hint(out, at, "stepOnlyHidden", { step: i + 1 });
  });
}
function controllerHas(field, value) {
  switch (field.type) {
    case "select":
    case "radio":
    case "checkboxes":
      return Array.isArray(field.options) && field.options.some((o) => isObject(o) && o.value === value);
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
    problem(out, at, "keyShape");
    return;
  }
  const file = typeof src.file === "string" && src.file.trim() !== "" ? src.file : void 0;
  const armored = typeof src.armored === "string" && src.armored.trim() !== "" ? src.armored : void 0;
  if (file === void 0 === (armored === void 0)) {
    problem(out, at, "keyExactlyOne");
    return;
  }
  if (armored !== void 0) {
    const block2 = publicKeyBlock(armored);
    if (block2.problem) problem(out, `${at}.armored`, block2.code, block2.params);
    return;
  }
  const abs = path.resolve(process.cwd(), file);
  if (!abs.startsWith(process.cwd() + path.sep)) {
    problem(out, `${at}.file`, "keyOutside", { file: String(src.file) });
    return;
  }
  let text;
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
      ...block.params
    });
}
function submissionCapacity(form) {
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
        chars += 64;
    }
  }
  const bytes = chars * 3 + 1024;
  return form.encryption.mode === "off" ? bytes : Math.ceil(bytes * 4 / 3) + 1024;
}
function checkForm(form, raw, rawSpam, keyNames, out) {
  const at = `forms.${form.id}`;
  if (!FORM_ID.test(form.id)) problem(out, at, "formIdPattern", { pattern: String(FORM_ID) });
  if (raw.template !== void 0 && !isTemplateName(raw.template))
    problem(out, `${at}.template`, "templateUnknown", { name: JSON.stringify(raw.template) });
  for (const [key, text] of [
    ["title", form.title],
    ["description", form.description],
    ["submitLabel", form.submitLabel],
    ["subject", form.subject],
    ["success.text", form.success.text]
  ])
    checkText(text, `${at}.${key}`, out);
  if (!Array.isArray(form.fields) || form.fields.length === 0) {
    problem(out, at, "noFields");
  } else {
    const names = /* @__PURE__ */ new Set();
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
  const tr = form.transport;
  switch (tr.kind) {
    case "relay":
    case "endpoint": {
      if (!tr.url) {
        problem(out, `${at}.transport.url`, "urlNeeded", { kind: tr.kind });
      } else if (!/^https?:\/\//.test(tr.url)) {
        problem(out, `${at}.transport.url`, "urlNotHttp", { url: tr.url });
      } else if (/^http:\/\//.test(tr.url) && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(tr.url)) {
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
    case "demo":
      if (tr.url) hint(out, `${at}.transport.url`, "demoNoEffect");
      if (form.success.mode === "redirect") hint(out, `${at}.success`, "demoRedirect");
      if (form.success.text !== void 0) hint(out, `${at}.success.text`, "demoNoEffect");
      if (form.spam.captcha !== "none" && !form.anonymous)
        hint(out, `${at}.spam.captcha`, "demoCaptcha", { provider: form.spam.captcha });
      break;
    default:
      problem(out, `${at}.transport.kind`, "kindUnknown", { kind: JSON.stringify(tr.kind) });
  }
  if ((tr.kind === "relay" || tr.kind === "mailto" || tr.kind === "demo") && Object.keys(tr.extra ?? {}).length > 0)
    hint(
      out,
      `${at}.transport.extra`,
      tr.kind === "relay" ? "extraRelay" : tr.kind === "mailto" ? "extraMailto" : "demoNoEffect"
    );
  if (tr.format !== void 0 && tr.format !== "json" && tr.format !== "form")
    problem(out, `${at}.transport.format`, "formatValue");
  const enc = form.encryption;
  if (!["required", "optional", "off"].includes(enc.mode))
    problem(out, `${at}.encryption.mode`, "modeValue");
  if (enc.mode !== "off") {
    if (enc.keys.length === 0) problem(out, `${at}.encryption`, "noKeys");
    for (const name of enc.keys)
      if (!keyNames.includes(name)) problem(out, `${at}.encryption.keys`, "keyUnknown", { name });
    if (tr.kind === "mailto") hint(out, at, "mailtoEncrypted");
  }
  const sp = form.spam;
  if (!Number.isInteger(sp.minSeconds) || sp.minSeconds < 0)
    problem(out, `${at}.spam.minSeconds`, "minSecondsValue");
  if (!Number.isInteger(sp.powDifficulty) || sp.powDifficulty < 8 || sp.powDifficulty > 20)
    problem(out, `${at}.spam.powDifficulty`, "powDifficultyValue");
  if (!["none", "turnstile", "hcaptcha"].includes(sp.captcha))
    problem(out, `${at}.spam.captcha`, "captchaValue");
  if (sp.captcha !== "none" && !sp.captchaSiteKey && !form.anonymous)
    problem(out, `${at}.spam.captchaSiteKey`, "siteKeyNeeded", { provider: sp.captcha });
  if (sp.captcha !== "none" && form.anonymous)
    hint(out, at, "anonymousCaptcha", { provider: sp.captcha });
  if (sp.captcha !== "none" && !form.anonymous && enc.mode !== "off")
    hint(out, `${at}.spam.captcha`, "encryptionCaptcha", { provider: sp.captcha });
  if (tr.kind !== "relay") {
    if (sp.pow) hint(out, `${at}.spam.pow`, "noRelayEffect");
    if (sp.rateLimitPerHour > 0 && (raw.spam?.rateLimitPerHour !== void 0 || rawSpam.rateLimitPerHour !== void 0))
      hint(out, `${at}.spam.rateLimitPerHour`, "noRelayEffect");
  } else if (sp.noScript) {
    if (sp.pow) hint(out, `${at}.spam.pow`, "powNoScript");
    if (sp.minSeconds > 0 && (raw.spam?.minSeconds !== void 0 || rawSpam.minSeconds !== void 0))
      hint(out, `${at}.spam.minSeconds`, "minSecondsNoScript");
  }
  if (tr.kind === "relay" && sp.rateLimitPerHour > 0 && (sp.captcha === "none" || form.anonymous) && (!sp.pow || sp.noScript))
    hint(out, `${at}.spam.rateLimitPerHour`, "rateLimitLever", { count: sp.rateLimitPerHour });
  if (sp.pow && tr.kind === "relay" && sp.powDifficulty >= 18 && sp.powDifficulty <= 20)
    hint(out, `${at}.spam.powDifficulty`, "powSlow", { bits: sp.powDifficulty });
  for (const key of ["maxFieldLength", "maxTextareaLength", "maxKeyLength", "maxBytes"])
    if (!Number.isInteger(sp[key]) || sp[key] < 1)
      problem(out, `${at}.spam.${key}`, "positiveInteger");
  if (Number.isInteger(sp.maxBytes) && sp.maxBytes >= 1) {
    const capacity = submissionCapacity(form);
    if (capacity > sp.maxBytes)
      hint(out, `${at}.spam.maxBytes`, "maxBytesLow", {
        maxBytes: sp.maxBytes,
        capacity,
        encrypted: enc.mode !== "off"
      });
  }
  if (form.anonymous) {
    if (raw.pageContext === true) hint(out, `${at}.pageContext`, "pageContextAnonymous");
    const written = raw.fields ?? (isTemplateName(raw.template) ? templateOf(raw.template).fields : void 0);
    written?.forEach((field, i) => {
      if (isObject(field) && "required" in field && field.required && isPersonalField(field))
        hint(out, `${at}.fields[${i}]`, "personalOptional", {
          name: String(field.name),
          type: field.type
        });
    });
  }
  if (form.success.mode !== "inline" && form.success.mode !== "redirect")
    problem(out, `${at}.success.mode`, "successMode");
  if (form.success.mode === "redirect" && !form.success.slug)
    problem(out, `${at}.success.slug`, "successSlug");
}
function validate(opts, rawForms, rawSpam = {}) {
  const out = { problems: [], hints: [], problemMessages: [], hintMessages: [] };
  const keyNames = Object.keys(opts.keys);
  for (const [name, src] of Object.entries(opts.keys)) checkKeySource(name, src, out);
  for (const form of Object.values(opts.forms)) {
    const raw = rawForms[form.id];
    checkForm(form, isObject(raw) ? raw : {}, rawSpam, keyNames, out);
  }
  if (!LANGUAGE_OPTION.test(opts.language))
    problem(out, "language", "languageValue", { value: opts.language });
  if (!opts.frontmatterKey.trim()) problem(out, "frontmatterKey", "frontmatterKeyEmpty");
  if (opts.layoutForm && !(opts.layoutForm in opts.forms))
    problem(out, "layoutForm", "layoutFormUnknown", { id: opts.layoutForm });
  if (!opts.codeBlockLang.trim() || /\s/.test(opts.codeBlockLang))
    problem(out, "codeBlockLang", "codeBlockLangValue");
  const known = new Set(textKeys());
  const locales2 = availableLocales().map((l) => l.toLowerCase().split("-")[0]);
  for (const [locale, entries] of Object.entries(opts.texts)) {
    if (!locales2.includes(locale.toLowerCase().split(/[-_]/)[0]))
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
  noScript: true,
  pow: false,
  powDifficulty: 16,
  captcha: "none",
  captchaSiteKey: "",
  rateLimitPerHour: 60,
  maxFieldLength: 2e3,
  maxTextareaLength: 2e4,
  maxKeyLength: 16384,
  maxBytes: 131072
};
var defaultOptions = {
  forms: {},
  transport: defaultTransport,
  keys: {},
  spam: defaultSpam,
  frontmatterKey: "form",
  codeBlockLang: "quartz-form",
  layoutForm: "",
  language: "auto",
  texts: {}
};
var isObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function withoutNulls(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== void 0) out[k] = v;
  return out;
}
function writtenSpam(spam) {
  const out = {};
  for (const [k, v] of Object.entries(spam))
    if (v !== defaultSpam[k]) out[k] = v;
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
    // `mode` defaults to inline inside a written `success` too: `success: { text: … }` stopped the
    // build with "inline or redirect" although the docs give inline as the default (fiftieth
    // review, N6). Anything that is not an object goes on to validate as written.
    success: isObject2(merged.success) ? { mode: "inline", ...withoutNulls(merged.success) } : merged.success ?? { mode: "inline" },
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
    layoutForm: typeof user.layoutForm === "string" ? user.layoutForm : "",
    language: typeof user.language === "string" ? user.language : "auto",
    texts: isObject2(user.texts) ? user.texts : {},
    problems: [],
    hints: [],
    problemMessages: [],
    hintMessages: []
  };
  const { problems, hints, problemMessages, hintMessages } = validate(
    resolved,
    rawForms,
    isObject2(user.spam) ? writtenSpam(withoutNulls(user.spam)) : {}
  );
  resolved.problems = problems;
  resolved.hints = hints;
  resolved.problemMessages = problemMessages;
  resolved.hintMessages = hintMessages;
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
  for (const hint2 of opts.hints) warnOnce(hint2, hint2);
}

export { __commonJS, __export, __require, __toESM, conditionOf, conditionsOf, defaultOptions, formatMessage, isNamed, logHints, messageLang, messageText, publicKeyBlock, resolveOptions, resolveOrThrow, stepsOf, templateNames, templateOf, warnOnce, wording };
//# sourceMappingURL=chunk-O5GZQ4RH.js.map
//# sourceMappingURL=chunk-O5GZQ4RH.js.map