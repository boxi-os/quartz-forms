import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { tmpDir } from "./keys";

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "relay-config.mjs");

function site(options: Record<string, unknown>): string {
  const dir = tmpDir("relay-site");
  fs.writeFileSync(
    path.join(dir, "quartz.config.yaml"),
    YAML.stringify({
      configuration: { pageTitle: "Test", locale: "de-DE", baseUrl: "example.org/site" },
      plugins: [
        { source: "@quartz-community/frontmatter", enabled: true },
        { source: "github:boxi-os/quartz-forms", enabled: true, options },
      ],
    }),
  );
  return dir;
}

function run(siteDir: string, outDir: string): string {
  return execFileSync("node", [script, siteDir, "--out", outDir], { encoding: "utf8", cwd: root });
}

/** The script's exit status and both streams, with the given flags and environment. */
function runWith(
  siteDir: string,
  outDir: string,
  flags: string[] = [],
  env: NodeJS.ProcessEnv = process.env,
): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [script, siteDir, "--out", outDir, ...flags], {
    encoding: "utf8",
    cwd: root,
    env,
  });
  return { status: r.status, out: r.stdout + r.stderr };
}
const php = spawnSync("php", ["-v"], { stdio: "ignore" }).status === 0;

const options = {
  transport: { kind: "relay", url: "https://example.org/forms/send.php" },
  forms: {
    contact: {
      recipient: "owner",
      subject: { de: "Kontakt", en: "Contact" },
      spam: { pow: true, rateLimitPerHour: 10 },
      fields: [
        { type: "text", name: "name", label: { de: "Name", en: "Name" }, autocomplete: "name" },
        { type: "email", name: "email", label: "E-Mail", required: true },
        {
          type: "select",
          name: "topic",
          label: "Thema",
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
        },
        { type: "scale", name: "rating", label: "Bewertung", min: 1, max: 5 },
        { type: "textarea", name: "message", label: "Nachricht", required: true, maxLength: 500 },
        { type: "consent", name: "ok", text: "Einverstanden" },
        { type: "hidden", name: "src", value: "web" },
      ],
      success: { mode: "redirect", slug: "danke" },
    },
    survey: {
      template: "survey",
      recipient: "owner",
      spam: { captcha: "turnstile", captchaSiteKey: "k" },
    },
    mail: {
      recipient: "x@example.org",
      transport: { kind: "mailto" },
      fields: [{ type: "textarea", name: "m", label: "M", required: true }],
    },
  },
};

