# Architecture Reference

Machine-readable architecture overview for `quartz-forms`, a Quartz v5 plugin with a transformer,
an emitter and one component. Sections are filled in as the pieces land; see the plan in the
commit history for what is coming.

## Plugin Lifecycle

1. **Loading**: Quartz reads the `quartz` manifest in `package.json` (`category:
["transformer", "emitter", "component"]`), imports `dist/index.js` and probes its exports
   for a factory per category (`Forms`, `FormsAssets`, `FormBox`).
2. **Initialization**: each factory receives the raw `options` of the YAML entry and runs
   `resolveOptions()`, which applies defaults, templates and the build-time validation.
3. **Transform** (per page): the transformer replaces ```quartz-form code blocks (mdast), the
   `{{form:id}}` placeholders and the frontmatter key (hast) with rendered forms and records on
   `file.data.quartzForms` which forms a page rendered.
4. **Render**: `FormBox` renders the layout-placed form unless the page hides it.
5. **Emit**: `FormsAssets` copies the OpenPGP.js bundle when any rendered form encrypts.
6. **Browser**: `forms.inline.ts` shows the fields whose conditions hold and one step at a
   time, validates, applies the spam traps, encrypts and sends.

## Directory Structure

- `src/index.ts`: factories and types (what Quartz imports). `components/index.ts`: the component.
- `src/types.ts`, `src/options.ts`: data model and defaults.
- `src/conditions.ts`: steps and the conditions per field (`when`), read by browser and relay.
- `src/transformer.ts`, `src/emitter.ts`, `src/components/FormBox.tsx`.
- `src/components/styles/forms.scss`, `src/scripts/forms.inline.ts`.
- `src/i18n/`: plugin UI strings (`en-US`, `de-DE`).
- `src/util/warn.ts` (`warnOnce`), `src/build/validate-manifest.ts`.
- `src/relay/generate.ts`, `src/cli.ts`: relay config and the command line (`dist/cli.js`, with
  `yaml` bundled so an installed copy runs it).
- `relay/php/`: the reference relay.
- `test/`: vitest tests. `dist/`: build output (committed).
