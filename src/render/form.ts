import { h } from "hastscript";
import type { Element, ElementContent } from "hast";
import type {
  ChoiceField,
  ConsentField,
  FormField,
  InputField,
  PgpKeyField,
  ResolvedForm,
  ScaleField,
  Text,
  TransportConfig,
  TransportKind,
} from "../types";
import { interpolate, resolveText } from "../text";
import type { RenderContext } from "./context";

/** Name of the honeypot field; starts with `_`, which no author's field may. */
export const HONEYPOT_NAME = "_hp_website";
/** Name of the checkbox that lets the visitor switch encryption off (`optional` mode). */
export const ENCRYPT_TOGGLE_NAME = "_encrypt";
/** Name of the file input next to a `pgpKey` field; the key text goes into the field itself. */
export const KEY_FILE_NAME = "_key_file";

type Child = ElementContent | string | null | undefined | false;

const text = (value: string): ElementContent => ({ type: "text", value });

function clean(children: Child[]): ElementContent[] {
  const out: ElementContent[] = [];
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    out.push(typeof c === "string" ? text(c) : c);
  }
  return out;
}

/** The preset URLs of the form services; `url` holds the id or key the service hands out. */
export function endpointOf(transport: TransportConfig, recipient: string | undefined): string {
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

/** The transports that take `extra` fields: an endpoint and the services, as flat fields. */
const QF_TAKES_EXTRA = new Set<TransportKind>(["endpoint", "formspree", "web3forms"]);

/**
 * Hidden inputs a service wants with every submission (the no-JavaScript path sends them too).
 * The relay knows the form's fields alone and the script never sent `extra` to it, but the hidden
 * inputs went with every plain post, which the relay refused as unknown_field (review finding
 * 22, 2026-10-19); a mailto form wrote them into the mail body. Neither gets them now.
 */
export function presetFields(form: ResolvedForm): Record<string, string> {
  const tr = form.transport;
  const fields: Record<string, string> = QF_TAKES_EXTRA.has(tr.kind) ? { ...(tr.extra ?? {}) } : {};
  if (tr.kind === "web3forms" && tr.url) fields.access_key = tr.url;
  return fields;
}

function requiredMark(ctx: RenderContext): ElementContent[] {
  return [
    h("span", { className: ["quartz-form__required"], ariaHidden: "true" }, " *"),
    h("span", { className: ["quartz-form__sr-only"] }, ` (${ctx.t.requiredMark})`),
  ];
}

function label(
  ctx: RenderContext,
  forId: string,
  value: Text,
  required: boolean | undefined,
): Element {
  return h("label", { className: ["quartz-form__label"], for: forId }, [
    text(resolveText(value, ctx.lang) ?? ""),
    ...(required ? requiredMark(ctx) : []),
  ]);
}

function legend(ctx: RenderContext, value: Text, required: boolean | undefined): Element {
  return h("legend", { className: ["quartz-form__label"] }, [
    text(resolveText(value, ctx.lang) ?? ""),
    ...(required ? requiredMark(ctx) : []),
  ]);
}

function hintAndError(ctx: RenderContext, id: string, hint: Text | undefined): ElementContent[] {
  const out: ElementContent[] = [];
  const hintText = resolveText(hint, ctx.lang);
  if (hintText) out.push(h("p", { className: ["quartz-form__hint"], id: `${id}-hint` }, hintText));
  out.push(h("p", { className: ["quartz-form__error"], id: `${id}-error`, hidden: true }));
  return out;
}

function describedBy(id: string, hint: Text | undefined): string {
  return hint !== undefined ? `${id}-hint ${id}-error` : `${id}-error`;
}

function fieldWrapper(field: FormField, children: Child[]): Element {
  return h(
    "div",
    {
      className: ["quartz-form__field", `quartz-form__field--${field.type}`],
      dataField: field.name,
    },
    clean(children),
  );
}

function renderInput(field: InputField, ctx: RenderContext, maxLength: number): Element {
  const id = `${ctx.idPrefix}-${field.name}`;
  const common = {
    id,
    name: field.name,
    required: field.required ? true : undefined,
    ariaRequired: field.required ? "true" : undefined,
    ariaDescribedby: describedBy(id, field.hint),
    placeholder: resolveText(field.placeholder, ctx.lang),
    autocomplete: field.autocomplete,
    maxlength: field.maxLength ?? maxLength,
  };
  const control =
    field.type === "textarea"
      ? h("textarea", { ...common, rows: field.rows ?? 6 })
      : h("input", {
          ...common,
          type: field.type,
          pattern: field.pattern,
          min: field.min,
          max: field.max,
          step: field.step,
          inputmode: field.type === "number" ? "decimal" : undefined,
        });
  return fieldWrapper(field, [
    label(ctx, id, field.label, field.required),
    control,
    ...hintAndError(ctx, id, field.hint),
  ]);
}

function renderChoice(field: ChoiceField, ctx: RenderContext): Element {
  const id = `${ctx.idPrefix}-${field.name}`;
  if (field.type === "select") {
    return fieldWrapper(field, [
      label(ctx, id, field.label, field.required),
      h(
        "select",
        {
          id,
          name: field.name,
          required: field.required ? true : undefined,
          ariaRequired: field.required ? "true" : undefined,
          ariaDescribedby: describedBy(id, field.hint),
        },
        [
          h(
            "option",
            { value: "", selected: true, disabled: field.required ? true : undefined },
            ctx.t.selectPlaceholder,
          ),
          ...field.options.map((o) =>
            h("option", { value: o.value }, resolveText(o.label, ctx.lang) ?? o.value),
          ),
        ],
      ),
      ...hintAndError(ctx, id, field.hint),
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
        dataRequired: field.required ? "true" : undefined,
        dataMinimum: field.required ? "1" : undefined,
      },
      [
        legend(ctx, field.label, field.required),
        ...field.options.map((o, i) =>
          h("div", { className: ["quartz-form__option"] }, [
            h("input", {
              type,
              id: `${id}-${i}`,
              name: field.name,
              value: o.value,
              required: type === "radio" && field.required ? true : undefined,
            }),
            h("label", { for: `${id}-${i}` }, resolveText(o.label, ctx.lang) ?? o.value),
          ]),
        ),
      ],
    ),
    ...hintAndError(ctx, id, field.hint),
  ]);
}