describe("relay-config", () => {
  it("writes the forms with their rules into config.generated.php and creates config.php once", () => {
    const siteDir = site(options);
    const out = tmpDir("relay-out");
    const log = run(siteDir, out);
    expect(log).toContain("config.generated.php (2 form(s) on the relay)");
    expect(log).toContain("created");
    const generated = fs.readFileSync(path.join(out, "config.generated.php"), "utf8");
    expect(generated).toContain("'contact' => [");
    expect(generated).toContain("'survey' => [");
    expect(generated).not.toContain("'mail' => [");
    expect(generated).toContain("'recipient' => 'owner'");
    expect(generated).toContain(
      "'subject' => [\n                'de' => 'Kontakt',\n                'en' => 'Contact',\n            ]",
    );
    // The redirect carries the site's base path: the no-JavaScript answer is a 303 to the site,
    // and the site's origin is where it goes when the request's Origin is not an allowed one.
    expect(generated).toContain("'redirect' => '/site/danke'");
    expect(generated).toContain("'siteOrigin' => 'https://example.org'");
    expect(generated).toMatch(/'pow' => true,\n\s+'powDifficulty' => 16/);
    expect(generated).toContain("'rateLimitPerHour' => 10");
    expect(generated).toMatch(/'minSeconds' => 3,\n\s+'noScript' => true/);
    // The subject falls back to the title: null without one, the template's record with one.
    expect(generated).toContain("'title' => null");
    expect(generated).toMatch(/'title' => \[\n\s+'en' => 'Survey',\n\s+'de' => 'Umfrage',\n\s+\]/);
    expect(generated).toMatch(
      /'name' => 'email',\n\s+'type' => 'email',\n\s+'required' => true,\n\s+'label' => 'E-Mail',\n\s+'maxLength' => 2000/,
    );
    expect(generated).toMatch(/'name' => 'message',[\s\S]*?'maxLength' => 500/);
    // The relay inserts a hidden field's value itself, so it needs to know it.
    expect(generated).toMatch(/'name' => 'src',\n\s+'type' => 'hidden',[\s\S]*?'value' => 'web'/);
    expect(generated).toMatch(/'name' => 'topic',[\s\S]*?'options' => \[\n\s+'a',\n\s+'b',\n\s+\]/);
    expect(generated).toMatch(/'optionLabels' => \[\n\s+'a' => 'A',\n\s+'b' => 'B',\n\s+\]/);
    expect(generated).toMatch(/'name' => 'rating',[\s\S]*?'min' => 1,\n\s+'max' => 5/);
    expect(generated).toMatch(
      /'name' => 'ok',\n\s+'type' => 'consent',\n\s+'required' => true,\n\s+'label' => 'Einverstanden'/,
    );
    // the anonymous survey template: captcha switched off, page context off
    expect(generated).toMatch(
      /'survey' => \[[\s\S]*?'anonymous' => true,\n\s+'pageContext' => false,[\s\S]*?'captcha' => 'none'/,
    );
    expect(generated).not.toContain("x@example.org");
    // the secret is the owner's, in config.php; the generated file is rewritten on every run
    expect(generated).not.toContain("captchaSecret");
    expect(fs.readFileSync(path.join(out, "config.php"), "utf8")).toContain(
      "'captchaSecret' => ''",
    );

    const config = fs.readFileSync(path.join(out, "config.php"), "utf8");
    expect(config).toMatch(/'secret' => '[A-Za-z0-9_-]{40,}'/);
    expect(config).toContain("'owner' => 'you@example.org'");
    expect(config).toContain("require __DIR__ . '/config.generated.php'");

    // a second run keeps config.php
    fs.writeFileSync(path.join(out, "config.php"), "<?php // mine");
    const again = run(siteDir, out);
    expect(again).toContain("config.php kept");
    expect(fs.readFileSync(path.join(out, "config.php"), "utf8")).toBe("<?php // mine");
  });

  it.skipIf(!php)(
    "compiles every pattern the way the relay does, with this machine's php, and refuses what PCRE cannot read",
    () => {
      // Second review, finding 3 (2026-10-19): the build reads a pattern as JavaScript, the relay
      // with PCRE, and a pattern PCRE cannot compile makes the relay refuse every value of its
      // field. The build refuses the syntax no PCRE2 reads (validate.test.ts); a property name
      // only JavaScript knows passes it and is caught here.
      const form = (pattern: string) => ({
        transport: { kind: "relay", url: "https://example.org/forms/send.php" },
        forms: {
          f: {
            recipient: "owner",
            fields: [
              { type: "text", name: "code", label: "Code", pattern: "[a-z]+" },
              { type: "text", name: "any", label: "Any", pattern },
            ],
          },
        },
      });
      const out = tmpDir("relay-pattern-out");
      const refused = runWith(site(form("\\p{Assigned}+")), out);
      expect(refused.status).toBe(1);
      expect(refused.out).toContain(
        'forms.f field "any": PCRE cannot read the pattern "\\p{Assigned}+" (Compilation failed: unknown property after \\P or \\p at offset 16); the relay would refuse every value of this field',
      );
      expect(refused.out).toContain("nothing written");
      expect(fs.existsSync(path.join(out, "config.generated.php"))).toBe(false);

      // An owner whose host runs a newer PCRE than this machine says so with the flag, and is
      // reminded of what the relay does with the pattern as it stands.
      const skipped = runWith(site(form("\\p{Assigned}+")), out, ["--skip-pattern-check"]);
      expect(skipped.status).toBe(0);
      expect(skipped.out).toContain('PCRE cannot read the pattern "\\p{Assigned}+"');
      expect(skipped.out).toContain("written anyway (--skip-pattern-check)");
      expect(fs.readFileSync(path.join(out, "config.generated.php"), "utf8")).toContain(
        "'pattern' => '\\\\p{Assigned}+'",
      );

      const fine = runWith(site(form("[A-Z]{3}")), tmpDir("relay-pattern-fine"));
      expect(fine.status).toBe(0);
      expect(fine.out).toMatch(
        /2 pattern\(s\) read by PCRE 10\.\d+ \(PHP \d+\.\d+\.\d+ on this machine; the host's may be older\)/,
      );
    },
  );

  it("says that the patterns were not checked when there is no php on the PATH", () => {
    const bin = tmpDir("relay-no-php-bin");
    fs.symlinkSync(process.execPath, path.join(bin, "node"));
    const out = tmpDir("relay-no-php-out");
    const r = runWith(
      site({
        transport: { kind: "relay", url: "https://example.org/forms/send.php" },
        forms: {
          f: {
            recipient: "owner",
            fields: [{ type: "text", name: "any", label: "Any", pattern: "\\p{Assigned}+" }],
          },
        },
      }),
      out,
      [],
      { ...process.env, PATH: bin },
    );
    expect(r.status).toBe(0);
    expect(r.out).toContain(
      "1 pattern(s) not checked against PCRE: no php on the PATH. The relay refuses every value of a field whose pattern its PCRE cannot read",
    );
    expect(fs.existsSync(path.join(out, "config.generated.php"))).toBe(true);
  });

  it("hands the php of the pattern check none of the QF_ variables", () => {
    // Third review, N5 (2026-10-19): the probe inherited QF_RELAY_OPERATOR, the operator's secret
    // and addresses, which it does not need. A php in front of the PATH that writes what it got.
    const bin = tmpDir("relay-env-bin");
    const dump = path.join(bin, "env.txt");
    const out = tmpDir("relay-env-out");
    fs.writeFileSync(
      path.join(bin, "php"),
      `#!/bin/sh\ncat > /dev/null\nenv > "${dump}"\necho '{"pcre":"10.42","php":"8.3.0","errors":[]}'\n`,
      { mode: 0o755 },
    );
    const r = runWith(
      site({
        transport: { kind: "relay", url: "https://example.org/forms/send.php" },
        forms: {
          f: {
            recipient: "owner",
            fields: [{ type: "text", name: "any", label: "Any", pattern: "[a-z]+" }],
          },
        },
      }),
      out,
      [],
      {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        QF_RELAY_OPERATOR: JSON.stringify({
          secret: "operator-secret-marker-0123456789abcdef",
          allowedOrigins: ["https://example.org"],
          from: "forms@example.org",
          mailer: "mail",
          recipients: { owner: "owner@example.org" },
        }),
        QF_KEY_ARMORED: "key-marker",
        QF_PROBE_SEES: "plain-marker",
      },
    );
    expect([r.status, r.out]).toEqual([0, r.out]);
    // the operator values did reach the command line: config.php has the secret
    expect(fs.readFileSync(path.join(out, "config.php"), "utf8")).toContain(
      "operator-secret-marker",
    );
    const seen = fs.readFileSync(dump, "utf8");
    expect(seen).toContain("PATH=");
    expect(seen).not.toMatch(/operator-secret-marker|key-marker|plain-marker|^QF_/m);
  });

  it("refuses a site without the plugin, and a definition with problems", () => {
    const none = tmpDir("relay-none");
    fs.writeFileSync(path.join(none, "quartz.config.yaml"), "plugins: []\n");
    expect(() => run(none, tmpDir("relay-none-out"))).toThrow(/no quartz-forms entry/);
    const bad = site({ forms: { contact: { fields: [] } } });
    expect(() => run(bad, tmpDir("relay-bad-out"))).toThrow(
      /problem\(s\) in the quartz-forms options/,
    );
  });
});
