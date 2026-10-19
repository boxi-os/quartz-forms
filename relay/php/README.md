# quartz-forms relay (PHP)

A single `send.php` that receives what the plugin's forms post and mails it. For classic web
hosting with PHP ≥ 8.1; no dependencies.

## Install

1. Run `npm run relay:config -- /path/to/site` in the plugin repo. It writes
   `relay/php/config.generated.php` (forms, fields, spam settings from the site's
   `quartz.config.yaml`) and, once, `relay/php/config.php` with a fresh secret.
2. Edit `config.php`: your origin(s), the `from` address, the recipient addresses, and the
   captcha provider's secret key (`captchaSecret`) when a form uses `spam.captcha`.
3. Upload `send.php`, `config.php`, `config.generated.php` and an empty, writable `counters/`
   directory to your web space, e.g. `https://example.org/forms/`.
4. Set `transport.url` in the site to that `send.php` URL and rebuild the site.
5. Whenever you change a form in `quartz.config.yaml`, run step 1 again and upload
   `config.generated.php`.

## What it checks

- Origin against `allowedOrigins`; the form id against the generated list.
- Honeypot (a filled form is told "sent" and nothing is sent), time trap on a stamp the relay
  signed when the page opened (`GET ?challenge=<id>` hands it out; measured with the relay's
  clock), proof of work when the form enables it (one per message: used proofs are kept as
  `pow-*.spent` files in `counters/` for two hours), captcha token (Turnstile or hCaptcha, unless
  the form is anonymous), rate limit per form and hour (a counter file, counting mails, no
  addresses).
- Plain text: every field against its rule (unknown field, required, length, options, e-mail,
  number range, pattern); errors go back as `{field, code}` and the browser shows them at the
  fields. Encrypted: the ciphertext must be an armored PGP message; nothing else is readable.
- The recipient is a name the config maps to an address. An address still at `@example.` is
  treated as missing.
- A plain form post (a browser without JavaScript) carries no stamp and no proof of work;
  it gets honeypot, rate limit and field checks, and a form with `noScript: false` refuses it.
  One that asks for encryption (`_encrypt`) is refused too: only the script can encrypt.
  The answer is the form's redirect (made absolute with the request's origin and the site's base
  path) or a short page in the submission's language.

## What it promises

Nothing is logged by this script. No sender address is stored. An anonymous form gets no
Reply-To and no page context. Your hoster's access log is outside this file.

## Mail

`mail()` by default; `sendmail` or an outbox file through `mailer`. The mail is `text/plain`
UTF-8 with the form's subject, `From` from the config and `Reply-To` from the visitor's e-mail
field when the form is not anonymous. Delivery depends on your hoster's SPF/DKIM setup for the
`from` domain.

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
