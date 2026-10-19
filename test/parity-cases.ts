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
  { field: "req", value: "ü".repeat(10), relay: "ok" },
  { field: "req", value: "😀".repeat(5), relay: "ok", note: "5 astral characters, 10 units" },
  { field: "req", value: "😀".repeat(6), relay: "too_long", note: "12 units, as maxlength counts" },
  { field: "txt", value: "abc", relay: "ok" },
  { field: "txt", value: "ABC", relay: "invalid", note: "pattern" },
  { field: "txt", value: "ab1", relay: "invalid" },
  { field: "txt", value: "abcdef", relay: "too_long", note: "length before pattern" },
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
  { field: "mail", value: "@b.de", relay: "invalid" },
  { field: "mail", value: "a@.de", relay: "invalid" },
  { field: "site", value: "https://münchen.de", relay: "ok" },
  { field: "site", value: "http://x.y/p?q#f", relay: "ok" },
  { field: "site", value: "HTTPS://X.Y", relay: "ok" },
  { field: "site", value: "ftp://x.y", relay: "invalid" },
  { field: "site", value: "https://x y.z", relay: "invalid" },
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
