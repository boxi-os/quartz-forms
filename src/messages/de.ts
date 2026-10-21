import type en from "./en";
import type { Params, Translate } from "./types";

const s = (p: Params, key: string): string => String(p[key] ?? "");

/** Die Meldungen des Plugins auf Deutsch, für die Kommandozeile (`--lang de`) und QuartzControl. */
const de: { [K in keyof typeof en]: (p: Params, t: Translate) => string } = {
  textEmpty: () => "leerer Text",
  textShape: () => "ein Text ist ein String oder ein Record Sprache → String",
  textRecordEmpty: () => "leerer Text-Record",

  fieldShape: () => "ein Feld ist ein Objekt mit type und name",
  fieldNamePattern: (p) =>
    `der Feldname ${s(p, "name")} muss ${s(p, "pattern")} entsprechen (ein Buchstabe, dann Buchstaben, Ziffern, _ oder -)`,
  fieldNameReserved: (p) => `der Feldname „${s(p, "name")}“ ist für die Sendung selbst reserviert`,
  minAboveMax: (p) => `min ${s(p, "min")} liegt über max ${s(p, "max")}`,
  maxLengthMin: () => "maxLength muss mindestens 1 sein",
  patternJsU: () =>
    "`\\u`-Escapes gibt es nur in JavaScript, das PCRE des Relays kann sie nicht lesen: schreib das Zeichen selbst oder `\\xHH` unter U+0100",
  patternJsNegClass: () =>
    "`[^]` gibt es nur in JavaScript, das PCRE des Relays kann es nicht lesen: schreib `[\\s\\S]`",
  patternJsEmptyClass: () =>
    "`[]` gibt es nur in JavaScript (es trifft nichts), das PCRE des Relays kann es nicht lesen",
  patternJsLookbehind: () =>
    "ein Lookbehind unbegrenzter Länge gibt es nur in JavaScript, das PCRE des Relays kann ihn nicht lesen",
  patternInvalid: (p) => `pattern ist kein regulärer Ausdruck (${s(p, "error")})`,
  optionsNeeded: (p) => `ein Feld vom Typ ${s(p, "type")} braucht mindestens eine Option`,
  optionShape: () => "eine Option ist { value, label } mit einem Wert",
  optionTwice: (p) => `Wert „${s(p, "value")}“ doppelt`,
  optionSpace: (p) =>
    `Wert „${s(p, "value")}“ beginnt oder endet mit Leerraum, der beim Senden entfernt wird: er ist nie wählbar`,
  scaleInteger: () => "eine Skala hat ganzzahlige min und max",
  scaleOrder: (p) => `min ${s(p, "min")} der Skala muss unter max ${s(p, "max")} liegen`,
  scaleSpan: () => "eine Skala umfasst höchstens 21 Stufen",
  consentText: () => "ein Einwilligungsfeld braucht einen Text",
  hiddenValue: () => "ein verborgenes Feld braucht einen Wert",
  fieldTypeUnknown: (p) => `unbekannter Feldtyp ${s(p, "type")}`,
  labelNeeded: (p) => `ein Feld vom Typ ${s(p, "type")} braucht eine Beschriftung (label)`,
  widthValue: () => "full, half oder third",
  layoutValue: () => "stacked oder inline",
  layoutSelect: () => "wirkt nicht bei select, dessen Optionen eine aufklappende Liste sind",
  showIfNotAllowed: (p) => `ein Feld vom Typ ${s(p, "type")} kann nicht bedingt sein`,
  showIfShape: () =>
    "{ field, equals } mit dem Namen eines Felds und einem Wert oder einer Liste davon",
  showIfUnknown: (p) => `kein Feld „${s(p, "field")}“ in diesem Formular`,
  showIfLater: (p) => `„${s(p, "field")}“ muss vor dem Feld stehen, das davon abhängt`,
  showIfController: (p) =>
    `„${s(p, "field")}“ ist ein Feld vom Typ ${s(p, "type")}; eine Bedingung braucht select, radio, checkboxes, checkbox oder scale`,
  showIfValue: (p) => `„${s(p, "field")}“ kann den Wert „${s(p, "value")}“ nicht haben`,
  pageBreakEdge: () => "ein Seitenumbruch steht zwischen Feldern, nicht am Anfang oder Ende",
  pageBreakTwice: () => "zwei Seitenumbrüche hintereinander lassen einen Schritt ohne Felder",
  consentInConditionalStep: () =>
    "eine Einwilligung kann nicht in einem Schritt mit Bedingung stehen: Wird der Schritt übersprungen, ginge die Nachricht ohne sie hinaus",
  stepOnlyHidden: (p) =>
    `Schritt ${s(p, "step")} enthält nur verborgene Werte und zeigt dem Besucher nichts`,

  keyShape: () => "ein Schlüssel ist { file } oder { armored }",
  keyExactlyOne: () => "genau eines von file oder armored",
  keyOutside: (p) => `${s(p, "file")} liegt außerhalb der Website`,
  keyUnreadable: (p) => `${s(p, "file")} fehlt oder ist nicht lesbar`,
  keyFileBlock: (p, t) => `${s(p, "file")}: ${t(s(p, "problem"), p)}`,

  armorPrivate: () =>
    "enthält einen privaten Schlüssel; exportiere nur den öffentlichen (gpg --export --armor)",
  armorNone: () => "kein öffentlicher PGP-Schlüssel im Textformat",
  armorIncomplete: () => "enthält einen unvollständigen Armor-Block",
  armorOther: (p) => `enthält neben dem öffentlichen Schlüssel einen PGP ${s(p, "kind")}`,
  armorMany: (p) =>
    `enthält ${s(p, "count")} Schlüsselblöcke; ein öffentlicher Schlüssel je Quelle`,

  pgpUnreadable: (p) => `kein lesbarer PGP-Schlüssel (${s(p, "error")})`,
  pgpPrivate: () => "das ist ein privater Schlüssel; die Website braucht den öffentlichen",
  pgpRevoked: () => "dieser Schlüssel ist widerrufen",
  pgpExpired: (p) => `dieser Schlüssel ist am ${s(p, "date")} abgelaufen`,
  pgpNoEncrypt: () =>
    "dieser Schlüssel kann nicht verschlüsseln (kein Verschlüsselungs-Unterschlüssel)",
  pgpNewAlgorithm: (p) =>
    `dieser Schlüssel verschlüsselt mit ${s(p, "algorithm")} in der Form von RFC 9580, die GnuPG nicht lesen kann: Mails an ihn entschlüsselt gpg nicht`,
  pgpVersion6: () =>
    "dieser Schlüssel hat die Version 6 aus RFC 9580, die GnuPG nicht lesen kann: Mails an ihn entschlüsselt gpg nicht",
  keyMissingSource: () => "weder file noch armored",
  keyFileUnreadable: () => "fehlt oder ist nicht lesbar",

  formIdPattern: (p) =>
    `die Kennung des Formulars muss ${s(p, "pattern")} entsprechen (Kleinbuchstaben, Ziffern, -)`,
  templateUnknown: (p) => `unbekannte Vorlage ${s(p, "name")}`,
  noFields: () => "keine Felder (schreib Felder oder wähle eine Vorlage)",
  fieldNameTwice: (p) => `Feldname „${s(p, "name")}“ doppelt`,
  onePgpKey: () => "höchstens ein Feld vom Typ pgpKey",

  urlNeeded: (p) => `${s(p, "kind")} braucht eine Adresse`,
  urlNotHttp: (p) => `${s(p, "url")} ist keine http(s)-Adresse`,
  urlPlainHttp: (p) => `${s(p, "url")} überträgt Sendungen unverschlüsselt (http)`,
  relayRecipient: () => "das Relay braucht den Namen des Empfängers",
  presetUrl: (p) => `${s(p, "kind")} braucht die Formular-ID oder den Zugangsschlüssel`,
  anonymousService: (p) =>
    `anonym, aber ${s(p, "kind")} sieht die Adresse des Absenders; siehe README`,
  mailtoRecipient: () => "mailto braucht eine E-Mail-Adresse",
  kindUnknown: (p) => `unbekannter Versandweg ${s(p, "kind")}`,
  extraRelay: () => "wirkt nicht beim Relay",
  extraMailto: () => "wirkt nicht bei mailto",
  demoNoEffect: () => "wirkt nicht bei demo, das nichts sendet",
  demoRedirect: () =>
    "demo zeigt unter dem Formular, was gesendet worden wäre, und leitet nicht weiter",
  demoCaptcha: (p) =>
    `bei demo wird das Widget von ${s(p, "provider")} nicht geladen: Es wird nichts gesendet, das es schützen könnte`,
  formatValue: () => "json oder form",

  modeValue: () => "required, optional oder off",
  noKeys: () => "keine Schlüssel, an die verschlüsselt werden kann",
  keyUnknown: (p) => `unbekannter Schlüssel „${s(p, "name")}“`,
  mailtoEncrypted: () => "ein verschlüsseltes mailto schreibt das ganze Chiffrat in die Mail",

  minSecondsValue: () => "eine ganze Zahl Sekunden, 0 oder mehr",
  powDifficultyValue: () => "eine ganze Zahl von 8 bis 20",
  captchaValue: () => "none, turnstile oder hcaptcha",
  siteKeyNeeded: (p) => `${s(p, "provider")} braucht den Site-Key`,
  anonymousCaptcha: (p) => `anonym, deshalb wird das Captcha von ${s(p, "provider")} nicht geladen`,
  encryptionCaptcha: (p) =>
    `das Skript von ${s(p, "provider")} läuft auf der Seite, auf der die Nachricht vor dem Verschlüsseln getippt wird, und kann sie lesen (siehe README)`,
  noRelayEffect: () => "wirkt nur mit dem Relay",
  powNoScript: () =>
    "ein einfacher Post ohne JavaScript (noScript: true) umgeht es; noScript: false verlangt das Skript",
  minSecondsNoScript: () =>
    "ein einfacher Post ohne JavaScript (noScript: true) trägt keinen Stempel und umgeht es; noScript: false verlangt das Skript",
  rateLimitLever: (p) =>
    `ein einzelner Client kann die ${s(p, "count")} Mails der Stunde selbst senden, danach nimmt das Formular bis zum Ende der Stunde von niemandem mehr etwas an; ein Captcha oder pow mit noScript: false macht das teuer (siehe README)`,
  powSlow: (p) => `${s(p, "bits")} Bit dauern auf einem Telefon vor jeder Nachricht Sekunden`,
  positiveInteger: () => "eine positive ganze Zahl",
  maxBytesLow: (p) =>
    `${s(p, "maxBytes")} ist kleiner als das, was die Felder fassen (etwa ${s(p, "capacity")} Bytes${p.encrypted ? " verschlüsselt" : ""}); eine lange Nachricht würde als zu groß abgewiesen`,

  pageContextAnonymous: () => "anonym, deshalb wird die Seite nicht mitgeschickt",
  personalOptional: (p) =>
    `anonym, deshalb kann „${s(p, "name")}“ (${s(p, "type")}) kein Pflichtfeld sein und wird optional`,

  successMode: () => "inline oder redirect",
  successSlug: () => "redirect braucht den Slug einer Seite",

  languageValue: (p) => `„${s(p, "value")}“ ist weder auto noch ein Sprachcode`,
  frontmatterKeyEmpty: () => "leer",
  layoutFormUnknown: (p) => `kein Formular „${s(p, "id")}“`,
  codeBlockLangValue: () => "ein Wort ohne Leerzeichen",
  textsLocaleUnknown: () =>
    "das Plugin hat keine Texte in dieser Sprache; sie gelten, wie sie dastehen",
  textsShape: () => "ein Record Textschlüssel → Wortlaut",
  textsKeyUnknown: () => "diesen Textschlüssel gibt es nicht",
  textsPlaceholderMissing: (p) => `ohne ${s(p, "names")}; dieser Wert fehlt dann im Satz`,
  textsPlaceholderUnknown: (p) =>
    `${s(p, "names")} ist kein Wert dieses Textes; es bleibt so stehen`,

  cliNeedsValue: (p) => `${s(p, "arg")} braucht einen Wert`,
  cliUnknownArgument: (p) => `unbekanntes Argument ${s(p, "arg")}`,
  cliNoSite: () => "kein Website-Ordner angegeben (--site)",
  cliConfigMissing: (p) => `${s(p, "path")} fehlt`,
  cliNoEntry: (p) =>
    `kein quartz-forms-Eintrag in ${s(p, "path")}: die source eines Eintrags muss auf quartz-forms enden (github:boxi-os/quartz-forms oder ein Ordner namens quartz-forms)`,
  cliEntries: (p) => `${s(p, "count")} Einträge von quartz-forms; es gilt der erste`,
  cliNoOut: () => "kein Ausgabeordner angegeben (--out)",
  cliUnknownCommand: (p) => `unbekannter Befehl „${s(p, "command")}“ (relay, check, key, texts)`,
  cliNoKey: () => "kein Schlüssel angegeben (--file oder der Text in QF_KEY_ARMORED)",
  cliKeyUnreadable: (p) => `${s(p, "file")}: fehlt oder ist nicht lesbar`,
  cliOperatorJson: () => "QF_RELAY_OPERATOR: kein JSON",
  cliOperatorProblems: (p) => `${s(p, "count")} Problem(e) in den Werten des Betreibers`,
  cliOptionProblems: (p) => `[forms] ${s(p, "count")} Problem(e) in den Optionen von quartz-forms:`,
  cliNoPhp: (p) =>
    `${s(p, "count")} Muster nicht gegen PCRE geprüft: kein php im PATH. Das Relay weist jeden Wert eines Felds ab, dessen Muster sein PCRE nicht lesen kann.`,
  cliPhpFailed: (p) => `php konnte die Muster nicht prüfen:\n${s(p, "message")}`,
  cliPhpFailedShort: () => "php konnte die Muster nicht prüfen",
  cliPatternUnreadable: (p) =>
    `forms.${s(p, "form")} Feld „${s(p, "field")}“: PCRE kann das Muster „${s(p, "pattern")}“ nicht lesen (${s(p, "why")}); das Relay würde jeden Wert dieses Felds abweisen`,
  cliPatternRefusal: () => "ein Muster, das PCRE nicht lesen kann",
  cliNothingWritten: () =>
    "nichts geschrieben; korrigiere das Muster oder gib --skip-pattern-check an, wenn das PCRE des Hosts neuer ist als das dieses Rechners",
  cliWrittenAnyway: () => "trotzdem geschrieben (--skip-pattern-check)",
  cliMissingRecipient: (p) =>
    `keine Adresse für den Empfänger „${s(p, "name")}“; das Relay weist seine Formulare ab`,

  operatorNotObject: () => "operator: kein Objekt",
  operatorSecret: () => "operator.secret: mindestens 32 Zeichen",
  operatorOrigins: () => "operator.allowedOrigins: eine Liste von Origins",
  operatorFrom: () => "operator.from: die E-Mail-Adresse des Absenders",
  operatorMailer: () => 'operator.mailer: "mail", { sendmail } oder { file }',
  operatorRecord: (p) => `operator.${s(p, "key")}: ein Record Name → Text`,
  operatorText: (p) => `operator.${s(p, "key")}: ein Text`,
  operatorCounterDir: () => "operator.counterDir: ein absoluter Pfad auf dem Server",
};

export default de;
