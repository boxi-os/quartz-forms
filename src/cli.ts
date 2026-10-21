/**
 * quartz-forms on the command line, for an installed copy as much as for a checkout: everything
 * it needs is bundled into dist/cli.js (`yaml` included), so it runs from a site's
 * `.quartz/plugins/quartz-forms` without `npm install`. QuartzControl calls it in a child
 * process; `npm run relay:config` is a thin wrapper around `relay`.
 *
 *   node dist/cli.js relay --site <dir> --out <dir> [--skip-pattern-check] [--json]
 *   node dist/cli.js check --site <dir> [--json]
 *   node dist/cli.js key   --site <dir> (--file <path> | armored text in QF_KEY_ARMORED) [--json]
 *   node dist/cli.js texts [--json]
 *
 * `--lang de` gives every message a caller shows (problems, hints, key problems, refusals,
 * warnings) in German; English without it, as the build log has them. The status lines of a run
 * in a terminal (`wrote …`, `kept …`) stay English.
 *
 * `relay` takes the owner's values (secret, origins, sender, addresses, captcha secrets) from the
 * environment variable QF_RELAY_OPERATOR as JSON and then writes config.php from them on every
 * run; without it config.php is created once from the example and kept. Secrets never travel
 * through argv, where any process list shows them.
 *
 * With `--json` stdout holds exactly one JSON object. Exit status: 0 done, 1 refused (the object
 * says why), 2 usage.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { resolveOptions } from "./options";
import { checkKey, type KeyReport } from "./pgp/check";
import { publicKeyBlock } from "./pgp/armor";
import { pluginRoot } from "./pgp/load";
import {
  checkPatterns,
  examplePhp,
  generatedPhp,
  operatorPhp,
  operatorProblems,
  recipientNames,
  relayData,
  relayHash,
  type PatternCheck,
  type RelayOperator,
} from "./relay/generate";
import type { QuartzFormsOptions, ResolvedOptions } from "./types";
import { availableLocales, i18n } from "./i18n";
import {
  formatMessage,
  messageLang,
  messageText,
  type Message,
  type MessageCode,
  type MessageLang,
  type Params,
} from "./messages";

const ENTRY = /(^|[/:])quartz-forms(\.git)?(#.*)?$/;

/** The language of the messages this run hands out; set once from `--lang` in main(). */
let lang: MessageLang = "en";
const m = (code: MessageCode, params?: Params): string => messageText(code, params, lang);
const fm = (message: Message): string => formatMessage(message, lang);

class Refusal extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown> = {},
    readonly status = 1,
  ) {
    super(message);
  }
}

interface Args {
  command: string;
  site?: string;
  out?: string;
  file?: string;
  json: boolean;
  skipPatternCheck: boolean;
  lang?: string;
}

function parseArgs(argv: string[]): Args {
  const [command = "", ...rest] = argv;
  const args: Args = { command, json: false, skipPatternCheck: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--json") args.json = true;
    else if (a === "--skip-pattern-check") args.skipPatternCheck = true;
    else if (a === "--site" || a === "--out" || a === "--file" || a === "--lang") {
      const value = rest[++i];
      if (value === undefined) throw new Refusal(m("cliNeedsValue", { arg: a }), {}, 2);
      args[a.slice(2) as "site" | "out" | "file" | "lang"] = value;
    } else if (a === "--") continue;
    else throw new Refusal(m("cliUnknownArgument", { arg: a }), {}, 2);
  }
  return args;
}

interface Site {
  dir: string;
  configPath: string;
  yaml: Record<string, unknown>;
  rawOptions: Partial<QuartzFormsOptions>;
  entries: number;
}

function readSite(site: string | undefined): Site {
  if (!site) throw new Refusal(m("cliNoSite"), {}, 2);
  const dir = path.resolve(site);
  const configPath = path.join(dir, "quartz.config.yaml");
  if (!fs.existsSync(configPath))
    throw new Refusal(m("cliConfigMissing", { path: configPath }), {}, 2);
  const yaml = (YAML.parse(fs.readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>;
  const plugins = Array.isArray(yaml.plugins) ? (yaml.plugins as Record<string, unknown>[]) : [];
  const entries = plugins.filter(
    (p) => ENTRY.test(String(p?.source ?? "")) || p?.name === "quartz-forms",
  );
  if (entries.length === 0) throw new Refusal(m("cliNoEntry", { path: configPath }), {}, 2);
  return {
    dir,
    configPath,
    yaml,
    rawOptions: (entries[0]!.options ?? {}) as Partial<QuartzFormsOptions>,
    entries: entries.length,
  };
}

/** Keys may name files relative to the site; every read of the options runs from there. */
function inSite<T>(dir: string, run: () => T): T {
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    return run();
  } finally {
    process.chdir(cwd);
  }
}

async function inSiteAsync<T>(dir: string, run: () => Promise<T>): Promise<T> {
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    return await run();
  } finally {
    process.chdir(cwd);
  }
}

function resolveAt(site: Site): ResolvedOptions {
  return inSite(site.dir, () => resolveOptions(site.rawOptions));
}

