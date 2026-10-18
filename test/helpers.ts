import type { FormDefinition, QuartzFormsOptions } from "../src/types";

/** A minimal, valid contact form on the relay transport. */
export function contact(extra: Partial<FormDefinition> = {}): FormDefinition {
  return {
    recipient: "owner",
    fields: [
      { type: "text", name: "name", label: "Name" },
      {
        type: "textarea",
        name: "message",
        label: { en: "Message", de: "Nachricht" },
        required: true,
      },
    ],
    ...extra,
  };
}

/** Valid options with one form; `extra` lies over them. */
export function options(extra: Partial<QuartzFormsOptions> = {}): Partial<QuartzFormsOptions> {
  return {
    transport: { kind: "relay", url: "https://example.org/forms/send.php" },
    forms: { contact: contact() },
    ...extra,
  };
}
