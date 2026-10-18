import { QuartzComponent } from '@quartz-community/types';
import { QuartzFormsOptions } from '../types.js';

/**
 * The form placed through the layout (`layout.position`). Rendering is filled in with the
 * data model; this constructor already wires the stylesheet and the browser script.
 */
declare const _default: (userOpts?: Partial<QuartzFormsOptions>) => QuartzComponent;

export { _default as FormBox, QuartzFormsOptions };
