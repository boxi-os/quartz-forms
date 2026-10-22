# quartz-forms

Provider-agnostic instruction file for AI coding assistants working on this repository.

## Project Overview

`quartz-forms` is a Quartz v5 plugin with a transformer, an emitter and one component. It renders
web forms defined in `quartz.config.yaml`, validates them in the browser, encrypts them with
OpenPGP before sending and posts them to a configurable transport. A PHP relay for the site
owner's own web space lives in `relay/php/`. See `ARCHITECTURE.md` for the lifecycle and file
map, `README.md` for user-facing options.

## Files to Modify

- `src/types.ts`: `QuartzFormsOptions` and the whole data model (single definition, documented
  per field). `quartz.configSchema` in `package.json` is checked against it by
  `test/config-schema.test.ts`, in both directions.
- `src/options.ts`: defaults and `resolveOptions()` (single source of truth for defaults).
- `src/validate.ts`: build-time validation of the form definitions (level 1 of three).
- `src/conditions.ts`: the steps of a form and each field's conditions (`showIf` and its step's),
  written as a `when` list into the browser's and the relay's config.
- `src/render/`: pure functions from a form definition to hast; used by the transformer and the
  component.
- `src/transformer.ts`: code block, placeholder and frontmatter embedding.
- `src/components/FormBox.tsx`: the form placed through the layout.
- `src/emitter.ts`: copies the OpenPGP.js bundle into `static/`.
- `src/scripts/forms.inline.ts`: browser script (validation level 2, spam traps, encryption,
  sending). Must stay a plain script (no `export`, no `declare global`).
- `src/components/styles/forms.scss`: the single stylesheet; every tunable value is a
  `--quartz-forms-*` custom property.
- `src/i18n/locales/*.ts`: plugin UI strings; add a locale by copying `en-US.ts`.
- `relay/php/`: `send.php` (validation level 3 against the definition written into
  `config.php`), `config.example.php`, README.
- `src/relay/generate.ts`: the relay's generated config (`config.generated.php`) and the owner's
  `config.php` from a site's options; `src/cli.ts`: the command line around it (`relay`,
  `check`, `key`), bundled into `dist/cli.js` for an installed copy.
- `src/messages/`: the plugin's messages about a definition as path, code and values, with an
  English (`en.ts`, word for word the build log) and a German catalog (`de.ts`, typed against
  it). A new message gets a code in both; `test/messages.test.ts` holds the German one to every
  value the English one names.
- `scripts/relay-config.mjs`: `npm run relay:config`, a thin wrapper around `dist/cli.js relay`.
- `test/`: vitest tests. `relay.test.ts` runs `send.php` under `php -S` (skipped, with a
  warning, when there is no `php`); every relay fix comes with a case there.

## Leave Alone

- `dist/`: build output. **Tracked and committed** (Quartz installs from it). Rebuild with
  `npm run build` after any change under `src/` and commit the result. `dist/vendor/openpgp/` is
  copied from `node_modules/openpgp` by the build, never edited.
- `.github/`: CI configuration.
- `tsup.config.ts`: only touch to add loaders or the vendor copy (the `.scss` and `.inline.ts`
  loaders must stay mirrored in `vitest.config.ts`).

## Workflow

1. Change code under `src/` and add/adjust tests in `test/`.
2. `npm run check` (typecheck, lint, prettier, vitest) must pass.
3. `npm run build`, commit `dist/` together with the source change. CI rebuilds `dist/` and fails
   if the result differs from the committed one.
4. Update `README.md` / `README.de.md` (options table) and `CHANGELOG.md`.

## Constraints

- Quartz calls every factory with the YAML `options` laid over the manifest's `defaultOptions`,
  one level deep (`{ ...manifest.defaultOptions, ...entry.options }`): a site without a `spam`
  block hands over the whole default one. Keep defaults in `src/options.ts`; the manifest mirrors
  them (`test/config-schema.test.ts`), and "written by the owner" means "differs from the
  default" for a global value (`writtenSpam` in `src/options.ts`).
- The manifest declares exactly one component (`FormBox`); Quartz resolves the YAML `layout`
  block by plugin name. Never add a `default` export to `src/index.ts`.
- Validation rules live once, in the form definition. Build, browser and relay derive from it;
  no level has rules of its own. Which fields count is one of those rules: `qfActive` in the
  script and `qf_active` in `send.php` evaluate the same `when` lists, and
  `test/parity-cases.ts` holds them to one catalog.
- Recipient addresses never reach the built site. The page sends a form id; the relay maps it to
  an address in its own `config.php`.
- Encryption happens in the browser only. No transport, including the relay, ever sees a key.
- `anonymous: true` is a promise the code keeps (no required personal fields, no Reply-To, no page
  context, no third-party captcha, no logging in the relay) and the README limits honestly.
- `preact` and `vfile` stay peerDependencies and external; everything else must be bundled.
  Never widen `noExternal` in `tsup.config.ts` beyond `@quartz-community/`.
- Every `addEventListener` in the inline script needs a matching `window.addCleanup()`.
- All code, comments, docs and commit messages in English; `README.de.md` mirrors `README.md`.
- `package.json` keeps `"private": true`. The plugin is installed from GitHub
  (`quartz plugin add github:boxi-os/quartz-forms`), never from npm, and the flag stops an
  accidental `npm publish`. It says nothing about the licence, which is MIT (`LICENSE`).
