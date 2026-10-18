# quartz-forms

A [Quartz v5](https://quartz.jzhao.xyz) plugin for web forms on a static site: contact, feedback,
sign-up and survey forms, rendered at build time, validated in the browser, encrypted with OpenPGP
before they leave the page, and sent through a configurable transport.

**Status: early development, private.** Nothing here is released yet.

- Forms are defined once in `quartz.config.yaml` (`options.forms`), by id
- A page embeds a form with a ` ```quartz-form ` code block, a `{{form:id}}` placeholder or
  the frontmatter key `form:`; a form can also sit in a layout area on every page
- Field types: text, email, phone, URL, number, date, textarea, select, radio, checkboxes, a single
  checkbox, a scale, a consent checkbox, a hidden value, and a field for the visitor's own public
  PGP key
- Per form: encryption `required`, `optional` or `off`; an anonymous mode without personal data
- Transports: your own relay (a PHP script ships in `relay/php/`), a generic HTTP endpoint,
  presets for form services, or `mailto:`
- Spam protection, all configurable: honeypot and time trap, proof-of-work and rate limiting in
  the relay, Turnstile/hCaptcha
- Labels in several languages, works with quartz-multilanguage

## Installation

```bash
npx quartz plugin add github:boxi-os/quartz-forms
```

```yaml
plugins:
  - source: github:boxi-os/quartz-forms
    enabled: true
    options:
      forms: {}
```

## Options

The option table follows with the data model.

## The relay

`relay/php/` holds a single `send.php` for classic web hosting with PHP. `npm run relay:config --
/path/to/site` writes its generated configuration from the site's `quartz.config.yaml`; recipient
addresses go into `config.php` by hand and never reach the site. See
[relay/php/README.md](relay/php/README.md).

## Development

```bash
npm install
npm run check   # typecheck + lint + format + tests
npm run build   # writes dist/ (committed, Quartz installs from it)
```

`dist/` is committed on purpose. After changing anything under `src/`, run `npm run build` and
commit the updated `dist/`.

A German version of this README is in [README.de.md](README.de.md).

## License

Not decided yet; the package is marked `UNLICENSED` until it is. OpenPGP.js, which the plugin
ships as a separate file, is LGPL-3.0-or-later.
