# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The data model (`src/types.ts`): forms by id with fields of thirteen types, a global transport
  and spam configuration every form can override, PGP key sources, encryption per form
  (`required | optional | off`), an anonymous mode, success handling, texts per language
  (`string | Record<lang, string>`). `quartz.configSchema` describes all of it in English and
  German and is checked against the types.
- Four templates (`contact`, `feedback`, `rsvp`, `survey`) with bilingual labels.
- Build-time validation (level 1 of three): ids, field names, choices, scales, key sources,
  transport, encryption, spam settings, success; problems stop the build in one error, hints are
  logged once. The anonymous mode is enforced here, not only hinted: required personal fields
  become optional, the page context is dropped.
- The plugin's own texts in `en-US` and `de-DE`, overridable per locale through `options.texts`.
- Rendering: `renderForm()` turns a form into hast (labels, required marks, hints, error slots
  wired by `aria-describedby`, fieldsets for choices and scales, consent with link, the
  visitor's-key field with file button and status line, honeypot, envelope fields, a status
  region and the browser configuration as JSON). The transformer embeds a form through a
  ` ```quartz-form ` code block, a `{{form:id}}` placeholder (also percent-encoded) or the
  frontmatter key; `form: false` hides the layout form. `FormBox` renders `options.layoutForm`
  through the layout block. Unknown form ids stop the build (a visible hint in serve mode);
  redirect slugs are checked against the site's pages.
- The stylesheet: Quartz theme variables, `--quartz-forms-*` custom properties, dark mode.
- The browser script (validation level 2): checks every field against the rules the renderer
  wrote into the form, on leaving a field and on sending, with messages in the page language,
  `aria-invalid`, focus on the first problem and a summary in the status region; honeypot (a
  filled form is told "sent" and nothing leaves the page) and time trap; sends to the relay as a
  JSON envelope, to an endpoint or a service preset as flat fields (JSON or form body), or opens
  the mail program for `mailto`; shows the relay's field errors at the fields, rate limits and
  refusals as sentences; thank-you sentence in place or redirect through Quartz's SPA router;
  reads the visitor's key file into the key field. Encryption and proof of work are stubs until
  their steps land.

- Scaffold: manifest with the three categories (transformer, emitter, component), build and test
  tooling copied from quartz-navigations, bilingual README skeleton.
