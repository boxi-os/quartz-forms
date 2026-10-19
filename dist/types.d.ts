/**
 * Options of quartz-forms. This file is the single source of truth for the data model:
 * `quartz.configSchema` in package.json is checked against it member by member
 * (test/config-schema.test.ts), `defaultOptions` in src/options.ts must satisfy it, and the
 * three validation levels (build, browser, relay) derive their rules from the same fields.
 */
/**
 * A user-facing text: one string for every language, or a record keyed by language code
 * (`{ de: "Name", en: "Name" }`). Resolution: exact code, then primary subtag, then the first
 * value. QuartzControl offers the site's languages as keys (`x-quartz-keys: "languages"`).
 */
type Text = string | Record<string, string>;
interface QuartzFormsOptions {
    /** The forms of this site, by id (`[a-z0-9-]`). A page embeds a form by this id. */
    forms: Record<string, FormDefinition>;
    /** Where a submission goes. Every form can override single fields of it. */
    transport: TransportConfig;
    /**
     * Public PGP keys, by name. A form names the keys it encrypts to; a key is read from a file
     * relative to the site root (`quartz/static/keys/owner.asc`) or written inline as armored text.
     */
    keys: Record<string, PgpKeySource>;
    /** Spam protection and size limits. Every form can override single fields of it. */
    spam: SpamConfig;
    /**
     * Frontmatter key that embeds a form on a page (`form: contact`) or hides the form placed
     * through the layout on this page (`form: false`).
     */
    frontmatterKey: string;
    /** Language tag of the fenced code block that embeds a form in the text. */
    codeBlockLang: string;
    /**
     * Id of the form placed through the layout block of this plugin entry (sidebar, footer, after
     * the body on every page). Empty: nothing is placed; forms are embedded per page only.
     */
    layoutForm: string;
    /**
     * Language of the form placed through the layout: `auto` takes the page language
     * (`frontmatter.lang`, else the site locale), or a language code.
     */
    language: string;
    /**
     * Own wording for the plugin's texts, by locale and text key (`de: { submit: "Abschicken" }`).
     * The keys are those of src/i18n/locales/en-US.ts.
     */
    texts: Record<string, Record<string, string>>;
}
/** The four field sets that ship with the plugin; `fields` replaces the template's fields. */
type FormTemplate = "contact" | "feedback" | "rsvp" | "survey";
interface FormDefinition {
    /** Start from a built-in field set. Own `fields` replace it entirely. */
    template?: FormTemplate;
    /** Heading above the form. */
    title?: Text;
    /** A sentence under the heading. */
    description?: Text;
    /** Text of the submit button; default from the plugin's texts. */
    submitLabel?: Text;
    /** The fields, in order. Required unless `template` is set. */
    fields?: FormField[];
    /**
     * Who receives the submission. For the relay this is a name the relay maps to an address in
     * its own `config.php`; the address never reaches the site. For `mailto` it is the address.
     */
    recipient?: string;
    /** Fixed subject line of the mail. With `anonymous` it must not contain field values. */
    subject?: Text;
    /** Overrides single fields of the global transport. */
    transport?: Partial<TransportConfig>;
    /** Encryption in the browser before sending. Default: off. */
    encryption?: EncryptionConfig;
    /**
     * Anonymous mode: no required personal fields, no Reply-To, no page context, no third-party
     * captcha, and the relay logs nothing. What this cannot promise is in the README.
     */
    anonymous?: boolean;
    /**
     * Send the page's title and slug along, as a line `Page: Title (slug)` of the message (for a
     * feedback form). Inside the ciphertext when the message is encrypted. Default: false.
     */
    pageContext?: boolean;
    /** Overrides single fields of the global spam settings. */
    spam?: Partial<SpamConfig>;
    /** What happens after a successful send. Default: a thank-you sentence in place. */
    success?: SuccessConfig;
    /** Extra class(es) on the form element, next to the fixed `quartz-form`. */
    className?: string;
}
type InputFieldType = "text" | "email" | "tel" | "url" | "number" | "date" | "textarea";
/** A single-value field rendered as `<input>` or `<textarea>`. */
interface InputField {
    type: InputFieldType;
    /** Name in the submission (`[a-z0-9_-]`, unique per form). */
    name: string;
    label: Text;
    required?: boolean;
    placeholder?: Text;
    /** A sentence under the field. */
    hint?: Text;
    /** HTML `autocomplete` token (`name`, `email`, `tel`, `off`). */
    autocomplete?: string;
    /** Regular expression the value must match (HTML `pattern`). */
    pattern?: string;
    /** Lower bound for `number`, checked by the build, the script and the relay. */
    min?: number;
    /** Upper bound for `number`, checked like `min`. */
    max?: number;
    /**
     * Step for `number` (HTML `step`). Only the browser's own check reads it, and that runs on the
     * no-script path alone; the script and the relay accept any number within the bounds.
     */
    step?: number;
    /** Rows of a `textarea`. */
    rows?: number;
    /** Maximum length in characters; default from the spam settings. */
    maxLength?: number;
}
interface ChoiceOption {
    value: string;
    label: Text;
}
/** One of several (`select`, `radio`) or several of several (`checkboxes`). */
interface ChoiceField {
    type: "select" | "radio" | "checkboxes";
    name: string;
    label: Text;
    required?: boolean;
    hint?: Text;
    options: ChoiceOption[];
}
/** A single checkbox with a label. */
interface CheckboxField {
    type: "checkbox";
    name: string;
    label: Text;
    required?: boolean;
    hint?: Text;
}
/** A rating from `min` to `max`, rendered as a row of radio buttons. */
interface ScaleField {
    type: "scale";
    name: string;
    label: Text;
    required?: boolean;
    hint?: Text;
    min: number;
    max: number;
    /** Caption at the low end. */
    minLabel?: Text;
    /** Caption at the high end. */
    maxLabel?: Text;
}
/** A checkbox the visitor must tick, with a sentence and an optional link (privacy policy). */
interface ConsentField {
    type: "consent";
    name: string;
    text: Text;
    /** Link target shown after the sentence. */
    link?: string;
    /** Link text; default from the plugin's texts. */
    linkLabel?: Text;
}
/**
 * The visitor's own public PGP key, pasted or chosen as an `.asc` file, so the owner can reply
 * encrypted. Checked in the browser; its fingerprint is shown; sent as part of the message.
 */