function renderScale(field: ScaleField, ctx: RenderContext): Element {
  const id = `${ctx.idPrefix}-${field.name}`;
  const steps: ElementContent[] = [];
  for (let v = field.min; v <= field.max; v++) {
    steps.push(
      h("div", { className: ["quartz-form__scale-step"] }, [
        h("input", {
          type: "radio",
          id: `${id}-${v}`,
          name: field.name,
          value: String(v),
          required: field.required ? true : undefined,
        }),
        h("label", { for: `${id}-${v}` }, String(v)),
      ]),
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
        dataRequired: field.required ? "true" : undefined,
      },
      [
        legend(ctx, field.label, field.required),
        h(
          "div",
          { className: ["quartz-form__scale-row"] },
          [
            minLabel ? h("span", { className: ["quartz-form__scale-caption"] }, minLabel) : null,
            h("div", { className: ["quartz-form__scale-steps"] }, steps),
            maxLabel ? h("span", { className: ["quartz-form__scale-caption"] }, maxLabel) : null,
          ].filter((x): x is Element => x !== null),
        ),
      ],
    ),
    ...hintAndError(ctx, id, field.hint),
  ]);
}

function renderCheckbox(field: FormField & { type: "checkbox" }, ctx: RenderContext): Element {
  const id = `${ctx.idPrefix}-${field.name}`;
  return fieldWrapper(field, [
    h("div", { className: ["quartz-form__option"] }, [
      h("input", {
        type: "checkbox",
        id,
        name: field.name,
        value: "yes",
        required: field.required ? true : undefined,
        ariaDescribedby: describedBy(id, field.hint),
      }),
      label(ctx, id, field.label, field.required),
    ]),
    ...hintAndError(ctx, id, field.hint),
  ]);
}

function renderConsent(field: ConsentField, ctx: RenderContext): Element {
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
        ariaDescribedby: `${id}-error`,
      }),
      h("label", { className: ["quartz-form__label"], for: id }, [
        text(sentence),
        ...(field.link
          ? [
              text(" "),
              h("a", { href: field.link, target: "_blank", rel: ["noopener"] }, linkLabel),
            ]
          : []),
        ...requiredMark(ctx),
      ]),
    ]),
    ...hintAndError(ctx, id, undefined),
  ]);
}

