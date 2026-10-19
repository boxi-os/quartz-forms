// Browser script of quartz-forms. Runs on every `nav` event (Quartz's SPA router); every
// listener is paired with `window.addCleanup`. Must stay a plain script: no `export`, no
// `declare global` (the build strips `export` statements and inlines the file into a <script>).
//
// Validation level 2 of three: the rules come from the JSON the renderer wrote into each form
// (`.quartz-form-config`), which it derived from the form definition. Nothing here invents a rule.

interface QfRule {
  /** Conditions that must all hold for the field to count (src/conditions.ts). */
  when?: { field: string; equals: string[] }[];
  name: string;
  type: string;
  label: string;
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  optionLabels?: Record<string, string>;
}

interface QfConfig {
  id: string;
  lang: string;
  fields: QfRule[];
  /** The steps of a form with page breaks, each with the names of its fields, in form order. */
  steps?: { title?: string; fields: string[] }[];
  transport: { kind: string; url: string; format: "json" | "form"; extra: Record<string, string> };
  subject?: string;
  spam: {
    honeypot: boolean;
    minSeconds: number;
    pow: boolean;
    powDifficulty: number;
    captcha: string;
    captchaSiteKey: string;
    maxBytes: number;
  };
  encryption: { mode: "required" | "optional" | "off"; keys: string[]; showFingerprint: boolean };
  anonymous: boolean;
  page?: { title: string; slug: string };
  success: { mode: "inline" | "redirect"; text: string; slug?: string };
  texts: Record<string, string>;
}

type QfValue = string | string[];

interface QfProblem {
  name: string;
  message: string;
}

interface QfRelayResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  errors?: { field?: string; code?: string; message?: string }[];
  /** With the demo transport: the message as it would have left the page. */
  demo?: string;
}

const QF_HONEYPOT = "_hp_website";
const QF_ENCRYPT_TOGGLE = "_encrypt";
const QF_KEY_FILE = "_key_file";

function qfText(cfg: QfConfig, key: string, values: Record<string, string | number> = {}): string {
  const template = cfg.texts[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

function qfBasePath(): string {
  return document.body.dataset.basepath ?? "";
}

/** Navigation seam: Quartz's SPA for pages of the site, the browser for everything else. */
function qfNavigate(url: string, internal: boolean): void {
  const w = window as unknown as {
    spaNavigate?: (url: URL) => void;
    __quartzFormsNavigate?: (url: string) => void;
  };
  if (w.__quartzFormsNavigate) return w.__quartzFormsNavigate(url);
  if (internal && typeof w.spaNavigate === "function") {
    w.spaNavigate(new URL(url, window.location.toString()));
    return;
  }
  window.location.assign(url);
}

function qfReadConfig(form: HTMLFormElement): QfConfig | null {
  const script = form.querySelector<HTMLScriptElement>("script.quartz-form-config");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent ?? "") as QfConfig;
  } catch {
    return null;
  }
}

/** The value(s) of a field as the visitor filled them in. */
function qfValueOf(form: HTMLFormElement, rule: QfRule): QfValue {
  const item = form.elements.namedItem(rule.name);
  if (!item) return "";
  const list: Element[] =
    item instanceof RadioNodeList
      ? Array.from(item as unknown as ArrayLike<Element>)
      : [item as Element];
  switch (rule.type) {
    case "checkboxes":
      return list
        .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.checked)
        .map((el) => el.value);
    case "radio":
    case "scale": {
      const checked = list.find(
        (el): el is HTMLInputElement => el instanceof HTMLInputElement && el.checked,
      );
      return checked ? checked.value : "";
    }
    case "checkbox":
    case "consent": {
      const box = list[0];
      return box instanceof HTMLInputElement && box.checked ? "yes" : "";
    }
    default: {
      const el = list[0] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
      return el ? String(el.value ?? "").trim() : "";
    }
  }
}

/**
 * The fields that count with these values: every condition of a field holds, and every field a
 * condition names counts itself - one pass in form order, since a condition only names an earlier
 * field (the build makes sure). The relay decides the same way (`qf_active` in send.php),
 * measured against one catalog of cases (test/parity-cases.ts, conditionCases).
 */
function qfActive(cfg: QfConfig, values: Record<string, QfValue | undefined>): Set<string> {
  const active = new Set<string>();
  for (const rule of cfg.fields) {
    const holds = (rule.when ?? []).every((cond) => {
      if (!active.has(cond.field)) return false;
      const value = values[cond.field];
      const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      return list.some((v) => typeof v === "string" && cond.equals.includes(v.trim()));
    });
    if (holds) active.add(rule.name);
  }
  return active;
}

function qfValuesOf(form: HTMLFormElement, cfg: QfConfig): Record<string, QfValue> {
  const values: Record<string, QfValue> = {};
  for (const rule of cfg.fields) values[rule.name] = qfValueOf(form, rule);
  return values;
}

/**
 * Shows the fields whose conditions hold and hides the others, clearing what a hidden field said
 * about itself; `aria-required` follows, since the markup leaves it off a conditional field (a
 * browser without this script would refuse a post where the field does not apply).
 */
function qfApplyConditions(form: HTMLFormElement, cfg: QfConfig): Set<string> {
  const active = qfActive(cfg, qfValuesOf(form, cfg));
  for (const rule of cfg.fields) {
    if (!rule.when) continue;
    const on = active.has(rule.name);
    const wrapper = form.querySelector<HTMLElement>(`[data-field="${rule.name}"]`);
    if (wrapper) wrapper.hidden = !on;
    if (!on) qfShowError(form, rule.name, null);
    for (const control of qfControlsOf(form, rule.name)) {
      if (on && rule.required) control.setAttribute("aria-required", "true");
      else control.removeAttribute("aria-required");
    }
  }
  return active;
}

function qfControlsOf(form: HTMLFormElement, name: string): Element[] {
  const item = form.elements.namedItem(name);
  if (!item) return [];
  return item instanceof RadioNodeList
    ? Array.from(item as unknown as ArrayLike<Element>)
    : [item as Element];
}

