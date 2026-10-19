# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`quartz-forms` is a [Quartz](https://quartz.jzhao.xyz) v5 plugin: web forms defined in
`quartz.config.yaml`, embedded per page or through the layout, encrypted with OpenPGP in the
browser, sent through a configurable transport. The scaffold follows the sibling projects
`quartz-navigations`, `quartz-layout-box` and `quartz-multilanguage` (same tooling, `dist/`
committed, installed via `github:` or a local path).

`AGENTS.md` (workflow and constraints) and `ARCHITECTURE.md` (lifecycle, file map) are the
detailed references; `README.md` documents all options for users.

## Commands

```bash
npm install          # install deps
npm run build        # tsup build -> dist/ (must be committed after changes to src/)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --max-warnings=0
npm run format       # prettier . --check (use `prettier . --write` to fix)
npm test             # vitest run
npm run check        # typecheck + lint + format + test (run before submitting)
```

Run a single test file: `npx vitest run test/options.test.ts`

`test/relay.test.ts` starts the PHP relay with `php -S` on a free port (forms from a
`quartz.config.yaml` through `scripts/relay-config.mjs`, mail into an outbox file) and drives it
with `fetch`. Without `php` on the PATH it is skipped and says so (`brew install php`).

## Measuring

A form is measured in a throwaway copy of a Quartz site (`~/Documents/QuartzProjekte/gui-test`,
copied into the scratchpad; `content/` there is a symlink into an Obsidian vault, write nothing
there). Install with `npx quartz plugin add /Users/boxi/Development/quartz-forms` (Quartz
symlinks local paths), build with `npx quartz build -o public`, serve `public/` and drive Chrome
with `playwright-core` (`channel: "chrome"`). Mail is measured with a mock relay in the
scratchpad, never with a real mailbox.

## Working rules

- Code, comments, commit messages in English; user-facing texts in `src/i18n/` in de-DE and
  en-US, always both.
- Every rule of the data model has a test. A fix comes with the measurement that found it.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