function renderPgpKey(field: PgpKeyField, ctx: RenderContext, maxLength: number): Element {
  const id = `${ctx.idPrefix}-${field.name}`;
  return fieldWrapper(field, [
    label(ctx, id, field.label, field.required),
    h("div", { className: ["quartz-form__key"] }, [
      h("label", { className: ["quartz-form__key-file"], for: `${id}-file` }, [
        h(
          "span",
          { className: ["quartz-form__button", "quartz-form__button--secondary"] },
          ctx.t.keyChooseFile,
        ),
        h("input", {
          type: "file",
          id: `${id}-file`,
          name: KEY_FILE_NAME,
          accept: ".asc,.gpg,.pgp,.txt,application/pgp-keys",
          className: ["quartz-form__sr-only"],
        }),
      ]),
      h("textarea", {
        id,
        name: field.name,
        rows: 4,
        required: field.required ? true : undefined,
        ariaRequired: field.required ? "true" : undefined,
        ariaDescribedby: describedBy(id, field.hint ?? ctx.t.keyPaste),
        placeholder: "-----BEGIN PGP PUBLIC KEY BLOCK-----",
        maxlength: maxLength,
        spellcheck: "false",
        dataPgpKey: "true",
      }),
      h("p", { className: ["quartz-form__key-status"], id: `${id}-status`, role: "status" }),
    ]),
    ...hintAndError(ctx, id, field.hint ?? ctx.t.keyPaste),
  ]);
}

