import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { generatePair, tmpDir } from "./keys";

// dist/cli.js as an installed copy runs it: QuartzControl calls it in a child process, with the
// owner's values in the environment, and reads one JSON object from stdout.
const root = path.resolve(__dirname, "..");
const cli = path.join(root, "dist", "cli.js");
const php = spawnSync("php", ["-v"], { stdio: "ignore" }).status === 0;

function site(options: Record<string, unknown>, files: Record<string, string> = {}): string {
  const dir = tmpDir("cli-site");
  fs.writeFileSync(
    path.join(dir, "quartz.config.yaml"),
    YAML.stringify({
      configuration: { pageTitle: "Test", locale: "de-DE", baseUrl: "example.org/site" },
      plugins: [{ source: "github:boxi-os/quartz-forms", enabled: true, options }],
    }),
  );
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

function run(
  args: string[],
  env: NodeJS.ProcessEnv = {},
  bin = cli,
): { status: number | null; json: Record<string, unknown>; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [bin, ...args, "--json"], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, QF_RELAY_OPERATOR: "", QF_KEY_ARMORED: "", ...env },
  });
  return { status: r.status, json: JSON.parse(r.stdout), stdout: r.stdout, stderr: r.stderr };
}

const relayOptions = {
  transport: { kind: "relay", url: "https://example.org/forms/send.php" },
  forms: {
    contact: {
      template: "contact",
      recipient: "owner",
    },
    feedback: {
      template: "feedback",
      recipient: "team",
    },
  },
};

const operator = {
  secret: "s".repeat(40),
  allowedOrigins: ["https://example.org"],
  from: "forms@example.org",
  subjectPrefix: "[Site]",
  captchaSecret: "cap's secret",
  mailer: { sendmail: "/usr/sbin/sendmail -t -i" },
  recipients: { owner: "owner@example.org" },
  counterDir: "/home/me/forms-counters",
};

