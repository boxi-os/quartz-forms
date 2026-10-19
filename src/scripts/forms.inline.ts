// Browser script of quartz-forms. Runs on every `nav` event (Quartz's SPA router); every
// listener is paired with `window.addCleanup`. Must stay a plain script: no `export`, no
// `declare global` (the build strips `export` statements and inlines the file into a <script>).
//
// Validation level 2 of three: the rules come from the JSON the renderer wrote into each form
// (`.quartz-form-config`), which it derived from the form definition. Nothing here invents a rule.

interface QfRule {
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
  transport: { kind: string; url: string; format: "json" | "form"; extra: Record<string, string> };
  recipient?: string;
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
// and was refused there).
const QF_EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;
const QF_URL = /^https?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/iu;
const QF_TEL = /^\+?[0-9 ()./-]{5,}$/;
const QF_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** One field against its rule; `null` when it passes. Mirrors what the relay checks. */
function qfCheck(cfg: QfConfig, rule: QfRule, value: QfValue): string | null {
  const t = (key: string, values?: Record<string, string | number>) => qfText(cfg, key, values);
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
      const n = Number(value.replace(",", "."));
      if (!Number.isFinite(n)) return t("invalidNumber");
      if (rule.min !== undefined && n < rule.min) return t("belowMin", { min: rule.min });
      if (rule.max !== undefined && n > rule.max) return t("aboveMax", { max: rule.max });
      break;
    }
    case "date":
      if (!QF_DATE.test(value) || Number.isNaN(Date.parse(value))) return t("invalidDate");
      break;
    case "scale": {
      const n = Number(value);
      if (
        !Number.isInteger(n) ||
        (rule.min !== undefined && n < rule.min) ||
        (rule.max !== undefined && n > rule.max)
      )
        return t("chooseOne");
      break;
    }
    case "select":
    case "radio":
      if (rule.options && !rule.options.includes(value)) return t("chooseOne");
      break;
    case "pgpKey":
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

function qfValidate(form: HTMLFormElement, cfg: QfConfig): QfProblem[] {
  const problems: QfProblem[] = [];
  for (const rule of cfg.fields) {
    if (rule.type === "hidden") continue;
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
  if (cfg.page) lines.push("", `Page: ${cfg.page.title} (${cfg.page.slug})`);
  if (key) lines.push("", "Public key of the sender:", key);
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

/** The visitor's own key: readable, public, not expired; then its fingerprint is shown. */
async function qfCheckVisitorKey(
  form: HTMLFormElement,
  cfg: QfConfig,
  rule: QfRule,
): Promise<void> {
  const status = form.querySelector<HTMLElement>(
    `#${form.querySelector(`[data-field="${rule.name}"] textarea`)?.id}-status`,
  );
  const value = qfValueOf(form, rule);
  if (typeof value !== "string" || value === "") {
    if (status) status.textContent = "";
    return;
  }
  let message: string | null = null;
  let accepted: string | null = null;
  try {
    const pgp = await qfOpenpgp();
    const key = await pgp.readKey({ armoredKey: value });
    if (key.isPrivate()) message = qfText(cfg, "keyNotPublic");
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

/* ---- Proof of work for the relay: a few hundred milliseconds of hashing, no third party ---- */

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
  const at = Date.now();
  try {
    const url = new URL(cfg.transport.url, window.location.toString());
    url.searchParams.set("challenge", cfg.id);
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    return { data: (await res.json()) as QfTicket, at };
  } catch {
    return { data: null, at };
  }
}

/**
 * Finds a nonce whose SHA-256 over `challenge:nonce` has the required leading zero bits. Hashes
 * in batches and yields between them so the page stays responsive. Returns nothing when the
 * form does not ask for it.
 */
async function qfProofOfWork(cfg: QfConfig, data: QfTicket | null): Promise<QfPow | undefined> {
  if (!cfg.spam.pow || cfg.transport.kind !== "relay") return undefined;
  if (!data?.pow || !data.challenge) return undefined;
  const difficulty = data.difficulty ?? cfg.spam.powDifficulty;
  const encoder = new TextEncoder();
  let nonce = 0;
  for (;;) {
    for (let i = 0; i < 64; i++, nonce++) {
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", encoder.encode(`${data.challenge}:${nonce}`)),
      );
      if (qfLeadingZeroBits(digest) >= difficulty)
        return { challenge: data.challenge, nonce: String(nonce) };
    }
    await new Promise((r) => setTimeout(r, 0));
  }
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
): Promise<QfRelayResponse> {
  const tr = cfg.transport;
  // The stamp is the one from when the page was opened: that is the time the relay measures.
  // The challenge changes hourly, so an old ticket is fetched again for the proof of work only.
  const opened = ticket ? await ticket : null;
  let fresh = opened;
  if (cfg.spam.pow && tr.kind === "relay" && (!fresh?.data || Date.now() - fresh.at > 30 * 60_000))
    fresh = await qfFetchTicket(cfg);
  const common = {
    form: cfg.id,
    lang: cfg.lang,
    ts: opened?.data?.stamp ?? fresh?.data?.stamp ?? "",
    page: cfg.page?.slug,
    pow: await qfProofOfWork(cfg, fresh?.data ?? null),
    captcha: captchaToken || undefined,
  };
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
    const payload = ciphertext
      ? { ...common, encrypted: true, ciphertext }
      : { ...common, encrypted: false, fields: values };
    const body = JSON.stringify(payload);
    // The relay refuses a body above the form's maxBytes with 413; said here first, in the
    // page's language, and the ciphertext never leaves the browser for nothing.
    if (new TextEncoder().encode(body).length > cfg.spam.maxBytes)
      return { ok: false, error: "too_large" };
    response = await fetch(tr.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
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

function qfFinish(form: HTMLFormElement, cfg: QfConfig, encrypted: boolean): void {
  if (cfg.success.mode === "redirect" && cfg.success.slug) {
    qfNavigate(qfInternalUrl(cfg.success.slug), true);
    return;
  }
  const text = cfg.success.text || qfText(cfg, encrypted ? "sentEncrypted" : "sent");
  for (const el of Array.from(form.children)) {
    if (el.classList.contains("quartz-form__title") || el.classList.contains("quartz-form__status"))
      continue;
    (el as HTMLElement).hidden = true;
  }
  form.dataset.state = "sent";
  qfStatus(form, "success", text);
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
  const ticket =
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
  if (cfg.spam.captcha !== "none" && !cfg.anonymous) qfMountCaptcha(form, cfg.spam.captcha);

  const onBlur = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const name = target?.getAttribute("name");
    const rule = name ? cfg.fields.find((r) => r.name === name) : undefined;
    if (!rule || rule.type === "hidden") return;
    if (rule.type === "pgpKey") return void qfCheckVisitorKey(form, cfg, rule);
    // Only report after the visitor has written something or left a required field empty.
    const value = qfValueOf(form, rule);
    const empty = Array.isArray(value) ? value.length === 0 : value === "";
    if (empty && !rule.required) return qfShowError(form, rule.name, null);
    qfShowError(form, rule.name, qfCheck(cfg, rule, value));
  };
  form.addEventListener("focusout", onBlur);
  window.addCleanup(() => form.removeEventListener("focusout", onBlur));

  let busy = false;
  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;

    const problems = qfValidate(form, cfg);
    if (problems.length > 0) {
      qfStatus(
        form,
        "error",
        problems.length === 1
          ? qfText(cfg, "errorSummaryOne")
          : qfText(cfg, "errorSummary", { count: problems.length }),
      );
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

    const values: Record<string, QfValue> = {};
    for (const rule of cfg.fields) values[rule.name] = qfValueOf(form, rule);

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
      const result = await qfSend(cfg, values, ciphertext, captchaToken, ticket);
      if (!result.ok && cfg.spam.captcha !== "none") qfResetCaptcha(form, cfg.spam.captcha);
      if (result.ok) {
        qfFinish(form, cfg, encrypt);
        return;
      }
      if (result.errors && result.errors.length > 0) {
        const problems: QfProblem[] = [];
        for (const e of result.errors) {
          const rule = cfg.fields.find((r) => r.name === e.field);
          if (!rule) continue;
          const message =
            e.message && !cfg.texts[e.code ?? ""] && cfg.transport.kind !== "relay"
              ? e.message
              : qfFieldErrorText(cfg, rule, e.code);
          qfShowError(form, rule.name, message);
          problems.push({ name: rule.name, message });
        }
        qfStatus(
          form,
          "error",
          problems.length === 1
            ? qfText(cfg, "errorSummaryOne")
            : qfText(cfg, "errorSummary", { count: problems.length }),
        );
        qfFocusFirst(form, problems);
        return;
      }
      if (result.error === "rate_limited") qfStatus(form, "error", qfText(cfg, "rateLimited"));
      else if (result.error === "too_large") qfStatus(form, "error", qfText(cfg, "tooLarge"));
      else if (result.message)
        qfStatus(form, "error", qfText(cfg, "rejected", { reason: result.message }));
      else qfStatus(form, "error", qfText(cfg, "sendFailed"));
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
  const keyRule = cfg.fields.find((r) => r.type === "pgpKey");
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