interface PgpKeyField {
    type: "pgpKey";
    name: string;
    label: Text;
    required?: boolean;
    hint?: Text;
}
/** A fixed value sent along, invisible. */
interface HiddenField {
    type: "hidden";
    name: string;
    value: string;
}
type FormField = InputField | ChoiceField | CheckboxField | ScaleField | ConsentField | PgpKeyField | HiddenField;
/**
 * `relay`: the plugin's own PHP relay. `endpoint`: any URL that takes a POST. `formspree`,
 * `web3forms`: presets for those services. `mailto`: opens the visitor's mail program.
 */
type TransportKind = "relay" | "endpoint" | "formspree" | "web3forms" | "mailto";
interface TransportConfig {
    kind: TransportKind;
    /** POST target for `relay` and `endpoint`; the form id or access key for the presets. */
    url?: string;
    /** Body encoding for `endpoint`; `relay` always sends JSON. */
    format?: "json" | "form";
    /** Extra fields sent with every submission (a service's access key, for instance). */
    extra?: Record<string, string>;
}
interface PgpKeySource {
    /** Path of an armored public key, relative to the site root. */
    file?: string;
    /** The armored public key itself. */
    armored?: string;
}
type EncryptionMode = "required" | "optional" | "off";
interface EncryptionConfig {
    /**
     * `required`: nothing is sent unencrypted; without JavaScript the form cannot send.
     * `optional`: the visitor decides with a checkbox (on by default). `off`: plain text.
     */
    mode: EncryptionMode;
    /** Names from `keys` to encrypt to; default: all keys. */
    keys?: string[];
    /** Show the recipient key's fingerprint under the form. Default: true. */
    showFingerprint?: boolean;
}
interface SpamConfig {
    /** An invisible field that must stay empty. */
    honeypot: boolean;
    /** Seconds a visitor needs at least between opening the page and sending. 0 turns it off. */
    minSeconds: number;
    /**
     * Accept a submission from a browser without JavaScript (a plain form post). It skips the time
     * trap and the proof of work, which only the script can supply; honeypot, rate limit and field
     * checks still apply. `false` renders the form without a target until the script runs.
     */
    noScript: boolean;
    /** Proof of work checked by the relay (`transport.kind: relay` only). */
    pow: boolean;
    /**
     * Leading zero bits the proof must reach, 8 to 20. Hashed in a Worker: 16 takes up to a second
     * on a desktop, 18 and more take seconds on a phone (the build says so).
     */
    powDifficulty: number;
    /** A third-party captcha. Loads that provider's script; ignored for anonymous forms. */
    captcha: "none" | "turnstile" | "hcaptcha";
    /** The provider's site key. */
    captchaSiteKey: string;
    /** Submissions per form and hour the relay accepts; 0 turns it off. No addresses are stored. */
    rateLimitPerHour: number;
    /** Default maximum length of a single-line field, in characters. */
    maxFieldLength: number;
    /** Default maximum length of a textarea, in characters. */
    maxTextareaLength: number;
    /** Maximum length of a pasted public key, in characters. */
    maxKeyLength: number;
    /**
     * Maximum size of a whole submission, in bytes, checked by the script before sending and by the
     * relay. The build says when the fields may hold more than this (a textarea of 20 000 CJK
     * characters is about 60 kB, armored ciphertext a third more).
     */
    maxBytes: number;
}
interface SuccessConfig {
    /** `inline`: a sentence replaces the form. `redirect`: go to a page of the site. */
    mode: "inline" | "redirect";
    /** The sentence for `inline`; default from the plugin's texts. */
    text?: Text;
    /** Slug of the page for `redirect` (`thanks`, `kontakt/danke`). */
    slug?: string;
}
interface ResolvedForm {
    id: string;
    title?: Text;
    description?: Text;
    submitLabel?: Text;
    fields: FormField[];
    recipient?: string;
    subject?: Text;
    transport: TransportConfig;
    encryption: Required<EncryptionConfig>;
    anonymous: boolean;
    pageContext: boolean;
    spam: SpamConfig;
    success: SuccessConfig;
    className?: string;
}
interface ResolvedOptions {
    forms: Record<string, ResolvedForm>;
    transport: TransportConfig;
    keys: Record<string, PgpKeySource>;
    spam: SpamConfig;
    frontmatterKey: string;
    codeBlockLang: string;
    layoutForm: string;
    language: string;
    texts: Record<string, Record<string, string>>;
    /** Problems the build must not pass over; `resolveOptions` throws them, this keeps them readable. */
    problems: string[];
    /** Things worth a line in the log, once. */
    hints: string[];
}

export type { CheckboxField, ChoiceField, ChoiceOption, ConsentField, EncryptionConfig, EncryptionMode, FormDefinition, FormField, FormTemplate, HiddenField, InputField, InputFieldType, PgpKeyField, PgpKeySource, QuartzFormsOptions, ResolvedForm, ResolvedOptions, ScaleField, SpamConfig, SuccessConfig, Text, TransportConfig, TransportKind };
