# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Fixes from an independent review of 0.1.1 (another model, fresh context, 2026-10-19):

- A key source that held a private key block behind the public one (the secret key appended to
  `owner.asc` with `gpg --export-secret-keys`) passed every build check, and the whole file went
  into the page: the private key was published on every form page. A source must now hold
  exactly one public key block (`src/pgp/armor.ts`), checked at build time and again whenever
  the file is read, and the page gets that block alone. The emitter reports a file that went bad
  during `--serve`.
- With `encryption: optional` the "send encrypted" box was rendered ticked, so a browser without
  JavaScript showed it ticked and posted plaintext, which the relay mailed. The box is now
  disabled and unticked until the script enables it, a `<noscript>` note says the form sends
  unencrypted without JavaScript (`noScriptPlain`), and the relay refuses a plain post that
  carries the box.
- `send.php` had no automated test; the measurement of 0.1.1 lived in scratch scripts. Now
  `test/relay.test.ts` starts the relay under `php -S` (forms resolved from a
  `quartz.config.yaml` by `relay:config`, mail into an outbox file) and covers the challenge and
  CORS, every refusal, the accepted mails, the plain-form path and the rate limit; CI installs
  PHP and runs `php -l`. Without `php` the suite is skipped with a warning.
- On the plain-form path every ticked `checkboxes` field was refused as `invalid`: the boxes
  share the field's name, and `parse_str` kept only the last value as a string. The relay parses
  the body itself now, collecting repeated names into a list, and takes a single tick as a list
  of one. The `survey` template works without JavaScript again.
- The captcha secret could not be set anywhere that lasted: the generated config carried an
  empty `captchaSecret` under each form, `config.php` could not override it (array union keeps
  the left side), and editing the generated file lost it on the next `relay:config` run. Every
  captcha form was refused. The secret now lives in `config.php` as `captchaSecret` (or per form
  under `captchaSecrets`), a captcha form without one answers `500 captcha_config` instead of a
  silent `400 captcha`, and `captchaVerifyUrls` can point the verification elsewhere (tests).
- The relay's pattern check passed whatever PCRE could not evaluate: escaping `/` for the `/`
  delimiter broke a JavaScript pattern with `\/`, invalid UTF-8 (possible only on the plain-form
  path) and a hit backtrack limit made `preg_match` answer `false`, and `false` counted as a
  pass. The pattern now uses a control character as delimiter, invalid UTF-8 is refused, and a
  pattern PCRE cannot apply refuses the value with a line in the server's error log. The README
  says a pattern must read the same in JavaScript and PCRE.
- Refused posts used up the hourly quota: the rate limit counted before the fields were checked,
  so invalid posts could block a form for an hour without a single mail. The relay now counts
  directly before handing the mail over, after every check.
- `spam.maxBytes` of a form had no effect: the relay compared the body with the largest limit of
  any form (a form with `maxBytes: 300` took a thousand bytes), and the script never looked at
  the size. The relay now applies the addressed form's limit, the script refuses a body above it
  before sending, in the page's language (`tooLarge`), and says the relay's 413 the same way.
  The defaults did not fit together either: a textarea of 20 000 CJK characters is about 60 kB,
  armored about 81 kB, above the former 65 536. The default is now 131 072 and the build says
  when a form's fields may hold more than its `maxBytes`.
- Proof of work and time trap stopped no bot. A solved proof was bound to the form and the hour,
  not to the message, so one nonce sent any number of messages for up to two hours; the relay
  now remembers used proofs (`pow-*.spent` beside the counters) and refuses the second use. The
  time trap compared the page's `Date.now()` with the relay's clock, which locked out a visitor
  whose clock ran ahead by more than the time on the page, while `ts=1` passed; the script now
  fetches a ticket from the relay when the page opens (`GET ?challenge=<id>`, which also carries
  the proof-of-work challenge) with a signed stamp of that moment, sends it as `ts`, and the
  relay measures on it with its own clock. A stamp that is not the relay's is `400 stamp`. The
  build says that `pow: true` with `noScript: true` is skipped by a plain post.
- The captcha widget did not appear on a page reached by Quartz' SPA navigation. Turnstile and
  hCaptcha render implicitly only the containers present when their script runs; the next page
  brought a fresh container, Quartz had dropped the script from the head, and the re-added copy
  only warned that it was already loaded: no widget, no token, "please complete the check" for
  ever (measured in Chrome with the Turnstile test key). The script now loads once with
  `render=explicit` and `data-persist`, and every bound form renders its own widget, removes it
  with its cleanup and resets it by id after a failed send.
- With an empty `allowedOrigins` the plain-form redirect went to whatever `Origin` the request
  carried (`Location: https://evil.test/…/thanks`, on the honeypot path too), and CORS echoed
  that origin. The redirect base is now the request's origin only when it is one of the listed
  origins, else the site's address from its `baseUrl`, which `relay:config` writes into the
  generated config as `siteOrigin`; without either the relay shows its "sent" page instead of
  redirecting. An empty list answers CORS with `*`, which is what it means.
