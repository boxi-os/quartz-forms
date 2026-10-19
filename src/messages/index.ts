import en, { type MessageCode } from "./en";
import de from "./de";
import type { Params, Translate } from "./types";

export type { MessageCode, Params };

/**
 * A message of the plugin about a definition: where (the option's path, as it stands in
 * quartz.config.yaml), what (a code) and with what (the values the sentence names). The sentence
 * is made from it per language; the build log takes English, the command line `--lang`.
 * QuartzControl reads the path to put a message at its form, field or section.
 */
export interface Message {
  path: string;
  code: MessageCode;
  params?: Params;
}

export const MESSAGE_LANGS = ["en", "de"] as const;
export type MessageLang = (typeof MESSAGE_LANGS)[number];

const catalogs: Record<MessageLang, Record<MessageCode, (p: Params, t: Translate) => string>> = {
  en,
  de,
};

/** A message language from a code like `de`, `de-DE` or `en_GB`; English for anything else. */
export function messageLang(code: string | undefined): MessageLang {
  const primary = (code ?? "").toLowerCase().split(/[-_]/)[0];
  return (MESSAGE_LANGS as readonly string[]).includes(primary ?? "")
    ? (primary as MessageLang)
    : "en";
}

/** The sentence of a code, without a path. */
export function messageText(
  code: MessageCode,
  params: Params = {},
  lang: MessageLang = "en",
): string {
  const catalog = catalogs[lang];
  const t: Translate = (c, p) => (c in catalog ? catalog[c as MessageCode](p ?? {}, t) : c);
  return catalog[code](params, t);
}

/** `path: sentence`, as the build log and the command line print it. */
export function formatMessage(message: Message, lang: MessageLang = "en"): string {
  const text = messageText(message.code, message.params, lang);
  return message.path ? `${message.path}: ${text}` : text;
}
