import type { FormDefinition, FormTemplate, Text } from "../types";

const t = (en: string, de: string): Text => ({ en, de });

/**
 * The field sets that ship with the plugin. A template is a partial form definition the user's
 * definition is laid over; own `fields` replace the template's fields entirely (no merge of
 * single fields, so a form never carries a field its author did not write).
 */
const templates: Record<FormTemplate, Partial<FormDefinition>> = {
  contact: {
    title: t("Contact", "Kontakt"),
    fields: [
      { type: "text", name: "name", label: t("Name", "Name"), autocomplete: "name" },
      {
        type: "email",
        name: "email",
        label: t("E-mail", "E-Mail"),
        hint: t("Only if you want a reply.", "Nur, wenn Sie eine Antwort möchten."),
        autocomplete: "email",
      },
      { type: "textarea", name: "message", label: t("Message", "Nachricht"), required: true },
      {
        type: "consent",
        name: "consent",
        text: t(
          "I agree that my message is processed to answer it.",
          "Ich bin einverstanden, dass meine Nachricht zur Beantwortung verarbeitet wird.",
        ),
      },
    ],
  },
  feedback: {
    title: t("Feedback on this page", "Feedback zu dieser Seite"),
    pageContext: true,
    fields: [
      {
        type: "scale",
        name: "rating",
        label: t("How helpful was this page?", "Wie hilfreich war diese Seite?"),
        min: 1,
        max: 5,
        minLabel: t("Not at all", "Gar nicht"),
        maxLabel: t("Very", "Sehr"),
        required: true,
      },
      {
        type: "textarea",
        name: "comment",
        label: t("What could be better?", "Was könnte besser sein?"),
        rows: 4,
      },
    ],
  },
  rsvp: {
    title: t("Sign up", "Anmeldung"),
    fields: [
      {
        type: "text",
        name: "name",
        label: t("Name", "Name"),
        required: true,
        autocomplete: "name",
      },
      {
        type: "email",
        name: "email",
        label: t("E-mail", "E-Mail"),
        required: true,
        autocomplete: "email",
      },
      {
        type: "select",
        name: "choice",
        label: t("Date", "Termin"),
        required: true,
        options: [
          { value: "1", label: t("First date", "Erster Termin") },
          { value: "2", label: t("Second date", "Zweiter Termin") },
        ],
      },
      {
        type: "number",
        name: "guests",
        label: t("Number of people", "Anzahl Personen"),
        min: 1,
        max: 10,
        required: true,
      },
      { type: "textarea", name: "note", label: t("Note", "Anmerkung"), rows: 3 },
      {
        type: "consent",
        name: "consent",
        text: t(
          "I agree that my details are stored to organise the event.",
          "Ich bin einverstanden, dass meine Angaben zur Organisation gespeichert werden.",
        ),
      },
    ],
  },
  survey: {
    title: t("Survey", "Umfrage"),
    anonymous: true,
    fields: [
      {
        type: "radio",
        name: "usage",
        label: t("How often do you visit this site?", "Wie oft besuchen Sie diese Website?"),
        required: true,
        options: [
          { value: "first", label: t("First time", "Zum ersten Mal") },
          { value: "sometimes", label: t("Now and then", "Gelegentlich") },
          { value: "often", label: t("Often", "Oft") },
        ],
      },
      {
        type: "checkboxes",
        name: "topics",
        label: t("Which topics interest you?", "Welche Themen interessieren Sie?"),
        options: [
          { value: "news", label: t("News", "Neuigkeiten") },
          { value: "guides", label: t("Guides", "Anleitungen") },
          { value: "background", label: t("Background", "Hintergrund") },
        ],
      },
      {
        type: "scale",
        name: "satisfaction",
        label: t("How satisfied are you overall?", "Wie zufrieden sind Sie insgesamt?"),
        min: 1,
        max: 5,
      },
      { type: "textarea", name: "comment", label: t("Anything else?", "Noch etwas?"), rows: 3 },
    ],
  },
};

export const templateNames = Object.keys(templates) as FormTemplate[];

export function templateOf(name: FormTemplate): Partial<FormDefinition> {
  // A copy, so a caller can never change the template for the next form.
  return JSON.parse(JSON.stringify(templates[name])) as Partial<FormDefinition>;
}

export function isTemplateName(name: unknown): name is FormTemplate {
  return typeof name === "string" && name in templates;
}