// E-mail and URL by one rule here and in the relay (QF_EMAIL/QF_URL in send.php): a local part
// and dot-separated labels without whitespace, a scheme and a host without whitespace. Letters
// outside ASCII pass on both sides (review finding, 2026-10-19: `müller@münchen.de` passed here
// and was refused there). Whitespace is this engine's `\s`, which trim() strips as well; the relay
// spells that list out (QF_WS), because PCRE's `\s` has U+0085 and lacks U+FEFF (second review,
// finding 10, 2026-10-19).
const QF_EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;
const QF_URL = /^https?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/iu;
const QF_TEL = /^\+?[0-9 ()./-]{5,}$/;
const QF_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Decimal notation only, as the relay reads it: Number() also took "0x5" and "Infinity".
const QF_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** A calendar day: the relay asks checkdate(), Date.parse() took February 30th. */
function qfIsDay(value: string): boolean {
  const m = QF_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * One field against its rule; `null` when it passes. The same rule as the relay's
 * `qf_check_field`, measured against one catalog of cases (test/parity-cases.ts): trimmed first,
 * line breaks as LF, length in UTF-16 units as the browser's maxlength counts them.
 */
function qfCheck(cfg: QfConfig, rule: QfRule, value: QfValue): string | null {
  const t = (key: string, values?: Record<string, string | number>) => qfText(cfg, key, values);
  if (typeof value === "string") value = value.replace(/\r\n?/g, "\n").trim();
  const empty = Array.isArray(value) ? value.length === 0 : value === "";
  if (empty) {
    if (!rule.required) return null;
    if (rule.type === "consent") return t("consentRequired");
    if (rule.type === "checkboxes") return t("chooseAtLeastOne");
    if (rule.type === "radio" || rule.type === "select" || rule.type === "scale")
      return t("chooseOne");
    return t("required");
  }
  if (Array.isArray(value)) {
    if (rule.options && value.some((v) => !rule.options!.includes(v))) return t("chooseOne");
    return null;
  }
  if (rule.maxLength !== undefined && value.length > rule.maxLength)
    return t("tooLong", { max: rule.maxLength });
  switch (rule.type) {
    case "email":
      if (!QF_EMAIL.test(value)) return t("invalidEmail");
      break;
    case "url":
      if (!QF_URL.test(value)) return t("invalidUrl");
      break;
    case "tel":
      if (!QF_TEL.test(value)) return t("invalidTel");
      break;
    case "number": {
      const decimal = value.replace(",", ".");
      if (!QF_NUMBER.test(decimal)) return t("invalidNumber");
      const n = Number(decimal);
      if (rule.min !== undefined && n < rule.min) return t("belowMin", { min: rule.min });
      if (rule.max !== undefined && n > rule.max) return t("aboveMax", { max: rule.max });
      break;
    }
    case "date":
      if (!qfIsDay(value)) return t("invalidDate");
      break;
    case "scale": {
      if (!/^-?\d+$/.test(value)) return t("chooseOne");
      const n = Number(value);
      if ((rule.min !== undefined && n < rule.min) || (rule.max !== undefined && n > rule.max))
        return t("chooseOne");
      break;
    }
    case "checkbox":
    case "consent":
      // A tick is "yes" (qfValueOf); anything else is no tick.
      if (value !== "yes") return t(rule.type === "consent" ? "consentRequired" : "required");
      break;
    case "select":
    case "radio":
      if (rule.options && !rule.options.includes(value)) return t("chooseOne");
      break;
    case "pgpKey":
      // The markers only; qfCheckVisitorKey parses the key when the field is left and at send.
      if (/-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(value)) return t("keyNotPublic");
      if (!/-----BEGIN PGP PUBLIC KEY BLOCK-----/.test(value)) return t("keyInvalid");
      break;
  }
  if (
    rule.pattern &&
    (rule.type === "text" ||
      rule.type === "textarea" ||
      rule.type === "tel" ||
      rule.type === "url" ||
      rule.type === "email")
  ) {
    try {
      if (!new RegExp(`^(?:${rule.pattern})$`, "u").test(value)) return t("patternMismatch");
    } catch {
      // A pattern the build accepted but this browser cannot read: do not block the visitor.
    }
  }
  return null;
}

function qfShowError(form: HTMLFormElement, name: string, message: string | null): void {
  const wrapper = form.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const slot = wrapper?.querySelector<HTMLElement>(".quartz-form__error");
  if (slot) {
    slot.textContent = message ?? "";
    slot.hidden = message === null;
  }
  for (const control of qfControlsOf(form, name)) {
    if (message === null) control.removeAttribute("aria-invalid");
    else control.setAttribute("aria-invalid", "true");
  }
}

/** Checks every field that counts, or of those only the ones named in `only` (one step's). */
function qfValidate(form: HTMLFormElement, cfg: QfConfig, only?: Set<string>): QfProblem[] {
  const problems: QfProblem[] = [];
  const active = qfActive(cfg, qfValuesOf(form, cfg));
  for (const rule of cfg.fields) {
    if (rule.type === "hidden" || (only && !only.has(rule.name))) continue;
    if (!active.has(rule.name)) {
      qfShowError(form, rule.name, null);
      continue;
    }
    const message = qfCheck(cfg, rule, qfValueOf(form, rule));
    qfShowError(form, rule.name, message);
    if (message) problems.push({ name: rule.name, message });
  }
  return problems;
}

function qfStatus(
  form: HTMLFormElement,
  state: "" | "info" | "error" | "success",
  text: string,
): void {
  const status = form.querySelector<HTMLElement>(".quartz-form__status");
  if (!status) return;
  status.dataset.state = state;
  status.textContent = text;
}

function qfErrorSummary(form: HTMLFormElement, cfg: QfConfig, problems: QfProblem[]): void {
  qfStatus(
    form,
    "error",
    problems.length === 1
      ? qfText(cfg, "errorSummaryOne")
      : qfText(cfg, "errorSummary", { count: problems.length }),
  );
}

function qfFocusFirst(form: HTMLFormElement, problems: QfProblem[]): void {
  const first = problems[0];
  if (!first) return;
  const control = qfControlsOf(form, first.name)[0];
  if (control instanceof HTMLElement) control.focus();
}

/** The message as the recipient reads it: `Label: value` per field, the page, the visitor's key. */
function qfSerialize(cfg: QfConfig, values: Record<string, QfValue>): string {
  const lines: string[] = [];
  let key: string | undefined;
  for (const rule of cfg.fields) {
    const value = values[rule.name];
    if (value === undefined) continue;
    if (rule.type === "pgpKey") {
      if (typeof value === "string" && value) key = value;
      continue;
    }
    // Choices are shown as the visitor read them; a checkbox as a ticked or empty box.
    const named = (v: string) => rule.optionLabels?.[v] ?? v;
    if (rule.type === "checkbox" || rule.type === "consent") {
      lines.push(`[${value === "" ? " " : "x"}] ${rule.label}`);
      continue;
    }
    const shown = Array.isArray(value) ? value.map(named).join(", ") : named(value);
    if (shown === "" && !rule.required) continue;
    lines.push(rule.type === "textarea" ? `${rule.label}:\n${shown}` : `${rule.label}: ${shown}`);
  }
  // The two lines of the plugin's own in the page's language, like the labels; send.php writes
  // them the same way for a post without JavaScript.
  if (cfg.page) {
    const { title, slug } = cfg.page;
    lines.push("", qfText(cfg, "messagePage", { page: title ? `${title} (${slug})` : slug }));
  }
  if (key) lines.push("", qfText(cfg, "messageKey"), key);
  return lines.join("\n");
}

/* ---- Encryption: OpenPGP.js, loaded from the site only when a form needs it ---- */

interface QfPgpKey {
  getFingerprint(): string;
  isPrivate(): boolean;
  getExpirationTime(): Promise<Date | null | number>;
}

interface QfOpenpgp {
  readKey(args: { armoredKey: string }): Promise<QfPgpKey>;
  createMessage(args: { text: string }): Promise<unknown>;
  encrypt(args: { message: unknown; encryptionKeys: unknown; format?: string }): Promise<string>;
}

let qfOpenpgpPromise: Promise<QfOpenpgp> | undefined;

/**
 * The library comes from `static/quartz-forms/openpgp/`, where the emitter put it; a test may
 * hand in a module instead. One load per page, shared by every form.
 */
function qfOpenpgp(): Promise<QfOpenpgp> {
  const injected = (window as unknown as { __quartzFormsOpenpgp?: QfOpenpgp }).__quartzFormsOpenpgp;
  if (injected) return Promise.resolve(injected);
  if (!qfOpenpgpPromise) {
    const url = `${qfBasePath().replace(/\/+$/, "")}/static/quartz-forms/openpgp/openpgp.min.mjs`;
    qfOpenpgpPromise = import(/* @vite-ignore */ url).then((m) => m as QfOpenpgp);
    qfOpenpgpPromise.catch(() => {
      qfOpenpgpPromise = undefined;
    });
  }
  return qfOpenpgpPromise;
}

function qfFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/.{1,4}/g) ?? []).join(" ");
}

