// Quartz resolves the factory for each manifest category by probing the exported functions
// with no arguments (`findFactory` in its config loader). Keep the exports limited to factories
// and helpers that tolerate being called without arguments. Never add a `default` export.
export { Forms } from "./transformer";
export { FormsAssets } from "./emitter";
export { default as FormBox } from "./components/FormBox";
export { resolveOptions, resolveOrThrow, defaultOptions } from "./options";
export { resolveText } from "./text";
export { templateNames, templateOf } from "./templates";

export type {
  QuartzFormsOptions,
  FormDefinition,
  FormField,
  FormTemplate,
  Text,
  TransportConfig,
  SpamConfig,
  EncryptionConfig,
  SuccessConfig,
  ResolvedForm,
  ResolvedOptions,
} from "./types";
