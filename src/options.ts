import type {
  EncryptionConfig,
  FormDefinition,
  QuartzFormsOptions,
  ResolvedForm,
  ResolvedOptions,
  SpamConfig,
  TransportConfig,
} from "./types";
import { isTemplateName, templateOf } from "./templates";
import { isPersonalField, validate } from "./validate";
import { warnOnce } from "./util/warn";

/** Defaults live only here; the manifest's `defaultOptions` mirrors them for editors. */
export const defaultTransport: TransportConfig = { kind: "relay" };

export const defaultSpam: SpamConfig = {
  honeypot: true,
  minSeconds: 3,
  pow: false,
  powDifficulty: 16,
  captcha: "none",
  captchaSiteKey: "",
  rateLimitPerHour: 60,
  maxFieldLength: 2000,
  maxTextareaLength: 20000,
  maxKeyLength: 16384,
  maxBytes: 65536,
};

export const defaultOptions: QuartzFormsOptions = {
  forms: {},
  transport: defaultTransport,
  keys: {},
  spam: defaultSpam,
  frontmatterKey: "form",
  codeBlockLang: "quartz-form",
  language: "auto",
  texts: {},
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * YAML written as `key:` with nothing after it arrives as `null`. Such a key counts as not
 * written at all, so defaults apply (the rule quartz-layout-box learned in 0.4.1).
 */
function withoutNulls<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[k] = v;
  return out as T;
}

function resolveForm(
  id: string,
  def: FormDefinition,
  global: { transport: TransportConfig; spam: SpamConfig; keyNames: string[] },
): ResolvedForm {
  const user = withoutNulls(def);
  const base = isTemplateName(user.template) ? templateOf(user.template) : {};
  // The user's definition lies over the template; `fields` replace, they never merge.
  const merged: FormDefinition = { ...base, ...user };

  const encryption: Required<EncryptionConfig> = {
    mode: merged.encryption?.mode ?? "off",
    keys: merged.encryption?.keys ?? global.keyNames,
    showFingerprint: merged.encryption?.showFingerprint ?? true,
  };

  const anonymous = merged.anonymous ?? false;
  // Anonymous keeps its promise here, not only in a hint: no required personal field, no page.
  const fields = (merged.fields ?? []).map((field) =>
    anonymous && isObject(field) && "required" in field && field.required && isPersonalField(field)
      ? { ...field, required: false }
      : field,
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
    pageContext: anonymous ? false : (merged.pageContext ?? false),
    spam: { ...global.spam, ...withoutNulls(merged.spam ?? {}) },
    success: merged.success ?? { mode: "inline" },
    className: merged.className,
  };
}

/**
 * Quartz passes the raw YAML `options` of the entry; manifest defaults are not merged in.
 * Every factory of this plugin runs the raw options through here. Problems that the build must
 * not pass over are thrown as one error listing all of them; hints are returned for the caller
 * to log once.
 */
export function resolveOptions(userOpts?: Partial<QuartzFormsOptions>): ResolvedOptions {
  const user = withoutNulls(userOpts ?? {});
  const transport: TransportConfig = {
    ...defaultTransport,
    ...withoutNulls(isObject(user.transport) ? user.transport : {}),
  };
  const spam: SpamConfig = {
    ...defaultSpam,
    ...withoutNulls(isObject(user.spam) ? user.spam : {}),
  };
  const keys = isObject(user.keys) ? withoutNulls(user.keys) : {};
  const keyNames = Object.keys(keys);
  const rawForms = isObject(user.forms) ? withoutNulls(user.forms) : {};

  const forms: Record<string, ResolvedForm> = {};
  for (const [id, def] of Object.entries(rawForms)) {
    forms[id] = resolveForm(id, isObject(def) ? (def as FormDefinition) : {}, {
      transport,
      spam,
      keyNames,
    });
  }

  const resolved: ResolvedOptions = {
    forms,
    transport,
    keys,
    spam,
    frontmatterKey: typeof user.frontmatterKey === "string" ? user.frontmatterKey : "form",
    codeBlockLang: typeof user.codeBlockLang === "string" ? user.codeBlockLang : "quartz-form",
    language: typeof user.language === "string" ? user.language : "auto",
    texts: isObject(user.texts) ? (user.texts as Record<string, Record<string, string>>) : {},
    problems: [],
    hints: [],
  };

  const { problems, hints } = validate(resolved, rawForms);
  resolved.problems = problems;
  resolved.hints = hints;
  return resolved;
}

/**
 * The entry point of every factory: resolves, and stops the build on problems. A form with a
 * wrong definition would otherwise go out as a page that cannot send.
 */
export function resolveOrThrow(userOpts?: Partial<QuartzFormsOptions>): ResolvedOptions {
  const opts = resolveOptions(userOpts);
  if (opts.problems.length > 0) {
    throw new Error(
      `[forms] ${opts.problems.length} problem(s) in the quartz-forms options:\n` +
        opts.problems.map((p) => `  - ${p}`).join("\n"),
    );
  }
  return opts;
}

/** Logs every hint once per build; three factories resolve the same options. */
export function logHints(opts: ResolvedOptions): void {
  for (const hint of opts.hints) warnOnce(hint, hint);
}