const qfKeyCache = new Map<string, Promise<QfPgpKey[]>>();

/** The recipient keys of a form, parsed once. */
function qfRecipientKeys(cfg: QfConfig): Promise<QfPgpKey[]> {
  const cacheKey = cfg.encryption.keys.join("\n");
  let keys = qfKeyCache.get(cacheKey);
  if (!keys) {
    keys = qfOpenpgp().then((pgp) =>
      Promise.all(cfg.encryption.keys.map((armoredKey) => pgp.readKey({ armoredKey }))),
    );
    qfKeyCache.set(cacheKey, keys);
  }
  return keys;
}

async function qfEncrypt(cfg: QfConfig, plaintext: string): Promise<string> {
  const pgp = await qfOpenpgp();
  const keys = await qfRecipientKeys(cfg);
  if (keys.length === 0) throw new Error("no keys");
  const message = await pgp.createMessage({ text: plaintext });
  return pgp.encrypt({ message, encryptionKeys: keys, format: "armored" });
}

/** Fills the fingerprint line under the form, so the visitor can compare it with the owner's. */
async function qfShowFingerprint(form: HTMLFormElement, cfg: QfConfig): Promise<void> {
  const line = form.querySelector<HTMLElement>("[data-fingerprint]");
  if (!line || !cfg.encryption.showFingerprint) return;
  try {
    const keys = await qfRecipientKeys(cfg);
    if (keys.length === 1)
      line.textContent = qfText(cfg, "encryptedFor", {
        fingerprint: qfFingerprint(keys[0]!.getFingerprint()),
      });
    else line.textContent = qfText(cfg, "encryptedForMany", { count: keys.length });
    line.hidden = false;
  } catch {
    // Nothing shown; sending will report that encryption is unavailable.
  }
}

/**
 * The visitor's own key: readable, public, not expired; then its fingerprint is shown. Returns
 * the error shown at the field, null when the key is accepted or the field is empty. Run when
 * the visitor leaves the field and again before sending: sending used to look for the public-key
 * marker only, and an expired key or a paste of public and private block went out (review
 * finding, 2026-10-19). OpenPGP.js reads the first block of such a paste and calls it public,
 * so the private marker is looked for in the text.
 *
 * Two ways to fail, two answers: a key the library cannot read is refused; a library that
 * cannot be loaded (network, content blocker, CSP) leaves the key as qfCheck saw it, markers
 * only, and the status says it went unchecked. The failed import used to read as "not a public
 * key", and a form that does not even encrypt could not be sent with a key pasted (second
 * review, price of the fixes, 2026-10-19). A form that encrypts fails later at qfEncrypt, with
 * its own sentence.
 */
async function qfCheckVisitorKey(
  form: HTMLFormElement,
  cfg: QfConfig,
  rule: QfRule,
): Promise<string | null> {
  const status = form.querySelector<HTMLElement>(
    `#${form.querySelector(`[data-field="${rule.name}"] textarea`)?.id}-status`,
  );
  const value = qfValueOf(form, rule);
  if (typeof value !== "string" || value === "") {
    if (status) status.textContent = "";
    return null;
  }
  let message: string | null = null;
  let accepted: string | null = null;
  let pgp: QfOpenpgp;
  try {
    pgp = await qfOpenpgp();
  } catch {
    qfShowError(form, rule.name, null);
    if (status) status.textContent = qfText(cfg, "keyUnchecked");
    return null;
  }
  try {
    const key = await pgp.readKey({ armoredKey: value });
    if (key.isPrivate() || /-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(value))
      message = qfText(cfg, "keyNotPublic");
    else {
      const expires = await key.getExpirationTime();
      if (expires instanceof Date && expires.getTime() < Date.now())
        message = qfText(cfg, "keyExpired");
      else
        accepted = qfText(cfg, "keyAccepted", { fingerprint: qfFingerprint(key.getFingerprint()) });
    }
  } catch {
    message = qfText(cfg, "keyInvalid");
  }
  qfShowError(form, rule.name, message);
  if (status) status.textContent = accepted ?? "";
  return message;
}

/* ---- Third-party captcha: the provider's script once per page life, one widget per form ---- */

// Both providers render implicitly only the containers that are in the DOM when their script
// runs. A page reached by Quartz' SPA navigation brings a fresh, empty container, and the script
// (re-added after Quartz patched the head) only warns that it is already loaded: no widget, no
// token, the check can never be passed (review finding 8, measured in Chrome with the Turnstile
// test key, 2026-10-19). Hence explicit rendering: the script loads once with `render=explicit`
// and `data-persist`, which Quartz keeps in the head across navigations, and every bound form
// renders its own widget and removes it with its cleanup.
const QF_CAPTCHA_SCRIPTS: Record<string, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
};

interface QfCaptchaApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
  getResponse?(widgetId?: string): string | undefined;
}