describe("cli relay", () => {
  it("writes the whole relay into its own directory, config.php from the operator values", () => {
    const out = tmpDir("cli-relay-out");
    const r = run(["relay", "--site", site(relayOptions), "--out", out], {
      QF_RELAY_OPERATOR: JSON.stringify(operator),
    });
    expect(r.status).toBe(0);
    expect(r.json.ok).toBe(true);
    expect(r.json.written).toEqual([
      "send.php",
      "counters/.htaccess",
      "config.generated.php",
      "config.php",
    ]);
    expect(r.json.forms).toEqual(["contact", "feedback"]);
    expect(r.json.recipients).toEqual(["owner", "team"]);
    // a form whose recipient has no address is refused by the relay; the caller hears of it
    expect(r.json.missingRecipients).toEqual(["team"]);
    expect(r.json.warnings).toEqual([
      'relay-config: no address for the recipient "team"; the relay refuses its forms',
    ]);
    expect(r.json.configPhp).toBe("written");
    expect(r.json.siteOrigin).toBe("https://example.org");
    // nothing secret on stdout, which a caller may log
    expect(r.stdout).not.toContain(operator.secret);
    expect(r.stdout).not.toContain("owner@example.org");

    expect(fs.readFileSync(path.join(out, "send.php"), "utf8")).toBe(
      fs.readFileSync(path.join(root, "relay", "php", "send.php"), "utf8"),
    );
    expect(fs.existsSync(path.join(out, "counters", ".htaccess"))).toBe(true);
    const config = fs.readFileSync(path.join(out, "config.php"), "utf8");
    expect(config).toContain(`'secret' => '${operator.secret}'`);
    expect(config).toContain("'captchaSecret' => 'cap\\'s secret'");
    expect(config).toMatch(/'mailer' => \[\n\s+'sendmail' => '\/usr\/sbin\/sendmail -t -i',/);
    expect(config).toMatch(/'recipients' => \[\n\s+'owner' => 'owner@example.org',/);
    expect(config).toContain("'counterDir' => '/home/me/forms-counters'");
    expect(config).toContain("require __DIR__ . '/config.generated.php'");
    expect(fs.statSync(path.join(out, "config.php")).mode & 0o777).toBe(0o600);
  });

  it("keeps config.php to its owner, created from the example or overwritten by the operator", () => {
    const created = tmpDir("cli-relay-created");
    expect(run(["relay", "--site", site(relayOptions), "--out", created]).json.configPhp).toBe(
      "created",
    );
    expect(fs.statSync(path.join(created, "config.php")).mode & 0o777).toBe(0o600);

    // a config.php someone else wrote readable for all keeps no such mode once it holds the secret
    const over = tmpDir("cli-relay-over");
    fs.writeFileSync(path.join(over, "config.php"), "<?php return [];\n", { mode: 0o644 });
    fs.chmodSync(path.join(over, "config.php"), 0o644);
    const r = run(["relay", "--site", site(relayOptions), "--out", over], {
      QF_RELAY_OPERATOR: JSON.stringify(operator),
    });
    expect(r.json.configPhp).toBe("written");
    expect(fs.statSync(path.join(over, "config.php")).mode & 0o777).toBe(0o600);
  });

  it.skipIf(!php)("writes PHP that PHP reads, with the values the relay looks up", () => {
    const out = tmpDir("cli-relay-php");
    const r = run(["relay", "--site", site(relayOptions), "--out", out], {
      QF_RELAY_OPERATOR: JSON.stringify({ ...operator, counterDir: "", mailer: "mail" }),
    });
    expect(r.status).toBe(0);
    const read = spawnSync(
      "php",
      [
        "-r",
        `$c = require '${path.join(out, "config.php")}'; echo json_encode([$c['secret'], $c['from'], $c['mailer'], $c['counterDir'], array_keys($c['forms']), $c['recipients']]);`,
      ],
      { encoding: "utf8" },
    );
    expect(read.status).toBe(0);
    expect(JSON.parse(read.stdout)).toEqual([
      operator.secret,
      "forms@example.org",
      "mail",
      path.join(out, "counters"),
      ["contact", "feedback"],
      { owner: "owner@example.org" },
    ]);
  });

  it("gives the same hash for the same definitions, and another one when a form changes", () => {
    const a = run(["relay", "--site", site(relayOptions), "--out", tmpDir("cli-hash-a")]);
    const b = run(["relay", "--site", site(relayOptions), "--out", tmpDir("cli-hash-b")]);
    expect(a.json.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.json.hash).toBe(a.json.hash);
    const changed = run([
      "relay",
      "--site",
      site({ ...relayOptions, spam: { rateLimitPerHour: 5 } }),
      "--out",
      tmpDir("cli-hash-c"),
    ]);
    expect(changed.json.hash).not.toBe(a.json.hash);
    // without operator values config.php is created once from the example
    expect(a.json.configPhp).toBe("created");
  });

  it("refuses operator values it cannot write, before writing anything", () => {
    const out = tmpDir("cli-relay-bad");
    const r = run(["relay", "--site", site(relayOptions), "--out", out], {
      QF_RELAY_OPERATOR: JSON.stringify({
        ...operator,
        secret: "short",
        mailer: { sendmail: " " },
        counterDir: "relative/dir",
      }),
    });
    expect(r.status).toBe(1);
    expect(r.json.ok).toBe(false);
    expect(r.json.problems).toEqual([
      "operator.secret: at least 32 characters",
      'operator.mailer: "mail", { sendmail } or { file }',
      "operator.counterDir: an absolute path on the server",
    ]);
    expect(fs.readdirSync(out)).toEqual([]);
    expect(
      run(["relay", "--site", site(relayOptions), "--out", out], {
        QF_RELAY_OPERATOR: "{not json",
      }).json.error,
    ).toBe("QF_RELAY_OPERATOR: not JSON");
  });

  it("says what is wrong with the options, as the build would", () => {
    const r = run([
      "relay",
      "--site",
      site({ forms: { contact: { fields: [] } } }),
      "--out",
      tmpDir("cli-relay-problems"),
    ]);
    expect(r.status).toBe(1);
    expect(r.json.problems).toContain(
      "forms.contact: no fields (write fields or choose a template)",
    );
  });

  it("answers a usage error with status 2", () => {
    expect(run(["relay", "--site", site(relayOptions)]).status).toBe(2);
    expect(run(["frobnicate"]).json.error).toBe('unknown command "frobnicate" (relay, check, key)');
    const none = tmpDir("cli-none");
    fs.writeFileSync(path.join(none, "quartz.config.yaml"), "plugins: []\n");
    expect(run(["check", "--site", none]).json.error).toMatch(/^no quartz-forms entry in /);
    // Third review, aside (2026-10-19): a local path of another name is no entry, and the
    // sentence did not say why.
    expect(run(["check", "--site", none]).json.error).toMatch(
      /: an entry's source must end in quartz-forms \(github:boxi-os\/quartz-forms, or a folder named quartz-forms\)$/,
    );
  });
});

describe("cli check and key", () => {
  it("reports problems, hints and every key with its fingerprint and expiry", async () => {
    const good = await generatePair();
    const expired = await generatePair({ expired: true });
    const dir = site(
      {
        transport: { kind: "mailto" },
        keys: {
          owner: { file: "keys/owner.asc" },
          old: { armored: expired.publicKey },
          gone: { file: "keys/missing.asc" },
        },
        spam: { pow: true },
        forms: {
          contact: {
            template: "contact",
            recipient: "owner@example.org",
            encryption: { mode: "required", keys: ["owner"] },
          },
        },
      },
      { "keys/owner.asc": good.publicKey },
    );
    const r = run(["check", "--site", dir]);
    expect(r.status).toBe(0);
    expect(r.json.problems).toEqual(["keys.gone.file: keys/missing.asc not found or not readable"]);
    expect(r.json.hints).toContain("forms.contact.spam.pow: has no effect without the relay");
    const keys = r.json.keys as { name: string; fingerprint: string; problem?: string }[];
    expect(keys.map((k) => k.name)).toEqual(["owner", "old", "gone"]);
    expect(keys[0]!.fingerprint.replace(/ /g, "")).toBe(good.fingerprint.toUpperCase());
    expect(keys[0]!.problem).toBeUndefined();
    expect(keys[1]!.problem).toMatch(/^this key expired on \d{4}-\d{2}-\d{2}$/);
    expect(keys[2]!.problem).toBe("not found or not readable");
  });

  it("reads a single key from a file or from the environment, never a private block", async () => {
    const pair = await generatePair({ name: "Key Person" });
    const dir = site({}, { "owner.asc": pair.publicKey });
    const fromFile = run(["key", "--site", dir, "--file", "owner.asc"]);
    const key = fromFile.json.key as { fingerprint: string; userIds: string[]; expires?: string };
    expect(key.fingerprint.replace(/ /g, "")).toBe(pair.fingerprint.toUpperCase());
    expect(key.userIds).toEqual(["Key Person <owner@example.org>"]);
    expect(key.expires).toBeUndefined();
    expect(String(fromFile.json.armored)).toMatch(/^-----BEGIN PGP PUBLIC KEY BLOCK-----/);

    const fromEnv = run(["key"], { QF_KEY_ARMORED: `junk before\n${pair.publicKey}\n` });
    expect((fromEnv.json.key as { fingerprint: string }).fingerprint).toBe(key.fingerprint);

    const both = run(["key"], { QF_KEY_ARMORED: pair.publicKey + pair.privateKey });
    expect((both.json.key as { problem: string }).problem).toBe(
      "holds a private key block; export only the public key (gpg --export --armor)",
    );
    expect(both.stdout).not.toContain("PRIVATE KEY");
  });
});

describe("cli from an installed copy", () => {
  it("runs with nothing but the files the package ships", () => {
    // Quartz installs the plugin without `npm install`: no node_modules, so whatever the CLI
    // imports beyond node's own modules must be in dist/.
    const copy = tmpDir("cli-installed");
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    for (const entry of [...pkg.files, "package.json"]) {
      fs.cpSync(path.join(root, entry), path.join(copy, entry), { recursive: true });
    }
    const r = run(
      ["relay", "--site", site(relayOptions), "--out", tmpDir("cli-installed-out")],
      {},
      path.join(copy, "dist", "cli.js"),
    );
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.json.written).toContain("send.php");
  });
});

describe("versions", () => {
  it("names the package's version in the relay's X-Mailer", () => {
    // 0.1.2 shipped a send.php that still said 0.1.1.
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const sendPhp = fs.readFileSync(path.join(root, "relay", "php", "send.php"), "utf8");
    expect(sendPhp).toContain(`const QF_VERSION = '${pkg.version}';`);
  });
  it("names the package's version in the status line of both READMEs", () => {
    // Third review, N8 (2026-10-19): both said 0.1.2 when the package was 0.4.0.
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const readme = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
    expect(readme("README.md")).toContain(`**Status: ${pkg.version}, `);
    expect(readme("README.de.md")).toContain(`**Stand: ${pkg.version}, `);
  });
});
