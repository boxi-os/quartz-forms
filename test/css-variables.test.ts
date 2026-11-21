// `quartz.cssVariables` in package.json lists the custom properties a site may set, with their
// defaults, a kind, a group and a description in English and German, for editors such as QuartzHub
// (Styles ▸ Variables). The stylesheet is what is true; the list only describes it. So the list is
// held against the stylesheet, both directions: every custom property the `.quartz-form` rule
// declares is listed with the same default (and the dark rule's value as `defaultDark`), and the
// list names nothing the stylesheet does not declare.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Variable = {
  name: string;
  selector: string;
  default?: string;
  defaultDark?: string;
  kind: string;
  group: string;
  description: string;
  description_de: string;
};
type Catalog = {
  groups: { id: string; label: string; label_de: string }[];
  variables: Variable[];
};

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")) as {
  quartz: { cssVariables: Catalog };
};
const catalog = pkg.quartz.cssVariables;
const scss = fs.readFileSync(path.join(__dirname, "../src/components/styles/forms.scss"), "utf-8");

/** The custom properties declared directly in a top-level rule, nested rules left out. */
function declarations(selector: string): Map<string, string> {
  const start = scss.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  let depth = 0;
  let body = "";
  for (let i = scss.indexOf("{", start); i < scss.length; i++) {
    const c = scss[i]!;
    if (c === "{") {
      depth++;
      if (depth === 1) continue;
    }
    if (c === "}") {
      depth--;
      if (depth === 0) break;
    }
    body += depth === 1 ? c : " ";
  }
  const out = new Map<string, string>();
  for (const m of body.replace(/\/\/[^\n]*/g, "").matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!, normalize(m[2]!));
  }
  return out;
}

const normalize = (value: string) =>
  value.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();

const UNSET = new Set<string>();
const KINDS = new Set(["color", "length", "number", "font", "time", "other"]);

describe("quartz.cssVariables", () => {
  const base = declarations(".quartz-form");
  const dark = declarations(':root[saved-theme="dark"] .quartz-form');

  it("lists every custom property of the .quartz-form rule with its default", () => {
    const listed = new Map(catalog.variables.map((v) => [v.name, v]));
    for (const [name, value] of base) {
      expect(listed.get(name)?.default, name).toBe(value);
    }
    for (const [name, value] of dark) {
      expect(listed.get(name)?.defaultDark, name).toBe(value);
    }
  });

  it("names nothing the stylesheet does not declare", () => {
    for (const v of catalog.variables) {
      if (UNSET.has(v.name)) {
        expect(v.default, v.name).toBeUndefined();
        expect(scss).toContain(`--${v.name}`);
      } else {
        expect(base.has(v.name), v.name).toBe(true);
      }
      if (v.defaultDark !== undefined) expect(dark.has(v.name), v.name).toBe(true);
    }
    expect(new Set(catalog.variables.map((v) => v.name)).size).toBe(catalog.variables.length);
  });

  it("gives each one a selector, a known kind, a listed group and both descriptions", () => {
    const groups = new Set(catalog.groups.map((g) => g.id));
    for (const g of catalog.groups) {
      expect(g.label.trim(), g.id).not.toBe("");
      expect(g.label_de.trim(), g.id).not.toBe("");
    }
    for (const v of catalog.variables) {
      expect(v.selector, v.name).toBe(".quartz-form");
      expect(KINDS.has(v.kind), `${v.name}: ${v.kind}`).toBe(true);
      expect(groups.has(v.group), `${v.name}: ${v.group}`).toBe(true);
      expect(v.description.trim(), v.name).not.toBe("");
      expect(v.description_de.trim(), v.name).not.toBe("");
    }
    // Every group is used, and listed in the order its variables first appear.
    const order = [...new Set(catalog.variables.map((v) => v.group))];
    expect(order).toEqual(catalog.groups.map((g) => g.id));
  });
});
