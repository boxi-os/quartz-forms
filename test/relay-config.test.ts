import { execFileSync } from "node:child_process";
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