/** The widget each bound form shows, by the id its provider gave it. */
const qfCaptchaWidgets = new WeakMap<HTMLFormElement, string>();

function qfCaptchaApi(provider: string): QfCaptchaApi | undefined {
  return (window as unknown as Record<string, QfCaptchaApi | undefined>)[provider];
}

/** Resolves with the provider's API once its script has run, with null when it cannot load. */
function qfLoadCaptcha(provider: string): Promise<QfCaptchaApi | null> {
  const src = QF_CAPTCHA_SCRIPTS[provider];
  if (!src) return Promise.resolve(null);
  const loaded = qfCaptchaApi(provider);
  if (loaded) return Promise.resolve(loaded);
  return new Promise((resolve) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.persist = "";
      document.head.appendChild(script);
    }
    script.addEventListener("error", () => resolve(null));
    // After `load` the script has run and its API is there; `turnstile.ready()` is not used,
    // it throws for a script tag with async/defer (measured in Chrome, 2026-10-19).
    script.addEventListener("load", () => resolve(qfCaptchaApi(provider) ?? null));
  });
}

/** Renders the form's widget as soon as the provider is there, and removes it with the cleanup. */
function qfMountCaptcha(form: HTMLFormElement, provider: string): void {
  const container = form.querySelector<HTMLElement>(".quartz-form__captcha");
  if (!container) return;
  let gone = false;
  void qfLoadCaptcha(provider).then((api) => {
    if (!api || gone || !container.isConnected) return;
    container.replaceChildren();
    try {
      const id = api.render(container, { sitekey: container.dataset.sitekey ?? "" });
      qfCaptchaWidgets.set(form, id);
    } catch {
      // the provider refused the container; the visitor is asked to complete the check
    }
  });
  window.addCleanup(() => {
    gone = true;
    const id = qfCaptchaWidgets.get(form);
    qfCaptchaWidgets.delete(form);
    if (id === undefined) return;
    try {
      qfCaptchaApi(provider)?.remove(id);
    } catch {
      // the widget is already gone
    }
  });
}

/** The token the widget wrote into the form (both providers add a hidden field), else asked for. */
function qfCaptchaToken(form: HTMLFormElement, provider: string): string {
  const name = provider === "turnstile" ? "cf-turnstile-response" : "h-captcha-response";
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  const written = el ? String(el.value ?? "") : "";
  if (written) return written;
  const id = qfCaptchaWidgets.get(form);
  try {
    return (id !== undefined && qfCaptchaApi(provider)?.getResponse?.(id)) || "";
  } catch {
    return "";
  }
}

function qfResetCaptcha(form: HTMLFormElement, provider: string): void {
  const id = qfCaptchaWidgets.get(form);
  if (id === undefined) return;
  try {
    qfCaptchaApi(provider)?.reset(id);
  } catch {
    // the widget is not there yet
  }
}

/* ---- Proof of work for the relay: hashing in a Worker, no third party ---- */

interface QfPow {
  challenge: string;
  nonce: string;
}

function qfLeadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(b) - 24;
    break;
  }
  return bits;
}

/**
 * What the relay hands out on `GET ?challenge=<form>`: a stamp of the moment, signed by the
 * relay, and the hour's proof-of-work challenge when the form asks for one.
 */
type QfTicket = { pow?: boolean; challenge?: string; difficulty?: number; stamp?: string };
type QfTicketAt = { data: QfTicket | null; at: number };

async function qfFetchTicket(cfg: QfConfig): Promise<QfTicketAt> {
  let at = Date.now();
  try {
    const url = new URL(cfg.transport.url, window.location.toString());
    url.searchParams.set("challenge", cfg.id);
    // The relay checks the request's origin, on a GET from the Referer (a GET to the site's own
    // host carries no Origin header). A site with `Referrer-Policy: no-referrer` sends no Referer
    // either, and a relay on the site's host refused the ticket as "origin not allowed" (second
    // review, aside 1, measured in Chrome 2026-10-19). An origin-only Referer, no more than the
    // browser's default policy sends a cross-origin relay; nothing on a downgrade to http.
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      referrerPolicy: "strict-origin",
    });
    const data = (await res.json()) as QfTicket;
    // From the answer, not the request: the relay issued the stamp in between, and a wait for the
    // time trap is measured from here (qfWaitTrap).
    at = Date.now();
    return { data, at };
  } catch {
    return { data: null, at };
  }
}

/** Waits until the time trap has passed for a stamp the script fetched just now. */
async function qfWaitTrap(cfg: QfConfig, ticket: QfTicketAt): Promise<void> {
  const left = ticket.at + cfg.spam.minSeconds * 1000 - Date.now();
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
}

/** The relay's error code in a refusal, read from a copy so the caller can still read the body. */
async function qfErrorCode(response: Response): Promise<string | undefined> {
  try {
    return ((await response.clone().json()) as QfRelayResponse).error;
  } catch {
    return undefined;
  }
}

// The hashing runs in a Worker made from a Blob. The same loop on the main thread, yielding with
// setTimeout(0) after every 64 hashes, took 3 to 35 s for 16 bits in Chrome: a hash costs 2 µs,
// each pause about 5 ms, so the pauses were 40 times the work. The Worker takes 0.1 to 0.9 s
// for 16 bits and 0.1 to 1 s for 18 (review finding 18, measured in headless Chrome on a
// desktop, 2026-10-19; a phone is several times slower). Where no Worker can run (no `Worker`, a
// CSP without `blob:`), the main thread hashes and yields after 10 ms of work, not after 64
// hashes: 0.1 to 1.1 s for 16 bits, the page still at 60 fps.
//
// The nonce starts at a random prefix. The challenge is the relay's HMAC over form and hour, the
// same for every visitor of that hour, and a solver counting from 0 finds the same nonce for all
// of them (193903 for "abc123" at 16 bits, in Chrome and WebKit alike): the first visitor's post
// spent it, and every later post of the hour was refused as "already used" (second review,
// finding 1, 2026-10-19). 72 random bits per solve keep two visitors apart.
const QF_POW_WORKER = `
function bits(bytes) {
  let n = 0;
  for (const b of bytes) {
    if (b === 0) { n += 8; continue; }
    n += Math.clz32(b) - 24;
    break;
  }
  return n;
}
onmessage = async (e) => {
  try {
    const { challenge, difficulty, prefix } = e.data;
    const encoder = new TextEncoder();
    for (let n = 0; ; n++) {
      const nonce = prefix + n;
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", encoder.encode(challenge + ":" + nonce)),
      );
      if (bits(digest) >= difficulty) { postMessage(nonce); return; }
    }
  } catch {
    postMessage(null);
  }
};
`;

/** Twelve random characters of the relay's nonce alphabet and a dash: the start of a nonce. */
function qfNoncePrefix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return (
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_") + "-"
  );
}

