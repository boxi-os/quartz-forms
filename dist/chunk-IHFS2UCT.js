import { createRequire } from 'module';
import fs2 from 'fs';
import path from 'path';
import { jsx, jsxs, Fragment } from 'preact/jsx-runtime';
import { h as h$1 } from 'preact';

createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
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
  __defProp(target, "default", { value: mod, enumerable: true }) ,
  mod
));

// node_modules/inline-style-parser/cjs/index.js
var require_cjs = __commonJS({
  "node_modules/inline-style-parser/cjs/index.js"(exports, module) {
    var COMMENT_REGEX = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;
    var NEWLINE_REGEX = /\n/g;
    var WHITESPACE_REGEX = /^\s*/;
    var PROPERTY_REGEX = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/;
    var COLON_REGEX = /^:\s*/;
    var VALUE_REGEX = /^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/;
    var SEMICOLON_REGEX = /^[;\s]*/;
    var TRIM_REGEX = /^\s+|\s+$/g;
    var NEWLINE = "\n";
    var FORWARD_SLASH = "/";
    var ASTERISK = "*";
    var EMPTY_STRING = "";
    var TYPE_COMMENT = "comment";
    var TYPE_DECLARATION = "declaration";
    function index2(style2, options) {
      if (typeof style2 !== "string") {
        throw new TypeError("First argument must be a string");
      }
      if (!style2) return [];
      options = options || {};
      var lineno = 1;
      var column = 1;
      function updatePosition(str) {
        var lines = str.match(NEWLINE_REGEX);
        if (lines) lineno += lines.length;
        var i = str.lastIndexOf(NEWLINE);
        column = ~i ? str.length - i : column + str.length;
      }
      function position3() {
        var start2 = { line: lineno, column };
        return function(node) {
          node.position = new Position(start2);
          whitespace2();
          return node;
        };
      }
      function Position(start2) {
        this.start = start2;
        this.end = { line: lineno, column };
        this.source = options.source;
      }
      Position.prototype.content = style2;
      function error(msg) {
        var err = new Error(
          options.source + ":" + lineno + ":" + column + ": " + msg
        );
        err.reason = msg;
        err.filename = options.source;
        err.line = lineno;
        err.column = column;
        err.source = style2;
        if (options.silent) ;
        else {
          throw err;
        }
      }
      function match(re2) {
        var m = re2.exec(style2);
        if (!m) return;
        var str = m[0];
        updatePosition(str);
        style2 = style2.slice(str.length);
        return m;
      }
      function whitespace2() {
        match(WHITESPACE_REGEX);
      }
      function comments(rules) {
        var c;
        rules = rules || [];
        while (c = comment()) {
          if (c !== false) {
            rules.push(c);
          }
        }
        return rules;
      }
      function comment() {
        var pos = position3();
        if (FORWARD_SLASH != style2.charAt(0) || ASTERISK != style2.charAt(1)) return;
        var i = 2;
        while (EMPTY_STRING != style2.charAt(i) && (ASTERISK != style2.charAt(i) || FORWARD_SLASH != style2.charAt(i + 1))) {
          ++i;
        }
        i += 2;
        if (EMPTY_STRING === style2.charAt(i - 1)) {
          return error("End of comment missing");
        }
        var str = style2.slice(2, i - 2);
        column += 2;
        updatePosition(str);
        style2 = style2.slice(i);
        column += 2;
        return pos({
          type: TYPE_COMMENT,
          comment: str
        });
      }
      function declaration() {
        var pos = position3();
        var prop = match(PROPERTY_REGEX);
        if (!prop) return;
        comment();
        if (!match(COLON_REGEX)) return error("property missing ':'");
        var val = match(VALUE_REGEX);
        var ret = pos({
          type: TYPE_DECLARATION,
          property: trim(prop[0].replace(COMMENT_REGEX, EMPTY_STRING)),
          value: val ? trim(val[0].replace(COMMENT_REGEX, EMPTY_STRING)) : EMPTY_STRING
        });
        match(SEMICOLON_REGEX);
        return ret;
      }
      function declarations() {
        var decls = [];
        comments(decls);
        var decl;
        while (decl = declaration()) {
          if (decl !== false) {
            decls.push(decl);
            comments(decls);
          }
        }
        return decls;
      }
      whitespace2();
      return declarations();
    }
    function trim(str) {
      return str ? str.replace(TRIM_REGEX, EMPTY_STRING) : EMPTY_STRING;
    }
    module.exports = index2;
  }
});

// node_modules/style-to-object/cjs/index.js
var require_cjs2 = __commonJS({
  "node_modules/style-to-object/cjs/index.js"(exports) {
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = StyleToObject;
    var inline_style_parser_1 = __importDefault(require_cjs());
    function StyleToObject(style2, iterator) {
      let styleObject = null;
      if (!style2 || typeof style2 !== "string") {
        return styleObject;
      }
      const declarations = (0, inline_style_parser_1.default)(style2);
      const hasIterator = typeof iterator === "function";
      declarations.forEach((declaration) => {
        if (declaration.type !== "declaration") {
          return;
        }
        const { property, value } = declaration;
        if (hasIterator) {
          iterator(property, value, declaration);
        } else if (value) {
          styleObject = styleObject || {};
          styleObject[property] = value;
        }
      });
      return styleObject;
    }
  }
});

// node_modules/style-to-js/cjs/utilities.js
var require_utilities = __commonJS({
  "node_modules/style-to-js/cjs/utilities.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.camelCase = void 0;
    var CUSTOM_PROPERTY_REGEX = /^--[a-zA-Z0-9_-]+$/;
    var HYPHEN_REGEX = /-([a-z])/g;
    var NO_HYPHEN_REGEX = /^[^-]+$/;
    var VENDOR_PREFIX_REGEX = /^-(webkit|moz|ms|o|khtml)-/;
    var MS_VENDOR_PREFIX_REGEX = /^-(ms)-/;
    var skipCamelCase = function(property) {
      return !property || NO_HYPHEN_REGEX.test(property) || CUSTOM_PROPERTY_REGEX.test(property);
    };
    var capitalize = function(match, character) {
      return character.toUpperCase();
    };
    var trimHyphen = function(match, prefix) {
      return "".concat(prefix, "-");
    };
    var camelCase = function(property, options) {
      if (options === void 0) {
        options = {};
      }
      if (skipCamelCase(property)) {
        return property;
      }
      property = property.toLowerCase();
      if (options.reactCompat) {
        property = property.replace(MS_VENDOR_PREFIX_REGEX, trimHyphen);
      } else {
        property = property.replace(VENDOR_PREFIX_REGEX, trimHyphen);
      }
      return property.replace(HYPHEN_REGEX, capitalize);
    };
    exports.camelCase = camelCase;
  }
});