- The counter files were one URL away: `counters/` ships next to `send.php`, inside the web
  root, and `GET /counters/<form>-<hour>.count` answered the hour's count; the example outbox
  path in `config.php` would have served every message the same way. `counters/` now carries a
  `.htaccess` that denies the web (Apache 2.4 and 2.2 syntax), the relay writes it again when it
  is missing, the example outbox path is outside the web root, and the README says to put
  `counterDir` outside the web root or to deny it in nginx.
- A `config.php` copied by hand from the example signed stamps and challenges with
  `REPLACE-WITH-A-LONG-RANDOM-STRING`, a missing `secret` with an empty key, so anyone who read
  the example could forge a stamp. A missing, placeholder or short secret (under 32 characters)
  now answers `500 secret_config` wherever a signature is needed, with the reason in the
  message; a form without time trap and proof of work still works without one.
- The captcha token was verified with `file_get_contents`, which needs `allow_url_fopen`;
  hosters switch it off, and every captcha form then failed as `400 captcha` "not solved", as
  did a provider that could not be reached. The relay now asks through cURL when
  `allow_url_fopen` is off, answers `500 captcha_config` with the reason when it has neither,
  and `502 captcha_verify` when the provider did not answer (measured under `php -S` with
  `allow_url_fopen=0`, with and without `curl_init`).
- A plain form post (a browser without JavaScript) carries line breaks as CRLF, the browser's
  `maxlength` and the script count them as one character: a textarea of 250 short lines was 499
  characters on the page and 748 at the relay, refused as `too_long`. The relay now normalises
  line breaks before the length check and in the mail.
- E-mail and URL fields were checked by two rules: the script accepted `müller@münchen.de` and
  `https://münchen.de`, the relay's `FILTER_VALIDATE_EMAIL`/`URL` refused them, and the visitor
  read "please use the requested format" for a value the page had taken. Both sides now apply
  one rule (a local part and dotted labels without whitespace; a scheme and a host), letters
  outside ASCII pass, and `Reply-To` is set only for an ASCII address, since `mail()` cannot
  carry another. The relay's `invalid` is now named by the field's type in the browser (e-mail,
  URL, phone, number, date, key) instead of always as a pattern mismatch.
- A `hidden` field was checked on no level: 900 × `x` posted under its name was mailed as if the
  recipient saw the fixed value. The generated relay config now carries the value, and the relay
  puts that value into the mail itself, whatever was posted.
- The armor check of an encrypted submission looked for the two markers only: a phishing text
  between or after them was mailed as the message. The ciphertext must now be exactly one armor
  block as OpenPGP.js writes it (Base64 lines, an optional checksum line, no header lines,
  nothing beside it), measured with a real OpenPGP.js message in the relay suite.
- The check of the visitor's own key (`pgpKey`) ran only when the field was left; sending looked
  for the public-key marker, cleared the error shown at the field and sent an expired key, a
  private key or a paste of public and private block (OpenPGP.js reads the first block and calls
  it public). The check now runs again before sending and its result counts; a text that holds a
  private key block is refused in the browser and by the relay.
- A refusal of the relay reached the visitor as the relay's English log sentence inside the
  page's words ("Die Nachricht wurde nicht angenommen: please wait a moment before sending"), and
  field errors for fields the page does not have (the site and `config.generated.php` drifted
  apart) ended in "Please check 0 field(s)." Every code the visitor can act on now has a sentence
  in the page's language (`too_fast`, `stamp` → `reloadPage`, `pow` → `proofRejected`,
  `captcha` → `captchaFailed`, `rate_limited`, `too_large`); what only the site owner can change
  is "could not be sent" to the visitor and a console warning with the code and the relay's
  sentence. An own `endpoint` is still quoted (`rejected`), its words are the site's.
- The mail went out `8bit` with the visitor's lines as they were: a textarea line of thousands of
  characters broke the 998-octet limit of RFC 5322, and a mail server wraps such a line where it
  likes, possibly inside a UTF-8 sequence, or refuses the mail. The body is now quoted-printable,
  no line longer than 76 octets; mail programs undo the encoding, an armored block stays
  decryptable, and the outbox file of the test mailer holds the encoded form.
- With `pageContext` an encrypted message carried the page inside the ciphertext and, a second
  time, as the slug in the clear beside it: the envelope sent it, the relay wrote `Page: <slug>`
  under the armor. The script now sends the page only with a plaintext message, and the relay
  mails nothing of the envelope on the encrypted path. The plaintext mail showed the slug alone
  where the encrypted text reads `Page: Title (slug)`; the title now travels with the slug
  (`pageTitle`, also as a hidden field of the no-script form) and both paths read the same line.

## [0.1.1] - 2026-10-19

