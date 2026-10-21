# quartz-forms

A [Quartz v5](https://quartz.jzhao.xyz) plugin for web forms on a static site: contact, feedback,
sign-up and survey forms, rendered at build time, validated in the browser, encrypted with OpenPGP
before they leave the page, and sent through a configurable transport.

**Status: 0.5.11, private.** Measured in a built site and in Chrome; the PHP relay is measured
under `php -S` by the test suite (`test/relay.test.ts`). Reviewed independently seven times, the
third time 0.4.0 as a whole, the fourth 0.4.1 to 0.5.4, the fifth 0.5.5 and 0.5.6, the sixth 0.5.7,
the seventh 0.5.8 and 0.5.9 (see the CHANGELOG); the placeholder hint and the path of “no fields”
in 0.5.10 and, in 0.5.11, `counters` and `generation` on the ticket and the probe file beside the
counters are not reviewed yet.

- Forms are defined once in `quartz.config.yaml` (`options.forms`), by id
- A page embeds a form with a ` ```quartz-form ` code block, a `{{form:id}}` placeholder or
  the frontmatter key `form:`; a form can also sit in a layout area on every page
- Field types: text, email, phone, URL, number, date, textarea, select, radio, checkboxes, a single
  checkbox, a scale, a consent checkbox, a hidden value, and a field for the visitor's own public
  PGP key
- Per form: encryption `required`, `optional` or `off`; an anonymous mode without personal data
- Transports: your own relay (a PHP script ships in `relay/php/`), a generic HTTP endpoint,
  presets for form services, `mailto:`, or a demo that sends nothing and shows what would have
  been sent
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

| Key           | Type                                          | Default             | Description                                                                                                                                            |
| ------------- | --------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `template`    | `contact` \| `feedback` \| `rsvp` \| `survey` | –                   | Start from a built-in field set. Own `fields` replace it entirely.                                                                                     |
| `title`       | Text                                          | –                   | Heading above the form.                                                                                                                                |
| `description` | Text                                          | –                   | A sentence under the heading.                                                                                                                          |
| `submitLabel` | Text                                          | plugin text         | Text of the submit button.                                                                                                                             |
| `fields`      | `Field[]`                                     | –                   | The fields, in order. Required unless `template` is set.                                                                                               |
| `recipient`   | `string`                                      | –                   | Relay: a _name_ the relay maps to an address in its own config. `mailto`: the address.                                                                 |
| `subject`     | Text                                          | title, else form id | Fixed subject line.                                                                                                                                    |
| `transport`   | partial Transport                             | global              | Overrides single transport fields.                                                                                                                     |
| `encryption`  | `{mode, keys?, showFingerprint?}`             | `mode: off`         | `required`: nothing leaves unencrypted (needs JavaScript). `optional`: a ticked toggle the visitor may untick. `keys`: names from `keys`, default all. |
| `anonymous`   | `boolean`                                     | `false`             | See [Anonymous](#anonymous).                                                                                                                           |
| `pageContext` | `boolean`                                     | `false`             | Send the page's title and slug along (feedback). Never for anonymous forms.                                                                            |
| `spam`        | partial Spam                                  | global              | Overrides single spam fields.                                                                                                                          |
| `success`     | `{mode, text?, slug?}`                        | `mode: inline`      | `inline`: a sentence replaces the form. `redirect`: go to the page `slug` (checked at build).                                                          |
| `className`   | `string`                                      | –                   | Extra class(es) next to `quartz-form`.                                                                                                                 |

### Fields

Every field has `type`, `name` (a letter, then letters, digits, `_` or `-`; unique per form) and,
except `hidden` and `consent`, a `label` (Text). Optional on most: `required`, `hint` (Text),
`width` and `showIf` (see below).

| `type`                                                      | Extra keys                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `text`, `email`, `tel`, `url`, `number`, `date`, `textarea` | `placeholder` (Text), `autocomplete`, `pattern`, `min`, `max`, `step`, `rows`, `maxLength` |
| `select`, `radio`, `checkboxes`                             | `options: [{value, label}]`; `layout` (`radio`, `checkboxes`)                              |
| `checkbox`                                                  | –                                                                                          |
| `scale`                                                     | `min`, `max` (integers, at most 21 steps), `minLabel`, `maxLabel`                          |
| `consent`                                                   | `text` (Text), `link`, `linkLabel`; always required                                        |
| `pgpKey`                                                    | the visitor's own public key (pasted or chosen as a file); at most one                     |
| `hidden`                                                    | `value`                                                                                    |
| `pageBreak`                                                 | no `name`; `title` (Text), `showIf`; starts a step, see [Steps](#steps)                    |

The relay sets `Reply-To` to the first filled-in `email` field. With more than one (yours and a
friend's), give the visitor's own `autocomplete: email`: then only such fields count.

A `pattern` is a JavaScript regular expression (the build and the browser read it with `u`), and
the relay applies it with PCRE: write only what both read the same way. The build refuses what no
PCRE2 reads (`\u` escapes, `[^]`, a lookbehind of unlimited length), and `npm run relay:config`
compiles every pattern with the `php` on your machine and stops at one PCRE cannot read, such as a
property name only JavaScript knows (`--skip-pattern-check` writes the config anyway, for a host
whose PCRE is newer than yours). What the host's PCRE still cannot read makes the relay refuse
every value of that field, with the pattern named in the server's error log.

#### Width and arrangement

`width: half` or `third` sets fields side by side; `full`, the default, takes the whole row. The
widths answer to the form's own width, not the window's, so a form in a sidebar is narrow on a
wide screen too: below 32rem a third becomes a half, below 22rem every field takes the whole row.
These two widths are numbers in the stylesheet, since container queries take no custom
properties. `layout: inline` sets the options of a `radio` or `checkboxes` field side by side,
wrapping where they do not fit; on a `select` it has no effect, and the build says so. Container
queries need Chrome 105, Safari 16 or Firefox 110; an older browser shows every field across the
whole row.

#### Conditions

`showIf: { field, equals }` shows a field only while an earlier field has one of the values.
`field` names a `select`, `radio`, `checkboxes`, `checkbox` or `scale` field before it; `equals`
is one value or a list: option values, `yes` for a `checkbox`, the number as a string for a
`scale`. A `checkboxes` field meets it with any one of the values ticked. Conditions may chain,
and a field whose controlling field does not count does not count either. `hidden` and `consent`
fields cannot be conditional (a `consent` field not through its step either, see Steps; a
`hidden` value arrives even from a step that does not count).

A field that does not count is not required, not checked, not sent and not in the mail; a value
posted for it is dropped, not refused. Without JavaScript every field shows: a conditional one
carries no native `required`, a note under it says when it is needed ("Only needed if …"), and
the relay decides.

#### Steps

An entry `{ type: pageBreak, title?, showIf? }` in `fields` starts a step. It stands between
fields, never first, last or twice in a row. With JavaScript one step shows at a time, under "Step
2 of 4: Title": "Next" (and Return in a field) checks only the open step, "Back" goes back without
checking, and a step whose `showIf` does not hold, or none of whose fields counts, is passed over
both ways. Encryption, captcha and the submit button show with the last step. When the relay
refuses a field, the form opens its step. A step's condition applies to each of its fields but a
`hidden` value, so the relay drops them like any conditional field; a `consent` field therefore
cannot stand in a step with a `showIf`, and the build refuses it there, so no message goes without
the consent. Without JavaScript all steps show one after the other, each under its title.

### Transport

| Key      | Values                                                          | Description                                                                                                |
| -------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `kind`   | `relay`, `endpoint`, `formspree`, `web3forms`, `mailto`, `demo` | The plugin's PHP relay; any POST URL; two service presets; the mail program; a demonstration.              |
| `url`    | URL, or the service's form id / access key                      | Required for `relay`, `endpoint` and the presets.                                                          |
| `format` | `json` \| `form`                                                | Body encoding for `endpoint`. The relay gets JSON from the script and a plain post without JavaScript.     |
| `extra`  | `Record<string, string>`                                        | Fields sent with every submission to an `endpoint` or a service; the relay, `mailto` and `demo` take none. |

`demo` sends nothing. The form checks what was typed, encrypts it if it encrypts, and shows below
itself the message as the recipient would have read it, with a button to try again. It needs no
`url` and no `recipient`, ignores `success.mode: redirect` and has no target without JavaScript.
It loads no captcha and sets no time trap (`minSeconds`): nothing is sent that either could protect.
It is meant for a site that shows a form without anyone to receive it, such as a handbook on a
host without PHP.

### Spam

| Key                 | Default  | Description                                                                                                                                                                          |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `honeypot`          | `true`   | An invisible field that must stay empty.                                                                                                                                             |
| `minSeconds`        | `3`      | Whole seconds between opening the page and sending, measured by the relay on the script's post; a plain post without JavaScript carries no stamp (see `noScript`). `0` turns it off. |
| `noScript`          | `true`   | Accept plain form posts from browsers without JavaScript; see below.                                                                                                                 |
| `pow`               | `false`  | Proof of work the relay checks, one per message (`relay` only).                                                                                                                      |
| `powDifficulty`     | `16`     | Leading zero bits, 8 to 20. Hashed in a Worker: 16 takes up to a second on a desktop, 18 and more take seconds on a phone (the build says so).                                       |
| `captcha`           | `none`   | `turnstile` or `hcaptcha`; loads that provider's script. Ignored when anonymous: no widget, and the relay asks for no token.                                                         |
| `captchaSiteKey`    | `""`     | The provider's site key; the secret key goes into the relay's `config.php`.                                                                                                          |
| `rateLimitPerHour`  | `60`     | Mails per form and hour the relay sends; refused posts and failed handovers do not count, no addresses (below).                                                                      |
| `maxFieldLength`    | `2000`   | Default length limit of a single-line field.                                                                                                                                         |
| `maxTextareaLength` | `20000`  | Default length limit of a textarea.                                                                                                                                                  |
| `maxKeyLength`      | `16384`  | Length limit of a pasted public key.                                                                                                                                                 |
| `maxBytes`          | `131072` | Size limit of a whole submission, in bytes, measured on its content (a plain post's URL encoding does not count); the build warns when the fields may hold more.                     |

With the relay, the script fetches a ticket when the page opens (`GET send.php?challenge=<id>`):
a stamp of that moment signed by the relay for that form, and the hour's proof-of-work challenge
if the form asks for one. The time trap is measured on that stamp with the relay's clock, so a
visitor's clock that runs ahead does not lock them out, and a made-up stamp or another form's is
refused; a stamp serves its form for a day, so a page left open keeps working. When the relay
does not take the stamp (none came when the page opened, or it is older than a day), the script
fetches a new one, waits `minSeconds` and sends once more; only then does it ask for a reload.
A solved proof of
work sends one message; the relay remembers used ones beside its counters, an hour's worth in a
directory of its own, and marks a proof as used only once the message is accepted and within the
hour's quota, so a refused post does not cost the visitor a new one.
The nonce starts at a random prefix, because the challenge is the same for every visitor of the
hour.

Without JavaScript a form with `encryption: off` or `optional` posts as a plain form to the relay,
which answers with the redirect or a short page (one that names the refused fields with the
sentences the script would show). Such a post carries neither the stamp nor a
proof of work, so the relay applies only honeypot, rate limit and field checks to it; with
`pow: true` or a `minSeconds` of your own the build says so. `noScript: false` refuses these posts and renders the form without
a target until the script runs, with a `<noscript>` note. With `optional` the "send encrypted" box stays unticked and disabled until the
script enables it, and a `<noscript>` note says the form sends unencrypted; a plain post that
carries the box anyway is refused by the relay.

The rate limit protects your mailbox, not your form. It counts a form's mails per hour, with no
address, so it is one quota for everyone: a single client that sends the hour's mails itself
(60 plain posts take under a second) closes the form to every other visitor until the hour is
over, and you receive those 60. Only a captcha makes each such post cost something, or a proof
of work with `noScript: false`, which a plain post cannot skip; an anonymous form loads no
captcha. Without either the build says so for every relay form.

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
it logs the fingerprint and stops on a problem. A key whose encryption subkey is X25519 or X448 in
the form RFC 9580 gave them (what OpenPGP.js 6 creates for `curve25519` and `curve448`) passes, but
GnuPG cannot read it (measured with 2.5.22) and decrypts nothing sent to it; the build says so. The
same holds for any key of version 6 (RFC 9580), whatever its algorithm. A key made with `gpg`
(cv25519, RSA) has no such problem.

Encryption protects the message on its way and in your mailbox, not on the page. Every script on
the page where the visitor types can read the fields before they are encrypted: the captcha
provider's widget (the build says so for an encrypting form with `captcha`), Quartz' `analytics`,
another plugin's script. In the clear travel the form's id, the page's language, the stamp (the
second the page was opened), that the message is encrypted, and the size of the ciphertext; the
mail carries the form's subject and no `Reply-To`, so you answer once you have decrypted the
visitor's address. A service (`endpoint`, `formspree`, `web3forms`) gets the ciphertext as `message`
with the form's `subject` as `_subject`, the transport's `extra` fields and a captcha's token
beside it; the page stays inside the ciphertext.

If OpenPGP.js cannot be loaded in a visitor's browser (network, content blocker, a strict CSP),
an encrypting form says so and sends nothing. A form that does not encrypt still sends; a key the
visitor pasted into a `pgpKey` field then goes out as pasted, checked for its markers only, and
the field says that it went unchecked.

## Validation

The rules of a field stand once, in its definition, and are applied three times: at build time
(ids, names, options, keys, transport, redirect pages), in the browser (with messages in the page
language, on leaving a field and on sending) and in the relay (every plain-text field; an
encrypted submission only by its armor and size). Which fields count under their conditions and
steps is decided the same way in all three: the build holds a condition to an earlier field and
to values it can have, and browser and relay read one list per field derived from it, in one
pass in form order.

## Styling

Every tunable value is a custom property on `.quartz-form`: `--quartz-forms-gap`, `-radius`,
`-border`, `-border-focus`, `-field-bg`, `-error`, `-success`, `-button-bg`, `-button-fg`,
`-max-width`. Set them in `custom.scss`:

```scss
.quartz-form {
  --quartz-forms-button-bg: var(--tertiary);
}
```

The stylesheet sits in Quartz' cascade layer `quartz-base`, so any rule outside it wins whatever
its specificity: your `custom.scss`, and just as much a theme's own unlayered rules. A theme that
styles the article's `input`, `select`, `textarea`, `label`, `button`, `fieldset` or `pre` styles
the form's too (edge, ground, font size, the button's colours). Two rules stand outside the layer
on purpose (`guard.scss`): the form's checkboxes and radios keep the browser's look, and its
paragraphs, headings, fieldsets and the demo's output keep no outer margin; a selector more
specific than `.quartz-form input[type="checkbox"]` or `.quartz-form p` overrides them.

## Texts

Every sentence the plugin shows comes from `src/i18n/locales/` (`en-US`, `de-DE`) and can be
replaced per locale: `texts: { de: { submit: "Abschicken" } }`. Keys are those of `en-US.ts`;
`{name}` placeholders are filled by the code. The German texts and templates address the visitor
informally (du). For the formal Sie, replace the sentences through `texts` and write your own
`fields`; the relay's page for a post without JavaScript keeps its own sentences, which say du.
The message itself is written in the page's language too, including its two lines of the
plugin's own (`messagePage`, `messageKey`); in a mail the relay writes for a post without
JavaScript they are the plugin's defaults, not those from `texts`.

## The relay

`relay/php/` holds a single `send.php` for classic web hosting with PHP 8.1 or newer and its
mbstring extension (the relay says so when that is missing). `npm run relay:config --
/path/to/site` writes its generated configuration from the site's `quartz.config.yaml`; recipient
addresses go into `config.php` by hand and never reach the site. See
[relay/php/README.md](relay/php/README.md).

The same generator ships as a command line for an installed copy (`.quartz/plugins/quartz-forms`
in a site), without `npm install`:

```bash
node dist/cli.js relay --site <site> --out <dir> [--skip-pattern-check] [--json]
node dist/cli.js check --site <site> [--json]   # problems, hints, every key with its fingerprint
node dist/cli.js key   --site <site> --file <key.asc> [--json]
node dist/cli.js texts [--json]                 # the plugin's wording of every text, by locale
```

`--lang de` gives the problems, hints, key problems and refusals in German (English without it;
the build log stays English).

`relay` into a directory of its own writes the whole relay (`send.php`, `counters/.htaccess`,
`counters/qf-probe.count`, `config.generated.php`, `config.php`). With the owner's values as JSON
in the environment variable
`QF_RELAY_OPERATOR` (secret, origins, sender, mailer, recipients, captcha secrets, counter
directory) it writes `config.php` from them on every run; secrets never go through argv. With
`--json` stdout holds one object, among others a `hash` of the generated rules that stays the same
as long as they do, and a `generation` that is new on every run and that the uploaded relay's
ticket answers. This is what QuartzControl runs. `config.php` is written with mode 0600; an
upload over SFTP or FTP does not keep that, so check its mode on the host (see
`relay/php/README.md`, step 3).

The relay answers only requests from the site's origin. A site with `Referrer-Policy:
no-referrer` hides that origin from a plain form post without JavaScript (the browser sends
`Origin: null`), so the relay refuses such posts and says why; the script's requests carry the
origin under any policy.

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