// node_modules/style-to-js/cjs/index.js
var require_cjs3 = __commonJS({
  "node_modules/style-to-js/cjs/index.js"(exports, module) {
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    var style_to_object_1 = __importDefault(require_cjs2());
    var utilities_1 = require_utilities();
    function StyleToJS(style2, options) {
      var output = {};
      if (!style2 || typeof style2 !== "string") {
        return output;
      }
      (0, style_to_object_1.default)(style2, function(property, value) {
        if (property && value) {
          output[(0, utilities_1.camelCase)(property, options)] = value;
        }
      });
      return output;
    }
    StyleToJS.default = StyleToJS;
    module.exports = StyleToJS;
  }
});

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
function templateOf(name2) {
  return JSON.parse(JSON.stringify(templates[name2]));
}
function isTemplateName(name2) {
  return typeof name2 === "string" && name2 in templates;
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
function textProblem(text3, at) {
  if (text3 === void 0) return void 0;
  if (typeof text3 === "string") return text3.trim() ? void 0 : `${at}: empty text`;
  if (!isObject(text3)) return `${at}: a text is a string or a record of language \u2192 string`;
  const entries = Object.entries(text3);
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
  for (const [key, text3] of texts) {
    const p = textProblem(text3, `${at}.${key}`);
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
function checkKeySource(name2, src, out) {
  const at = `keys.${name2}`;
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
  let text3;
  try {
    text3 = fs2.readFileSync(abs, "utf8");
  } catch {
    out.problems.push(`${at}.file: ${src.file} not found or not readable`);
    return;
  }
  if (!PUBLIC_KEY_BLOCK.test(text3))
    out.problems.push(`${at}.file: ${src.file} is not an armored PGP public key block`);
}
function checkForm(form, raw, keyNames, out) {
  const at = `forms.${form.id}`;
  if (!FORM_ID.test(form.id))
    out.problems.push(`${at}: form id must match ${FORM_ID} (lower-case letters, digits, -)`);
  if (raw.template !== void 0 && !isTemplateName(raw.template))
    out.problems.push(`${at}.template: unknown template ${JSON.stringify(raw.template)}`);
  for (const [key, text3] of [
    ["title", form.title],
    ["description", form.description],
    ["submitLabel", form.submitLabel],
    ["subject", form.subject],
    ["success.text", form.success.text]
  ]) {
    const p = textProblem(text3, `${at}.${key}`);
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
    for (const name2 of enc.keys)
      if (!keyNames.includes(name2))
        out.problems.push(`${at}.encryption.keys: unknown key "${name2}"`);
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
  for (const [name2, src] of Object.entries(opts.keys)) checkKeySource(name2, src, out);
  for (const form of Object.values(opts.forms)) {
    const raw = rawForms[form.id];
    checkForm(form, isObject(raw) ? raw : {}, keyNames, out);
  }
  if (!LANGUAGE_OPTION.test(opts.language))
    out.problems.push(`language: "${opts.language}" is neither auto nor a language code`);
  if (!opts.frontmatterKey.trim()) out.problems.push("frontmatterKey: empty");
  if (opts.layoutForm && !(opts.layoutForm in opts.forms))
    out.problems.push(`layoutForm: no form "${opts.layoutForm}"`);
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
    layoutForm: typeof user.layoutForm === "string" ? user.layoutForm : "",
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

// src/text.ts
function resolveText(text3, lang) {
  if (text3 === void 0) return void 0;
  if (typeof text3 === "string") return text3;
  const entries = Object.entries(text3);
  if (entries.length === 0) return void 0;
  const want = lang.toLowerCase();
  const exact = entries.find(([k]) => k.toLowerCase() === want);
  if (exact) return exact[1];
  const primary = want.split(/[-_]/)[0];
  const sub = entries.find(([k]) => k.toLowerCase().split(/[-_]/)[0] === primary);
  if (sub) return sub[1];
  return entries[0][1];
}
function interpolate(template, values) {
  return template.replace(
    /\{(\w+)\}/g,
    (m, key) => key in values ? String(values[key]) : m
  );
}

// node_modules/unist-util-is/lib/index.js
var convert = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  (function(test) {
    if (test === null || test === void 0) {
      return ok;
    }
    if (typeof test === "function") {
      return castFactory(test);
    }
    if (typeof test === "object") {
      return Array.isArray(test) ? anyFactory(test) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        propertiesFactory(
          /** @type {Props} */
          test
        )
      );
    }
    if (typeof test === "string") {
      return typeFactory(test);
    }
    throw new Error("Expected function, string, or object as test");
  })
);
function anyFactory(tests) {
  const checks2 = [];
  let index2 = -1;
  while (++index2 < tests.length) {
    checks2[index2] = convert(tests[index2]);
  }
  return castFactory(any);
  function any(...parameters) {
    let index3 = -1;
    while (++index3 < checks2.length) {
      if (checks2[index3].apply(this, parameters)) return true;
    }
    return false;
  }
}
function propertiesFactory(check) {
  const checkAsRecord = (
    /** @type {Record<string, unknown>} */
    check
  );
  return castFactory(all);
  function all(node) {
    const nodeAsRecord = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      node
    );
    let key;
    for (key in check) {
      if (nodeAsRecord[key] !== checkAsRecord[key]) return false;
    }
    return true;
  }
}
function typeFactory(check) {
  return castFactory(type);
  function type(node) {
    return node && node.type === check;
  }
}
function castFactory(testFunction) {
  return check;
  function check(value, index2, parent) {
    return Boolean(
      looksLikeANode(value) && testFunction.call(
        this,
        value,
        typeof index2 === "number" ? index2 : void 0,
        parent || void 0
      )
    );
  }
}
function ok() {
  return true;
}
function looksLikeANode(value) {
  return value !== null && typeof value === "object" && "type" in value;
}

// node_modules/unist-util-visit-parents/lib/color.node.js
function color(d) {
  return "\x1B[33m" + d + "\x1B[39m";
}

// node_modules/unist-util-visit-parents/lib/index.js
var empty = [];
var CONTINUE = true;
var EXIT = false;
var SKIP = "skip";
function visitParents(tree, test, visitor, reverse) {
  let check;
  if (typeof test === "function" && typeof visitor !== "function") {
    reverse = visitor;
    visitor = test;
  } else {
    check = test;
  }
  const is2 = convert(check);
  const step = reverse ? -1 : 1;
  factory(tree, void 0, [])();
  function factory(node, index2, parents) {
    const value = (
      /** @type {Record<string, unknown>} */
      node && typeof node === "object" ? node : {}
    );
    if (typeof value.type === "string") {
      const name2 = (
        // `hast`
        typeof value.tagName === "string" ? value.tagName : (
          // `xast`
          typeof value.name === "string" ? value.name : void 0
        )
      );
      Object.defineProperty(visit2, "name", {
        value: "node (" + color(node.type + (name2 ? "<" + name2 + ">" : "")) + ")"
      });
    }
    return visit2;
    function visit2() {
      let result = empty;
      let subresult;
      let offset;
      let grandparents;
      if (!test || is2(node, index2, parents[parents.length - 1] || void 0)) {
        result = toResult(visitor(node, parents));
        if (result[0] === EXIT) {
          return result;
        }
      }
      if ("children" in node && node.children) {
        const nodeAsParent = (
          /** @type {UnistParent} */
          node
        );
        if (nodeAsParent.children && result[0] !== SKIP) {
          offset = (reverse ? nodeAsParent.children.length : -1) + step;
          grandparents = parents.concat(nodeAsParent);
          while (offset > -1 && offset < nodeAsParent.children.length) {
            const child = nodeAsParent.children[offset];
            subresult = factory(child, offset, grandparents)();
            if (subresult[0] === EXIT) {
              return subresult;
            }
            offset = typeof subresult[1] === "number" ? subresult[1] : offset + step;
          }
        }
      }
      return result;
    }
  }
}
function toResult(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "number") {
    return [CONTINUE, value];
  }
  return value === null || value === void 0 ? empty : [value];
}

// node_modules/unist-util-visit/lib/index.js
function visit(tree, testOrVisitor, visitorOrReverse, maybeReverse) {
  let reverse;
  let test;
  let visitor;
  if (typeof testOrVisitor === "function" && typeof visitorOrReverse !== "function") {
    test = void 0;
    visitor = testOrVisitor;
    reverse = visitorOrReverse;
  } else {
    test = testOrVisitor;
    visitor = visitorOrReverse;
    reverse = maybeReverse;
  }
  visitParents(tree, test, overload, reverse);
  function overload(node, parents) {
    const parent = parents[parents.length - 1];
    const index2 = parent ? parent.children.indexOf(node) : void 0;
    return visitor(node, index2, parent);
  }
}
var cache = /* @__PURE__ */ new Map();
function loadKeys(sources, names) {
  const out = [];
  for (const name2 of names) {
    const src = sources[name2];
    if (!src) continue;
    if (typeof src.armored === "string" && src.armored.trim()) {
      out.push({ name: name2, armored: src.armored.trim() });
      continue;
    }
    if (typeof src.file !== "string") continue;
    const abs = path.resolve(process.cwd(), src.file);
    try {
      const mtimeMs = fs2.statSync(abs).mtimeMs;
      const hit = cache.get(abs);
      if (hit && hit.mtimeMs === mtimeMs) {
        out.push({ name: name2, armored: hit.armored });
        continue;
      }
      const armored = fs2.readFileSync(abs, "utf8").trim();
      cache.set(abs, { mtimeMs, armored });
      out.push({ name: name2, armored });
    } catch {
    }
  }
  return out;
}

// src/render/context.ts
function pageLanguage(frontmatter, siteLocale) {
  const fm = frontmatter?.lang;
  if (typeof fm === "string" && fm.trim()) return fm.trim();
  return siteLocale ?? "en-US";
}
function makeContext(opts, form, args) {
  return {
    lang: args.lang,
    t: wording(args.lang, opts.texts),
    idPrefix: args.idPrefix,
    keys: form.encryption.mode === "off" ? [] : loadKeys(opts.keys, form.encryption.keys),
    page: args.page,
    serve: args.serve
  };
}

// node_modules/property-information/lib/util/schema.js
var Schema = class {
  /**
   * @param {SchemaType['property']} property
   *   Property.
   * @param {SchemaType['normal']} normal
   *   Normal.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Schema.
   */
  constructor(property, normal, space) {
    this.normal = normal;
    this.property = property;
    if (space) {
      this.space = space;
    }
  }
};
Schema.prototype.normal = {};
Schema.prototype.property = {};
Schema.prototype.space = void 0;

// node_modules/property-information/lib/util/merge.js
function merge(definitions, space) {
  const property = {};
  const normal = {};
  for (const definition of definitions) {
    Object.assign(property, definition.property);
    Object.assign(normal, definition.normal);
  }
  return new Schema(property, normal, space);
}

// node_modules/property-information/lib/normalize.js
function normalize(value) {
  return value.toLowerCase();
}

// node_modules/property-information/lib/util/info.js
var Info = class {
  /**
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @returns
   *   Info.
   */
  constructor(property, attribute) {
    this.attribute = attribute;
    this.property = property;
  }
};
Info.prototype.attribute = "";
Info.prototype.booleanish = false;
Info.prototype.boolean = false;
Info.prototype.commaOrSpaceSeparated = false;
Info.prototype.commaSeparated = false;
Info.prototype.defined = false;
Info.prototype.mustUseProperty = false;
Info.prototype.number = false;
Info.prototype.overloadedBoolean = false;
Info.prototype.property = "";
Info.prototype.spaceSeparated = false;
Info.prototype.space = void 0;

// node_modules/property-information/lib/util/types.js
var types_exports = {};
__export(types_exports, {
  boolean: () => boolean,
  booleanish: () => booleanish,
  commaOrSpaceSeparated: () => commaOrSpaceSeparated,
  commaSeparated: () => commaSeparated,
  number: () => number,
  overloadedBoolean: () => overloadedBoolean,
  spaceSeparated: () => spaceSeparated
});
var powers = 0;
var boolean = increment();
var booleanish = increment();
var overloadedBoolean = increment();
var number = increment();
var spaceSeparated = increment();
var commaSeparated = increment();
var commaOrSpaceSeparated = increment();
function increment() {
  return 2 ** ++powers;
}

// node_modules/property-information/lib/util/defined-info.js
var checks = (
  /** @type {ReadonlyArray<keyof typeof types>} */
  Object.keys(types_exports)
);
var DefinedInfo = class extends Info {
  /**
   * @constructor
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @param {number | null | undefined} [mask]
   *   Mask.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Info.
   */
  constructor(property, attribute, mask, space) {
    let index2 = -1;
    super(property, attribute);
    mark(this, "space", space);
    if (typeof mask === "number") {
      while (++index2 < checks.length) {
        const check = checks[index2];
        mark(this, checks[index2], (mask & types_exports[check]) === types_exports[check]);
      }
    }
  }
};
DefinedInfo.prototype.defined = true;
function mark(values, key, value) {
  if (value) {
    values[key] = value;
  }
}

// node_modules/property-information/lib/util/create.js
function create(definition) {
  const properties = {};
  const normals = {};
  for (const [property, value] of Object.entries(definition.properties)) {
    const info = new DefinedInfo(
      property,
      definition.transform(definition.attributes || {}, property),
      value,
      definition.space
    );
    if (definition.mustUseProperty && definition.mustUseProperty.includes(property)) {
      info.mustUseProperty = true;
    }
    properties[property] = info;
    normals[normalize(property)] = property;
    normals[normalize(info.attribute)] = property;
  }
  return new Schema(properties, normals, definition.space);
}

// node_modules/property-information/lib/aria.js
var aria = create({
  properties: {
    ariaActiveDescendant: null,
    ariaAtomic: booleanish,
    ariaAutoComplete: null,
    ariaBusy: booleanish,
    ariaChecked: booleanish,
    ariaColCount: number,
    ariaColIndex: number,
    ariaColSpan: number,
    ariaControls: spaceSeparated,
    ariaCurrent: null,
    ariaDescribedBy: spaceSeparated,
    ariaDetails: null,
    ariaDisabled: booleanish,
    ariaDropEffect: spaceSeparated,
    ariaErrorMessage: null,
    ariaExpanded: booleanish,
    ariaFlowTo: spaceSeparated,
    ariaGrabbed: booleanish,
    ariaHasPopup: null,
    ariaHidden: booleanish,
    ariaInvalid: null,
    ariaKeyShortcuts: null,
    ariaLabel: null,
    ariaLabelledBy: spaceSeparated,
    ariaLevel: number,
    ariaLive: null,
    ariaModal: booleanish,
    ariaMultiLine: booleanish,
    ariaMultiSelectable: booleanish,
    ariaOrientation: null,
    ariaOwns: spaceSeparated,
    ariaPlaceholder: null,
    ariaPosInSet: number,
    ariaPressed: booleanish,
    ariaReadOnly: booleanish,
    ariaRelevant: null,
    ariaRequired: booleanish,
    ariaRoleDescription: spaceSeparated,
    ariaRowCount: number,
    ariaRowIndex: number,
    ariaRowSpan: number,
    ariaSelected: booleanish,
    ariaSetSize: number,
    ariaSort: null,
    ariaValueMax: number,
    ariaValueMin: number,
    ariaValueNow: number,
    ariaValueText: null,
    role: null
  },
  transform(_, property) {
    return property === "role" ? property : "aria-" + property.slice(4).toLowerCase();
  }
});

// node_modules/property-information/lib/util/case-sensitive-transform.js
function caseSensitiveTransform(attributes, attribute) {
  return attribute in attributes ? attributes[attribute] : attribute;
}

// node_modules/property-information/lib/util/case-insensitive-transform.js
function caseInsensitiveTransform(attributes, property) {
  return caseSensitiveTransform(attributes, property.toLowerCase());
}

// node_modules/property-information/lib/html.js
var html = create({
  attributes: {
    acceptcharset: "accept-charset",
    classname: "class",
    htmlfor: "for",
    httpequiv: "http-equiv"
  },
  mustUseProperty: ["checked", "multiple", "muted", "selected"],
  properties: {
    // Standard Properties.
    abbr: null,
    accept: commaSeparated,
    acceptCharset: spaceSeparated,
    accessKey: spaceSeparated,
    action: null,
    allow: null,
    allowFullScreen: boolean,
    allowPaymentRequest: boolean,
    allowUserMedia: boolean,
    alpha: boolean,
    alt: null,
    as: null,
    async: boolean,
    autoCapitalize: null,
    autoComplete: spaceSeparated,
    autoFocus: boolean,
    autoPlay: boolean,
    blocking: spaceSeparated,
    capture: null,
    charSet: null,
    checked: boolean,
    cite: null,
    className: spaceSeparated,
    closedBy: null,
    colorSpace: null,
    cols: number,
    colSpan: number,
    command: null,
    commandFor: null,
    content: null,
    contentEditable: booleanish,
    controls: boolean,
    controlsList: spaceSeparated,
    coords: number | commaSeparated,
    crossOrigin: null,
    data: null,
    dateTime: null,
    decoding: null,
    default: boolean,
    defer: boolean,
    dir: null,
    dirName: null,
    disabled: boolean,
    download: overloadedBoolean,
    draggable: booleanish,
    encType: null,
    enterKeyHint: null,
    fetchPriority: null,
    form: null,
    formAction: null,
    formEncType: null,
    formMethod: null,
    formNoValidate: boolean,
    formTarget: null,
    headers: spaceSeparated,
    height: number,
    hidden: overloadedBoolean,
    high: number,
    href: null,
    hrefLang: null,
    htmlFor: spaceSeparated,
    httpEquiv: spaceSeparated,
    id: null,
    imageSizes: null,
    imageSrcSet: null,
    inert: boolean,
    inputMode: null,
    integrity: null,
    is: null,
    isMap: boolean,
    itemId: null,
    itemProp: spaceSeparated,
    itemRef: spaceSeparated,
    itemScope: boolean,
    itemType: spaceSeparated,
    kind: null,
    label: null,
    lang: null,
    language: null,
    list: null,
    loading: null,
    loop: boolean,
    low: number,
    manifest: null,
    max: null,
    maxLength: number,
    media: null,
    method: null,
    min: null,
    minLength: number,
    multiple: boolean,
    muted: boolean,
    name: null,
    nonce: null,
    noModule: boolean,
    noValidate: boolean,
    onAbort: null,
    onAfterPrint: null,
    onAuxClick: null,
    onBeforeMatch: null,
    onBeforePrint: null,
    onBeforeToggle: null,
    onBeforeUnload: null,
    onBlur: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onContextLost: null,
    onContextMenu: null,
    onContextRestored: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFormData: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLanguageChange: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadEnd: null,
    onLoadStart: null,
    onMessage: null,
    onMessageError: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRejectionHandled: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onScrollEnd: null,
    onSecurityPolicyViolation: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onSlotChange: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnhandledRejection: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onWheel: null,
    open: boolean,
    optimum: number,
    pattern: null,
    ping: spaceSeparated,
    placeholder: null,
    playsInline: boolean,
    popover: null,
    popoverTarget: null,
    popoverTargetAction: null,
    poster: null,
    preload: null,
    readOnly: boolean,
    referrerPolicy: null,
    rel: spaceSeparated,
    required: boolean,
    reversed: boolean,
    rows: number,
    rowSpan: number,
    sandbox: spaceSeparated,
    scope: null,
    scoped: boolean,
    seamless: boolean,
    selected: boolean,
    shadowRootClonable: boolean,
    shadowRootCustomElementRegistry: boolean,
    shadowRootDelegatesFocus: boolean,
    shadowRootMode: null,
    shadowRootSerializable: boolean,
    shape: null,
    size: number,
    sizes: null,
    slot: null,
    span: number,
    spellCheck: booleanish,
    src: null,
    srcDoc: null,
    srcLang: null,
    srcSet: null,
    start: number,
    step: null,
    style: null,
    tabIndex: number,
    target: null,
    title: null,
    translate: null,
    type: null,
    typeMustMatch: boolean,
    useMap: null,
    value: booleanish,
    width: number,
    wrap: null,
    writingSuggestions: null,
    // Legacy.
    // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
    align: null,
    // Several. Use CSS `text-align` instead,
    aLink: null,
    // `<body>`. Use CSS `a:active {color}` instead
    archive: spaceSeparated,
    // `<object>`. List of URIs to archives
    axis: null,
    // `<td>` and `<th>`. Use `scope` on `<th>`
    background: null,
    // `<body>`. Use CSS `background-image` instead
    bgColor: null,
    // `<body>` and table elements. Use CSS `background-color` instead
    border: number,
    // `<table>`. Use CSS `border-width` instead,
    borderColor: null,
    // `<table>`. Use CSS `border-color` instead,
    bottomMargin: number,
    // `<body>`
    cellPadding: null,
    // `<table>`
    cellSpacing: null,
    // `<table>`
    char: null,
    // Several table elements. When `align=char`, sets the character to align on
    charOff: null,
    // Several table elements. When `char`, offsets the alignment
    classId: null,
    // `<object>`
    clear: null,
    // `<br>`. Use CSS `clear` instead
    code: null,
    // `<object>`
    codeBase: null,
    // `<object>`
    codeType: null,
    // `<object>`
    color: null,
    // `<font>` and `<hr>`. Use CSS instead
    compact: boolean,
    // Lists. Use CSS to reduce space between items instead
    declare: boolean,
    // `<object>`
    event: null,
    // `<script>`
    face: null,
    // `<font>`. Use CSS instead
    frame: null,
    // `<table>`
    frameBorder: null,
    // `<iframe>`. Use CSS `border` instead
    hSpace: number,
    // `<img>` and `<object>`
    leftMargin: number,
    // `<body>`
    link: null,
    // `<body>`. Use CSS `a:link {color: *}` instead
    longDesc: null,
    // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
    lowSrc: null,
    // `<img>`. Use a `<picture>`
    marginHeight: number,
    // `<body>`
    marginWidth: number,
    // `<body>`
    noResize: boolean,
    // `<frame>`
    noHref: boolean,
    // `<area>`. Use no href instead of an explicit `nohref`
    noShade: boolean,
    // `<hr>`. Use background-color and height instead of borders
    noWrap: boolean,
    // `<td>` and `<th>`
    object: null,
    // `<applet>`
    profile: null,
    // `<head>`
    prompt: null,
    // `<isindex>`
    rev: null,
    // `<link>`
    rightMargin: number,
    // `<body>`
    rules: null,
    // `<table>`
    scheme: null,
    // `<meta>`
    scrolling: booleanish,
    // `<frame>`. Use overflow in the child context
    standby: null,
    // `<object>`
    summary: null,
    // `<table>`
    text: null,
    // `<body>`. Use CSS `color` instead
    topMargin: number,
    // `<body>`
    valueType: null,
    // `<param>`
    version: null,
    // `<html>`. Use a doctype.
    vAlign: null,
    // Several. Use CSS `vertical-align` instead
    vLink: null,
    // `<body>`. Use CSS `a:visited {color}` instead
    vSpace: number,
    // `<img>` and `<object>`
    // Non-standard Properties.
    allowTransparency: null,
    autoCorrect: null,
    autoSave: null,
    credentialless: boolean,
    disablePictureInPicture: boolean,
    disableRemotePlayback: boolean,
    exportParts: commaSeparated,
    part: spaceSeparated,
    prefix: null,
    property: null,
    results: number,
    security: null,
    unselectable: null
  },
  space: "html",
  transform: caseInsensitiveTransform
});

// node_modules/property-information/lib/svg.js
var svg = create({
  attributes: {
    accentHeight: "accent-height",
    alignmentBaseline: "alignment-baseline",
    arabicForm: "arabic-form",
    baselineShift: "baseline-shift",
    capHeight: "cap-height",
    className: "class",
    clipPath: "clip-path",
    clipRule: "clip-rule",
    colorInterpolation: "color-interpolation",
    colorInterpolationFilters: "color-interpolation-filters",
    colorProfile: "color-profile",
    colorRendering: "color-rendering",
    crossOrigin: "crossorigin",
    dataType: "datatype",
    dominantBaseline: "dominant-baseline",
    enableBackground: "enable-background",
    fillOpacity: "fill-opacity",
    fillRule: "fill-rule",
    floodColor: "flood-color",
    floodOpacity: "flood-opacity",
    fontFamily: "font-family",
    fontSize: "font-size",
    fontSizeAdjust: "font-size-adjust",
    fontStretch: "font-stretch",
    fontStyle: "font-style",
    fontVariant: "font-variant",
    fontWeight: "font-weight",
    glyphName: "glyph-name",
    glyphOrientationHorizontal: "glyph-orientation-horizontal",
    glyphOrientationVertical: "glyph-orientation-vertical",
    hrefLang: "hreflang",
    horizAdvX: "horiz-adv-x",
    horizOriginX: "horiz-origin-x",
    horizOriginY: "horiz-origin-y",
    imageRendering: "image-rendering",
    letterSpacing: "letter-spacing",
    lightingColor: "lighting-color",
    markerEnd: "marker-end",
    markerMid: "marker-mid",
    markerStart: "marker-start",
    maskType: "mask-type",
    navDown: "nav-down",
    navDownLeft: "nav-down-left",
    navDownRight: "nav-down-right",
    navLeft: "nav-left",
    navNext: "nav-next",
    navPrev: "nav-prev",
    navRight: "nav-right",
    navUp: "nav-up",
    navUpLeft: "nav-up-left",
    navUpRight: "nav-up-right",
    onAbort: "onabort",
    onActivate: "onactivate",
    onAfterPrint: "onafterprint",
    onBeforePrint: "onbeforeprint",
    onBegin: "onbegin",
    onCancel: "oncancel",
    onCanPlay: "oncanplay",
    onCanPlayThrough: "oncanplaythrough",
    onChange: "onchange",
    onClick: "onclick",
    onClose: "onclose",
    onCopy: "oncopy",
    onCueChange: "oncuechange",
    onCut: "oncut",
    onDblClick: "ondblclick",
    onDrag: "ondrag",
    onDragEnd: "ondragend",
    onDragEnter: "ondragenter",
    onDragExit: "ondragexit",
    onDragLeave: "ondragleave",
    onDragOver: "ondragover",
    onDragStart: "ondragstart",
    onDrop: "ondrop",
    onDurationChange: "ondurationchange",
    onEmptied: "onemptied",
    onEnd: "onend",
    onEnded: "onended",
    onError: "onerror",
    onFocus: "onfocus",
    onFocusIn: "onfocusin",
    onFocusOut: "onfocusout",
    onHashChange: "onhashchange",
    onInput: "oninput",
    onInvalid: "oninvalid",
    onKeyDown: "onkeydown",
    onKeyPress: "onkeypress",
    onKeyUp: "onkeyup",
    onLoad: "onload",
    onLoadedData: "onloadeddata",
    onLoadedMetadata: "onloadedmetadata",
    onLoadStart: "onloadstart",
    onMessage: "onmessage",
    onMouseDown: "onmousedown",
    onMouseEnter: "onmouseenter",
    onMouseLeave: "onmouseleave",
    onMouseMove: "onmousemove",
    onMouseOut: "onmouseout",
    onMouseOver: "onmouseover",
    onMouseUp: "onmouseup",
    onMouseWheel: "onmousewheel",
    onOffline: "onoffline",
    onOnline: "ononline",
    onPageHide: "onpagehide",
    onPageShow: "onpageshow",
    onPaste: "onpaste",
    onPause: "onpause",
    onPlay: "onplay",
    onPlaying: "onplaying",
    onPopState: "onpopstate",
    onProgress: "onprogress",
    onRateChange: "onratechange",
    onRepeat: "onrepeat",
    onReset: "onreset",
    onResize: "onresize",
    onScroll: "onscroll",
    onSeeked: "onseeked",
    onSeeking: "onseeking",
    onSelect: "onselect",
    onShow: "onshow",
    onStalled: "onstalled",
    onStorage: "onstorage",
    onSubmit: "onsubmit",
    onSuspend: "onsuspend",
    onTimeUpdate: "ontimeupdate",
    onToggle: "ontoggle",
    onUnload: "onunload",
    onVolumeChange: "onvolumechange",
    onWaiting: "onwaiting",
    onZoom: "onzoom",
    overlinePosition: "overline-position",
    overlineThickness: "overline-thickness",
    paintOrder: "paint-order",
    panose1: "panose-1",
    pointerEvents: "pointer-events",
    referrerPolicy: "referrerpolicy",
    renderingIntent: "rendering-intent",
    shapeRendering: "shape-rendering",
    stopColor: "stop-color",
    stopOpacity: "stop-opacity",
    strikethroughPosition: "strikethrough-position",
    strikethroughThickness: "strikethrough-thickness",
    strokeDashArray: "stroke-dasharray",
    strokeDashOffset: "stroke-dashoffset",
    strokeLineCap: "stroke-linecap",
    strokeLineJoin: "stroke-linejoin",
    strokeMiterLimit: "stroke-miterlimit",
    strokeOpacity: "stroke-opacity",
    strokeWidth: "stroke-width",
    tabIndex: "tabindex",
    textAnchor: "text-anchor",
    textDecoration: "text-decoration",
    textRendering: "text-rendering",
    transformOrigin: "transform-origin",
    typeOf: "typeof",
    underlinePosition: "underline-position",
    underlineThickness: "underline-thickness",
    unicodeBidi: "unicode-bidi",
    unicodeRange: "unicode-range",
    unitsPerEm: "units-per-em",
    vAlphabetic: "v-alphabetic",
    vHanging: "v-hanging",
    vIdeographic: "v-ideographic",
    vMathematical: "v-mathematical",
    vectorEffect: "vector-effect",
    vertAdvY: "vert-adv-y",
    vertOriginX: "vert-origin-x",
    vertOriginY: "vert-origin-y",
    wordSpacing: "word-spacing",
    writingMode: "writing-mode",
    xHeight: "x-height",
    // These were camelcased in Tiny. Now lowercased in SVG 2
    playbackOrder: "playbackorder",
    timelineBegin: "timelinebegin"
  },
  properties: {
    about: commaOrSpaceSeparated,
    accentHeight: number,
    accumulate: null,
    additive: null,
    alignmentBaseline: null,
    alphabetic: number,
    amplitude: number,
    arabicForm: null,
    ascent: number,
    attributeName: null,
    attributeType: null,
    azimuth: number,
    bandwidth: null,
    baselineShift: null,
    baseFrequency: null,
    baseProfile: null,
    bbox: null,
    begin: null,
    bias: number,
    by: null,
    calcMode: null,
    capHeight: number,
    className: spaceSeparated,
    clip: null,
    clipPath: null,
    clipPathUnits: null,
    clipRule: null,
    color: null,
    colorInterpolation: null,
    colorInterpolationFilters: null,
    colorProfile: null,
    colorRendering: null,
    content: null,
    contentScriptType: null,
    contentStyleType: null,
    crossOrigin: null,
    cursor: null,
    cx: null,
    cy: null,
    d: null,
    dataType: null,
    defaultAction: null,
    descent: number,
    diffuseConstant: number,
    direction: null,
    display: null,
    dur: null,
    divisor: number,
    dominantBaseline: null,
    download: boolean,
    dx: null,
    dy: null,
    edgeMode: null,
    editable: null,
    elevation: number,
    enableBackground: null,
    end: null,
    event: null,
    exponent: number,
    externalResourcesRequired: null,
    fill: null,
    fillOpacity: number,
    fillRule: null,
    filter: null,
    filterRes: null,
    filterUnits: null,
    floodColor: null,
    floodOpacity: null,
    focusable: null,
    focusHighlight: null,
    fontFamily: null,
    fontSize: null,
    fontSizeAdjust: null,
    fontStretch: null,
    fontStyle: null,
    fontVariant: null,
    fontWeight: null,
    format: null,
    fr: null,
    from: null,
    fx: null,
    fy: null,
    g1: commaSeparated,
    g2: commaSeparated,
    glyphName: commaSeparated,
    glyphOrientationHorizontal: null,
    glyphOrientationVertical: null,
    glyphRef: null,
    gradientTransform: null,
    gradientUnits: null,
    handler: null,
    hanging: number,
    hatchContentUnits: null,
    hatchUnits: null,
    height: null,
    href: null,
    hrefLang: null,
    horizAdvX: number,
    horizOriginX: number,
    horizOriginY: number,
    id: null,
    ideographic: number,
    imageRendering: null,
    initialVisibility: null,
    in: null,
    in2: null,
    intercept: number,
    k: number,
    k1: number,
    k2: number,
    k3: number,
    k4: number,
    kernelMatrix: commaOrSpaceSeparated,
    kernelUnitLength: null,
    keyPoints: null,
    // SEMI_COLON_SEPARATED
    keySplines: null,
    // SEMI_COLON_SEPARATED
    keyTimes: null,
    // SEMI_COLON_SEPARATED
    kerning: null,
    lang: null,
    lengthAdjust: null,
    letterSpacing: null,
    lightingColor: null,
    limitingConeAngle: number,
    local: null,
    markerEnd: null,
    markerMid: null,
    markerStart: null,
    markerHeight: null,
    markerUnits: null,
    markerWidth: null,
    mask: null,
    maskContentUnits: null,
    maskType: null,
    maskUnits: null,
    mathematical: null,
    max: null,
    media: null,
    mediaCharacterEncoding: null,
    mediaContentEncodings: null,
    mediaSize: number,
    mediaTime: null,
    method: null,
    min: null,
    mode: null,
    name: null,
    navDown: null,
    navDownLeft: null,
    navDownRight: null,
    navLeft: null,
    navNext: null,
    navPrev: null,
    navRight: null,
    navUp: null,
    navUpLeft: null,
    navUpRight: null,
    numOctaves: null,
    observer: null,
    offset: null,
    onAbort: null,
    onActivate: null,
    onAfterPrint: null,
    onBeforePrint: null,
    onBegin: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnd: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFocusIn: null,
    onFocusOut: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadStart: null,
    onMessage: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onMouseWheel: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRepeat: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onShow: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onZoom: null,
    opacity: null,
    operator: null,
    order: null,
    orient: null,
    orientation: null,
    origin: null,
    overflow: null,
    overlay: null,
    overlinePosition: number,
    overlineThickness: number,
    paintOrder: null,
    panose1: null,
    path: null,
    pathLength: number,
    patternContentUnits: null,
    patternTransform: null,
    patternUnits: null,
    phase: null,
    ping: spaceSeparated,
    pitch: null,
    playbackOrder: null,
    pointerEvents: null,
    points: null,
    pointsAtX: number,
    pointsAtY: number,
    pointsAtZ: number,
    preserveAlpha: null,
    preserveAspectRatio: null,
    primitiveUnits: null,
    propagate: null,
    property: commaOrSpaceSeparated,
    r: null,
    radius: null,
    referrerPolicy: null,
    refX: null,
    refY: null,
    rel: commaOrSpaceSeparated,
    rev: commaOrSpaceSeparated,
    renderingIntent: null,
    repeatCount: null,
    repeatDur: null,
    requiredExtensions: commaOrSpaceSeparated,
    requiredFeatures: commaOrSpaceSeparated,
    requiredFonts: commaOrSpaceSeparated,
    requiredFormats: commaOrSpaceSeparated,
    resource: null,
    restart: null,
    result: null,
    rotate: null,
    rx: null,
    ry: null,
    scale: null,
    seed: null,
    shapeRendering: null,
    side: null,
    slope: null,
    snapshotTime: null,
    specularConstant: number,
    specularExponent: number,
    spreadMethod: null,
    spacing: null,
    startOffset: null,
    stdDeviation: null,
    stemh: null,
    stemv: null,
    stitchTiles: null,
    stopColor: null,
    stopOpacity: null,
    strikethroughPosition: number,
    strikethroughThickness: number,
    string: null,
    stroke: null,
    strokeDashArray: commaOrSpaceSeparated,
    strokeDashOffset: null,
    strokeLineCap: null,
    strokeLineJoin: null,
    strokeMiterLimit: number,
    strokeOpacity: number,
    strokeWidth: null,
    style: null,
    surfaceScale: number,
    syncBehavior: null,
    syncBehaviorDefault: null,
    syncMaster: null,
    syncTolerance: null,
    syncToleranceDefault: null,
    systemLanguage: commaOrSpaceSeparated,
    tabIndex: number,
    tableValues: null,
    target: null,
    targetX: number,
    targetY: number,
    textAnchor: null,
    textDecoration: null,
    textRendering: null,
    textLength: null,
    timelineBegin: null,
    title: null,
    transformBehavior: null,
    type: null,
    typeOf: commaOrSpaceSeparated,
    to: null,
    transform: null,
    transformOrigin: null,
    u1: null,
    u2: null,
    underlinePosition: number,
    underlineThickness: number,
    unicode: null,
    unicodeBidi: null,
    unicodeRange: null,
    unitsPerEm: number,
    values: null,
    vAlphabetic: number,
    vMathematical: number,
    vectorEffect: null,
    vHanging: number,
    vIdeographic: number,
    version: null,
    vertAdvY: number,
    vertOriginX: number,
    vertOriginY: number,
    viewBox: null,
    viewTarget: null,
    visibility: null,
    width: null,
    widths: null,
    wordSpacing: null,
    writingMode: null,
    x: null,
    x1: null,
    x2: null,
    xChannelSelector: null,
    xHeight: number,
    y: null,
    y1: null,
    y2: null,
    yChannelSelector: null,
    z: null,
    zoomAndPan: null
  },
  space: "svg",
  transform: caseSensitiveTransform
});

// node_modules/property-information/lib/xlink.js
var xlink = create({
  properties: {
    xLinkActuate: null,
    xLinkArcRole: null,
    xLinkHref: null,
    xLinkRole: null,
    xLinkShow: null,
    xLinkTitle: null,
    xLinkType: null
  },
  space: "xlink",
  transform(_, property) {
    return "xlink:" + property.slice(5).toLowerCase();
  }
});

// node_modules/property-information/lib/xmlns.js
var xmlns = create({
  attributes: { xmlnsxlink: "xmlns:xlink" },
  properties: { xmlnsXLink: null, xmlns: null },
  space: "xmlns",
  transform: caseInsensitiveTransform
});

// node_modules/property-information/lib/xml.js
var xml = create({
  properties: { xmlBase: null, xmlLang: null, xmlSpace: null },
  space: "xml",
  transform(_, property) {
    return "xml:" + property.slice(3).toLowerCase();
  }
});

// node_modules/property-information/lib/hast-to-react.js
var hastToReact = {
  classId: "classID",
  dataType: "datatype",
  itemId: "itemID",
  strokeDashArray: "strokeDasharray",
  strokeDashOffset: "strokeDashoffset",
  strokeLineCap: "strokeLinecap",
  strokeLineJoin: "strokeLinejoin",
  strokeMiterLimit: "strokeMiterlimit",
  typeOf: "typeof",
  xLinkActuate: "xlinkActuate",
  xLinkArcRole: "xlinkArcrole",
  xLinkHref: "xlinkHref",
  xLinkRole: "xlinkRole",
  xLinkShow: "xlinkShow",
  xLinkTitle: "xlinkTitle",
  xLinkType: "xlinkType",
  xmlnsXLink: "xmlnsXlink"
};

// node_modules/property-information/lib/find.js
var cap = /[A-Z]/g;
var dash = /-[a-z]/g;
var valid = /^data[-\w.:]+$/i;
function find(schema, value) {
  const normal = normalize(value);
  let property = value;
  let Type = Info;
  if (normal in schema.normal) {
    return schema.property[schema.normal[normal]];
  }
  if (normal.length > 4 && normal.slice(0, 4) === "data" && valid.test(value)) {
    if (value.charAt(4) === "-") {
      const rest = value.slice(5).replace(dash, camelcase);
      property = "data" + rest.charAt(0).toUpperCase() + rest.slice(1);
    } else {
      const rest = value.slice(4);
      if (!dash.test(rest)) {
        let dashes = rest.replace(cap, kebab);
        if (dashes.charAt(0) !== "-") {
          dashes = "-" + dashes;
        }
        value = "data" + dashes;
      }
    }
    Type = DefinedInfo;
  }
  return new Type(property, value);
}
function kebab($0) {
  return "-" + $0.toLowerCase();
}
function camelcase($0) {
  return $0.charAt(1).toUpperCase();
}

// node_modules/property-information/index.js
var html2 = merge([aria, html, xlink, xmlns, xml], "html");
var svg2 = merge([aria, svg, xlink, xmlns, xml], "svg");

// node_modules/comma-separated-tokens/index.js
function parse(value) {
  const tokens = [];
  const input = String(value || "");
  let index2 = input.indexOf(",");
  let start2 = 0;
  let end = false;
  while (!end) {
    if (index2 === -1) {
      index2 = input.length;
      end = true;
    }
    const token = input.slice(start2, index2).trim();
    if (token || !end) {
      tokens.push(token);
    }
    start2 = index2 + 1;
    index2 = input.indexOf(",", start2);
  }
  return tokens;
}
function stringify(values, options) {
  const settings = {};
  const input = values[values.length - 1] === "" ? [...values, ""] : values;
  return input.join(
    (settings.padRight ? " " : "") + "," + (settings.padLeft === false ? "" : " ")
  ).trim();
}

// node_modules/hast-util-parse-selector/lib/index.js
var search = /[#.]/g;
function parseSelector(selector, defaultTagName) {
  const value = selector || "";
  const props = {};
  let start2 = 0;
  let previous;
  let tagName;
  while (start2 < value.length) {
    search.lastIndex = start2;
    const match = search.exec(value);
    const subvalue = value.slice(start2, match ? match.index : value.length);
    if (subvalue) {
      if (!previous) {
        tagName = subvalue;
      } else if (previous === "#") {
        props.id = subvalue;
      } else if (Array.isArray(props.className)) {
        props.className.push(subvalue);
      } else {
        props.className = [subvalue];
      }
      start2 += subvalue.length;
    }
    if (match) {
      previous = match[0];
      start2++;
    }
  }
  return {
    type: "element",
    // @ts-expect-error: tag name is parsed.
    tagName: tagName || defaultTagName || "div",
    properties: props,
    children: []
  };
}

// node_modules/space-separated-tokens/index.js
function parse2(value) {
  const input = String(value || "").trim();
  return input ? input.split(/[ \t\n\r\f]+/g) : [];
}
function stringify2(values) {
  return values.join(" ").trim();
}

// node_modules/hastscript/lib/create-h.js
function createH(schema, defaultTagName, caseSensitive) {
  const adjust = caseSensitive ? createAdjustMap(caseSensitive) : void 0;
  function h3(selector, properties, ...children) {
    let node;
    if (selector === null || selector === void 0) {
      node = { type: "root", children: [] };
      const child = (
        /** @type {Child} */
        properties
      );
      children.unshift(child);
    } else {
      node = parseSelector(selector, defaultTagName);
      const lower = node.tagName.toLowerCase();
      const adjusted = adjust ? adjust.get(lower) : void 0;
      node.tagName = adjusted || lower;
      if (isChild(properties)) {
        children.unshift(properties);
      } else {
        for (const [key, value] of Object.entries(properties)) {
          addProperty(schema, node.properties, key, value);
        }
      }
    }
    for (const child of children) {
      addChild(node.children, child);
    }
    if (node.type === "element" && node.tagName === "template") {
      node.content = { type: "root", children: node.children };
      node.children = [];
    }
    return node;
  }
  return h3;
}
function isChild(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return true;
  }
  if (typeof value.type !== "string") return false;
  const record = (
    /** @type {Record<string, unknown>} */
    value
  );
  const keys = Object.keys(value);
  for (const key of keys) {
    const value2 = record[key];
    if (value2 && typeof value2 === "object") {
      if (!Array.isArray(value2)) return true;
      const list = (
        /** @type {ReadonlyArray<unknown>} */
        value2
      );
      for (const item of list) {
        if (typeof item !== "number" && typeof item !== "string") {
          return true;
        }
      }
    }
  }
  if ("children" in value && Array.isArray(value.children)) {
    return true;
  }
  return false;
}
function addProperty(schema, properties, key, value) {
  const info = find(schema, key);
  let result;
  if (value === null || value === void 0) return;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return;
    result = value;
  } else if (typeof value === "boolean") {
    result = value;
  } else if (typeof value === "string") {
    if (info.spaceSeparated) {
      result = parse2(value);
    } else if (info.commaSeparated) {
      result = parse(value);
    } else if (info.commaOrSpaceSeparated) {
      result = parse2(parse(value).join(" "));
    } else {
      result = parsePrimitive(info, info.property, value);
    }
  } else if (Array.isArray(value)) {
    result = [...value];
  } else {
    result = info.property === "style" ? style(value) : String(value);
  }
  if (Array.isArray(result)) {
    const finalResult = [];
    for (const item of result) {
      finalResult.push(
        /** @type {number | string} */
        parsePrimitive(info, info.property, item)
      );
    }
    result = finalResult;
  }
  if (info.property === "className" && Array.isArray(properties.className)) {
    result = properties.className.concat(
      /** @type {Array<number | string> | number | string} */
      result
    );
  }
  properties[info.property] = result;
}
function addChild(nodes, value) {
  if (value === null || value === void 0) ; else if (typeof value === "number" || typeof value === "string") {
    nodes.push({ type: "text", value: String(value) });
  } else if (Array.isArray(value)) {
    for (const child of value) {
      addChild(nodes, child);
    }
  } else if (typeof value === "object" && "type" in value) {
    if (value.type === "root") {
      addChild(nodes, value.children);
    } else {
      nodes.push(value);
    }
  } else {
    throw new Error("Expected node, nodes, or string, got `" + value + "`");
  }
}
function parsePrimitive(info, name2, value) {
  if (typeof value === "string") {
    if (info.number && value && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    if ((info.boolean || info.overloadedBoolean) && (value === "" || normalize(value) === normalize(name2))) {
      return true;
    }
  }
  return value;
}
function style(styles) {
  const result = [];
  for (const [key, value] of Object.entries(styles)) {
    result.push([key, value].join(": "));
  }
  return result.join("; ");
}
function createAdjustMap(values) {
  const result = /* @__PURE__ */ new Map();
  for (const value of values) {
    result.set(value.toLowerCase(), value);
  }
  return result;
}

// node_modules/hastscript/lib/svg-case-sensitive-tag-names.js
var svgCaseSensitiveTagNames = [
  "altGlyph",
  "altGlyphDef",
  "altGlyphItem",
  "animateColor",
  "animateMotion",
  "animateTransform",
  "clipPath",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "foreignObject",
  "glyphRef",
  "linearGradient",
  "radialGradient",
  "solidColor",
  "textArea",
  "textPath"
];

// node_modules/hastscript/lib/index.js
var h = createH(html2, "div");
createH(svg2, "g", svgCaseSensitiveTagNames);

// src/render/form.ts
var HONEYPOT_NAME = "_hp_website";
var ENCRYPT_TOGGLE_NAME = "_encrypt";
var KEY_FILE_NAME = "_key_file";
var text = (value) => ({ type: "text", value });
function clean(children) {
  const out = [];
  for (const c of children) {
    if (c === null || c === void 0 || c === false) continue;
    out.push(typeof c === "string" ? text(c) : c);
  }
  return out;
}
function endpointOf(transport, recipient) {
  switch (transport.kind) {
    case "relay":
    case "endpoint":
      return transport.url ?? "";
    case "formspree":
      return `https://formspree.io/f/${transport.url ?? ""}`;
    case "web3forms":
      return "https://api.web3forms.com/submit";
    case "mailto":
      return `mailto:${recipient ?? ""}`;
  }
}
function presetFields(form) {
  const tr = form.transport;
  const fields = { ...tr.extra ?? {} };
  if (tr.kind === "web3forms" && tr.url) fields.access_key = tr.url;
  return fields;
}
function requiredMark(ctx) {
  return [
    h("span", { className: ["quartz-form__required"], ariaHidden: "true" }, " *"),
    h("span", { className: ["quartz-form__sr-only"] }, ` (${ctx.t.requiredMark})`)
  ];
}
function label(ctx, forId, value, required) {
  return h("label", { className: ["quartz-form__label"], for: forId }, [
    text(resolveText(value, ctx.lang) ?? ""),
    ...required ? requiredMark(ctx) : []
  ]);
}
function legend(ctx, value, required) {
  return h("legend", { className: ["quartz-form__label"] }, [
    text(resolveText(value, ctx.lang) ?? ""),
    ...required ? requiredMark(ctx) : []
  ]);
}
function hintAndError(ctx, id, hint) {
  const out = [];
  const hintText = resolveText(hint, ctx.lang);
  if (hintText) out.push(h("p", { className: ["quartz-form__hint"], id: `${id}-hint` }, hintText));
  out.push(h("p", { className: ["quartz-form__error"], id: `${id}-error`, hidden: true }));
  return out;
}
function describedBy(id, hint) {
  return hint !== void 0 ? `${id}-hint ${id}-error` : `${id}-error`;
}
function fieldWrapper(field, children) {
  return h(
    "div",
    {
      className: ["quartz-form__field", `quartz-form__field--${field.type}`],
      dataField: field.name
    },
    clean(children)
  );
}
function renderInput(field, ctx, maxLength) {
  const id = `${ctx.idPrefix}-${field.name}`;
  const common = {
    id,
    name: field.name,
    required: field.required ? true : void 0,
    ariaRequired: field.required ? "true" : void 0,
    ariaDescribedby: describedBy(id, field.hint),
    placeholder: resolveText(field.placeholder, ctx.lang),
    autocomplete: field.autocomplete,
    maxlength: field.maxLength ?? maxLength
  };
  const control = field.type === "textarea" ? h("textarea", { ...common, rows: field.rows ?? 6 }) : h("input", {
    ...common,
    type: field.type,
    pattern: field.pattern,
    min: field.min,
    max: field.max,
    step: field.step,
    inputmode: field.type === "number" ? "decimal" : void 0
  });
  return fieldWrapper(field, [
    label(ctx, id, field.label, field.required),
    control,
    ...hintAndError(ctx, id, field.hint)
  ]);
}
function renderChoice(field, ctx) {
  const id = `${ctx.idPrefix}-${field.name}`;
  if (field.type === "select") {
    return fieldWrapper(field, [
      label(ctx, id, field.label, field.required),
      h(
        "select",
        {
          id,
          name: field.name,
          required: field.required ? true : void 0,
          ariaRequired: field.required ? "true" : void 0,
          ariaDescribedby: describedBy(id, field.hint)
        },
        [
          h(
            "option",
            { value: "", selected: true, disabled: field.required ? true : void 0 },
            ctx.t.selectPlaceholder
          ),
          ...field.options.map(
            (o) => h("option", { value: o.value }, resolveText(o.label, ctx.lang) ?? o.value)
          )
        ]
      ),
      ...hintAndError(ctx, id, field.hint)
    ]);
  }
  const type = field.type === "radio" ? "radio" : "checkbox";
  return fieldWrapper(field, [
    h(
      "fieldset",
      {
        className: ["quartz-form__group"],
        id,
        ariaDescribedby: describedBy(id, field.hint),
        dataRequired: field.required ? "true" : void 0,
        dataMinimum: field.required ? "1" : void 0
      },
      [
        legend(ctx, field.label, field.required),
        ...field.options.map(
          (o, i) => h("div", { className: ["quartz-form__option"] }, [
            h("input", {
              type,
              id: `${id}-${i}`,
              name: field.name,
              value: o.value,
              required: type === "radio" && field.required ? true : void 0
            }),
            h("label", { for: `${id}-${i}` }, resolveText(o.label, ctx.lang) ?? o.value)
          ])
        )
      ]
    ),
    ...hintAndError(ctx, id, field.hint)
  ]);
}
function renderScale(field, ctx) {
  const id = `${ctx.idPrefix}-${field.name}`;
  const steps = [];
  for (let v = field.min; v <= field.max; v++) {
    steps.push(
      h("div", { className: ["quartz-form__scale-step"] }, [
        h("input", {
          type: "radio",
          id: `${id}-${v}`,
          name: field.name,
          value: String(v),
          required: field.required ? true : void 0
        }),
        h("label", { for: `${id}-${v}` }, String(v))
      ])
    );
  }
  const minLabel = resolveText(field.minLabel, ctx.lang);
  const maxLabel = resolveText(field.maxLabel, ctx.lang);
  return fieldWrapper(field, [
    h(
      "fieldset",
      {
        className: ["quartz-form__group", "quartz-form__scale"],
        id,
        ariaDescribedby: describedBy(id, field.hint),
        dataRequired: field.required ? "true" : void 0
      },
      [
        legend(ctx, field.label, field.required),
        h(
          "div",
          { className: ["quartz-form__scale-row"] },
          [
            minLabel ? h("span", { className: ["quartz-form__scale-caption"] }, minLabel) : null,
            h("div", { className: ["quartz-form__scale-steps"] }, steps),
            maxLabel ? h("span", { className: ["quartz-form__scale-caption"] }, maxLabel) : null
          ].filter((x) => x !== null)
        )
      ]
    ),
    ...hintAndError(ctx, id, field.hint)
  ]);
}
function renderCheckbox(field, ctx) {
  const id = `${ctx.idPrefix}-${field.name}`;
  return fieldWrapper(field, [
    h("div", { className: ["quartz-form__option"] }, [
      h("input", {
        type: "checkbox",
        id,
        name: field.name,
        value: "yes",
        required: field.required ? true : void 0,
        ariaDescribedby: describedBy(id, field.hint)
      }),
      label(ctx, id, field.label, field.required)
    ]),
    ...hintAndError(ctx, id, field.hint)
  ]);
}
function renderConsent(field, ctx) {
  const id = `${ctx.idPrefix}-${field.name}`;
  const sentence = resolveText(field.text, ctx.lang) ?? "";
  const linkLabel = resolveText(field.linkLabel, ctx.lang) ?? ctx.t.privacyLink;
  return fieldWrapper(field, [
    h("div", { className: ["quartz-form__option"] }, [
      h("input", {
        type: "checkbox",
        id,
        name: field.name,
        value: "yes",
        required: true,
        ariaRequired: "true",
        ariaDescribedby: `${id}-error`
      }),
      h("label", { className: ["quartz-form__label"], for: id }, [
        text(sentence),
        ...field.link ? [
          text(" "),
          h("a", { href: field.link, target: "_blank", rel: ["noopener"] }, linkLabel)
        ] : [],
        ...requiredMark(ctx)
      ])
    ]),
    ...hintAndError(ctx, id, void 0)
  ]);
}
function renderPgpKey(field, ctx, maxLength) {
  const id = `${ctx.idPrefix}-${field.name}`;
  return fieldWrapper(field, [
    label(ctx, id, field.label, field.required),
    h("div", { className: ["quartz-form__key"] }, [
      h("label", { className: ["quartz-form__key-file"], for: `${id}-file` }, [
        h(
          "span",
          { className: ["quartz-form__button", "quartz-form__button--secondary"] },
          ctx.t.keyChooseFile
        ),
        h("input", {
          type: "file",
          id: `${id}-file`,
          name: KEY_FILE_NAME,
          accept: ".asc,.gpg,.pgp,.txt,application/pgp-keys",
          className: ["quartz-form__sr-only"]
        })
      ]),
      h("textarea", {
        id,
        name: field.name,
        rows: 4,
        required: field.required ? true : void 0,
        ariaRequired: field.required ? "true" : void 0,
        ariaDescribedby: describedBy(id, field.hint ?? ctx.t.keyPaste),
        placeholder: "-----BEGIN PGP PUBLIC KEY BLOCK-----",
        maxlength: maxLength,
        spellcheck: "false",
        dataPgpKey: "true"
      }),
      h("p", { className: ["quartz-form__key-status"], id: `${id}-status`, role: "status" })
    ]),
    ...hintAndError(ctx, id, field.hint ?? ctx.t.keyPaste)
  ]);
}
function renderField(field, form, ctx) {
  switch (field.type) {
    case "textarea":
      return renderInput(field, ctx, form.spam.maxTextareaLength);
    case "text":
    case "email":
    case "tel":
    case "url":
    case "number":
    case "date":
      return renderInput(field, ctx, form.spam.maxFieldLength);
    case "select":
    case "radio":
    case "checkboxes":
      return renderChoice(field, ctx);
    case "scale":
      return renderScale(field, ctx);
    case "checkbox":
      return renderCheckbox(field, ctx);
    case "consent":
      return renderConsent(field, ctx);
    case "pgpKey":
      return renderPgpKey(field, ctx, form.spam.maxKeyLength);
    case "hidden":
      return h("input", { type: "hidden", name: field.name, value: field.value });
  }
}
function clientConfig(form, ctx) {
  const t2 = ctx.t;
  const fields = form.fields.map((f) => {
    const rule = {
      name: f.name,
      type: f.type,
      label: f.type === "consent" ? resolveText(f.text, ctx.lang) ?? f.name : f.type === "hidden" ? f.name : resolveText(f.label, ctx.lang) ?? f.name,
      required: f.type === "consent" ? true : "required" in f ? Boolean(f.required) : false
    };
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
        if (f.min !== void 0) rule.min = f.min;
        if (f.max !== void 0) rule.max = f.max;
        if (f.pattern !== void 0) rule.pattern = f.pattern;
        break;
      case "select":
      case "radio":
      case "checkboxes":
        rule.options = f.options.map((o) => o.value);
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
  });
  const anonymous = form.anonymous;
  return {
    id: form.id,
    lang: ctx.lang,
    fields,
    transport: {
      kind: form.transport.kind,
      url: endpointOf(form.transport, form.recipient),
      format: form.transport.format ?? "json",
      extra: presetFields(form)
    },
    recipient: form.transport.kind === "relay" ? form.recipient : void 0,
    subject: resolveText(form.subject, ctx.lang),
    spam: {
      honeypot: form.spam.honeypot,
      minSeconds: form.spam.minSeconds,
      pow: form.spam.pow && form.transport.kind === "relay",
      powDifficulty: form.spam.powDifficulty,
      captcha: anonymous ? "none" : form.spam.captcha,
      captchaSiteKey: anonymous ? "" : form.spam.captchaSiteKey,
      maxBytes: form.spam.maxBytes
    },
    encryption: {
      mode: form.encryption.mode,
      keys: ctx.keys.map((k) => k.armored),
      showFingerprint: form.encryption.showFingerprint
    },
    anonymous,
    page: form.pageContext && ctx.page ? { title: ctx.page.title, slug: ctx.page.slug } : void 0,
    success: {
      mode: form.success.mode,
      text: resolveText(form.success.text, ctx.lang) ?? (form.encryption.mode === "required" ? t2.sentEncrypted : t2.sent),
      slug: form.success.slug
    },
    texts: {
      sending: t2.sending,
      sent: t2.sent,
      sentEncrypted: t2.sentEncrypted,
      required: t2.required,
      invalidEmail: t2.invalidEmail,
      invalidUrl: t2.invalidUrl,
      invalidTel: t2.invalidTel,
      invalidNumber: t2.invalidNumber,
      invalidDate: t2.invalidDate,
      belowMin: t2.belowMin,
      aboveMax: t2.aboveMax,
      tooLong: t2.tooLong,
      patternMismatch: t2.patternMismatch,
      chooseOne: t2.chooseOne,
      chooseAtLeastOne: t2.chooseAtLeastOne,
      consentRequired: t2.consentRequired,
      keyInvalid: t2.keyInvalid,
      keyNotPublic: t2.keyNotPublic,
      keyExpired: t2.keyExpired,
      keyAccepted: t2.keyAccepted,
      encryptedFor: t2.encryptedFor,
      encryptedForMany: t2.encryptedForMany,
      encryptionUnavailable: t2.encryptionUnavailable,
      tooFast: t2.tooFast,
      sendFailed: t2.sendFailed,
      rejected: t2.rejected,
      rateLimited: t2.rateLimited,
      errorSummary: t2.errorSummary,
      errorSummaryOne: t2.errorSummaryOne
    }
  };
}
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function renderForm(form, ctx) {
  const t2 = ctx.t;
  const title = resolveText(form.title, ctx.lang);
  const description = resolveText(form.description, ctx.lang);
  const submit = resolveText(form.submitLabel, ctx.lang) ?? t2.submit;
  const required = form.encryption.mode === "required";
  const action = endpointOf(form.transport, form.recipient);
  const hidden = presetFields(form);
  const notes = [];
  if (form.anonymous)
    notes.push(
      h("p", { className: ["quartz-form__note", "quartz-form__note--anonymous"] }, t2.anonymousNote)
    );
  if (form.pageContext && ctx.page)
    notes.push(
      h(
        "p",
        { className: ["quartz-form__note"] },
        interpolate(t2.pageContextNote, { title: ctx.page.title })
      )
    );
  if (form.transport.kind === "mailto")
    notes.push(h("p", { className: ["quartz-form__note"] }, t2.mailtoNote));
  const encryptionRow = [];
  if (form.encryption.mode === "optional") {
    const id = `${ctx.idPrefix}-${ENCRYPT_TOGGLE_NAME}`;
    encryptionRow.push(
      h("div", { className: ["quartz-form__field", "quartz-form__field--encrypt"] }, [
        h("div", { className: ["quartz-form__option"] }, [
          h("input", {
            type: "checkbox",
            id,
            name: ENCRYPT_TOGGLE_NAME,
            value: "yes",
            checked: true
          }),
          h("label", { className: ["quartz-form__label"], for: id }, t2.encryptToggle)
        ])
      ])
    );
  }
  if (form.encryption.mode !== "off" && form.encryption.showFingerprint)
    encryptionRow.push(
      h("p", { className: ["quartz-form__encrypted"], dataFingerprint: "true", hidden: true })
    );
  return h(
    "form",
    {
      className: [
        "quartz-form",
        ...form.className ? form.className.split(/\s+/).filter(Boolean) : []
      ],
      dataForm: form.id,
      dataLang: ctx.lang,
      dataTransport: form.transport.kind,
      dataEncryption: form.encryption.mode,
      method: "post",
      // With encryption required the plaintext target is never written into the page; the
      // script sets it once it has encrypted. Without JavaScript the form cannot send.
      action: required ? void 0 : action,
      enctype: form.transport.kind === "mailto" ? "text/plain" : void 0,
      novalidate: void 0
    },
    clean([
      title ? h("h3", { className: ["quartz-form__title"] }, title) : null,
      description ? h("p", { className: ["quartz-form__description"] }, description) : null,
      ...notes,
      required ? h("noscript", {}, [
        h("p", { className: ["quartz-form__note", "quartz-form__note--noscript"] }, t2.noScript)
      ]) : null,
      ...form.fields.map((f) => renderField(f, form, ctx)),
      form.spam.honeypot ? h("div", { className: ["quartz-form__hp"], ariaHidden: "true" }, [
        h("label", { for: `${ctx.idPrefix}-${HONEYPOT_NAME}` }, "Website"),
        h("input", {
          type: "text",
          id: `${ctx.idPrefix}-${HONEYPOT_NAME}`,
          name: HONEYPOT_NAME,
          tabindex: -1,
          autocomplete: "off"
        })
      ]) : null,
      h("input", { type: "hidden", name: "form", value: form.id }),
      h("input", { type: "hidden", name: "lang", value: ctx.lang }),
      h("input", { type: "hidden", name: "ts", value: "" }),
      form.pageContext && ctx.page ? h("input", { type: "hidden", name: "page", value: ctx.page.slug }) : null,
      ...Object.entries(hidden).map(([k, v]) => h("input", { type: "hidden", name: k, value: v })),
      ...encryptionRow,
      h("div", { className: ["quartz-form__actions"] }, [
        h(
          "button",
          {
            type: "submit",
            className: ["quartz-form__button"],
            disabled: required ? true : void 0,
            dataEnableWithJs: required ? "true" : void 0
          },
          submit
        )
      ]),
      h("div", { className: ["quartz-form__status"], role: "status", ariaLive: "polite" }),
      h("script", { type: "application/json", className: ["quartz-form-config"] }, [
        text(scriptJson(clientConfig(form, ctx)))
      ])
    ])
  );
}
function renderMissing(id, serve) {
  return h("div", { className: ["quartz-form", "quartz-form--missing"], role: "note" }, [
    h("p", {}, [text("quartz-forms: no form "), h("code", {}, id), text(" in options.forms.")])
  ]);
}

// src/components/styles/forms.scss
var forms_default = ".quartz-form {\n  --quartz-forms-gap: 1rem;\n  --quartz-forms-radius: 5px;\n  --quartz-forms-border: var(--lightgray);\n  --quartz-forms-border-focus: var(--secondary);\n  --quartz-forms-field-bg: var(--light);\n  --quartz-forms-error: #b3261e;\n  --quartz-forms-success: #2e7d32;\n  --quartz-forms-button-bg: var(--secondary);\n  --quartz-forms-button-fg: var(--light);\n  --quartz-forms-max-width: 40rem;\n  display: flex;\n  flex-direction: column;\n  gap: var(--quartz-forms-gap);\n  max-width: var(--quartz-forms-max-width);\n  margin: 1.5rem 0;\n  font-family: var(--bodyFont);\n  color: var(--darkgray);\n}\n.quartz-form__title {\n  margin: 0;\n  font-family: var(--headerFont);\n  color: var(--dark);\n}\n.quartz-form__description, .quartz-form__note, .quartz-form__hint {\n  margin: 0;\n  font-size: 0.9em;\n  color: var(--gray);\n}\n.quartz-form__note--anonymous {\n  color: var(--darkgray);\n}\n.quartz-form__note--noscript {\n  color: var(--quartz-forms-error);\n}\n.quartz-form__field {\n  display: flex;\n  flex-direction: column;\n  gap: 0.35rem;\n}\n.quartz-form__label,\n.quartz-form legend.quartz-form__label {\n  font-weight: 600;\n  color: var(--dark);\n  padding: 0;\n}\n.quartz-form__required {\n  color: var(--quartz-forms-error);\n}\n.quartz-form__sr-only {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  padding: 0;\n  margin: -1px;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  white-space: nowrap;\n  border: 0;\n}\n.quartz-form input[type=text],\n.quartz-form input[type=email],\n.quartz-form input[type=tel],\n.quartz-form input[type=url],\n.quartz-form input[type=number],\n.quartz-form input[type=date],\n.quartz-form select,\n.quartz-form textarea {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 0.5rem 0.65rem;\n  font: inherit;\n  color: var(--dark);\n  background: var(--quartz-forms-field-bg);\n  border: 1px solid var(--quartz-forms-border);\n  border-radius: var(--quartz-forms-radius);\n}\n.quartz-form input[type=text]:focus-visible,\n.quartz-form input[type=email]:focus-visible,\n.quartz-form input[type=tel]:focus-visible,\n.quartz-form input[type=url]:focus-visible,\n.quartz-form input[type=number]:focus-visible,\n.quartz-form input[type=date]:focus-visible,\n.quartz-form select:focus-visible,\n.quartz-form textarea:focus-visible {\n  outline: 2px solid var(--quartz-forms-border-focus);\n  outline-offset: 1px;\n}\n.quartz-form input[type=text][aria-invalid=true],\n.quartz-form input[type=email][aria-invalid=true],\n.quartz-form input[type=tel][aria-invalid=true],\n.quartz-form input[type=url][aria-invalid=true],\n.quartz-form input[type=number][aria-invalid=true],\n.quartz-form input[type=date][aria-invalid=true],\n.quartz-form select[aria-invalid=true],\n.quartz-form textarea[aria-invalid=true] {\n  border-color: var(--quartz-forms-error);\n}\n.quartz-form textarea {\n  resize: vertical;\n  min-height: 5rem;\n}\n.quartz-form__group {\n  display: flex;\n  flex-direction: column;\n  gap: 0.35rem;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  min-inline-size: 0;\n}\n.quartz-form__option {\n  display: flex;\n  align-items: baseline;\n  gap: 0.5rem;\n}\n.quartz-form__option input {\n  flex: none;\n  accent-color: var(--secondary);\n}\n.quartz-form__option label {\n  font-weight: normal;\n}\n.quartz-form__scale-row {\n  display: flex;\n  align-items: center;\n  gap: 0.75rem;\n  flex-wrap: wrap;\n}\n.quartz-form__scale-steps {\n  display: flex;\n  gap: 0.25rem;\n}\n.quartz-form__scale-step {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 0.15rem;\n  font-size: 0.85em;\n}\n.quartz-form__scale-step input {\n  accent-color: var(--secondary);\n}\n.quartz-form__scale-caption {\n  font-size: 0.85em;\n  color: var(--gray);\n}\n.quartz-form__key {\n  display: flex;\n  flex-direction: column;\n  gap: 0.35rem;\n}\n.quartz-form__key-file {\n  align-self: flex-start;\n}\n.quartz-form__key-status {\n  margin: 0;\n  font-size: 0.85em;\n  color: var(--gray);\n  font-family: var(--codeFont);\n}\n.quartz-form__error {\n  margin: 0;\n  font-size: 0.9em;\n  color: var(--quartz-forms-error);\n}\n.quartz-form__hp {\n  position: absolute;\n  left: -10000px;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n}\n.quartz-form__actions {\n  display: flex;\n  gap: 0.75rem;\n  align-items: center;\n}\n.quartz-form__button {\n  display: inline-block;\n  padding: 0.55rem 1.1rem;\n  font: inherit;\n  font-weight: 600;\n  color: var(--quartz-forms-button-fg);\n  background: var(--quartz-forms-button-bg);\n  border: 0;\n  border-radius: var(--quartz-forms-radius);\n  cursor: pointer;\n}\n.quartz-form__button:focus-visible {\n  outline: 2px solid var(--quartz-forms-border-focus);\n  outline-offset: 2px;\n}\n.quartz-form__button:disabled {\n  cursor: not-allowed;\n  opacity: 0.6;\n}\n.quartz-form__button--secondary {\n  color: var(--dark);\n  background: var(--lightgray);\n}\n.quartz-form__status {\n  min-height: 1.4em;\n  font-size: 0.95em;\n}\n.quartz-form__status[data-state=error] {\n  color: var(--quartz-forms-error);\n}\n.quartz-form__status[data-state=success] {\n  color: var(--quartz-forms-success);\n}\n.quartz-form__encrypted {\n  margin: 0;\n  font-size: 0.85em;\n  color: var(--gray);\n}\n.quartz-form__encrypted code {\n  font-size: 0.95em;\n}\n.quartz-form--missing {\n  padding: 0.75rem 1rem;\n  border: 2px dashed var(--quartz-forms-error);\n  border-radius: var(--quartz-forms-radius);\n  color: var(--quartz-forms-error);\n}\n.quartz-form--missing p {\n  margin: 0;\n}\n\n.quartz-form-box .quartz-form {\n  margin: 0;\n}\n\n:root[saved-theme=dark] .quartz-form {\n  --quartz-forms-error: #f2b8b5;\n  --quartz-forms-success: #a5d6a7;\n}";

// src/scripts/forms.inline.ts
var forms_inline_default = 'document.addEventListener("nav",()=>{let n=document.querySelectorAll("form.quartz-form");for(let e of n){let t=o=>{o.preventDefault()};e.addEventListener("submit",t),window.addCleanup(()=>e.removeEventListener("submit",t))}});\n';

// src/transformer.ts
var FORM_PLACEHOLDER = /\{\{\s*form:([A-Za-z0-9-]+)\s*\}\}|%7B%7Bform:([A-Za-z0-9-]+)%7D%7D/i;
var PLACEHOLDER_MARKER = "data-quartz-form";
function pageInfo(data) {
  const fm = data.frontmatter ?? {};
  return {
    title: typeof fm.title === "string" ? fm.title : String(data.slug ?? ""),
    slug: String(data.slug ?? "")
  };
}
function frontmatterForms(frontmatter, key) {
  const value = frontmatter?.[key];
  if (value === false) return { ids: [], hideLayout: true };
  if (typeof value === "string" && value.trim()) return { ids: [value.trim()], hideLayout: false };
  if (Array.isArray(value))
    return {
      ids: value.filter((v) => typeof v === "string" && v.trim() !== "").map((v) => v.trim()),
      hideLayout: false
    };
  return { ids: [], hideLayout: false };
}
var PageForms = class {
  constructor(opts, ctx, data, lang) {
    this.opts = opts;
    this.ctx = ctx;
    this.data = data;
    this.lang = lang;
  }
  opts;
  ctx;
  data;
  lang;
  rendered = [];
  counts = /* @__PURE__ */ new Map();
  render(id) {
    const form = this.opts.forms[id];
    if (!form) {
      const where = String(this.data.filePath ?? this.data.slug ?? "a page");
      const message = `${where} embeds the form "${id}", which options.forms does not have`;
      if (!this.ctx.argv.serve) throw new Error(`[forms] ${message}`);
      warnOnce(`missing:${id}:${where}`, message);
      return renderMissing(id);
    }
    const n = (this.counts.get(id) ?? 0) + 1;
    this.counts.set(id, n);
    this.rendered.push(id);
    const context = makeContext(this.opts, form, {
      lang: this.lang,
      idPrefix: n === 1 ? `qf-${id}` : `qf-${id}-${n}`,
      page: pageInfo(this.data),
      serve: this.ctx.argv.serve
    });
    return renderForm(form, context);
  }
};
function codeBlockMarker(id) {
  return `<div ${PLACEHOLDER_MARKER}="${id.replace(/[^A-Za-z0-9-]/g, "")}"></div>`;
}
function codeBlockId(value) {
  const line = value.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  return line;
}
function checkRedirects(opts, ctx) {
  const slugs = new Set(ctx.allSlugs);
  for (const form of Object.values(opts.forms)) {
    if (form.success.mode !== "redirect" || !form.success.slug) continue;
    const slug = form.success.slug.replace(/^\/+|\/+$/g, "");
    if (slugs.has(slug) || slugs.has(`${slug}/index`)) continue;
    const message = `forms.${form.id}.success.slug: no page "${form.success.slug}" in the site`;
    if (!ctx.argv.serve) throw new Error(`[forms] ${message}`);
    warnOnce(`redirect:${form.id}`, message);
  }
}
var Forms = (userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  return {
    name: "Forms",
    markdownPlugins() {
      return [
        () => (tree) => {
          visit(tree, "code", (node, index2, parent) => {
            if (node.lang !== opts.codeBlockLang || !parent || index2 === void 0) return;
            const id = codeBlockId(node.value);
            if (!id) return;
            const html3 = { type: "html", value: codeBlockMarker(id) };
            parent.children.splice(index2, 1, html3);
            return SKIP;
          });
        }
      ];
    },
    htmlPlugins(ctx) {
      checkRedirects(opts, ctx);
      const siteLocale = ctx.cfg.configuration.locale;
      return [
        () => (tree, file) => {
          const data = file.data;
          const lang = pageLanguage(data.frontmatter, siteLocale);
          const page = new PageForms(opts, ctx, data, lang);
          visit(tree, "element", (node, index2, parent) => {
            if (node.tagName !== "div" || !parent || index2 === void 0) return;
            const id = node.properties[PLACEHOLDER_MARKER] ?? node.properties.dataQuartzForm;
            if (typeof id !== "string") return;
            const form = page.render(id);
            if (form) parent.children.splice(index2, 1, form);
            else parent.children.splice(index2, 1);
            return SKIP;
          });
          visit(tree, "text", (node, index2, parent) => {
            if (!parent || index2 === void 0 || !FORM_PLACEHOLDER.test(node.value)) return;
            const match = FORM_PLACEHOLDER.exec(node.value);
            const id = match[1] ?? match[2];
            const form = page.render(id);
            const before = node.value.slice(0, match.index);
            const after = node.value.slice(match.index + match[0].length);
            const rest = [];
            if (before) rest.push({ type: "text", value: before });
            if (after) rest.push({ type: "text", value: after });
            parent.children.splice(index2, 1, ...rest);
            if (!form) return index2;
            const parentEl = parent;
            const onlyPlaceholder = parentEl.type === "element" && parentEl.tagName === "p" && parentEl.children.every((c) => c.type !== "text" || c.value.trim() === "");
            if (onlyPlaceholder) {
              parentEl.__replaceWith = form;
            } else {
              parentEl.__insertAfter = [
                ...parentEl.__insertAfter ?? [],
                form
              ];
            }
            return index2 + rest.length;
          });
          visit(tree, "element", (node, index2, parent) => {
            const marked = node;
            if (!parent || index2 === void 0) return;
            if (marked.__replaceWith) {
              parent.children.splice(index2, 1, marked.__replaceWith);
              return SKIP;
            }
            if (marked.__insertAfter) {
              const forms = marked.__insertAfter;
              delete marked.__insertAfter;
              parent.children.splice(index2 + 1, 0, ...forms);
              return index2 + 1 + forms.length;
            }
          });
          const fm = frontmatterForms(data.frontmatter, opts.frontmatterKey);
          for (const id of fm.ids) {
            const form = page.render(id);
            if (form) tree.children.push(form);
          }
          const existing = data.quartzForms;
          data.quartzForms = {
            rendered: [...existing?.rendered ?? [], ...page.rendered],
            hideLayout: fm.hideLayout || existing?.hideLayout === true
          };
        }
      ];
    },
    externalResources() {
      return {
        css: [{ content: forms_default, inline: true }],
        js: [{ loadTime: "afterDOMReady", contentType: "inline", script: forms_inline_default }]
      };
    }
  };
};

// node_modules/devlop/lib/default.js
function ok2() {
}

// node_modules/estree-util-is-identifier-name/lib/index.js
var nameRe = /^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var nameReJsx = /^[$_\p{ID_Start}][-$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var emptyOptions = {};
function name(name2, options) {
  const settings = emptyOptions;
  const re2 = settings.jsx ? nameReJsx : nameRe;
  return re2.test(name2);
}

// node_modules/hast-util-whitespace/lib/index.js
var re = /[ \t\n\f\r]/g;
function whitespace(thing) {
  return typeof thing === "object" ? thing.type === "text" ? empty2(thing.value) : false : empty2(thing);
}
function empty2(value) {
  return value.replace(re, "") === "";
}

// node_modules/hast-util-to-jsx-runtime/lib/index.js
var import_style_to_js = __toESM(require_cjs3());
var pointStart = point("start");
function point(type) {
  return point3;
  function point3(node) {
    const point4 = node && node.position && node.position[type] || {};
    if (typeof point4.line === "number" && point4.line > 0 && typeof point4.column === "number" && point4.column > 0) {
      return {
        line: point4.line,
        column: point4.column,
        offset: typeof point4.offset === "number" && point4.offset > -1 ? point4.offset : void 0
      };
    }
  }
}

// node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position2(value.position);
  }
  if ("start" in value || "end" in value) {
    return position2(value);
  }
  if ("line" in value || "column" in value) {
    return point2(value);
  }
  return "";
}
function point2(point3) {
  return index(point3 && point3.line) + ":" + index(point3 && point3.column);
}
function position2(pos) {
  return point2(pos && pos.start) + "-" + point2(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}

// node_modules/vfile-message/lib/index.js
var VFileMessage = class extends Error {
  /**
   * Create a message for `reason`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {Options | null | undefined} [options]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | Options | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // eslint-disable-next-line complexity
  constructor(causeOrReason, optionsOrParentOrPlace, origin) {
    super();
    if (typeof optionsOrParentOrPlace === "string") {
      origin = optionsOrParentOrPlace;
      optionsOrParentOrPlace = void 0;
    }
    let reason = "";
    let options = {};
    let legacyCause = false;
    if (optionsOrParentOrPlace) {
      if ("line" in optionsOrParentOrPlace && "column" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("start" in optionsOrParentOrPlace && "end" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("type" in optionsOrParentOrPlace) {
        options = {
          ancestors: [optionsOrParentOrPlace],
          place: optionsOrParentOrPlace.position
        };
      } else {
        options = { ...optionsOrParentOrPlace };
      }
    }
    if (typeof causeOrReason === "string") {
      reason = causeOrReason;
    } else if (!options.cause && causeOrReason) {
      legacyCause = true;
      reason = causeOrReason.message;
      options.cause = causeOrReason;
    }
    if (!options.ruleId && !options.source && typeof origin === "string") {
      const index2 = origin.indexOf(":");
      if (index2 === -1) {
        options.ruleId = origin;
      } else {
        options.source = origin.slice(0, index2);
        options.ruleId = origin.slice(index2 + 1);
      }
    }
    if (!options.place && options.ancestors && options.ancestors) {
      const parent = options.ancestors[options.ancestors.length - 1];
      if (parent) {
        options.place = parent.position;
      }
    }
    const start2 = options.place && "start" in options.place ? options.place.start : options.place;
    this.ancestors = options.ancestors || void 0;
    this.cause = options.cause || void 0;
    this.column = start2 ? start2.column : void 0;
    this.fatal = void 0;
    this.file = "";
    this.message = reason;
    this.line = start2 ? start2.line : void 0;
    this.name = stringifyPosition(options.place) || "1:1";
    this.place = options.place || void 0;
    this.reason = this.message;
    this.ruleId = options.ruleId || void 0;
    this.source = options.source || void 0;
    this.stack = legacyCause && options.cause && typeof options.cause.stack === "string" ? options.cause.stack : "";
    this.actual = void 0;
    this.expected = void 0;
    this.note = void 0;
    this.url = void 0;
  }
};
VFileMessage.prototype.file = "";
VFileMessage.prototype.name = "";
VFileMessage.prototype.reason = "";
VFileMessage.prototype.message = "";
VFileMessage.prototype.stack = "";
VFileMessage.prototype.column = void 0;
VFileMessage.prototype.line = void 0;
VFileMessage.prototype.ancestors = void 0;
VFileMessage.prototype.cause = void 0;
VFileMessage.prototype.fatal = void 0;
VFileMessage.prototype.place = void 0;
VFileMessage.prototype.ruleId = void 0;
VFileMessage.prototype.source = void 0;

// node_modules/hast-util-to-jsx-runtime/lib/index.js
var own = {}.hasOwnProperty;
var emptyMap = /* @__PURE__ */ new Map();
var cap2 = /[A-Z]/g;
var tableElements = /* @__PURE__ */ new Set(["table", "tbody", "thead", "tfoot", "tr"]);
var tableCellElement = /* @__PURE__ */ new Set(["td", "th"]);
var docs = "https://github.com/syntax-tree/hast-util-to-jsx-runtime";
function toJsxRuntime(tree, options) {
  if (!options || options.Fragment === void 0) {
    throw new TypeError("Expected `Fragment` in options");
  }
  const filePath = options.filePath || void 0;
  let create2;
  if (options.development) {
    if (typeof options.jsxDEV !== "function") {
      throw new TypeError(
        "Expected `jsxDEV` in options when `development: true`"
      );
    }
    create2 = developmentCreate(filePath, options.jsxDEV);
  } else {
    if (typeof options.jsx !== "function") {
      throw new TypeError("Expected `jsx` in production options");
    }
    if (typeof options.jsxs !== "function") {
      throw new TypeError("Expected `jsxs` in production options");
    }
    create2 = productionCreate(filePath, options.jsx, options.jsxs);
  }
  const state = {
    Fragment: options.Fragment,
    ancestors: [],
    components: options.components || {},
    create: create2,
    elementAttributeNameCase: options.elementAttributeNameCase || "react",
    evaluater: options.createEvaluater ? options.createEvaluater() : void 0,
    filePath,
    ignoreInvalidStyle: options.ignoreInvalidStyle || false,
    passKeys: options.passKeys !== false,
    passNode: options.passNode || false,
    schema: options.space === "svg" ? svg2 : html2,
    stylePropertyNameCase: options.stylePropertyNameCase || "dom",
    tableCellAlignToStyle: options.tableCellAlignToStyle !== false
  };
  const result = one(state, tree, void 0);
  if (result && typeof result !== "string") {
    return result;
  }
  return state.create(
    tree,
    state.Fragment,
    { children: result || void 0 },
    void 0
  );
}
function one(state, node, key) {
  if (node.type === "element") {
    return element(state, node, key);
  }
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    return mdxExpression(state, node);
  }
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    return mdxJsxElement(state, node, key);
  }
  if (node.type === "mdxjsEsm") {
    return mdxEsm(state, node);
  }
  if (node.type === "root") {
    return root(state, node, key);
  }
  if (node.type === "text") {
    return text2(state, node);
  }
}
function element(state, node, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node.tagName.toLowerCase() === "svg" && parentSchema.space === "html") {
    schema = svg2;
    state.schema = schema;
  }
  state.ancestors.push(node);
  const type = findComponentFromName(state, node.tagName, false);
  const props = createElementProps(state, node);
  let children = createChildren(state, node);
  if (tableElements.has(node.tagName)) {
    children = children.filter(function(child) {
      return typeof child === "string" ? !whitespace(child) : true;
    });
  }
  addNode(state, props, type, node);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node, type, props, key);
}
function mdxExpression(state, node) {
  if (node.data && node.data.estree && state.evaluater) {
    const program = node.data.estree;
    const expression = program.body[0];
    ok2(expression.type === "ExpressionStatement");
    return (
      /** @type {Child | undefined} */
      state.evaluater.evaluateExpression(expression.expression)
    );
  }
  crashEstree(state, node.position);
}
function mdxEsm(state, node) {
  if (node.data && node.data.estree && state.evaluater) {
    return (
      /** @type {Child | undefined} */
      state.evaluater.evaluateProgram(node.data.estree)
    );
  }
  crashEstree(state, node.position);
}
function mdxJsxElement(state, node, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node.name === "svg" && parentSchema.space === "html") {
    schema = svg2;
    state.schema = schema;
  }
  state.ancestors.push(node);
  const type = node.name === null ? state.Fragment : findComponentFromName(state, node.name, true);
  const props = createJsxElementProps(state, node);
  const children = createChildren(state, node);
  addNode(state, props, type, node);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node, type, props, key);
}
function root(state, node, key) {
  const props = {};
  addChildren(props, createChildren(state, node));
  return state.create(node, state.Fragment, props, key);
}
function text2(_, node) {
  return node.value;
}
function addNode(state, props, type, node) {
  if (typeof type !== "string" && type !== state.Fragment && state.passNode) {
    props.node = node;
  }
}
function addChildren(props, children) {
  if (children.length > 0) {
    const value = children.length > 1 ? children : children[0];
    if (value) {
      props.children = value;
    }
  }
}
function productionCreate(_, jsx3, jsxs2) {
  return create2;
  function create2(_2, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const fn = isStaticChildren ? jsxs2 : jsx3;
    return key ? fn(type, props, key) : fn(type, props);
  }
}
function developmentCreate(filePath, jsxDEV) {
  return create2;
  function create2(node, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const point3 = pointStart(node);
    return jsxDEV(
      type,
      props,
      key,
      isStaticChildren,
      {
        columnNumber: point3 ? point3.column - 1 : void 0,
        fileName: filePath,
        lineNumber: point3 ? point3.line : void 0
      },
      void 0
    );
  }
}
function createElementProps(state, node) {
  const props = {};
  let alignValue;
  let prop;
  for (prop in node.properties) {
    if (prop !== "children" && own.call(node.properties, prop)) {
      const result = createProperty(state, prop, node.properties[prop]);
      if (result) {
        const [key, value] = result;
        if (state.tableCellAlignToStyle && key === "align" && typeof value === "string" && tableCellElement.has(node.tagName)) {
          alignValue = value;
        } else {
          props[key] = value;
        }
      }
    }
  }
  if (alignValue) {
    const style2 = (
      /** @type {Style} */
      props.style || (props.style = {})
    );
    style2[state.stylePropertyNameCase === "css" ? "text-align" : "textAlign"] = alignValue;
  }
  return props;
}
function createJsxElementProps(state, node) {
  const props = {};
  for (const attribute of node.attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      if (attribute.data && attribute.data.estree && state.evaluater) {
        const program = attribute.data.estree;
        const expression = program.body[0];
        ok2(expression.type === "ExpressionStatement");
        const objectExpression = expression.expression;
        ok2(objectExpression.type === "ObjectExpression");
        const property = objectExpression.properties[0];
        ok2(property.type === "SpreadElement");
        Object.assign(
          props,
          state.evaluater.evaluateExpression(property.argument)
        );
      } else {
        crashEstree(state, node.position);
      }
    } else {
      const name2 = attribute.name;
      let value;
      if (attribute.value && typeof attribute.value === "object") {
        if (attribute.value.data && attribute.value.data.estree && state.evaluater) {
          const program = attribute.value.data.estree;
          const expression = program.body[0];
          ok2(expression.type === "ExpressionStatement");
          value = state.evaluater.evaluateExpression(expression.expression);
        } else {
          crashEstree(state, node.position);
        }
      } else {
        value = attribute.value === null ? true : attribute.value;
      }
      props[name2] = /** @type {Props[keyof Props]} */
      value;
    }
  }
  return props;
}
function createChildren(state, node) {
  const children = [];
  let index2 = -1;
  const countsByName = state.passKeys ? /* @__PURE__ */ new Map() : emptyMap;
  while (++index2 < node.children.length) {
    const child = node.children[index2];
    let key;
    if (state.passKeys) {
      const name2 = child.type === "element" ? child.tagName : child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement" ? child.name : void 0;
      if (name2) {
        const count = countsByName.get(name2) || 0;
        key = name2 + "-" + count;
        countsByName.set(name2, count + 1);
      }
    }
    const result = one(state, child, key);
    if (result !== void 0) children.push(result);
  }
  return children;
}
function createProperty(state, prop, value) {
  const info = find(state.schema, prop);
  if (value === null || value === void 0 || typeof value === "number" && Number.isNaN(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value = info.commaSeparated ? stringify(value) : stringify2(value);
  }
  if (info.property === "style") {
    let styleObject = typeof value === "object" ? value : parseStyle(state, String(value));
    if (state.stylePropertyNameCase === "css") {
      styleObject = transformStylesToCssCasing(styleObject);
    }
    return ["style", styleObject];
  }
  return [
    state.elementAttributeNameCase === "react" && info.space ? hastToReact[info.property] || info.property : info.attribute,
    value
  ];
}
function parseStyle(state, value) {
  try {
    return (0, import_style_to_js.default)(value, { reactCompat: true });
  } catch (error) {
    if (state.ignoreInvalidStyle) {
      return {};
    }
    const cause = (
      /** @type {Error} */
      error
    );
    const message = new VFileMessage("Cannot parse `style` attribute", {
      ancestors: state.ancestors,
      cause,
      ruleId: "style",
      source: "hast-util-to-jsx-runtime"
    });
    message.file = state.filePath || void 0;
    message.url = docs + "#cannot-parse-style-attribute";
    throw message;
  }
}
function findComponentFromName(state, name2, allowExpression) {
  let result;
  if (!allowExpression) {
    result = { type: "Literal", value: name2 };
  } else if (name2.includes(".")) {
    const identifiers = name2.split(".");
    let index2 = -1;
    let node;
    while (++index2 < identifiers.length) {
      const prop = name(identifiers[index2]) ? { type: "Identifier", name: identifiers[index2] } : { type: "Literal", value: identifiers[index2] };
      node = node ? {
        type: "MemberExpression",
        object: node,
        property: prop,
        computed: Boolean(index2 && prop.type === "Literal"),
        optional: false
      } : prop;
    }
    result = node;
  } else {
    result = name(name2) && !/^[a-z]/.test(name2) ? { type: "Identifier", name: name2 } : { type: "Literal", value: name2 };
  }
  if (result.type === "Literal") {
    const name3 = (
      /** @type {string | number} */
      result.value
    );
    return own.call(state.components, name3) ? state.components[name3] : name3;
  }
  if (state.evaluater) {
    return state.evaluater.evaluateExpression(result);
  }
  crashEstree(state);
}
function crashEstree(state, place) {
  const message = new VFileMessage(
    "Cannot handle MDX estrees without `createEvaluater`",
    {
      ancestors: state.ancestors,
      place,
      ruleId: "mdx-estree",
      source: "hast-util-to-jsx-runtime"
    }
  );
  message.file = state.filePath || void 0;
  message.url = docs + "#cannot-handle-mdx-estrees-without-createevaluater";
  throw message;
}
function transformStylesToCssCasing(domCasing) {
  const cssCasing = {};
  let from;
  for (from in domCasing) {
    if (own.call(domCasing, from)) {
      cssCasing[transformStyleToCssCasing(from)] = domCasing[from];
    }
  }
  return cssCasing;
}
function transformStyleToCssCasing(from) {
  let to = from.replace(cap2, toDash);
  if (to.slice(0, 3) === "ms-") to = "-" + to;
  return to;
}
function toDash($0) {
  return "-" + $0.toLowerCase();
}
function childrenToString(children) {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  return String(children ?? "");
}
var builtinComponents = {
  table: (props) => /* @__PURE__ */ jsx("div", { class: "table-container", children: /* @__PURE__ */ jsx("table", { ...props }) }),
  style: ({ children, ...rest }) => h$1("style", { ...rest, dangerouslySetInnerHTML: { __html: childrenToString(children) } }),
  script: ({ children, ...rest }) => h$1("script", { ...rest, dangerouslySetInnerHTML: { __html: childrenToString(children) } })
};
function htmlToJsx(tree, components) {
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    elementAttributeNameCase: "html",
    components: { ...builtinComponents, ...components }
  });
}
var FormBox_default = ((userOpts) => {
  const opts = resolveOrThrow(userOpts);
  logHints(opts);
  const form = opts.layoutForm ? opts.forms[opts.layoutForm] : void 0;
  const FormBox = (props) => {
    if (!form) return null;
    const data = props.fileData;
    if (data.quartzForms?.hideLayout) return null;
    if (frontmatterForms(data.frontmatter, opts.frontmatterKey).hideLayout) return null;
    const lang = opts.language === "auto" ? pageLanguage(data.frontmatter, props.cfg.locale) : opts.language;
    const fm = data.frontmatter ?? {};
    const ctx = makeContext(opts, form, {
      lang,
      idPrefix: `qf-${form.id}-layout`,
      page: {
        title: typeof fm.title === "string" ? fm.title : String(data.slug ?? ""),
        slug: String(data.slug ?? "")
      },
      serve: Boolean(props.ctx?.argv?.serve)
    });
    const tree = renderForm(form, ctx);
    return /* @__PURE__ */ jsx("div", { class: ["quartz-form-box", props.displayClass].filter(Boolean).join(" "), children: htmlToJsx(tree) });
  };
  FormBox.css = forms_default;
  FormBox.afterDOMLoaded = forms_inline_default;
  return FormBox;
});

export { FormBox_default, Forms, defaultOptions, logHints, resolveOptions, resolveOrThrow, resolveText, templateNames, templateOf };
//# sourceMappingURL=chunk-IHFS2UCT.js.map
//# sourceMappingURL=chunk-IHFS2UCT.js.map