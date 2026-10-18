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

- Scaffold: manifest with the three categories (transformer, emitter, component), build and test
  tooling copied from quartz-navigations, bilingual README skeleton.