/** A key report with its problem in this run's language. */
function localized(report: KeyReport): KeyReport {
  const { code, params, noticeCode, noticeParams, ...rest } = report;
  return {
    ...rest,
    ...(code ? { problem: m(code, params) } : {}),
    ...(noticeCode ? { notice: m(noticeCode, noticeParams) } : {}),
  };
}

/** Every key the options name, read and checked as the build checks the ones in use. */
async function keyReports(site: Site, opts: ResolvedOptions): Promise<KeyReport[]> {
  return inSiteAsync(site.dir, async () => {
    const out: KeyReport[] = [];
    for (const [name, src] of Object.entries(opts.keys)) {
      let text: string | undefined;
      if (src && typeof src.armored === "string" && src.armored.trim()) text = src.armored;
      else if (src && typeof src.file === "string" && src.file.trim()) {
        try {
          text = fs.readFileSync(path.resolve(src.file), "utf8");
        } catch {
          out.push({ name, fingerprint: "", userIds: [], problem: m("keyFileUnreadable") });
          continue;
        }
      }
      if (text === undefined) {
        out.push({ name, fingerprint: "", userIds: [], problem: m("keyMissingSource") });
        continue;
      }
      const block = publicKeyBlock(text);
      if (block.armored === undefined) {
        out.push({ name, fingerprint: "", userIds: [], problem: m(block.code, block.params) });
        continue;
      }
      out.push(localized(await checkKey(name, block.armored)));
    }
    return out;
  });
}

type Say = (line: string) => void;

async function commandCheck(args: Args): Promise<Record<string, unknown>> {
  const site = readSite(args.site);
  const opts = resolveAt(site);
  const keys = await keyReports(site, opts);
  return {
    ok: true,
    entries: site.entries,
    problems: opts.problemMessages.map(fm),
    hints: opts.hintMessages.map(fm),
    keys,
  };
}

async function commandKey(args: Args): Promise<Record<string, unknown>> {
  let text: string;
  if (args.file !== undefined) {
    const file = path.resolve(args.site ? path.resolve(args.site) : process.cwd(), args.file);
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      throw new Refusal(m("cliKeyUnreadable", { file: args.file }));
    }
  } else if (process.env.QF_KEY_ARMORED) text = process.env.QF_KEY_ARMORED;
  else throw new Refusal(m("cliNoKey"), {}, 2);
  const block = publicKeyBlock(text);
  if (block.armored === undefined)
    return {
      ok: true,
      key: { name: "", fingerprint: "", userIds: [], problem: m(block.code, block.params) },
    };
  return { ok: true, key: localized(await checkKey("", block.armored)), armored: block.armored };
}

function shown(file: string): string {
  const rel = path.relative(process.cwd(), file);
  return rel.startsWith("..") ? file : rel;
}

function sayPatterns(check: PatternCheck, skip: boolean, warn: Say, say: Say): void {
  switch (check.status) {
    case "none":
      return;
    case "no-php":
      warn(`relay-config: ${m("cliNoPhp", { count: check.count })}`);
      return;
    case "failed":
      warn(`relay-config: ${m("cliPhpFailed", { message: check.message })}`);
      return;
    case "checked":
      for (const e of check.errors) warn(`relay-config: ${m("cliPatternUnreadable", { ...e })}`);
      if (check.errors.length > 0 && skip) warn(`relay-config: ${m("cliWrittenAnyway")}`);
      else if (check.errors.length === 0)
        say(
          `${check.count} pattern(s) read by PCRE ${check.pcre} (PHP ${check.php} on this machine; the host's may be older)`,
        );
  }
}

function readOperator(): RelayOperator | undefined {
  const raw = process.env.QF_RELAY_OPERATOR;
  if (raw === undefined || raw === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Refusal(m("cliOperatorJson"));
  }
  const problems = operatorProblems(parsed);
  if (problems.length > 0)
    throw new Refusal(m("cliOperatorProblems", { count: problems.length }), {
      problems: problems.map(fm),
    });
  return parsed as RelayOperator;
}