/** The nonce from a Worker, or null when none can run here or it failed. */
function qfSolveInWorker(
  challenge: string,
  difficulty: number,
  prefix: string,
): Promise<string | null> {
  try {
    if (typeof Worker === "undefined") return Promise.resolve(null);
    const url = URL.createObjectURL(new Blob([QF_POW_WORKER], { type: "text/javascript" }));
    const worker = new Worker(url);
    return new Promise((resolve) => {
      const done = (nonce: string | null) => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(nonce);
      };
      worker.onmessage = (e: MessageEvent) => done(typeof e.data === "string" ? e.data : null);
      worker.onerror = () => done(null);
      worker.postMessage({ challenge, difficulty, prefix });
    });
  } catch {
    return Promise.resolve(null);
  }
}

/** The nonce found on the main thread, yielding after every 10 ms of hashing. */
async function qfSolveHere(challenge: string, difficulty: number, prefix: string): Promise<string> {
  const encoder = new TextEncoder();
  let since = performance.now();
  for (let n = 0; ; n++) {
    const nonce = prefix + n;
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(`${challenge}:${nonce}`)),
    );
    if (qfLeadingZeroBits(digest) >= difficulty) return nonce;
    if (performance.now() - since > 10) {
      await new Promise((r) => setTimeout(r, 0));
      since = performance.now();
    }
  }
}

/**
 * Finds a nonce whose SHA-256 over `challenge:nonce` has the required leading zero bits, in a
 * Worker where one can run. Returns nothing when the form does not ask for it.
 */
async function qfProofOfWork(cfg: QfConfig, data: QfTicket | null): Promise<QfPow | undefined> {
  if (!cfg.spam.pow || cfg.transport.kind !== "relay") return undefined;
  if (!data?.pow || !data.challenge) return undefined;
  const difficulty = data.difficulty ?? cfg.spam.powDifficulty;
  const prefix = qfNoncePrefix();
  const nonce =
    (await qfSolveInWorker(data.challenge, difficulty, prefix)) ??
    (await qfSolveHere(data.challenge, difficulty, prefix));
  return { challenge: data.challenge, nonce };
}

function qfInternalUrl(slug: string): string {
  const base = qfBasePath().replace(/\/+$/, "");
  return `${base}/${slug.replace(/^\/+/, "")}`;
}