export function renderField(field: FormField, form: ResolvedForm, ctx: RenderContext): Element {
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

/** What the browser script needs; written into the form as JSON. */
export interface ClientFieldRule {
  name: string;
  type: FormField["type"];
  label: string;
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  /** Label per option value, in the page language, for the message the recipient reads. */
  optionLabels?: Record<string, string>;
}

export interface ClientConfig {
  id: string;
  lang: string;
  fields: ClientFieldRule[];
  transport: {
    kind: TransportConfig["kind"];
    url: string;
    format: "json" | "form";
    extra: Record<string, string>;
  };
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
  encryption: {
    mode: ResolvedForm["encryption"]["mode"];
    keys: string[];
    showFingerprint: boolean;
  };
  anonymous: boolean;
  page?: { title: string; slug: string };
  success: { mode: "inline" | "redirect"; text: string; slug?: string };
  texts: Record<string, string>;
}

export function clientConfig(form: ResolvedForm, ctx: RenderContext): ClientConfig {
  const t = ctx.t;
  const fields: ClientFieldRule[] = form.fields.map((f) => {
    const rule: ClientFieldRule = {
      name: f.name,
      type: f.type,
      label:
        f.type === "consent"
          ? (resolveText(f.text, ctx.lang) ?? f.name)
          : f.type === "hidden"
            ? f.name
            : (resolveText(f.label, ctx.lang) ?? f.name),
      required: f.type === "consent" ? true : "required" in f ? Boolean(f.required) : false,
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
        if (f.min !== undefined) rule.min = f.min;
        if (f.max !== undefined) rule.max = f.max;
        if (f.pattern !== undefined) rule.pattern = f.pattern;
        break;
      case "select":
      case "radio":
      case "checkboxes":
        rule.options = f.options.map((o) => o.value);
        rule.optionLabels = Object.fromEntries(
          f.options.map((o) => [o.value, resolveText(o.label, ctx.lang) ?? o.value]),
        );
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
      extra: presetFields(form),
    },
    subject: resolveText(form.subject, ctx.lang),
    spam: {
      honeypot: form.spam.honeypot,
      minSeconds: form.spam.minSeconds,
      pow: form.spam.pow && form.transport.kind === "relay",
      powDifficulty: form.spam.powDifficulty,
      captcha: anonymous ? "none" : form.spam.captcha,
      captchaSiteKey: anonymous ? "" : form.spam.captchaSiteKey,
      maxBytes: form.spam.maxBytes,
    },
    encryption: {
      mode: form.encryption.mode,
      keys: ctx.keys.map((k) => k.armored),
      showFingerprint: form.encryption.showFingerprint,
    },
    anonymous,
    page: form.pageContext && ctx.page ? { title: ctx.page.title, slug: ctx.page.slug } : undefined,
    success: {
      mode: form.success.mode,
      text:
        resolveText(form.success.text, ctx.lang) ??
        (form.encryption.mode === "required" ? t.sentEncrypted : t.sent),
      slug: form.success.slug,
    },
    texts: {
      sending: t.sending,
      sent: t.sent,
      sentEncrypted: t.sentEncrypted,
      required: t.required,
      invalidEmail: t.invalidEmail,
      invalidUrl: t.invalidUrl,
      invalidTel: t.invalidTel,
      invalidNumber: t.invalidNumber,
      invalidDate: t.invalidDate,
      belowMin: t.belowMin,
      aboveMax: t.aboveMax,
      tooLong: t.tooLong,
      patternMismatch: t.patternMismatch,
      chooseOne: t.chooseOne,
      chooseAtLeastOne: t.chooseAtLeastOne,
      consentRequired: t.consentRequired,
      keyInvalid: t.keyInvalid,
      keyNotPublic: t.keyNotPublic,
      keyExpired: t.keyExpired,
      keyAccepted: t.keyAccepted,
      keyUnchecked: t.keyUnchecked,
      encryptedFor: t.encryptedFor,
      encryptedForMany: t.encryptedForMany,
      encryptionUnavailable: t.encryptionUnavailable,
      tooFast: t.tooFast,
      reloadPage: t.reloadPage,
      proofRejected: t.proofRejected,
      captchaFailed: t.captchaFailed,
      captchaRequired: t.captchaRequired,
      sendFailed: t.sendFailed,
      rejected: t.rejected,
      rateLimited: t.rateLimited,
      tooLarge: t.tooLarge,
      errorSummary: t.errorSummary,
      errorSummaryOne: t.errorSummaryOne,
    },
  };
}

/** JSON that may sit inside a `<script>`: `<` is escaped so `</script>` cannot occur. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The whole form as a hast element. Transformer and component share this. */
export function renderForm(form: ResolvedForm, ctx: RenderContext): Element {
  const t = ctx.t;
  const title = resolveText(form.title, ctx.lang);
  const description = resolveText(form.description, ctx.lang);
  const submit = resolveText(form.submitLabel, ctx.lang) ?? t.submit;
  const required = form.encryption.mode === "required";
  // Encryption required, or no-script posts switched off: the form gets no target and no live
  // button until the script runs, and says so in a <noscript> note.
  const scriptOnly = required || !form.spam.noScript;
  const action = endpointOf(form.transport, form.recipient);
  const hidden = presetFields(form);

  const notes: ElementContent[] = [];
  if (form.anonymous)
    notes.push(
      h("p", { className: ["quartz-form__note", "quartz-form__note--anonymous"] }, t.anonymousNote),
    );
  if (form.pageContext && ctx.page)
    notes.push(
      h(
        "p",
        { className: ["quartz-form__note"] },
        interpolate(t.pageContextNote, { title: ctx.page.title }),
      ),
    );
  if (form.transport.kind === "mailto")
    notes.push(h("p", { className: ["quartz-form__note"] }, t.mailtoNote));

  const encryptionRow: ElementContent[] = [];
  if (form.encryption.mode === "optional") {
    const id = `${ctx.idPrefix}-${ENCRYPT_TOGGLE_NAME}`;
    // Only the script can encrypt, so only the script ticks and enables this box. Rendered
    // ticked, a browser without JavaScript showed "Send encrypted" and posted plaintext
    // (review finding, 2026-10-19); the <noscript> note below says what happens instead.
    encryptionRow.push(
      h("div", { className: ["quartz-form__field", "quartz-form__field--encrypt"] }, [
        h("div", { className: ["quartz-form__option"] }, [
          h("input", {
            type: "checkbox",
            id,
            name: ENCRYPT_TOGGLE_NAME,
            value: "yes",
            disabled: true,
            dataEnableWithJs: "true",
          }),
          h("label", { className: ["quartz-form__label"], for: id }, t.encryptToggle),
        ]),
      ]),
    );
  }
  if (form.encryption.mode !== "off" && form.encryption.showFingerprint)
    encryptionRow.push(
      h("p", { className: ["quartz-form__encrypted"], dataFingerprint: "true", hidden: true }),
    );

  // The third-party captcha widget renders into this container; its script is loaded by the
  // browser script only when such a form is on the page. Anonymous forms never get one.
  const captcha =
    form.spam.captcha !== "none" && !form.anonymous
      ? h("div", {
          className: [
            "quartz-form__captcha",
            form.spam.captcha === "turnstile" ? "cf-turnstile" : "h-captcha",
          ],
          dataSitekey: form.spam.captchaSiteKey,
          dataCaptcha: form.spam.captcha,
        })
      : null;

  return h(
    "form",
    {
      className: [
        "quartz-form",
        ...(form.className ? form.className.split(/\s+/).filter(Boolean) : []),
      ],
      dataForm: form.id,
      dataLang: ctx.lang,
      dataTransport: form.transport.kind,
      dataEncryption: form.encryption.mode,
      method: "post",
      // With encryption required the plaintext target is never written into the page: the
      // script sends with fetch and never reads `action`. Without JavaScript the form cannot send.
      action: scriptOnly ? undefined : action,
      enctype: form.transport.kind === "mailto" ? "text/plain" : undefined,
      novalidate: undefined,
    },
    clean([
      title ? h("h3", { className: ["quartz-form__title"] }, title) : null,
      description ? h("p", { className: ["quartz-form__description"] }, description) : null,
      ...notes,
      scriptOnly || form.encryption.mode === "optional"
        ? h("noscript", {}, [
            h(
              "p",
              { className: ["quartz-form__note", "quartz-form__note--noscript"] },
              required ? t.noScript : scriptOnly ? t.needsScript : t.noScriptPlain,
            ),
          ])
        : null,
      ...form.fields.map((f) => renderField(f, form, ctx)),
      form.spam.honeypot
        ? h("div", { className: ["quartz-form__hp"], ariaHidden: "true" }, [
            h("label", { for: `${ctx.idPrefix}-${HONEYPOT_NAME}` }, "Website"),
            h("input", {
              type: "text",
              id: `${ctx.idPrefix}-${HONEYPOT_NAME}`,
              name: HONEYPOT_NAME,
              tabindex: -1,
              autocomplete: "off",
            }),
          ])
        : null,
      h("input", { type: "hidden", name: "form", value: form.id }),
      h("input", { type: "hidden", name: "lang", value: ctx.lang }),
      h("input", { type: "hidden", name: "ts", value: "" }),
      // Slug and title, flat, as the script sends them on the plain path; an encrypted message
      // carries the page inside the ciphertext instead (the script drops both fields then).
      ...(form.pageContext && ctx.page
        ? [
            h("input", { type: "hidden", name: "page", value: ctx.page.slug }),
            h("input", { type: "hidden", name: "pageTitle", value: ctx.page.title }),
          ]
        : []),
      ...Object.entries(hidden).map(([k, v]) => h("input", { type: "hidden", name: k, value: v })),
      ...encryptionRow,
      captcha,
      h("div", { className: ["quartz-form__actions"] }, [
        h(
          "button",
          {
            type: "submit",
            className: ["quartz-form__button"],
            disabled: scriptOnly ? true : undefined,
            dataEnableWithJs: scriptOnly ? "true" : undefined,
          },
          submit,
        ),
      ]),
      h("div", { className: ["quartz-form__status"], role: "status", ariaLive: "polite" }),
      h("script", { type: "application/json", className: ["quartz-form-config"] }, [
        text(scriptJson(clientConfig(form, ctx))),
      ]),
    ]),
  );
}

/** What a page shows for a form id it does not have: a visible hint in serve mode, nothing in a build. */
export function renderMissing(id: string, serve: boolean): Element | null {
  if (!serve) return null;
  return h("div", { className: ["quartz-form", "quartz-form--missing"], role: "note" }, [
    h("p", {}, [text("quartz-forms: no form "), h("code", {}, id), text(" in options.forms.")]),
  ]);
}
