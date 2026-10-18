import { QuartzTransformerPlugin, QuartzEmitterPlugin } from '@quartz-community/types';
import { QuartzFormsOptions, ResolvedOptions } from './types.js';
export { FormDefinition } from './types.js';
export { FormBox } from './components/index.js';

/**
 * Embeds forms into pages: the ```quartz-form code block (mdast), the `{{form:id}}` placeholder
 * and the frontmatter key (hast). Filled in with the data model.
 */
declare const Forms: QuartzTransformerPlugin<Partial<QuartzFormsOptions>>;

/**
 * Copies the OpenPGP.js browser bundle into `static/quartz-forms/` when a rendered form
 * encrypts. Filled in with the encryption step.
 */
declare const FormsAssets: QuartzEmitterPlugin<Partial<QuartzFormsOptions>>;

/** Defaults live only here; the manifest's `defaultOptions` mirrors them for editors. */
declare const defaultOptions: QuartzFormsOptions;
/**
 * Quartz passes the raw YAML `options` of the entry; manifest defaults are not merged in.
 * Every factory of this plugin runs the raw options through here.
 */
declare function resolveOptions(userOpts?: Partial<QuartzFormsOptions>): ResolvedOptions;

export { Forms, FormsAssets, QuartzFormsOptions, ResolvedOptions, defaultOptions, resolveOptions };