async function qfSend(
  cfg: QfConfig,
  values: Record<string, QfValue>,
  ciphertext: string | undefined,
  captchaToken: string,
  ticket: Promise<QfTicketAt> | null,
  renew?: (ticket: QfTicketAt) => void,
): Promise<QfRelayResponse> {
  const tr = cfg.transport;
  // The stamp is the one from when the page was opened: that is the time the relay measures.
  // The challenge changes hourly, so an old ticket is fetched again for the proof of work only.
  const opened = ticket ? await ticket : null;
  let fresh = opened;
  if (cfg.spam.pow && tr.kind === "relay" && (!fresh?.data || Date.now() - fresh.at > 30 * 60_000))
    fresh = await qfFetchTicket(cfg);
  // When the ticket of the page's opening did not come (relay or network away), the one fetched
  // for the proof serves for the stamp too, and the time trap is waited out on it here: sent at
  // once, it was refused as too fast at every try. It replaces the page's ticket (`renew`).
  if (!opened?.data?.stamp && fresh?.data?.stamp && fresh !== opened) {
    renew?.(fresh);
    await qfWaitTrap(cfg, fresh);
  }
  // The page goes along in the clear only with a plaintext message; an encrypted one has it in
  // the serialized text, and the relay used to write the slug beside the armor a second time,
  // unencrypted (review finding 23, 2026-10-19).
  const page = cfg.page && !ciphertext ? cfg.page : undefined;
  const common = {
    form: cfg.id,
    lang: cfg.lang,
    ts: opened?.data?.stamp ?? fresh?.data?.stamp ?? "",
    page: page?.slug,
    pageTitle: page?.title,
    pow: await qfProofOfWork(cfg, fresh?.data ?? null),
    captcha: captchaToken || undefined,
  };
  // The demo sends nothing: what the recipient would read - the serialized text, or the armored
  // message the browser just encrypted - goes back to be shown under the form.
  if (tr.kind === "demo") return { ok: true, demo: ciphertext ?? qfSerialize(cfg, values) };
  if (tr.kind === "mailto") {
    const body = ciphertext ?? qfSerialize(cfg, values);
    const subject = cfg.subject ?? cfg.id;
    qfNavigate(
      `${tr.url}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      false,
    );
    return { ok: true };
  }
  let response: Response;
  if (tr.kind === "relay") {
    const post = (ts: string): Promise<Response> | null => {
      const payload = ciphertext
        ? { ...common, ts, encrypted: true, ciphertext }
        : { ...common, ts, encrypted: false, fields: values };
      const body = JSON.stringify(payload);
      // The relay refuses a body above the form's maxBytes with 413; said here first, in the
      // page's language, and the ciphertext never leaves the browser for nothing.
      if (new TextEncoder().encode(body).length > cfg.spam.maxBytes) return null;
      return fetch(tr.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
      });
    };
    const first = post(common.ts);
    if (!first) return { ok: false, error: "too_large" };
    response = await first;
    // A stamp the relay does not take - none, because no ticket ever came, or one older than a
    // day - used to end in "please reload the page", and the reload lost what was typed and the
    // open step (third review, M2, 2026-10-19). The relay checks the stamp before proof and
    // captcha, so neither is spent yet: the script fetches a new stamp, waits the time trap out on
    // it and sends once more; only if that fails too does the visitor read the sentence.
    if (
      response.status === 400 &&
      cfg.spam.minSeconds > 0 &&
      (await qfErrorCode(response)) === "stamp"
    ) {
      const renewed = await qfFetchTicket(cfg);
      const stamp = renewed.data?.stamp;
      if (stamp) {
        renew?.(renewed);
        await qfWaitTrap(cfg, renewed);
        response = (await post(stamp)) ?? response;
      }
    }
  } else {
    // endpoint and the service presets: flat fields the way these services expect them.
    const flat: Record<string, string> = { ...tr.extra };
    if (ciphertext) flat.message = ciphertext;
    else for (const [k, v] of Object.entries(values)) flat[k] = Array.isArray(v) ? v.join(", ") : v;
    if (cfg.subject) flat._subject = cfg.subject;
    if (cfg.page) flat._page = cfg.page.slug;
    // The services verify the widget's token themselves, under the widget's own field name.
    if (captchaToken)
      flat[cfg.spam.captcha === "turnstile" ? "cf-turnstile-response" : "h-captcha-response"] =
        captchaToken;
    if (tr.format === "form") {
      response = await fetch(tr.url, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(flat),
      });
    } else {
      response = await fetch(tr.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(flat),
      });
    }
  }
  let data: QfRelayResponse = {};
  try {
    data = (await response.json()) as QfRelayResponse;
  } catch {
    // A service that answers with HTML: judge by the status alone.
  }
  if (response.status === 429) return { ok: false, error: "rate_limited" };
  if (!response.ok)
    return {
      ok: false,
      error: data.error ?? `http_${response.status}`,
      errors: data.errors,
      message: data.message,
    };
  return { ...data, ok: data.ok !== false };
}

function qfFieldErrorText(
  cfg: QfConfig,
  rule: QfRule | undefined,
  code: string | undefined,
): string {
  switch (code) {
    case "required":
      return qfText(cfg, rule?.type === "consent" ? "consentRequired" : "required");
    case "too_long":
      return qfText(cfg, "tooLong", { max: rule?.maxLength ?? "" });
    case "not_an_option":
      return qfText(cfg, "chooseOne");
    case "malformed":
      // A value that is not a string, or a list for a field of one value: the relay's own
      // sentence, since no format of the field was missed.
      return qfText(cfg, "malformed");
    case "invalid":
      // The relay says only "invalid"; the field's type names what was wrong.
      switch (rule?.type) {
        case "email":
          return qfText(cfg, "invalidEmail");
        case "url":
          return qfText(cfg, "invalidUrl");
        case "tel":
          return qfText(cfg, "invalidTel");
        case "number":
          return qfText(cfg, "invalidNumber");
        case "date":
          return qfText(cfg, "invalidDate");
        case "pgpKey":
          return qfText(cfg, "keyInvalid");
        case "checkbox":
        case "consent":
          return qfText(cfg, "consentRequired");
        default:
          return qfText(cfg, "patternMismatch");
      }
    default:
      return qfText(cfg, "patternMismatch");
  }
}

/**
 * The relay's refusal in the page's words. The relay answers in English for the log; its
 * `message` used to be quoted inside the page's sentence ("Die Nachricht wurde nicht angenommen:
 * please wait a moment before sending", review finding 19, 2026-10-19). Every code the visitor
 * can act on has a sentence; what only the site owner can change (the relay's configuration, its
 * mail server, an origin list) is "could not be sent" to the visitor and a console warning with
 * the code for the owner. An own `endpoint` speaks the site's words and is quoted as before.
 */
function qfRefusalText(cfg: QfConfig, result: QfRelayResponse): string {
  const sentences: Record<string, string> = {
    too_fast: "tooFast",
    stamp: "reloadPage",
    pow: "proofRejected",
    captcha: "captchaFailed",
    rate_limited: "rateLimited",
    too_large: "tooLarge",
  };
  const key = sentences[result.error ?? ""];
  if (key) return qfText(cfg, key);
  if (cfg.transport.kind !== "relay" && result.message)
    return qfText(cfg, "rejected", { reason: result.message });
  if (result.error || result.message || result.errors) {
    const fields = (result.errors ?? []).map((e) => `${e.field ?? "?"}: ${e.code ?? "?"}`);
    console.warn(
      `quartz-forms: the relay refused form "${cfg.id}" with ${result.error ?? "no code"}` +
        (result.message ? ` (${result.message})` : "") +
        (fields.length ? `; fields ${fields.join(", ")}` : ""),
    );
  }
  return qfText(cfg, "sendFailed");
}

function qfFinish(form: HTMLFormElement, cfg: QfConfig, encrypted: boolean, demo?: string): void {
  if (demo === undefined && cfg.success.mode === "redirect" && cfg.success.slug) {
    qfNavigate(qfInternalUrl(cfg.success.slug), true);
    return;
  }
  const text =
    cfg.success.text ||
    qfText(
      cfg,
      demo === undefined
        ? encrypted
          ? "sentEncrypted"
          : "sent"
        : encrypted
          ? "demoSentEncrypted"
          : "demoSent",
    );
  // Only what shows now is hidden, so that the demo can show exactly that again.
  const hidden: HTMLElement[] = [];
  for (const el of Array.from(form.children) as HTMLElement[]) {
    if (el.classList.contains("quartz-form__title") || el.classList.contains("quartz-form__status"))
      continue;
    if (el.hidden || el.tagName === "SCRIPT") continue;
    el.hidden = true;
    hidden.push(el);
  }
  form.dataset.state = "sent";
  qfStatus(form, "success", text);
  if (demo !== undefined) qfShowDemo(form, cfg, demo, encrypted, hidden);
}

/**
 * The demo's result under the status: the message as the recipient would read it, and a button
 * that brings the form back with what was typed, to try it once more.
 */
function qfShowDemo(
  form: HTMLFormElement,
  cfg: QfConfig,
  demo: string,
  encrypted: boolean,
  hidden: HTMLElement[],
) {
  const output = document.createElement("pre");
  // The armor's lines are its own and keep their breaks; the plain text wraps like the textarea.
  output.className = encrypted
    ? "quartz-form__demo quartz-form__demo--armored"
    : "quartz-form__demo";
  // A scrolling region has to be reachable by keyboard.
  output.tabIndex = 0;
  output.textContent = demo;
  const again = document.createElement("button");
  again.type = "button";
  again.className = "quartz-form__button quartz-form__button--secondary quartz-form__demo-again";
  again.textContent = qfText(cfg, "demoAgain");
  const status = form.querySelector(".quartz-form__status");
  if (status) status.after(output, again);
  else form.append(output, again);
  const onAgain = () => {
    again.removeEventListener("click", onAgain);
    output.remove();
    again.remove();
    for (const el of hidden) el.hidden = false;
    delete form.dataset.state;
    qfStatus(form, "", "");
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) {
      button.disabled = false;
      button.focus();
    }
  };
  again.addEventListener("click", onAgain);
  window.addCleanup(() => again.removeEventListener("click", onAgain));
}

/* ---- Steps: a form with page breaks, one step at a time ---- */

interface QfStepper {
  /** Shows the open step again after a value changed: which steps count, which buttons show. */
  refresh(): void;
  /** Whether the open step is the last one that counts, where the form is sent. */
  isLast(): boolean;
  /** Opens the step that holds a field (the first one with an error). */
  reveal(name: string): void;
  /** Checks the open step's fields and opens the next step that counts; false when it refused. */
  next(): Promise<boolean>;
  back(): void;
}

/**
 * Without the script every step shows, one after the other. With it one step is open: "Next"
 * checks only that step's fields, a step none of whose fields count (its own condition, or the
 * ones of all its fields, do not hold) is passed over both ways, and the count "Step 2 of 4"
 * counts the steps that count now. What belongs to sending (encryption, captcha, the submit
 * button, all marked `data-qf-later`) shows with the last step; `onLast` runs when it first opens.
 */
function qfStepper(
  form: HTMLFormElement,
  cfg: QfConfig,
  check: (only: Set<string>) => Promise<QfProblem[]>,
  onLast: () => void,
): QfStepper | null {
  const steps = cfg.steps;
  if (!steps || steps.length < 2) return null;
  const boxes = steps.map((_, i) =>
    form.querySelector<HTMLElement>(`.quartz-form__step[data-step="${i}"]`),
  );
  const progress = form.querySelector<HTMLElement>(".quartz-form__progress");
  const backButton = form.querySelector<HTMLButtonElement>("button[data-step-back]");
  const nextButton = form.querySelector<HTMLButtonElement>("button[data-step-next]");
  let current = 0;
  let reachedLast = false;

  // Steps that count: the first, the open one, and every one with a field that counts and shows.
  const counting = (): number[] => {
    const active = qfActive(cfg, qfValuesOf(form, cfg));
    const shown = new Set(cfg.fields.filter((r) => r.type !== "hidden").map((r) => r.name));
    return steps
      .map((step, i) =>
        i === 0 || i === current || step.fields.some((n) => active.has(n) && shown.has(n)) ? i : -1,
      )
      .filter((i) => i >= 0);
  };

  const refresh = () => {
    const list = counting();
    const last = list[list.length - 1] === current;
    boxes.forEach((box, i) => {
      if (box) box.hidden = i !== current;
    });
    if (progress) {
      const title = steps[current]?.title;
      // With the other steps skipped there is nothing to count ("Step 1 of 1", third review,
      // aside, 2026-10-19); emptied, so the count is said again when a step comes back.
      const text =
        list.length < 2
          ? ""
          : qfText(cfg, title ? "stepOfTitled" : "stepOf", {
              current: list.indexOf(current) + 1,
              total: list.length,
              title: title ?? "",
            });
      progress.hidden = text === "";
      // The count is a live region: said when it changes, not on every keystroke.
      if (progress.textContent !== text) progress.textContent = text;
    }
    if (backButton) backButton.hidden = current === list[0];
    if (nextButton) nextButton.hidden = last;
    form.dataset.qfStep = last ? "last" : "middle";
    if (last && !reachedLast) {
      reachedLast = true;
      onLast();
    }
  };

  // After a step changes, the visitor lands on its heading, or on its first field without one.
  const focusStep = () => {
    const box = boxes[current];
    if (!box) return;
    const heading = box.querySelector<HTMLElement>(".quartz-form__step-title");
    if (heading) return heading.focus();
    const control = Array.from(
      box.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea, button"),
    ).find((el) => !el.closest("[hidden]"));
    control?.focus();
  };

  const open = (index: number) => {
    if (index === current) return;
    current = index;
    qfStatus(form, "", "");
    refresh();
    focusStep();
  };

  let busy = false;
  const next = async (): Promise<boolean> => {
    if (busy) return false;
    busy = true;
    try {
      const problems = await check(new Set(steps[current]?.fields ?? []));
      if (problems.length > 0) {
        qfErrorSummary(form, cfg, problems);
        qfFocusFirst(form, problems);
        return false;
      }
      const following = counting().find((i) => i > current);
      if (following !== undefined) open(following);
      return true;
    } finally {
      busy = false;
    }
  };

  const back = () => {
    const before = counting().filter((i) => i < current);
    const previous = before[before.length - 1];
    if (previous !== undefined) open(previous);
  };

  const reveal = (name: string) => {
    const index = steps.findIndex((step) => step.fields.includes(name));
    if (index < 0 || index === current) return;
    current = index;
    refresh();
  };

  const onNext = () => void next();
  nextButton?.addEventListener("click", onNext);
  backButton?.addEventListener("click", back);
  window.addCleanup(() => {
    nextButton?.removeEventListener("click", onNext);
    backButton?.removeEventListener("click", back);
  });
  refresh();
  return {
    refresh,
    isLast: () => form.dataset.qfStep === "last",
    reveal,
    next,
    back,
  };
}

function qfBind(form: HTMLFormElement): void {
  if (form.dataset.qfBound === "1") return;
  const cfg = qfReadConfig(form);
  if (!cfg) return;
  form.dataset.qfBound = "1";
  form.noValidate = true;

  const ts = form.elements.namedItem("ts") as HTMLInputElement | null;
  const openedAt = Date.now();
  if (ts) ts.value = String(openedAt);
  // The relay's ticket, fetched once per page view where the relay will check it: the signed
  // stamp of this moment for the time trap, and the proof-of-work challenge. The visitor's clock
  // is not involved; the relay measures with its own (review finding, 2026-10-19).
  let ticket =
    cfg.transport.kind === "relay" && (cfg.spam.minSeconds > 0 || cfg.spam.pow)
      ? qfFetchTicket(cfg)
      : null;

  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button?.dataset.enableWithJs === "true") button.disabled = false;
  // The "send encrypted" box of an optional form: ticked only now that encrypting is possible.
  const encryptToggle = form.elements.namedItem(QF_ENCRYPT_TOGGLE) as HTMLInputElement | null;
  if (encryptToggle?.dataset.enableWithJs === "true") {
    encryptToggle.disabled = false;
    encryptToggle.checked = true;
  }
  if (cfg.encryption.mode !== "off") void qfShowFingerprint(form, cfg);
  const captcha = cfg.spam.captcha !== "none" && !cfg.anonymous ? cfg.spam.captcha : null;

  const onBlur = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const name = target?.getAttribute("name");
    const rule = name ? cfg.fields.find((r) => r.name === name) : undefined;
    if (!rule || rule.type === "hidden") return;
    if (!qfActive(cfg, qfValuesOf(form, cfg)).has(rule.name)) return;
    if (rule.type === "pgpKey") return void qfCheckVisitorKey(form, cfg, rule);
    // Only report after the visitor has written something or left a required field empty.
    const value = qfValueOf(form, rule);
    const empty = Array.isArray(value) ? value.length === 0 : value === "";
    if (empty && !rule.required) return qfShowError(form, rule.name, null);
    qfShowError(form, rule.name, qfCheck(cfg, rule, value));
  };
  form.addEventListener("focusout", onBlur);
  window.addCleanup(() => form.removeEventListener("focusout", onBlur));

  const keyRule = cfg.fields.find((r) => r.type === "pgpKey");
  // The fields' own check, of all of them or of one step's; then the visitor's key, if it counts.
  const check = async (only?: Set<string>): Promise<QfProblem[]> => {
    const problems = qfValidate(form, cfg, only);
    if (
      problems.length === 0 &&
      keyRule &&
      (!only || only.has(keyRule.name)) &&
      qfValueOf(form, keyRule) !== "" &&
      qfActive(cfg, qfValuesOf(form, cfg)).has(keyRule.name)
    ) {
      const message = await qfCheckVisitorKey(form, cfg, keyRule);
      if (message) problems.push({ name: keyRule.name, message });
    }
    return problems;
  };

  // A form with page breaks shows one step at a time; its captcha renders when the last step
  // first opens (a widget rendered out of sight is sized for nothing), the others' at once.
  const stepper = qfStepper(form, cfg, check, () => {
    if (captcha) qfMountCaptcha(form, captcha);
  });
  if (!stepper && captcha) qfMountCaptcha(form, captcha);

  // Conditional fields: shown and hidden as the fields they depend on change; so are the steps
  // that count, and with them "Next" or "Submit".
  if (cfg.fields.some((r) => r.when)) {
    qfApplyConditions(form, cfg);
    const onChange = () => {
      qfApplyConditions(form, cfg);
      stepper?.refresh();
    };
    form.addEventListener("change", onChange);
    form.addEventListener("input", onChange);
    window.addCleanup(() => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("input", onChange);
    });
  }

  let busy = false;
  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    // Return in a field of a step before the last one goes on, it does not send.
    if (stepper && !stepper.isLast()) return void stepper.next();

    // The visitor's key is parsed, which takes a moment: no second submit meanwhile.
    busy = true;
    let problems: QfProblem[];
    try {
      problems = await check();
    } finally {
      busy = false;
    }
    if (problems.length > 0) {
      stepper?.reveal(problems[0]!.name);
      qfErrorSummary(form, cfg, problems);
      qfFocusFirst(form, problems);
      return;
    }

    // Honeypot: a filled field means a bot; it is told "sent" and nothing leaves the page.
    const hp = form.elements.namedItem(QF_HONEYPOT) as HTMLInputElement | null;
    if (cfg.spam.honeypot && hp && hp.value !== "") {
      qfFinish(form, cfg, false);
      return;
    }
    if (cfg.spam.minSeconds > 0 && Date.now() - openedAt < cfg.spam.minSeconds * 1000) {
      qfStatus(form, "error", qfText(cfg, "tooFast"));
      return;
    }

    let captchaToken = "";
    if (cfg.spam.captcha !== "none" && !cfg.anonymous) {
      captchaToken = qfCaptchaToken(form, cfg.spam.captcha);
      if (!captchaToken) {
        qfStatus(form, "error", qfText(cfg, "captchaRequired"));
        return;
      }
    }

    // Only what counts goes out: a field whose condition does not hold is neither sent nor
    // encrypted (the relay would drop it anyway; mailto and the services would not).
    const all = qfValuesOf(form, cfg);
    const active = qfActive(cfg, all);
    const values: Record<string, QfValue> = {};
    for (const rule of cfg.fields) if (active.has(rule.name)) values[rule.name] = all[rule.name]!;

    const toggle = form.elements.namedItem(QF_ENCRYPT_TOGGLE) as HTMLInputElement | null;
    const encrypt =
      cfg.encryption.mode === "required" ||
      (cfg.encryption.mode === "optional" && !!toggle?.checked);

    busy = true;
    if (button) button.disabled = true;
    qfStatus(form, "info", qfText(cfg, "sending"));
    try {
      let ciphertext: string | undefined;
      if (encrypt) {
        try {
          ciphertext = await qfEncrypt(cfg, qfSerialize(cfg, values));
        } catch {
          qfStatus(form, "error", qfText(cfg, "encryptionUnavailable"));
          return;
        }
      }
      const result = await qfSend(cfg, values, ciphertext, captchaToken, ticket, (renewed) => {
        ticket = Promise.resolve(renewed);
      });
      if (!result.ok && cfg.spam.captcha !== "none") qfResetCaptcha(form, cfg.spam.captcha);
      if (result.ok) {
        qfFinish(form, cfg, encrypt, result.demo);
        return;
      }
      // Errors at fields the visitor can correct. A field this page does not have, or one the
      // relay does not know (`unknown_field`: the site and config.generated.php drifted apart),
      // is nothing the visitor can fix, so it is said below as "could not be sent" and named in
      // the console, where the site owner looks. Skipping those used to leave an empty list and
      // the summary "please check 0 fields" (review finding 19, 2026-10-19).
      const problems: QfProblem[] = [];
      for (const e of result.errors ?? []) {
        const rule = cfg.fields.find((r) => r.name === e.field);
        if (!rule || e.code === "unknown_field") continue;
        const message =
          e.message && !cfg.texts[e.code ?? ""] && cfg.transport.kind !== "relay"
            ? e.message
            : qfFieldErrorText(cfg, rule, e.code);
        qfShowError(form, rule.name, message);
        problems.push({ name: rule.name, message });
      }
      if (problems.length > 0) {
        stepper?.reveal(problems[0]!.name);
        qfErrorSummary(form, cfg, problems);
        qfFocusFirst(form, problems);
        return;
      }
      qfStatus(form, "error", qfRefusalText(cfg, result));
    } catch {
      qfStatus(form, "error", qfText(cfg, "sendFailed"));
    } finally {
      busy = false;
      if (button && form.dataset.state !== "sent") button.disabled = false;
    }
  };
  form.addEventListener("submit", onSubmit);
  // The flag only guards against binding twice within one page load (the stylesheet and the
  // script travel with the transformer and the component alike); a cleanup frees the form again.
  window.addCleanup(() => {
    form.removeEventListener("submit", onSubmit);
    delete form.dataset.qfBound;
  });

  // The visitor's key file: read into the textarea, which is what gets validated and sent.
  const fileInput = form.elements.namedItem(QF_KEY_FILE) as HTMLInputElement | null;
  if (fileInput && keyRule) {
    const onFile = () => {
      const file = fileInput.files?.[0];
      const area = form.elements.namedItem(keyRule.name) as HTMLTextAreaElement | null;
      if (!file || !area) return;
      const reader = new FileReader();
      reader.onload = () => {
        area.value = String(reader.result ?? "");
        area.dispatchEvent(new Event("input", { bubbles: true }));
        void qfCheckVisitorKey(form, cfg, keyRule);
      };
      reader.readAsText(file);
    };
    fileInput.addEventListener("change", onFile);
    window.addCleanup(() => fileInput.removeEventListener("change", onFile));
  }
}

function qfSetup(): void {
  for (const form of document.querySelectorAll<HTMLFormElement>("form.quartz-form[data-form]"))
    qfBind(form);
}

document.addEventListener("nav", qfSetup);
