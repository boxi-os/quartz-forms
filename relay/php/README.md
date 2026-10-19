# quartz-forms relay (PHP)

A single `send.php` that receives what the plugin's forms post and mails it. For classic web
hosting with PHP ≥ 8.1 and its mbstring extension (nearly every host has it; without it every
request is answered `500 mbstring_config` and says so); no packages to install.

## Install

1. Run `npm run relay:config -- /path/to/site` in the plugin repo. It writes
   `relay/php/config.generated.php` (forms, fields, spam settings from the site's
   `quartz.config.yaml`) and, once, `relay/php/config.php` with a fresh secret. With a `php` on
   your PATH it compiles every field pattern the way `send.php` does and stops at one PCRE
   cannot read (`--skip-pattern-check` writes the config anyway).
2. Edit `config.php`: your origin(s), the `from` address, the recipient addresses, and the
   captcha provider's secret key (`captchaSecret`) when a form uses `spam.captcha`. If you
   copied `config.example.php` by hand instead, set `secret` to a random value of at least 32
   characters (`openssl rand -base64 32`); the relay refuses to sign with the placeholder.
3. Upload `send.php`, `config.php`, `config.generated.php` and the writable `counters/`
   directory with its `.htaccess` to your web space, e.g. `https://example.org/forms/`. The
   counter files say how many messages a form got; the `.htaccess` keeps Apache from serving
   them (the relay writes it again when it is missing). On nginx deny the directory in the
   server block, or better, on any server, set `counterDir` in `config.php` to a directory
   outside the web root. An outbox file (`mailer => ['file' => …]`) belongs outside the web
   root too, or every message is one URL away from anyone.
4. Set `transport.url` in the site to that `send.php` URL and rebuild the site.
5. Whenever you change a form in `quartz.config.yaml`, run step 1 again and upload
   `config.generated.php`.

## What it checks

- Origin against `allowedOrigins`; the form id against the generated list. The origin is the
  request's `Origin` header, or the origin of its `Referer`. A site with `Referrer-Policy:
no-referrer` hides both from a plain form post without JavaScript (the browser sends
  `Origin: null`; so does `same-origin` when the relay is on another host than the site): such a
  post is refused with 403 and a message that says so, since nothing tells it from any other
  page's. The browser script's requests carry the origin under any policy.
- Honeypot (a filled form is told "sent" and nothing is sent), time trap on a stamp the relay
  signed for the form when the page opened (`GET ?challenge=<id>` hands it out, good for that
  form for a day; measured with the relay's clock), proof of work when the form enables it (one per message: used proofs are kept under
  `counters/`, a directory per hour that goes as a whole once its challenges have expired, this
  hour and the next; a proof is marked only once the hour's quota let the message through, so an
  hour never holds more of them than it mailed), captcha token (Turnstile or hCaptcha, unless
  the form is anonymous), rate limit per form and hour (a counter file, counting mails, no
  addresses).
- Plain text: every field against its rule (unknown field, required, length, options, e-mail,
  number range, pattern); errors go back as `{field, code}` and the browser shows them at the
  fields. E-mail and URL follow the browser script's rule, so letters outside ASCII pass on both
  sides; `Reply-To` is set only for an ASCII address. Encrypted: the ciphertext must be exactly
  one armored PGP message block (Base64 lines and a checksum, no header lines, nothing beside
  it); what is inside is not readable here.
- The recipient is a name the config maps to an address. An address still at `@example.` is
  treated as missing.
- The captcha token is verified with the provider over HTTP: with `allow_url_fopen`, or through
  cURL when the hoster has switched that off. A host with neither answers `500 captcha_config`
  and says so; a provider that cannot be reached is `502 captcha_verify`, not "not solved".
- A plain form post (a browser without JavaScript) carries no stamp and no proof of work;
  it gets honeypot, rate limit and field checks, and a form with `noScript: false` refuses it.
  One that asks for encryption (`_encrypt`) is refused too: only the script can encrypt.
  The answer is the form's redirect (made absolute with the request's origin when it is on
  `allowedOrigins`, else with the site's `baseUrl` from the generated config, plus the site's
  base path) or a short page in the submission's language; when fields were refused, the page
  names each one by its label with the sentence the browser script would show at the field.

## What it promises

Nothing is logged by this script. No sender address is stored. An anonymous form gets no
Reply-To and no page context. Your hoster's access log is outside this file.

## Mail

`mail()` by default; `sendmail` or an outbox file through `mailer`. The mail is `text/plain`
UTF-8, quoted-printable (no line longer than 76 octets, whatever the visitor typed), with the
form's subject, `From` from the config and `Reply-To` from the visitor's e-mail field when the
form is not anonymous. In the outbox file the body is therefore encoded; a mail program shows it
decoded. Delivery depends on your hoster's SPF/DKIM setup for the
`from` domain.

With `['sendmail' => '…']` keep the `-i` flag (as in `config.example.php`): without it, a line that
holds a single dot ends the message for sendmail, and everything the visitor wrote after it is
lost. The quoted-printable encoding leaves such a line as it is. `mail()` passes the flag itself.

## Test from the command line

```bash
curl -i -X POST https://example.org/forms/send.php \
  -H 'Content-Type: application/json' -H 'Origin: https://example.org' \
  -d '{"form":"contact","lang":"en","ts":0,"encrypted":false,"fields":{"message":"hello"}}'
```

With `minSeconds` above 0 the `ts: 0` is refused as `stamp` (not the relay's), which proves the
time trap; a stamp from `GET send.php?challenge=contact` sent back at once is `too_fast`.

The repository's `test/relay.test.ts` runs this file under `php -S` with every refusal, the
accepted paths (mail in an outbox file), the plain-form path and the rate limit; `npm test` runs
it whenever `php` is on the PATH.
