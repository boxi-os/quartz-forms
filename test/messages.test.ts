import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import en from "../src/messages/en";
import de from "../src/messages/de";
import { formatMessage, messageLang, messageText, type MessageCode } from "../src/messages";
import { resolveOptions } from "../src/options";
import { tmpDir } from "./keys";

// Every value a message may name, each a marker that cannot occur in a sentence by chance.
const PARAMS = {
  name: "⟦name⟧",
  pattern: "⟦pattern⟧",
  min: 7001,
  max: 7002,
  error: "⟦error⟧",
  type: "⟦type⟧",
  value: "⟦value⟧",
  file: "⟦file⟧",
  problem: "armorNone",
  kind: "⟦kind⟧",
  count: 7003,
  date: "⟦date⟧",
  url: "⟦url⟧",
  provider: "⟦provider⟧",
  bits: 7004,
  maxBytes: 7005,
  capacity: 7006,
  encrypted: true,
  id: "⟦id⟧",
  arg: "⟦arg⟧",
  path: "⟦path⟧",
  command: "⟦command⟧",
  message: "⟦message⟧",
  form: "⟦form⟧",
  field: "⟦field⟧",
  why: "⟦why⟧",
  key: "⟦key⟧",
  step: 7007,
};
const markers = (text: string): string[] => (text.match(/⟦\w+⟧|70\d\d/g) ?? []).sort();

describe("messages", () => {
  it("has a German sentence for every code, naming every value the English one names", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const code of Object.keys(en) as MessageCode[]) {
      const english = messageText(code, PARAMS, "en");
      const german = messageText(code, PARAMS, "de");
      expect(german, code).not.toMatch(/undefined|\[object/);
      expect(german.trim(), code).not.toBe("");
      expect(markers(german), code).toEqual(markers(english));
    }
  });

  it("is German where it says something in words", () => {
    // Even the ones that are mostly option words ("none, turnstile or hcaptcha") have an "or".
    const same = (Object.keys(en) as MessageCode[]).filter(
      (code) => messageText(code, PARAMS, "en") === messageText(code, PARAMS, "de"),
    );
    expect(same).toEqual([]);
  });

  it("reads the language from a locale and falls back to English", () => {
    expect(messageLang("de-DE")).toBe("de");
    expect(messageLang("de_AT")).toBe("de");
    expect(messageLang("en")).toBe("en");
    expect(messageLang("fr")).toBe("en");
    expect(messageLang(undefined)).toBe("en");
  });

  it("keeps the build log's English and the path in both languages", () => {
    const opts = resolveOptions({
      forms: {
        contact: {
          fields: [
            { type: "text", name: "form", label: "X" },
            { type: "scale", name: "s", label: "S", min: 5, max: 1 },
          ],
        },
      },
    } as never);
    expect(opts.problemMessages.map((m) => formatMessage(m))).toEqual(opts.problems);
    const german = opts.problemMessages.map((m) => formatMessage(m, "de"));
    expect(german).toContain(
      "forms.contact.fields[0]: der Feldname „form“ ist für die Sendung selbst reserviert",
    );
    expect(german).toContain("forms.contact.fields[1]: min 5 der Skala muss unter max 1 liegen");
    expect(german).toContain("forms.contact.transport.url: relay braucht eine Adresse");
    for (let i = 0; i < german.length; i++)
      expect(german[i]!.split(": ")[0]).toBe(opts.problems[i]!.split(": ")[0]);
  });
});

describe("the command line in German", () => {
  const root = path.resolve(__dirname, "..");
  const cli = path.join(root, "dist", "cli.js");
  const run = (args: string[], env: NodeJS.ProcessEnv = {}) => {
    const r = spawnSync(process.execPath, [cli, ...args, "--json"], {
      encoding: "utf8",
      env: { ...process.env, QF_RELAY_OPERATOR: "", QF_KEY_ARMORED: "", ...env },
    });
    return { status: r.status, json: JSON.parse(r.stdout) as Record<string, unknown> };
  };

  it("answers check, key and a refusal with --lang de", () => {
    const dir = tmpDir("messages-site");
    fs.writeFileSync(
      path.join(dir, "quartz.config.yaml"),
      YAML.stringify({
        plugins: [
          {
            source: "github:boxi-os/quartz-forms",
            options: { forms: { contact: { template: "contact" } } },
          },
        ],
      }),
    );
    const check = run(["check", "--site", dir, "--lang", "de"]);
    expect(check.json.problems).toEqual([
      "forms.contact.transport.url: relay braucht eine Adresse",
      "forms.contact.recipient: das Relay braucht den Namen des Empfängers",
    ]);
    expect(run(["check", "--site", dir]).json.problems).toEqual([
      "forms.contact.transport.url: relay needs a URL",
      "forms.contact.recipient: the relay needs the recipient's name",
    ]);
    const key = run(["key", "--lang", "de"], { QF_KEY_ARMORED: "kein Schlüssel" });
    expect((key.json.key as { problem: string }).problem).toBe(
      "kein öffentlicher PGP-Schlüssel im Textformat",
    );
    const refused = run(["relay", "--site", dir, "--out", tmpDir("messages-out"), "--lang", "de"]);
    expect(refused.status).toBe(1);
    expect(refused.json.problems).toContain(
      "forms.contact.recipient: das Relay braucht den Namen des Empfängers",
    );
    expect(run(["frobnicate", "--lang", "de"]).json.error).toBe(
      "unbekannter Befehl „frobnicate“ (relay, check, key, texts)",
    );
  });
});
