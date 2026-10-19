import type { FormField } from "./types";

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

/** A field's own `showIf`, normalized; undefined when it has none or it is not well formed. */
export function conditionOf(field: FormField): Condition | undefined {
  const showIf = (field as { showIf?: unknown }).showIf;
  if (!showIf || typeof showIf !== "object" || Array.isArray(showIf)) return undefined;
  const { field: name, equals } = showIf as { field?: unknown; equals?: unknown };
  if (typeof name !== "string" || !name) return undefined;
  const list = typeof equals === "string" ? [equals] : Array.isArray(equals) ? equals : [];
  const values = list.filter((v): v is string => typeof v === "string" && v !== "");
  return values.length ? { field: name, equals: values } : undefined;
}

/**
 * Every field's conditions, all of which must hold: its own `showIf`. Written once here and
 * handed to the browser (clientConfig) and the relay (relayData) alike, so both evaluate the same
 * list - in form order, a field also inactive when a field it depends on is.
 */
export function conditionsOf(fields: FormField[]): Map<string, Condition[]> {
  const out = new Map<string, Condition[]>();
  for (const field of fields) {
    const own = conditionOf(field);
    if (own) out.set(field.name, [own]);
  }
  return out;
}
