# quartz-forms

A [Quartz v5](https://quartz.jzhao.xyz) plugin for web forms on a static site: contact, feedback,
sign-up and survey forms, rendered at build time, validated in the browser, encrypted with OpenPGP
before they leave the page, and sent through a configurable transport.

**Status: 0.1.1 plus unreleased fixes, private.** Measured in a built site and in Chrome; the PHP relay is measured under `php -S` by the test suite (`test/relay.test.ts`) and was reviewed independently (see the CHANGELOG).

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

## Embedding a form

Three ways on a page, one through the layout:

````markdown
```quartz-form
contact
```
````

```markdown
{{form:contact}}
```

```yaml
---
form: contact # or a list: [contact, feedback]; `form: false` hides the layout form here
---
```

```yaml
# quartz.config.yaml: the same form on every page, placed like any component
options:
  layoutForm: feedback
layout:
  position: afterBody
  priority: 20
```

## Options

All options live under `options:` of the plugin entry. A _Text_ is a string or a record by
language code (`{ de: "Name", en: "Name" }`); the page language picks the entry.

| Option           | Type                                  | Default         | Description                                                              |
| ---------------- | ------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `forms`          | `Record<id, Form>`                    | `{}`            | The forms, by id (`[a-z0-9-]`). See below.                               |
| `transport`      | `Transport`                           | `{kind: relay}` | Where submissions go; every form may override single fields.             |
| `keys`           | `Record<name, {file} \| {armored}>`   | `{}`            | Public PGP keys: a file relative to the site root, or the armored text.  |
| `spam`           | `Spam`                                | see below       | Spam protection and limits; every form may override single fields.       |
| `frontmatterKey` | `string`                              | `"form"`        | Frontmatter key that embeds a form or hides the layout form (`false`).   |
| `codeBlockLang`  | `string`                              | `"quartz-form"` | Language tag of the code block that embeds a form.                       |
| `layoutForm`     | `string`                              | `""`            | Id of the form placed through this entry's `layout` block. Empty: none.  |
| `language`       | `"auto"` \| code                      | `"auto"`        | Language of the layout form: the page's, or a fixed code.                |
| `texts`          | `Record<locale, Record<key, string>>` | `{}`            | Own wording for the plugin's texts, e.g. `de: { submit: "Abschicken" }`. |

### Form

| Key           | Type                                          | Default        | Description                                                                                                                                            |
| ------------- | --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `template`    | `contact` \| `feedback` \| `rsvp` \| `survey` | –              | Start from a built-in field set. Own `fields` replace it entirely.                                                                                     |
| `title`       | Text                                          | –              | Heading above the form.                                                                                                                                |
| `description` | Text                                          | –              | A sentence under the heading.                                                                                                                          |
| `submitLabel` | Text                                          | plugin text    | Text of the submit button.                                                                                                                             |
| `fields`      | `Field[]`                                     | –              | The fields, in order. Required unless `template` is set.                                                                                               |
| `recipient`   | `string`                                      | –              | Relay: a _name_ the relay maps to an address in its own config. `mailto`: the address.                                                                 |
| `subject`     | Text                                          | form id        | Fixed subject line.                                                                                                                                    |
| `transport`   | partial Transport                             | global         | Overrides single transport fields.                                                                                                                     |
| `encryption`  | `{mode, keys?, showFingerprint?}`             | `mode: off`    | `required`: nothing leaves unencrypted (needs JavaScript). `optional`: a ticked toggle the visitor may untick. `keys`: names from `keys`, default all. |
| `anonymous`   | `boolean`                                     | `false`        | See [Anonymous](#anonymous).                                                                                                                           |
| `pageContext` | `boolean`                                     | `false`        | Send the page's title and slug along (feedback). Never for anonymous forms.                                                                            |
| `spam`        | partial Spam                                  | global         | Overrides single spam fields.                                                                                                                          |
| `success`     | `{mode, text?, slug?}`                        | `mode: inline` | `inline`: a sentence replaces the form. `redirect`: go to the page `slug` (checked at build).                                                          |
| `className`   | `string`                                      | –              | Extra class(es) next to `quartz-form`.                                                                                                                 |

### Fields

Every field has `type`, `name` (a letter, then letters, digits, `_` or `-`; unique per form) and,
except `hidden` and `consent`, a `label` (Text). Optional on most: `required`, `hint` (Text).

| `type`                                                      | Extra keys                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `text`, `email`, `tel`, `url`, `number`, `date`, `textarea` | `placeholder` (Text), `autocomplete`, `pattern`, `min`, `max`, `step`, `rows`, `maxLength` |
| `select`, `radio`, `checkboxes`                             | `options: [{value, label}]`                                                                |
| `checkbox`                                                  | –                                                                                          |
| `scale`                                                     | `min`, `max` (integers, at most 21 steps), `minLabel`, `maxLabel`                          |
| `consent`                                                   | `text` (Text), `link`, `linkLabel`; always required                                        |
| `pgpKey`                                                    | the visitor's own public key (pasted or chosen as a file); at most one                     |
| `hidden`                                                    | `value`                                                                                    |

A `pattern` is a JavaScript regular expression (the build and the browser read it with `u`), and
the relay applies it with PCRE: write only what both read the same way. The build refuses what no
PCRE2 reads (`\u` escapes, `[^]`, a lookbehind of unlimited length), and `npm run relay:config`
compiles every pattern with the `php` on your machine and stops at one PCRE cannot read, such as a
property name only JavaScript knows (`--skip-pattern-check` writes the config anyway, for a host
whose PCRE is newer than yours). What the host's PCRE still cannot read makes the relay refuse
every value of that field, with the pattern named in the server's error log.

### Transport

| Key      | Values                                                  | Description                                                                                            |
| -------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `kind`   | `relay`, `endpoint`, `formspree`, `web3forms`, `mailto` | The plugin's PHP relay; any POST URL; two service presets; the mail program.                           |
| `url`    | URL, or the service's form id / access key              | Required for `relay`, `endpoint` and the presets.                                                      |
| `format` | `json` \| `form`                                        | Body encoding for `endpoint`. The relay gets JSON from the script and a plain post without JavaScript. |
| `extra`  | `Record<string, string>`                                | Fields sent with every submission to an `endpoint` or a service; the relay and `mailto` take none.     |

### Spam

| Key                 | Default  | Description                                                                                                                                                                    |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `honeypot`          | `true`   | An invisible field that must stay empty.                                                                                                                                       |
| `minSeconds`        | `3`      | Seconds between opening the page and sending, measured by the relay on the script's post; a plain post without JavaScript carries no stamp (see `noScript`). `0` turns it off. |
| `noScript`          | `true`   | Accept plain form posts from browsers without JavaScript; see below.                                                                                                           |
| `pow`               | `false`  | Proof of work the relay checks, one per message (`relay` only).                                                                                                                |
| `powDifficulty`     | `16`     | Leading zero bits, 8 to 20. Hashed in a Worker: 16 takes up to a second on a desktop, 18 and more take seconds on a phone (the build says so).                                 |
| `captcha`           | `none`   | `turnstile` or `hcaptcha`; loads that provider's script. Ignored when anonymous.                                                                                               |
| `captchaSiteKey`    | `""`     | The provider's site key; the secret key goes into the relay's `config.php`.                                                                                                    |
| `rateLimitPerHour`  | `60`     | Mails per form and hour the relay sends; refused posts do not count, no addresses.                                                                                             |
| `maxFieldLength`    | `2000`   | Default length limit of a single-line field.                                                                                                                                   |
| `maxTextareaLength` | `20000`  | Default length limit of a textarea.                                                                                                                                            |
| `maxKeyLength`      | `16384`  | Length limit of a pasted public key.                                                                                                                                           |
| `maxBytes`          | `131072` | Size limit of a whole submission, in bytes; the build warns when the fields may hold more.                                                                                     |

With the relay, the script fetches a ticket when the page opens (`GET send.php?challenge=<id>`):
a stamp of that moment signed by the relay, and the hour's proof-of-work challenge if the form
asks for one. The time trap is measured on that stamp with the relay's clock, so a visitor's
clock that runs ahead does not lock them out, and a made-up stamp is refused. A solved proof of
work sends one message; the relay remembers used ones beside its counters, an hour's worth in a
directory of its own, and marks a proof as used only once the message is accepted and within the
hour's quota, so a refused post does not cost the visitor a new one.
The nonce starts at a random prefix, because the challenge is the same for every visitor of the
hour.

Without JavaScript a form with `encryption: off` or `optional` posts as a plain form to the relay,
which answers with the redirect or a short page. Such a post carries neither the stamp nor a
proof of work, so the relay applies only honeypot, rate limit and field checks to it; with
`pow: true` or a `minSeconds` of your own the build says so. `noScript: false` refuses these posts and renders the form without
a target until the script runs, with a `<noscript>` note. With `optional` the "send encrypted" box stays unticked and disabled until the
script enables it, and a `<noscript>` note says the form sends unencrypted; a plain post that
carries the box anyway is refused by the relay.

## Anonymous

`anonymous: true` on a form means, and the code enforces it:

- No required personal field: `email`, `tel`, `pgpKey` and fields whose `autocomplete` names a
  person become optional (the build says so).
- No page context, no `Reply-To`, no third-party captcha (nothing of the visitor goes to a third
  party), and the relay logs nothing.

What it cannot promise: your hoster's access log, the network in between, and what a form
service (`formspree`, `web3forms`) records on its side. The build warns about that combination.

## Encryption

OpenPGP.js runs in the visitor's browser, loaded from `static/quartz-forms/openpgp/` only on
pages that need it. The message (`Label: value` per field, the page, the visitor's key) is
encrypted to the configured public keys; only the armored ciphertext leaves the page, as the
body of the mail. Read it with `gpg`, Thunderbird, Mailvelope or GPG Suite. The fingerprint of the
recipient key is shown under the form so a visitor can compare it with the one you publish.

The build checks every key in use: readable, public, not revoked, not expired, able to encrypt;
it logs the fingerprint and stops on a problem.

## Validation

The rules of a field stand once, in its definition, and are applied three times: at build time
(ids, names, options, keys, transport, redirect pages), in the browser (with messages in the page
language, on leaving a field and on sending) and in the relay (every plain-text field; an
encrypted submission only by its armor and size).

## Texts

Every sentence the plugin shows comes from `src/i18n/locales/` (`en-US`, `de-DE`) and can be
replaced per locale: `texts: { de: { submit: "Abschicken" } }`. Keys are those of `en-US.ts`;
`{name}` placeholders are filled by the code.

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