async function commandRelay(args: Args, say: Say, warn: Say): Promise<Record<string, unknown>> {
  const site = readSite(args.site);
  if (!args.out) throw new Refusal(m("cliNoOut"), {}, 2);
  const outDir = path.resolve(args.out);
  const operator = readOperator();
  if (site.entries > 1) warn(`relay-config: ${m("cliEntries", { count: site.entries })}`);
  const opts = resolveAt(site);
  if (opts.problems.length > 0) {
    const problems = opts.problemMessages.map(fm);
    throw new Refusal(
      `${m("cliOptionProblems", { count: problems.length })}\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
      { problems },
    );
  }
  const configuration = site.yaml.configuration as Record<string, unknown> | undefined;
  const data = relayData(opts, configuration?.baseUrl);
  const recipients = recipientNames(data);

  const patterns = checkPatterns(data);
  sayPatterns(patterns, args.skipPatternCheck, warn, say);
  if (patterns.status === "failed") throw new Refusal(m("cliPhpFailedShort"), { patterns });
  if (patterns.status === "checked" && patterns.errors.length > 0 && !args.skipPatternCheck) {
    warn(`relay-config: ${m("cliNothingWritten")}`);
    throw new Refusal(m("cliPatternRefusal"), { patterns });
  }

  const relayDir = path.join(pluginRoot(), "relay", "php");
  const written: string[] = [];
  fs.mkdirSync(outDir, { recursive: true });
  // A run into a directory of its own carries the whole relay; the checkout's relay/php already
  // holds send.php and must not be copied onto itself.
  if (path.resolve(relayDir) !== outDir) {
    fs.copyFileSync(path.join(relayDir, "send.php"), path.join(outDir, "send.php"));
    fs.mkdirSync(path.join(outDir, "counters"), { recursive: true });
    // The probe has the counters' ending, so whatever serves it serves them: asking for the
    // .htaccess said nothing where Apache ignores it (AllowOverride None) or nginx denies `\.ht`,
    // both 403 for it and 200 for a count (review 2026-10-29, M3, measured on Debian).
    for (const name of [".htaccess", "qf-probe.count"])
      fs.copyFileSync(path.join(relayDir, "counters", name), path.join(outDir, "counters", name));
    written.push("send.php", "counters/.htaccess", "counters/qf-probe.count");
  }
  fs.writeFileSync(
    path.join(outDir, "config.generated.php"),
    generatedPhp(data, path.basename(site.configPath)),
  );
  written.push("config.generated.php");
  say(
    `wrote ${shown(path.join(outDir, "config.generated.php"))} (${Object.keys(data.forms).length} form(s) on the relay)`,
  );

  const configFile = path.join(outDir, "config.php");
  let configPhp: "written" | "created" | "kept";
  let missingRecipients: string[] = [];
  // config.php holds the secret: readable by its owner only, whichever branch writes it. A mode
  // given to writeFileSync applies to a file it creates, not to one it overwrites.
  if (operator) {
    fs.writeFileSync(configFile, operatorPhp(operator), { mode: 0o600 });
    fs.chmodSync(configFile, 0o600);
    configPhp = "written";
    missingRecipients = recipients.filter((r) => !operator.recipients[r]?.trim());
    for (const r of missingRecipients)
      warn(`relay-config: ${m("cliMissingRecipient", { name: r })}`);
    say(`wrote ${shown(configFile)} from the operator values`);
  } else if (!fs.existsSync(configFile)) {
    const example = fs.readFileSync(path.join(relayDir, "config.example.php"), "utf8");
    fs.writeFileSync(configFile, examplePhp(example, recipients), { mode: 0o600 });
    configPhp = "created";
    say(
      `created ${shown(configFile)} with a fresh secret; fill in origins, from and the ${recipients.length} recipient address(es)`,
    );
  } else {
    configPhp = "kept";
    say(`${shown(configFile)} kept (addresses and secret are yours)`);
  }
  if (configPhp !== "kept") written.push("config.php");

  return {
    ok: true,
    written,
    forms: Object.keys(data.forms),
    recipients,
    missingRecipients,
    siteOrigin: data.siteOrigin,
    hash: relayHash(data),
    configPhp,
    patterns,
  };
}

/**
 * The plugin's own wording of every text, by locale: what `options.texts` lays its entries over
 * (`wording()`), so that an editor can show each text with the words that apply while it is
 * unset. A key the plugin does not have here is ignored by the build.
 */
function commandTexts(): Record<string, unknown> {
  return { ok: true, locales: Object.fromEntries(availableLocales().map((l) => [l, i18n(l)])) };
}

export async function main(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const lines: string[] = [];
  const warnings: string[] = [];
  const say: Say = (line) => (json ? lines.push(line) : console.log(line));
  const warn: Say = (line) => (json ? warnings.push(line) : console.warn(line));
  // Before the arguments are read, so that a refusal of them is in the language asked for too.
  const langAt = argv.indexOf("--lang");
  lang = messageLang(langAt >= 0 ? argv[langAt + 1] : undefined);
  try {
    const args = parseArgs(argv);
    let result: Record<string, unknown>;
    if (args.command === "relay") result = await commandRelay(args, say, warn);
    else if (args.command === "check") result = await commandCheck(args);
    else if (args.command === "key") result = await commandKey(args);
    else if (args.command === "texts") result = commandTexts();
    else throw new Refusal(m("cliUnknownCommand", { command: args.command }), {}, 2);
    if (json) process.stdout.write(JSON.stringify({ ...result, warnings }) + "\n");
    else if (args.command !== "relay") console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (e) {
    const refusal = e instanceof Refusal ? e : new Refusal((e as Error).message ?? String(e));
    if (json)
      process.stdout.write(
        JSON.stringify({ ok: false, error: refusal.message, ...refusal.details, warnings }) + "\n",
      );
    else {
      console.error(refusal.message);
      if (refusal.status === 2)
        console.error(
          "usage: quartz-forms relay --site <dir> --out <dir> [--skip-pattern-check] | check --site <dir> | key --site <dir> --file <path> | texts  [--json] [--lang de|en]",
        );
    }
    return refusal.status;
  }
}

// Run when executed (dist/cli.js), not when imported by a test.
const self = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (/[/\\]cli\.(js|ts)$/.test(self)) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
