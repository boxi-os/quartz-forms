import type { FormField } from "../src/types";

/**
 * One rule source, three checks (build, browser script, relay): this catalog holds the edge
 * cases both suites read, so `qfCheck` in `forms.inline.ts` and `qf_check_field` in `send.php`
 * are measured against the same values (the review of 0.1.1 asked for it, 2026-10-19). Every
 * field is optional except `req` and the consent, so a case fills one field at a time.
 */
export const parityFields: FormField[] = [
  { type: "text", name: "req", label: "Required", required: true, maxLength: 10 },
  { type: "text", name: "txt", label: "Text", maxLength: 5, pattern: "[a-z]+" },
  // The escapes an owner writes, with the browser's meaning: `\s` a fixed list, `\d` and `\w`
  // ASCII, `\v` the vertical tab (second review, finding 10, 2026-10-19).
  {
    type: "text",
    name: "esc",
    label: "Escapes",
    pattern: "a\\sb|\\d\\d|\\w\\w\\w|[\\s\\d]{4}|\\Sx|a\\vb",
  },
  { type: "textarea", name: "area", label: "Area", maxLength: 10 },
  { type: "email", name: "mail", label: "Mail" },
  { type: "url", name: "site", label: "Site" },
  { type: "tel", name: "tel", label: "Tel" },
  { type: "number", name: "num", label: "Number", min: 1, max: 10 },
  { type: "date", name: "day", label: "Day" },
  { type: "scale", name: "rate", label: "Rate", min: 1, max: 5 },
  {
    type: "select",
    name: "pick",
    label: "Pick",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  {
    type: "radio",
    name: "one",
    label: "One",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  {
    type: "checkboxes",
    name: "many",
    label: "Many",
    options: [
      { value: "x", label: "X" },
      { value: "y", label: "Y" },
    ],
  },
  { type: "checkbox", name: "box", label: "Box" },
  { type: "consent", name: "consent", text: "Agreed" },
];

/** What the relay answers for the field; the script must agree on ok vs. refused, and on these two codes. */
export type ParityOutcome = "ok" | "required" | "too_long" | "not_an_option" | "invalid";

export interface ParityCase {
  field: string;
  value: string | string[];
  relay: ParityOutcome;
  note?: string;
}

export const parityCases: ParityCase[] = [
  // required and length: characters as the browser's maxlength counts them (UTF-16 units), trimmed
  { field: "req", value: "x", relay: "ok" },
  { field: "req", value: "", relay: "required" },
  { field: "req", value: "   ", relay: "required", note: "whitespace only is empty" },
  { field: "req", value: "  ", relay: "required", note: "Unicode whitespace too" },
  { field: "req", value: "abcdefghij", relay: "ok" },
  { field: "req", value: "abcdefghijk", relay: "too_long" },
  { field: "req", value: "  abcdefghij  ", relay: "ok", note: "measured after trimming" },
  // Second review, finding 10 (2026-10-19): trim() strips the browser's whitespace list, which
  // has U+FEFF and lacks U+0085; qf_trim stripped U+0085 and kept U+FEFF.
  { field: "req", value: "﻿", relay: "required", note: "a BOM alone is empty on both sides" },
  { field: "req", value: "\u0085", relay: "ok", note: "NEL is not whitespace to the browser" },
  { field: "req", value: "​", relay: "ok", note: "neither side trims a zero-width space" },
  { field: "req", value: "ü".repeat(10), relay: "ok" },
  { field: "req", value: "😀".repeat(5), relay: "ok", note: "5 astral characters, 10 units" },
  { field: "req", value: "😀".repeat(6), relay: "too_long", note: "12 units, as maxlength counts" },
  { field: "txt", value: "abc", relay: "ok" },
  { field: "txt", value: "ABC", relay: "invalid", note: "pattern" },
  { field: "txt", value: "ab1", relay: "invalid" },
  { field: "txt", value: "abcdef", relay: "too_long", note: "length before pattern" },
  { field: "esc", value: "a b", relay: "ok", note: "\\s" },
  { field: "esc", value: "a b", relay: "ok", note: "\\s takes NBSP on both sides" },
  { field: "esc", value: "a﻿b", relay: "ok", note: "\\s takes U+FEFF in the browser" },
  {
    field: "esc",
    value: "a\u0085b",
    relay: "invalid",
    note: "neither \\s nor \\v takes NEL there",
  },
  { field: "esc", value: "a᠎b", relay: "invalid", note: "nor U+180E" },
  { field: "esc", value: "12", relay: "ok", note: "\\d" },
  { field: "esc", value: "١٢", relay: "invalid", note: "\\d is ASCII in the browser" },
  { field: "esc", value: "abc", relay: "ok", note: "\\w" },
  { field: "esc", value: "a_1", relay: "ok" },
  { field: "esc", value: "müd", relay: "invalid", note: "\\w is ASCII in the browser" },
  { field: "esc", value: "1﻿23", relay: "ok", note: "[\\s\\d] inside a class" },
  { field: "esc", value: "١٢٣٤", relay: "invalid" },
  {
    field: "esc",
    value: "\u0085x",
    relay: "ok",
    note: "\\S takes NEL in the browser, trim keeps it",
  },
  { field: "esc", value: "a\u000bb", relay: "ok", note: "\\v is the vertical tab" },
  { field: "area", value: "a\nb\nc\nd\ne", relay: "ok", note: "9 characters, LF" },
  { field: "area", value: "a\r\nb\r\nc\r\nd\r\ne", relay: "ok", note: "CRLF counts as one" },
  { field: "area", value: "a\nb\nc\nd\ne\nf", relay: "too_long", note: "11 characters" },
  // e-mail and URL: one regular expression on both sides
  { field: "mail", value: "a@b.cd", relay: "ok" },
  { field: "mail", value: "müller@münchen.de", relay: "ok" },
  { field: "mail", value: "a@b.de ", relay: "ok", note: "trailing Unicode space trimmed" },
  { field: "mail", value: "a@b", relay: "invalid" },
  { field: "mail", value: "a b@c.de", relay: "invalid" },
  { field: "mail", value: "a b@c.de", relay: "invalid", note: "NBSP is whitespace on both sides" },
  { field: "mail", value: "a\u0085b@example.org", relay: "ok", note: "NEL is not (finding 10)" },
  { field: "mail", value: "a﻿b@example.org", relay: "invalid", note: "U+FEFF is" },
  { field: "mail", value: "a​b@example.org", relay: "ok", note: "a zero-width space is not" },
  { field: "mail", value: "@b.de", relay: "invalid" },
  { field: "mail", value: "a@.de", relay: "invalid" },
  { field: "site", value: "https://münchen.de", relay: "ok" },
  { field: "site", value: "http://x.y/p?q#f", relay: "ok" },
  { field: "site", value: "HTTPS://X.Y", relay: "ok" },
  { field: "site", value: "ftp://x.y", relay: "invalid" },
  { field: "site", value: "https://x y.z", relay: "invalid" },
  { field: "site", value: "https://x﻿y.z", relay: "invalid", note: "U+FEFF is whitespace" },
  { field: "site", value: "https://x\u0085y.z", relay: "ok", note: "NEL is not" },
  { field: "site", value: "example.org", relay: "invalid" },
  { field: "tel", value: "+49 30 1234", relay: "ok" },
  { field: "tel", value: "+49(0)30-12.34/5", relay: "ok" },
  { field: "tel", value: "1234", relay: "invalid", note: "shorter than five" },
  { field: "tel", value: "12345a", relay: "invalid" },
  // number: decimal notation only, comma as decimal mark, bounds inclusive
  { field: "num", value: "5", relay: "ok" },
  { field: "num", value: "1,5", relay: "ok" },
  { field: "num", value: "1", relay: "ok" },
  { field: "num", value: "10", relay: "ok" },
  { field: "num", value: "1e1", relay: "ok", note: "10" },
  { field: "num", value: " 5 ", relay: "ok" },
  { field: "num", value: "0", relay: "invalid", note: "below min" },
  { field: "num", value: "11", relay: "invalid", note: "above max" },
  { field: "num", value: "0x5", relay: "invalid", note: "no hexadecimal" },
  { field: "num", value: "Infinity", relay: "invalid" },
  { field: "num", value: "1_0", relay: "invalid" },
  { field: "num", value: "٥", relay: "invalid", note: "no other digit systems" },
  { field: "num", value: "abc", relay: "invalid" },
  // date: a calendar day in ISO form
  { field: "day", value: "2026-10-19", relay: "ok" },
  { field: "day", value: "2024-02-29", relay: "ok" },
  { field: "day", value: "2026-02-29", relay: "invalid", note: "no leap day" },
  { field: "day", value: "2026-02-30", relay: "invalid" },
  { field: "day", value: "2026-13-01", relay: "invalid" },
  { field: "day", value: "2026-00-10", relay: "invalid" },
  { field: "day", value: "19.10.2026", relay: "invalid" },
  // scale: an integer within the bounds
  { field: "rate", value: "3", relay: "ok" },
  { field: "rate", value: "1", relay: "ok" },
  { field: "rate", value: "5", relay: "ok" },
  { field: "rate", value: "0", relay: "not_an_option" },
  { field: "rate", value: "6", relay: "not_an_option" },
  { field: "rate", value: "-1", relay: "not_an_option" },
  { field: "rate", value: "2.5", relay: "invalid" },
  { field: "rate", value: "3.0", relay: "invalid", note: "digits only" },
  { field: "rate", value: "3e0", relay: "invalid" },
  { field: "rate", value: "x", relay: "invalid" },
  // choices
  { field: "pick", value: "a", relay: "ok" },
  { field: "pick", value: "c", relay: "not_an_option" },
  { field: "pick", value: "A", relay: "not_an_option" },
  { field: "one", value: "b", relay: "ok" },
  { field: "one", value: "z", relay: "not_an_option" },
  { field: "many", value: ["x"], relay: "ok" },
  { field: "many", value: ["x", "y"], relay: "ok" },
  { field: "many", value: [], relay: "ok" },
  { field: "many", value: "x", relay: "ok", note: "one box, as the plain path posts it" },
  { field: "many", value: ["z"], relay: "not_an_option" },
  { field: "many", value: ["x", "z"], relay: "not_an_option" },
  // boxes: ticked is "yes", anything else is not a tick
  { field: "box", value: "yes", relay: "ok" },
  { field: "box", value: "", relay: "ok" },
  { field: "box", value: "on", relay: "invalid" },
  { field: "consent", value: "yes", relay: "ok" },
  { field: "consent", value: "", relay: "required" },
  { field: "consent", value: "no", relay: "invalid" },
];

/**
 * Conditional fields (`showIf`, 0.4.0): which fields count for a set of posted values. Browser
 * (`qfActive` + `qfCheck`) and relay (`qf_active` + `qf_check_field`) read the same cases. A
 * dependent field is required, so "counts" shows as `required` while it is empty and `ok` once
 * filled; `dropped` means it does not count - not required, not checked, not mailed.
 */
export const conditionFields: FormField[] = [
  {
    type: "radio",
    name: "topic",
    label: "Topic",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  {
    type: "text",
    name: "ifA",
    label: "If A",
    required: true,
    showIf: { field: "topic", equals: "a" },
  },
  {
    type: "checkboxes",
    name: "many",
    label: "Many",
    options: [
      { value: "x", label: "X" },
      { value: "y", label: "Y" },
      { value: "z", label: "Z" },
    ],
  },
  {
    type: "text",
    name: "ifXY",
    label: "If X or Y",
    required: true,
    showIf: { field: "many", equals: ["x", "y"] },
  },
  { type: "checkbox", name: "box", label: "Box" },
  {
    type: "textarea",
    name: "ifBox",
    label: "If box",
    required: true,
    showIf: { field: "box", equals: "yes" },
  },
  { type: "scale", name: "rate", label: "Rate", min: 1, max: 5 },
  {
    type: "text",
    name: "ifLow",
    label: "If low",
    required: true,
    showIf: { field: "rate", equals: ["1", "2"] },
  },
  // A chain: `sel` counts under topic b, `ifS1` under sel s1.
  {
    type: "select",
    name: "sel",
    label: "Sel",
    options: [
      { value: "s1", label: "S1" },
      { value: "s2", label: "S2" },
    ],
    showIf: { field: "topic", equals: "b" },
  },
  {
    type: "text",
    name: "ifS1",
    label: "If S1",
    required: true,
    showIf: { field: "sel", equals: "s1" },
  },
  // A step that counts only with the box ticked: its condition reaches each of its fields, before
  // a field's own.
  { type: "pageBreak", title: "Step", showIf: { field: "box", equals: "yes" } },
  { type: "text", name: "inStep", label: "In step", required: true },
  {
    type: "text",
    name: "inStepIf5",
    label: "In step, if 5",
    required: true,
    showIf: { field: "rate", equals: "5" },
  },
];

export type ConditionOutcome = "ok" | "required" | "dropped";

export interface ConditionCase {
  values: Record<string, string | string[]>;
  expect: Record<string, ConditionOutcome>;
  note?: string;
}

export const conditionCases: ConditionCase[] = [
  {
    values: {},
    expect: {
      ifA: "dropped",
      ifXY: "dropped",
      ifBox: "dropped",
      ifLow: "dropped",
      sel: "dropped",
      ifS1: "dropped",
      inStep: "dropped",
      inStepIf5: "dropped",
    },
  },
  { values: { topic: "a" }, expect: { ifA: "required" } },
  { values: { topic: "a", ifA: "hi" }, expect: { ifA: "ok" } },
  {
    values: { topic: "b", ifA: "posted anyway" },
    expect: { ifA: "dropped" },
    note: "a value for a field that does not count goes",
  },
  {
    values: { topic: " a " },
    expect: { ifA: "required" },
    note: "the controller's value is trimmed, as the field check trims",
  },
  { values: { many: ["y"] }, expect: { ifXY: "required" } },
  {
    values: { many: ["z", "x"] },
    expect: { ifXY: "required" },
    note: "one of the values ticked is enough",
  },
  {
    values: { many: "x" },
    expect: { ifXY: "required" },
    note: "a plain post with one box ticked sends a string",
  },
  { values: { many: ["z"], ifXY: "posted anyway" }, expect: { ifXY: "dropped" } },
  { values: { box: "yes" }, expect: { ifBox: "required" } },
  { values: { box: "yes", ifBox: "text" }, expect: { ifBox: "ok" } },
  { values: { rate: "2" }, expect: { ifLow: "required" } },
  { values: { rate: "3", ifLow: "posted anyway" }, expect: { ifLow: "dropped" } },
  { values: { topic: "b", sel: "s1" }, expect: { sel: "ok", ifS1: "required" } },
  { values: { topic: "b", sel: "s2", ifS1: "x" }, expect: { ifS1: "dropped" } },
  {
    values: { topic: "a", ifA: "hi", sel: "s1", ifS1: "x" },
    expect: { sel: "dropped", ifS1: "dropped" },
    note: "a field whose controller does not count does not count either",
  },
  {
    values: { box: "yes", ifBox: "t" },
    expect: { inStep: "required", inStepIf5: "dropped" },
    note: "the step counts, a field in it with an own condition still needs that one",
  },
  {
    values: { box: "yes", ifBox: "t", rate: "5", inStep: "s" },
    expect: { inStep: "ok", inStepIf5: "required" },
  },
  {
    values: { rate: "5", inStep: "posted anyway", inStepIf5: "posted anyway" },
    expect: { inStep: "dropped", inStepIf5: "dropped" },
    note: "a field's own condition holds, but its step's does not",
  },
];