Measured the PHP relay against PHP 8.5.11 (`php -S`): 46 requests covering every refusal
(origin, JSON, time trap, honeypot, unknown field, required, option, length, size, proof of work,
encryption mode, armor), the accepted paths with the mail in an outbox file (labels, `[x]`,
Reply-To only when not anonymous, page line only with page context, the armored message
unchanged), the plain-form path and the rate limit; then the browser measurement of 0.1.0 again
with the PHP relay in place of the mock (29 of 29), and Chrome with JavaScript switched off:
a plain post lands on the relay's German page with the mail written, the redirect form lands on
the site's thank-you page, a `noScript: false` form stays inert without the script and sends
with it (8 of 8). Fixes from it:

- The plain-form path (a browser without JavaScript) always fell into the time trap, because only
  the script fills the time stamp. The relay now skips time trap and proof of work on that path
  and the new `spam.noScript` (default `true`) decides whether to accept it at all; `false`
  renders the form without a target until the script runs.
- The redirect on that path was relative and so resolved against the relay's host; the relay
  now sends it absolute with the request's origin, and `relay:config` prefixes the site's base
  path from `baseUrl`.
- The relay's subject falls back to the form's title before the form id.
- The relay's no-JavaScript answer page is in the submission's language (German or English) and
  the `X-Powered-By` header is removed.
- `npm run relay:config` names a target outside the repo by its absolute path.

## [0.1.0] - 2026-10-19

First working version, private. Measured on 2026-10-19 in a throwaway copy of the gui-test site
built with Quartz 5.0.0, driven in Chrome with playwright-core: all four embeddings render, the
code block leaves no `<pre>` behind, element ids stay unique with two instances on a page, empty
submits show field errors in German with focus and summary, an encryption-required form sends
only an armored PGP message that `gpg` decrypts to the labelled text, the optional toggle sends
plain text when unticked, the proof of work passes the mock relay's check and the redirect lands
on the thank-you page, `form: false` hides the layout form, an English page gets English texts,
forms survive SPA navigation without double binding, no horizontal scroll at 375 px, inputs
follow the dark theme, no console errors. QuartzControl reads the schema (9 of 9 options as
fields). Not measured: the PHP relay against an interpreter, the no-JavaScript path.

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
  reads the visitor's key file into the key field. Proof of work is a stub until the relay lands.
- Encryption with OpenPGP.js 6.3.2: the browser loads the lightweight bundle from
  `static/quartz-forms/openpgp/` only on pages that need it, parses the recipient keys once,
  shows the fingerprint under the form, encrypts the serialised message (`required`, or
  `optional` with the toggle ticked) and sends only the armored ciphertext; the visitor's own
  key is checked (public, not expired) and its fingerprint shown. The build copies the bundle
  and its LGPL licence text unmodified into `dist/vendor/openpgp/` (CI compares them); the
  emitter copies it into the site and runs the deep key check (readable, public, not revoked,
  not expired, able to encrypt), logs every key's fingerprint once and stops the build on a bad
  key. Roundtrip test: what the browser script encrypts, the owner's private key decrypts.
- The relay (`relay/php/send.php`, PHP ≥ 8.1, no dependencies): validation level 3 against the
  definition `npm run relay:config -- <site>` writes into `config.generated.php` (forms, fields,
  spam settings; `config.php` with secret, origins, from and the recipient addresses is created
  once and never overwritten). Checks origin, honeypot, time trap, a stateless proof of work
  (HMAC challenge per form and hour), Turnstile/hCaptcha tokens, a per-form hourly counter
  without addresses, size, every plain-text field (unknown, required, length, options, e-mail,
  number range, pattern) with `{field, code}` answers, and that an encrypted submission is an
  armored PGP message. Mails through `mail()`, sendmail or an outbox file; Reply-To only from a
  non-anonymous form's e-mail field; nothing is logged. A no-JavaScript POST gets a redirect or
  a plain page. The browser script fetches the challenge and hashes in batches so the page stays
  responsive. **Not yet run against a PHP interpreter** (none installed here); see the README.
- Third-party captcha (Turnstile, hCaptcha): the renderer places the provider's container with
  the site key, the browser script loads the provider's script once per page and only when such
  a form is on it, refuses to send without a token and hands the token to the relay (`captcha`)
  or to a service under the widget's own field name. Never for anonymous forms. Service presets
  (`formspree`, `web3forms`) post flat fields with `Accept: application/json`; a service's field
  message is shown at the field.
- The message as the recipient reads it names choices by their labels in the page language and
  draws a checkbox or consent as `[x]`/`[ ]` plus its text (first measured as `Thema: bug` and a
  sentence followed by `: yes`). The browser script, the relay and its generated config agree.
- The stylesheet brings checkboxes and radios back to the browser's own (`all: revert`): a theme
  that draws task-list checkboxes with `appearance: none` and a negative margin pushed ours out
  of the form (measured on the gui-test template).

- Scaffold: manifest with the three categories (transformer, emitter, component), build and test
  tooling copied from quartz-navigations, bilingual README skeleton.
