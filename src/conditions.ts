import type { FormField, PageBreakField, Text } from "./types";

/** Every field type but the page break: the ones with a name, a value and a place in the mail. */
export type NamedField = Exclude<FormField, PageBreakField>;

export function isNamed(field: FormField): field is NamedField {
  return field.type !== "pageBreak";
}

/**
 * One condition a field depends on, as browser and relay read it: the controlling field's name
 * and the values that hold it. `showIf.equals` may be one string; here it is always a list.
 */
export interface Condition {
  field: string;
  equals: string[];
}

/** The fields a condition may name: they have values to compare. */
export const CONTROLLER_TYPES = ["select", "radio", "checkboxes", "checkbox", "scale"] as const;

/** A field's or a page break's own `showIf`, normalized; undefined when it has none or it is not well formed. */
export function conditionOf(field: FormField): Condition | undefined {
  const showIf = (field as { showIf?: unknown }).showIf;
  if (!showIf || typeof showIf !== "object" || Array.isArray(showIf)) return undefined;
  const { field: name, equals } = showIf as { field?: unknown; equals?: unknown };
  if (typeof name !== "string" || !name) return undefined;
  const list = typeof equals === "string" ? [equals] : Array.isArray(equals) ? equals : [];
  const values = list.filter((v): v is string => typeof v === "string" && v !== "");
  return values.length ? { field: name, equals: values } : undefined;
}

/** One step of a form: the fields between two page breaks, and the break that starts it. */
export interface Step {
  title?: Text;
  /** The condition of the page break that starts the step; the first step has none. */
  condition?: Condition;
  fields: NamedField[];
}

/** The steps of a form; a form without page breaks is one step. */
export function stepsOf(fields: FormField[]): Step[] {
  const steps: Step[] = [{ fields: [] }];
  for (const field of fields) {
    if (field.type === "pageBreak") {
      const condition = conditionOf(field);
      steps.push({
        ...(field.title !== undefined ? { title: field.title } : {}),
        ...(condition ? { condition } : {}),
        fields: [],
      });
    } else steps[steps.length - 1]!.fields.push(field);
  }
  return steps;
}

/**
 * Every field's conditions, all of which must hold: the condition of the step it stands in, then
 * its own `showIf`. Written once here and handed to the browser (clientConfig) and the relay
 * (relayData) alike, so both evaluate the same list - in form order, a field also inactive when a
 * field it depends on is.
 */
export function conditionsOf(fields: FormField[]): Map<string, Condition[]> {
  const out = new Map<string, Condition[]>();
  for (const step of stepsOf(fields))
    for (const field of step.fields) {
      const list = [step.condition, conditionOf(field)].filter((c): c is Condition => !!c);
      if (list.length) out.set(field.name, list);
    }
  return out;
}
