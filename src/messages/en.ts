import type { Params, Translate } from "./types";

const s = (p: Params, key: string): string => String(p[key] ?? "");

/**
 * The plugin's own messages about a definition - the problems that stop the build, the hints it
 * logs, what a key or the command line refuses - in English, word for word what the build log has
 * always said (the build log stays English; tests hold these strings). The German catalog must
 * have every key (de.ts is typed against this one).
 */
const en = {
  // texts
  textEmpty: () => "empty text",
  textShape: () => "a text is a string or a record of language → string",
  textRecordEmpty: () => "empty text record",

  // fields
  fieldShape: () => "a field is an object with a type and a name",
  fieldNamePattern: (p: Params) =>
    `field name ${s(p, "name")} must match ${s(p, "pattern")} (a letter, then letters, digits, _ or -)`,
  fieldNameReserved: (p: Params) =>
    `field name "${s(p, "name")}" is reserved by the submission envelope`,
  minAboveMax: (p: Params) => `min ${s(p, "min")} is above max ${s(p, "max")}`,
  maxLengthMin: () => "maxLength must be at least 1",
  patternJsU: () =>
    "`\\u` escapes are JavaScript only, the relay's PCRE cannot read them: write the character itself, or `\\xHH` below U+0100",
  patternJsNegClass: () =>
    "`[^]` is JavaScript only, the relay's PCRE cannot read it: write `[\\s\\S]`",
  patternJsEmptyClass: () =>
    "`[]` is JavaScript only (it matches nothing), the relay's PCRE cannot read it",
  patternJsLookbehind: () =>
    "a lookbehind of unlimited length is JavaScript only, the relay's PCRE cannot read it",
  patternInvalid: (p: Params) => `pattern is not a regular expression (${s(p, "error")})`,
  optionsNeeded: (p: Params) => `a ${s(p, "type")} field needs at least one option`,
  optionShape: () => "an option is { value, label } with a value",
  optionTwice: (p: Params) => `value "${s(p, "value")}" twice`,
  optionSpace: (p: Params) =>
    `value "${s(p, "value")}" begins or ends with whitespace, which is trimmed from what is sent: it can never be chosen`,
  scaleInteger: () => "a scale has integer min and max",
  scaleOrder: (p: Params) => `scale min ${s(p, "min")} must be below max ${s(p, "max")}`,
  scaleSpan: () => "a scale spans at most 21 steps",
  consentText: () => "a consent field needs a text",
  hiddenValue: () => "a hidden field needs a value",
  fieldTypeUnknown: (p: Params) => `unknown field type ${s(p, "type")}`,
  labelNeeded: (p: Params) => `a ${s(p, "type")} field needs a label`,
  widthValue: () => "full, half or third",
  layoutValue: () => "stacked or inline",
  layoutSelect: () => "has no effect on a select, whose options are a list to open",
  showIfNotAllowed: (p: Params) => `a ${s(p, "type")} field cannot be conditional`,
  showIfShape: () => "{ field, equals } with the name of a field and one value or a list of them",
  showIfUnknown: (p: Params) => `no field "${s(p, "field")}" in this form`,
  showIfLater: (p: Params) => `"${s(p, "field")}" must come before the field that depends on it`,
  showIfController: (p: Params) =>
    `"${s(p, "field")}" is a ${s(p, "type")} field; a condition needs a select, radio, checkboxes, checkbox or scale`,
  showIfValue: (p: Params) => `"${s(p, "field")}" cannot have the value "${s(p, "value")}"`,
  pageBreakEdge: () => "a page break stands between fields, not first or last",
  pageBreakTwice: () => "two page breaks in a row leave a step without fields",
  consentInConditionalStep: () =>
    "a consent field cannot stand in a step with a condition: when the step is skipped, the message would go without it",
  stepOnlyHidden: (p: Params) =>
    `step ${s(p, "step")} holds only hidden values and shows the visitor nothing`,

  // keys in the options
  keyShape: () => "a key is { file } or { armored }",
  keyExactlyOne: () => "exactly one of file or armored",
  keyOutside: (p: Params) => `${s(p, "file")} lies outside the site`,
  keyUnreadable: (p: Params) => `${s(p, "file")} not found or not readable`,
  keyFileBlock: (p: Params, t: Translate) => `${s(p, "file")}: ${t(s(p, "problem"), p)}`,

  // armor (src/pgp/armor.ts)
  armorPrivate: () =>
    "holds a private key block; export only the public key (gpg --export --armor)",
  armorNone: () => "not an armored PGP public key block",
  armorIncomplete: () => "holds an incomplete armor block",
  armorOther: (p: Params) => `holds a PGP ${s(p, "kind")} besides the public key`,
  armorMany: (p: Params) => `holds ${s(p, "count")} key blocks; one public key per source`,

  // a key as OpenPGP.js reads it (src/pgp/check.ts)
  pgpUnreadable: (p: Params) => `not a readable PGP key (${s(p, "error")})`,
  pgpPrivate: () => "this is a private key; the site needs the public key",
  pgpRevoked: () => "this key is revoked",
  pgpExpired: (p: Params) => `this key expired on ${s(p, "date")}`,
  pgpNoEncrypt: () => "this key cannot encrypt (no encryption subkey)",
  pgpNewAlgorithm: (p: Params) =>
    `this key encrypts with ${s(p, "algorithm")} as RFC 9580 writes it, which GnuPG cannot read: gpg does not decrypt mails sent to it`,
  pgpVersion6: () =>
    "this is a version 6 key as RFC 9580 writes it, which GnuPG cannot read: gpg does not decrypt mails sent to it",
  keyMissingSource: () => "neither file nor armored",
  keyFileUnreadable: () => "not found or not readable",

  // a form
  formIdPattern: (p: Params) =>
    `form id must match ${s(p, "pattern")} (lower-case letters, digits, -)`,
  templateUnknown: (p: Params) => `unknown template ${s(p, "name")}`,
  noFields: () => "no fields (write fields or choose a template)",
  fieldNameTwice: (p: Params) => `field name "${s(p, "name")}" twice`,
  onePgpKey: () => "at most one pgpKey field",

  // transport
  urlNeeded: (p: Params) => `${s(p, "kind")} needs a URL`,
  urlNotHttp: (p: Params) => `${s(p, "url")} is not an http(s) URL`,
  urlPlainHttp: (p: Params) => `${s(p, "url")} sends submissions unencrypted in transit (http)`,
  relayRecipient: () => "the relay needs the recipient's name",
  presetUrl: (p: Params) => `${s(p, "kind")} needs the form id or access key`,
  anonymousService: (p: Params) =>
    `anonymous, but ${s(p, "kind")} sees the sender's address; see the README`,
  mailtoRecipient: () => "mailto needs an e-mail address",
  kindUnknown: (p: Params) => `unknown kind ${s(p, "kind")}`,
  extraRelay: () => "has no effect with the relay",
  extraMailto: () => "has no effect with mailto",
  demoNoEffect: () => "has no effect with demo, which sends nothing",
  demoRedirect: () => "demo shows what would have been sent below the form and does not redirect",
  demoCaptcha: (p: Params) =>
    `with demo the ${s(p, "provider")} widget is not loaded: nothing is sent that it could protect`,
  formatValue: () => "json or form",

  // encryption
  modeValue: () => "required, optional or off",
  noKeys: () => "no keys to encrypt to",
  keyUnknown: (p: Params) => `unknown key "${s(p, "name")}"`,
  mailtoEncrypted: () => "encrypted mailto puts the whole ciphertext into the mail body",

  // spam
  minSecondsValue: () => "a whole number of seconds, 0 or more",
  powDifficultyValue: () => "an integer from 8 to 20",
  captchaValue: () => "none, turnstile or hcaptcha",
  siteKeyNeeded: (p: Params) => `${s(p, "provider")} needs the site key`,
  anonymousCaptcha: (p: Params) => `anonymous, so the ${s(p, "provider")} captcha is not loaded`,
  noRelayEffect: () => "has no effect without the relay",
  encryptionCaptcha: (p: Params) =>
    `the ${s(p, "provider")} script runs on the page where the message is typed before it is encrypted, and can read it (see the README)`,
  powNoScript: () =>
    "a plain post without JavaScript (noScript: true) skips it; noScript: false requires the script",
  minSecondsNoScript: () =>
    "a plain post without JavaScript (noScript: true) carries no stamp and skips it; noScript: false requires the script",
  rateLimitLever: (p: Params) =>
    `one client can send the hour's ${s(p, "count")} mails by itself, and the form takes no more from anyone until the hour is over; a captcha, or pow with noScript: false, makes that cost something (see the README)`,
  powSlow: (p: Params) => `${s(p, "bits")} bits take seconds on a phone before every message`,
  positiveInteger: () => "a positive integer",
  maxBytesLow: (p: Params) =>
    `${s(p, "maxBytes")} is below what the fields may hold (about ${s(p, "capacity")} bytes${p.encrypted ? " once encrypted" : ""}); a long message would be refused as too large`,

  // anonymous
  pageContextAnonymous: () => "anonymous, so the page is not sent along",
  personalOptional: (p: Params) =>
    `anonymous, so "${s(p, "name")}" (${s(p, "type")}) cannot be required and is made optional`,

  // success
  successMode: () => "inline or redirect",
  successSlug: () => "redirect needs the slug of a page",

  // the entry
  languageValue: (p: Params) => `"${s(p, "value")}" is neither auto nor a language code`,
  frontmatterKeyEmpty: () => "empty",
  layoutFormUnknown: (p: Params) => `no form "${s(p, "id")}"`,
  codeBlockLangValue: () => "one word without spaces",
  textsLocaleUnknown: () => "the plugin has no texts in this language; they are used as written",
  textsShape: () => "a record of text key → wording",
  textsKeyUnknown: () => "no such text key",
  textsPlaceholderMissing: (p: Params) =>
    `without ${s(p, "names")}; the sentence then lacks that value`,
  textsPlaceholderUnknown: (p: Params) =>
    `${s(p, "names")} is no value of this text; it stays as written`,

  // the command line (src/cli.ts) and the relay generator (src/relay/generate.ts)
  cliNeedsValue: (p: Params) => `${s(p, "arg")} needs a value`,
  cliUnknownArgument: (p: Params) => `unknown argument ${s(p, "arg")}`,
  cliNoSite: () => "no site directory given (--site)",
  cliConfigMissing: (p: Params) => `${s(p, "path")} not found`,
  // Quartz names a plugin by the end of its source, so a folder of another name is not this one.
  cliNoEntry: (p: Params) =>
    `no quartz-forms entry in ${s(p, "path")}: an entry's source must end in quartz-forms (github:boxi-os/quartz-forms, or a folder named quartz-forms)`,
  cliEntries: (p: Params) => `${s(p, "count")} quartz-forms entries; taking the first`,
  cliNoOut: () => "no output directory given (--out)",
  cliUnknownCommand: (p: Params) =>
    `unknown command "${s(p, "command")}" (relay, check, key, texts)`,
  cliNoKey: () => "no key given (--file, or the armored text in QF_KEY_ARMORED)",
  cliKeyUnreadable: (p: Params) => `${s(p, "file")}: not found or not readable`,
  cliOperatorJson: () => "QF_RELAY_OPERATOR: not JSON",
  cliOperatorProblems: (p: Params) => `${s(p, "count")} problem(s) in the operator values`,
  cliOptionProblems: (p: Params) =>
    `[forms] ${s(p, "count")} problem(s) in the quartz-forms options:`,
  cliNoPhp: (p: Params) =>
    `${s(p, "count")} pattern(s) not checked against PCRE: no php on the PATH. The relay refuses every value of a field whose pattern its PCRE cannot read.`,
  cliPhpFailed: (p: Params) => `php could not check the patterns:\n${s(p, "message")}`,
  cliPhpFailedShort: () => "php could not check the patterns",
  cliPatternUnreadable: (p: Params) =>
    `forms.${s(p, "form")} field "${s(p, "field")}": PCRE cannot read the pattern "${s(p, "pattern")}" (${s(p, "why")}); the relay would refuse every value of this field`,
  cliPatternRefusal: () => "a pattern PCRE cannot read",
  cliNothingWritten: () =>
    "nothing written; fix the pattern, or pass --skip-pattern-check when the host's PCRE is newer than this machine's",
  cliWrittenAnyway: () => "written anyway (--skip-pattern-check)",
  cliMissingRecipient: (p: Params) =>
    `no address for the recipient "${s(p, "name")}"; the relay refuses its forms`,

  operatorNotObject: () => "operator: not an object",
  operatorSecret: () => "operator.secret: at least 32 characters",
  operatorOrigins: () => "operator.allowedOrigins: a list of origins",
  operatorFrom: () => "operator.from: the sender's e-mail address",
  operatorMailer: () => 'operator.mailer: "mail", { sendmail } or { file }',
  operatorRecord: (p: Params) => `operator.${s(p, "key")}: a record of name → text`,
  operatorText: (p: Params) => `operator.${s(p, "key")}: a text`,
  operatorCounterDir: () => "operator.counterDir: an absolute path on the server",
};

export default en;
export type MessageCode = keyof typeof en;
