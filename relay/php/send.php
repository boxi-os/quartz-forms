<?php
/**
 * quartz-forms relay: receives a submission from the static site and mails it.
 *
 * Validation level 3 of three: the fields are checked against the definition that
 * `npm run relay:config` wrote into config.generated.php from quartz.config.yaml, so the relay
 * applies the same rules as the build and the browser. Recipient addresses live only here,
 * never on the site; the page sends a form id.
 *
 * Promises this file keeps: nothing is logged, no address of the sender is stored, an anonymous
 * form gets no Reply-To and no page context, and rate limiting counts submissions per form and
 * hour without recording who sent them.
 *
 * PHP >= 8.1, no dependencies. See README.md next to this file.
 */

declare(strict_types=1);

const QF_HONEYPOT = '_hp_website';
const QF_VERSION = '0.1.1';
/** What config.example.php ships as `secret`; relay:config replaces it, a hand copy may not. */
const QF_SECRET_PLACEHOLDER = 'REPLACE-WITH-A-LONG-RANDOM-STRING';
const QF_SECRET_MIN_LENGTH = 32;

$config = require __DIR__ . '/config.php';
header_remove('X-Powered-By');

/** The two sentences the no-JavaScript answer page needs, in the submission's language. */
function qf_words(string $lang): array
{
    $de = [
        'sent' => 'Gesendet',
        'sentText' => 'Danke, Ihre Nachricht wurde gesendet.',
        'notSent' => 'Nicht gesendet',
        'notSentText' => 'Die Nachricht konnte nicht gesendet werden.',
    ];
    $en = [
        'sent' => 'Sent',
        'sentText' => 'Thank you, your message has been sent.',
        'notSent' => 'Not sent',
        'notSentText' => 'The message could not be sent.',
    ];
    return str_starts_with(strtolower($lang), 'de') ? $de : $en;
}

/* ---------------------------------------------------------------- helpers */

function qf_json(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function qf_wants_html(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $ctype = $_SERVER['CONTENT_TYPE'] ?? '';
    return str_contains($ctype, 'application/x-www-form-urlencoded')
        && !str_contains($accept, 'application/json');
}

/** The request's Origin, or the origin of its Referer; '' when it carries neither. */
function qf_request_origin(): string
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '' && isset($_SERVER['HTTP_REFERER'])) {
        $p = parse_url($_SERVER['HTTP_REFERER']);
        if (is_array($p) && isset($p['scheme'], $p['host'])) {
            $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        }
    }
    return $origin;
}

/**
 * The site's origin for a redirect: the request's Origin (or Referer) when it is one of the
 * listed `allowedOrigins` (a site reachable under two names sends the visitor back to the one
 * they came from), else the site's address from the generated config (`siteOrigin`, from the
 * site's baseUrl), else the first listed origin. With an empty list the request's Origin used
 * to be taken as it came, which made the redirect go wherever the poster said (review finding
 * 11, 2026-10-19). A relative Location would resolve against this relay's host.
 */
function qf_site_origin(array $config): string
{
    $allowed = $config['allowedOrigins'] ?? [];
    if ($allowed !== [] && qf_origin_allowed($config)) {
        $origin = qf_request_origin();
        if ($origin !== '') {
            return rtrim($origin, '/');
        }
    }
    $site = $config['siteOrigin'] ?? '';
    if (is_string($site) && $site !== '') {
        return rtrim($site, '/');
    }
    return rtrim((string) ($allowed[0] ?? ''), '/');
}

/** Answer for the no-JavaScript path: a redirect when the form has one, else a plain page. */
function qf_html(int $status, string $title, string $text, ?string $redirect = null, string $detail = ''): never
{
    if ($redirect !== null && $status < 400) {
        if (str_starts_with($redirect, '/')) {
            $site = qf_site_origin($GLOBALS['config']);
            // No address of the site known: the page below says "sent" instead of a redirect
            // that would resolve against this relay's host.
            $redirect = $site === '' ? null : $site . $redirect;
        }
        if ($redirect !== null) {
            header('Location: ' . $redirect, true, 303);
            exit;
        }
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $lang = htmlspecialchars(substr($GLOBALS['qfLang'] ?? 'en', 0, 2), ENT_QUOTES, 'UTF-8');
    $t = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $p = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $d = $detail === '' ? '' : '<p><small>' . htmlspecialchars($detail, ENT_QUOTES, 'UTF-8') . '</small></p>';
    echo "<!doctype html><html lang=\"$lang\"><meta charset=\"utf-8\"><title>$t</title><h1>$t</h1><p>$p</p>$d</html>";
    exit;
}

function qf_fail(int $status, string $error, string $message, array $errors = [], ?string $redirect = null): never
{
    if (qf_wants_html()) {
        $w = qf_words($GLOBALS['qfLang'] ?? 'en');
        qf_html($status, $w['notSent'], $w['notSentText'], null, $message);
    }
    $body = ['ok' => false, 'error' => $error, 'message' => $message];
    if ($errors !== []) {
        $body['errors'] = $errors;
    }
    qf_json($status, $body);
}

function qf_origin_allowed(array $config): bool
{
    $allowed = $config['allowedOrigins'] ?? [];
    if ($allowed === []) {
        return true;
    }
    $origin = qf_request_origin();
    foreach ($allowed as $a) {
        if (strcasecmp(rtrim($a, '/'), rtrim($origin, '/')) === 0) {
            return true;
        }
    }
    return false;
}

function qf_cors(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && qf_origin_allowed($config)) {
        // An empty list means any origin, and says so, instead of echoing the one that arrived.
        $any = ($config['allowedOrigins'] ?? []) === [];
        header('Access-Control-Allow-Origin: ' . ($any ? '*' : $origin));
        if (!$any) {
            header('Vary: Origin');
        }
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Accept');
        header('Access-Control-Max-Age: 600');
    }
}

/**
 * The key that signs challenges and stamps. A copied config.example.php signed with the
 * placeholder, a missing key with '' (review finding 21, 2026-10-19): anyone who reads the
 * example could forge a stamp. The owner's mistake, said as 500 like a missing address; only
 * asked for where a signature is needed, so a form without time trap and proof of work works
 * without a secret.
 */
function qf_secret(array $config): string
{
    $secret = $config['secret'] ?? '';
    if (!is_string($secret) || strlen($secret) < QF_SECRET_MIN_LENGTH || $secret === QF_SECRET_PLACEHOLDER) {
        qf_fail(500, 'secret_config', sprintf(
            'the secret in config.php is missing, shorter than %d characters or still the placeholder',
            QF_SECRET_MIN_LENGTH
        ));
    }
    return $secret;
}

/** Challenge for the proof of work: stateless, bound to the form and the hour. */
function qf_challenge(array $config, string $form, int $window): string
{
    return hash_hmac('sha256', $form . '|' . $window, qf_secret($config));
}

/**
 * The relay's own word on when a page was opened: `issued.signature`, handed out with the
 * challenge and sent back as `ts`. The time trap is measured against it with the relay's clock.
 * The page's clock was used before, which locked out a visitor whose clock ran ahead, and a
 * made-up number such as `ts=1` passed (review findings, 2026-10-19).
 */
function qf_stamp(array $config, int $issued): string
{
    return $issued . '.' . hash_hmac('sha256', 'stamp|' . $issued, qf_secret($config));
}

/** Seconds since the relay issued the stamp; null when it is not the relay's, or older than a day. */
function qf_stamp_age(array $config, mixed $stamp): ?int
{
    if (!is_string($stamp) || !preg_match('/^(\d{1,12})\.[0-9a-f]{64}$/', $stamp, $m)) {
        return null;
    }
    $issued = (int) $m[1];
    if (!hash_equals(qf_stamp($config, $issued), $stamp)) {
        return null;
    }
    $age = time() - $issued;
    return ($age < -60 || $age > 86400) ? null : $age;
}

/**
 * The value when it is a string, else ''. A list or a number where the page sends a string is
 * not a string: `(string)` on `{"form":["x"]}` printed "Warning: Array to string conversion in
 * /…/send.php" before the JSON, with the relay's path (review finding 17, 2026-10-19).
 */
function qf_str(mixed $value): string
{
    return is_string($value) ? $value : '';
}

function qf_leading_zero_bits(string $hex): int
{
    $bits = 0;
    foreach (str_split($hex) as $c) {
        $v = hexdec($c);
        if ($v === 0) {
            $bits += 4;
            continue;
        }
        $bits += 4 - (int) floor(log($v, 2)) - 1;
        break;
    }
    return $bits;
}

function qf_pow_valid(array $config, string $form, int $difficulty, mixed $pow): bool
{
    if (!is_array($pow) || !is_string($pow['challenge'] ?? null) || !is_string($pow['nonce'] ?? null)) {
        return false;
    }
    $challenge = $pow['challenge'];
    $nonce = $pow['nonce'];
    if (strlen($nonce) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/', $nonce)) {
        return false;
    }
    $now = (int) floor(time() / 3600);
    $ok = false;
    foreach ([$now, $now - 1] as $window) {
        if (hash_equals(qf_challenge($config, $form, $window), $challenge)) {
            $ok = true;
            break;
        }
    }
    if (!$ok) {
        return false;
    }
    return qf_leading_zero_bits(hash('sha256', $challenge . ':' . $nonce)) >= $difficulty;
}

/**
 * The directory of the counters and the used proofs: created when missing, and kept with a
 * .htaccess that denies the web, because the counter files tell how many messages a form got
 * and the directory ships next to send.php, inside the web root (review finding 16, 2026-10-19:
 * `GET /counters/survey-2026101906.count` answered `3`). Only Apache reads .htaccess; the
 * README says to put `counterDir` outside the web root, or to deny it in nginx. Null when the
 * directory cannot be made.
 */
function qf_counter_dir(array $config): ?string
{
    $dir = $config['counterDir'] ?? (__DIR__ . '/counters');
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return null;
    }
    $htaccess = $dir . '/.htaccess';
    if (!file_exists($htaccess)) {
        @file_put_contents($htaccess, "# quartz-forms relay: not for the web.\n"
            . "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n");
    }
    return $dir;
}

/**
 * Marks a proof of work as used, or says that it was. The proof is bound to the form and the
 * hour, not to the message, so one solved nonce would otherwise send any number of messages for
 * up to two hours (review finding, 2026-10-19: the same nonce three times, three mails). One
 * file per used proof beside the counters; files older than the challenge's two windows go.
 */
function qf_pow_spent(array $config, string $challenge, string $nonce): bool
{
    $dir = qf_counter_dir($config);
    if ($dir === null) {
        error_log('quartz-forms relay: cannot create the counter directory; a proof of work may be reused');
        return false;
    }
    $window = (int) floor(time() / 3600);
    foreach (glob($dir . '/pow-*.spent') ?: [] as $old) {
        if (preg_match('/^pow-(\d+)-/', basename($old), $m) && (int) $m[1] < $window - 1) {
            @unlink($old);
        }
    }
    $key = substr(hash('sha256', $challenge . ':' . $nonce), 0, 32);
    $file = sprintf('%s/pow-%d-%s.spent', $dir, $window, $key);
    $fh = @fopen($file, 'x'); // atomic: fails when the file is already there
    if ($fh === false) {
        if (file_exists($file)) {
            return true;
        }
        error_log('quartz-forms relay: cannot write to ' . $dir . '; a proof of work may be reused');
        return false;
    }
    fclose($fh);
    return false;
}

/** Counts a mail for this form in this hour; no address, no time beyond the hour. */
function qf_rate_limited(array $config, string $form, int $perHour): bool
{
    if ($perHour <= 0) {
        return false;
    }
    $dir = qf_counter_dir($config);
    if ($dir === null) {
        return false; // cannot count: let the mail through rather than lose it
    }
    $hour = gmdate('YmdH');
    $file = $dir . '/' . preg_replace('/[^a-z0-9-]/', '', $form) . '-' . $hour . '.count';
    foreach (glob($dir . '/*.count') ?: [] as $old) {
        if (!str_ends_with($old, '-' . $hour . '.count')) {
            @unlink($old);
        }
    }
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false;
    }
    flock($fh, LOCK_EX);
    $count = (int) stream_get_contents($fh);
    $limited = $count >= $perHour;
    if (!$limited) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, (string) ($count + 1));
        fflush($fh);
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $limited;
}

/**
 * A form-urlencoded body as the browser sends it: a name that occurs more than once (the boxes
 * of a `checkboxes` field all share the field's name) becomes a list. `parse_str` kept only the
 * last value, so every ticked `checkboxes` field was refused as `invalid` on the plain-form path
 * (review finding, 2026-10-19).
 */
function qf_parse_form(string $raw): array
{
    $out = [];
    foreach (explode('&', $raw) as $pair) {
        if ($pair === '') {
            continue;
        }
        $eq = strpos($pair, '=');
        $name = urldecode($eq === false ? $pair : substr($pair, 0, $eq));
        $value = $eq === false ? '' : urldecode(substr($pair, $eq + 1));
        if (!array_key_exists($name, $out)) {
            $out[$name] = $value;
        } elseif (is_array($out[$name])) {
            $out[$name][] = $value;
        } else {
            $out[$name] = [$out[$name], $value];
        }
    }
    return $out;
}

/**
 * The provider's secret key: `captchaSecrets[<form>]` in config.php, else `captchaSecret`. It
 * lives in the hand-written file only; the generated one is rewritten by every `relay:config`
 * run, and a key under `forms.<id>.spam` there could not be overridden from config.php (array
 * union keeps the left side; review finding, 2026-10-19).
 */
function qf_captcha_secret(array $config, string $formId): string
{
    $secret = $config['captchaSecrets'][$formId] ?? ($config['captchaSecret'] ?? '');
    return is_string($secret) ? $secret : '';
}

/** Where a token is verified; `captchaVerifyUrls` in config.php overrides it (tests, proxies). */
function qf_captcha_verify_url(array $config, string $provider): string
{
    $default = $provider === 'turnstile'
        ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
        : 'https://api.hcaptcha.com/siteverify';
    $url = $config['captchaVerifyUrls'][$provider] ?? $default;
    return is_string($url) && $url !== '' ? $url : $default;
}

/** Whether this PHP can make an HTTP request at all: '' when it can, else the reason for the owner. */
function qf_http_unavailable(): string
{
    if (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOL) || function_exists('curl_init')) {
        return '';
    }
    return 'allow_url_fopen is off and the curl extension is missing: the captcha cannot be verified';
}

/**
 * POSTs a form body and returns the answer, or null when the request could not be made.
 * `file_get_contents` on a URL needs allow_url_fopen, which hosters switch off; every captcha
 * form then failed as "not solved" (review finding 24, 2026-10-19). cURL when it is off.
 */
function qf_http_post(string $url, array $fields): ?string
{
    $body = http_build_query($fields);
    if (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOL)) {
        $ctx = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $body,
            'timeout' => 8,
        ]]);
        $res = @file_get_contents($url, false, $ctx);
        return $res === false ? null : $res;
    }
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) {
            return null;
        }
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $res = curl_exec($ch);
        return is_string($res) ? $res : null;
    }
    return null;
}

/**
 * What the provider says about the token; null when it could not be asked, or did not answer
 * JSON. "Could not check" is not "wrong": the caller tells those two apart.
 */
function qf_captcha_valid(array $config, string $formId, string $provider, mixed $token): ?bool
{
    $secret = qf_captcha_secret($config, $formId);
    if (!is_string($token) || $token === '' || $secret === '') {
        return false;
    }
    $res = qf_http_post(qf_captcha_verify_url($config, $provider), ['secret' => $secret, 'response' => $token]);
    if ($res === null) {
        return null;
    }
    $data = json_decode($res, true);
    if (!is_array($data)) {
        return null;
    }
    return ($data['success'] ?? false) === true;
}

/**
 * Line breaks as the browser counts them. A form post carries CRLF, the browser's maxlength and
 * the script count LF: 250 short lines were 499 characters on the page and 748 here, refused as
 * too long (review finding, 2026-10-19). Normalised before the check and for the mail.
 */
function qf_newlines(mixed $value): mixed
{
    if (is_string($value)) {
        return str_replace(["\r\n", "\r"], "\n", $value);
    }
    if (is_array($value)) {
        return array_map('qf_newlines', $value);
    }
    return $value;
}

// E-mail and URL by the same rule as the browser script (QF_EMAIL/QF_URL there): a local part
// and dot-separated labels without whitespace, a scheme and a host without whitespace. Letters
// outside ASCII pass on both sides. FILTER_VALIDATE_EMAIL/URL refused `müller@münchen.de` and
// `https://münchen.de`, which the page had accepted, and the visitor read "please use the
// requested format" (review finding, 2026-10-19).
// (*UCP): `\s` means Unicode whitespace, as in JavaScript; without it PCRE counts ASCII only,
// and an address with a no-break space passed here and was refused by the script.
const QF_EMAIL = '/(*UCP)^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u';
const QF_URL = '~(*UCP)^https?://[^\s/?#]+(?:[/?#]\S*)?$~iu';
// Decimal notation only, the same expression as the script's QF_NUMBER (is_numeric agreed, but
// the script's Number() took "0x5", so both sides now read one rule).
const QF_NUMBER = '/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i';

/** Trimmed as JavaScript's trim() trims: Unicode whitespace too, not only ASCII. */
function qf_trim(string $value): string
{
    return preg_replace('/(*UCP)^\s+|\s+$/u', '', $value) ?? trim($value);
}

/** Length as the browser's maxlength counts it: UTF-16 units, so an emoji counts two. */
function qf_length(string $value): int
{
    return intdiv(strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')), 2);
}

/**
 * One field against its rule; null when it passes. The same rule as the script's qfCheck,
 * measured against one catalog of cases (test/parity-cases.ts). Before the catalog the two
 * sides parted on whitespace-only values, Unicode whitespace, the length of an emoji, "0x5" as a
 * number, February 30th as a date and "3.0" on a scale (2026-10-19).
 */
function qf_check_field(array $rule, mixed $value): ?string
{
    $type = $rule['type'];
    $isList = $type === 'checkboxes';
    if ($isList) {
        if ($value === null || $value === '') {
            $value = [];
        }
        if (is_string($value)) {
            // one box ticked on the plain-form path
            $value = [$value];
        }
        if (!is_array($value)) {
            return 'invalid';
        }
        foreach ($value as $v) {
            if (!is_string($v) || !mb_check_encoding($v, 'UTF-8')) {
                return 'invalid';
            }
        }
        if ($value === []) {
            return !empty($rule['required']) ? 'required' : null;
        }
        $options = $rule['options'] ?? null;
        if (is_array($options)) {
            foreach ($value as $v) {
                if (!in_array($v, $options, true)) {
                    return 'not_an_option';
                }
            }
        }
        return null;
    }
    if ($value !== null && !is_string($value)) {
        // A form value is a string; `true` became "1" and passed as a scale's first step.
        return 'invalid';
    }
    $value = $value ?? '';
    if (!mb_check_encoding($value, 'UTF-8')) {
        // Only the plain-form path can deliver this (json_decode refuses it); preg_match would
        // answer false on it, which used to count as a pass.
        return 'invalid';
    }
    $value = qf_trim($value);
    if ($value === '') {
        return !empty($rule['required']) ? 'required' : null;
    }
    if (isset($rule['maxLength']) && qf_length($value) > (int) $rule['maxLength']) {
        return 'too_long';
    }
    switch ($type) {
        case 'email':
            if (preg_match(QF_EMAIL, $value) !== 1) {
                return 'invalid';
            }
            break;
        case 'url':
            if (preg_match(QF_URL, $value) !== 1) {
                return 'invalid';
            }
            break;
        case 'tel':
            if (!preg_match('/^\+?[0-9 ().\/-]{5,}$/', $value)) {
                return 'invalid';
            }
            break;
        case 'number':
            $n = str_replace(',', '.', $value);
            if (preg_match(QF_NUMBER, $n) !== 1) {
                return 'invalid';
            }
            if (isset($rule['min']) && (float) $n < (float) $rule['min']) {
                return 'invalid';
            }
            if (isset($rule['max']) && (float) $n > (float) $rule['max']) {
                return 'invalid';
            }
            break;
        case 'date':
            // A calendar day: strtotime() took February 30th and month 00.
            if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $d) || !checkdate((int) $d[2], (int) $d[3], (int) $d[1])) {
                return 'invalid';
            }
            break;
        case 'scale':
            if (!preg_match('/^-?\d+$/', $value)) {
                return 'invalid';
            }
            $n = (int) $value;
            if ((isset($rule['min']) && $n < (int) $rule['min']) || (isset($rule['max']) && $n > (int) $rule['max'])) {
                return 'not_an_option';
            }
            break;
        case 'select':
        case 'radio':
            if (is_array($rule['options'] ?? null) && !in_array($value, $rule['options'], true)) {
                return 'not_an_option';
            }
            break;
        case 'checkbox':
        case 'consent':
            if ($value !== 'yes') {
                return 'invalid';
            }
            break;
        case 'pgpKey':
            // No PGP parser here; but a private block in the paste is visible, and it must not
            // travel in a mail (review finding, 2026-10-19).
            if (!str_contains($value, '-----BEGIN PGP PUBLIC KEY BLOCK-----')
                || str_contains($value, '-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
                return 'invalid';
            }
            break;
    }
    if (!empty($rule['pattern']) && in_array($type, ['text', 'textarea', 'tel', 'url', 'email'], true)) {
        // A control character as delimiter: the pattern is written for JavaScript and may hold
        // `\/`, which escaping `/` for a `/` delimiter turned into `\\/` (a pattern PCRE could not
        // read). An unreadable pattern, invalid input or a hit backtrack limit all gave false,
        // and false used to pass (review finding, 2026-10-19): now it refuses, and the owner
        // finds the reason in the server's error log.
        $m = @preg_match("\x01^(?:" . $rule['pattern'] . ")$\x01u", $value);
        if ($m === 0) {
            return 'invalid';
        }
        if ($m === false) {
            error_log(sprintf(
                'quartz-forms relay: the pattern of field "%s" cannot be applied (%s); the value was refused',
                $rule['name'] ?? '?',
                preg_last_error_msg()
            ));
            return 'invalid';
        }
    }
    return null;
}

/** A Text (string, or record by language) in the submission's language. */
function qf_text(mixed $label, string $lang, string $fallback = ''): string
{
    if ($label === null) {
        return $fallback;
    }
    if (!is_array($label)) {
        return (string) $label;
    }
    $want = strtolower($lang);
    foreach ($label as $k => $v) {
        if (strtolower((string) $k) === $want) {
            return (string) $v;
        }
    }
    $primary = explode('-', str_replace('_', '-', $want))[0];
    foreach ($label as $k => $v) {
        if (explode('-', strtolower(str_replace('_', '-', (string) $k)))[0] === $primary) {
            return (string) $v;
        }
    }
    return (string) reset($label);
}

function qf_label(array $rule, string $lang): string
{
    return qf_text($rule['label'] ?? null, $lang, (string) $rule['name']);
}

/** The message as the recipient reads it, the same shape the browser produces when encrypting. */
function qf_serialize(array $formCfg, array $fields, string $lang, ?array $page): string
{
    $lines = [];
    $key = null;
    foreach ($formCfg['fields'] as $rule) {
        $name = $rule['name'];
        if (!array_key_exists($name, $fields)) {
            continue;
        }
        $value = $fields[$name];
        if ($rule['type'] === 'pgpKey') {
            if (is_string($value) && $value !== '') {
                $key = trim($value);
            }
            continue;
        }
        $label = qf_label($rule, $lang);
        // Choices are shown as the visitor read them; a checkbox as a ticked or empty box.
        if ($rule['type'] === 'checkbox' || $rule['type'] === 'consent') {
            $lines[] = '[' . ((string) $value === '' ? ' ' : 'x') . '] ' . $label;
            continue;
        }
        $named = function ($v) use ($rule, $lang): string {
            $labels = $rule['optionLabels'] ?? null;
            return is_array($labels) && array_key_exists((string) $v, $labels)
                ? qf_text($labels[(string) $v], $lang, (string) $v)
                : (string) $v;
        };
        $shown = is_array($value) ? implode(', ', array_map($named, $value)) : $named(trim((string) $value));
        if ($shown === '' && empty($rule['required'])) {
            continue;
        }
        $lines[] = $rule['type'] === 'textarea' ? "$label:\n$shown" : "$label: $shown";
    }
    if ($page !== null) {
        $lines[] = '';
        $lines[] = 'Page: ' . ($page['title'] !== '' ? $page['title'] . ' (' . $page['slug'] . ')' : $page['slug']);
    }
    if ($key !== null) {
        $lines[] = '';
        $lines[] = 'Public key of the sender:';
        $lines[] = $key;
    }
    return implode("\n", $lines);
}

function qf_header_safe(string $s): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $s) ?? '');
}

/** Sends through mail() or a sendmail binary; headers carry nothing about the sender's machine. */
function qf_mail(array $config, string $to, string $subject, string $body, ?string $replyTo): bool
{
    $from = qf_header_safe((string) ($config['from'] ?? 'forms@localhost'));
    $headers = [
        'From: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: quoted-printable',
        'X-Mailer: quartz-forms-relay/' . QF_VERSION,
        'Auto-Submitted: auto-generated',
    ];
    if ($replyTo !== null) {
        $headers[] = 'Reply-To: ' . qf_header_safe($replyTo);
    }
    $encodedSubject = mb_encode_mimeheader(qf_header_safe($subject), 'UTF-8', 'B', "\r\n");
    $body = str_replace("\r\n", "\n", $body);
    $body = str_replace("\n", "\r\n", $body);
    // Quoted-printable, so that no line of the mail is longer than 76 octets: the body used to go
    // out 8bit with the visitor's lines as they were, and a textarea line of thousands of
    // characters broke RFC 5322's 998-octet limit, which an MTA wraps where it likes, possibly
    // inside a UTF-8 sequence, or refuses (review finding 20, 2026-10-19). The encoder keeps CRLF
    // line breaks as they are and encodes a lone LF, hence the CRLF form above. Mail programs
    // undo the encoding before they show or decrypt the text; an armored block stays decryptable.
    $body = quoted_printable_encode($body);

    $mailer = $config['mailer'] ?? 'mail';
    if (is_array($mailer) && isset($mailer['sendmail'])) {
        $raw = 'To: ' . qf_header_safe($to) . "\r\n" . 'Subject: ' . $encodedSubject . "\r\n"
            . implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n";
        $proc = @proc_open($mailer['sendmail'], [0 => ['pipe', 'r']], $pipes);
        if (!is_resource($proc)) {
            return false;
        }
        fwrite($pipes[0], $raw);
        fclose($pipes[0]);
        return proc_close($proc) === 0;
    }
    if (is_array($mailer) && isset($mailer['file'])) {
        // Testing: append the whole mail to a file instead of sending it.
        $raw = 'To: ' . qf_header_safe($to) . "\r\n" . 'Subject: ' . $encodedSubject . "\r\n"
            . implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n";
        return (bool) @file_put_contents($mailer['file'], $raw . "\r\n----\r\n", FILE_APPEND | LOCK_EX);
    }
    return @mail($to, $encodedSubject, $body, implode("\r\n", $headers));
}

/* ------------------------------------------------------------------- flow */

qf_cors($config);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$forms = $config['forms'] ?? [];

if ($method === 'GET') {
    $form = qf_str($_GET['challenge'] ?? null);
    if ($form === '' || !isset($forms[$form])) {
        qf_json(404, ['ok' => false, 'error' => 'unknown_form', 'message' => 'no such form']);
    }
    if (!qf_origin_allowed($config)) {
        qf_json(403, ['ok' => false, 'error' => 'origin', 'message' => 'origin not allowed']);
    }
    $spam = $forms[$form]['spam'];
    $ticket = ['ok' => true, 'stamp' => qf_stamp($config, time())];
    if (empty($spam['pow'])) {
        qf_json(200, $ticket + ['pow' => false]);
    }
    qf_json(200, $ticket + [
        'pow' => true,
        'challenge' => qf_challenge($config, $form, (int) floor(time() / 3600)),
        'difficulty' => (int) ($spam['powDifficulty'] ?? 16),
    ]);
}

if ($method !== 'POST') {
    qf_json(405, ['ok' => false, 'error' => 'method', 'message' => 'POST only']);
}

// Read no more than the largest limit of any form; the addressed form's limit is applied below.
$maxBytes = 0;
foreach ($forms as $f) {
    $maxBytes = max($maxBytes, (int) ($f['spam']['maxBytes'] ?? 65536));
}
$raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1) ?: '';
if (strlen($raw) > $maxBytes) {
    qf_fail(413, 'too_large', 'the submission is too large');
}

$isForm = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/x-www-form-urlencoded');
if ($isForm) {
    $data = qf_parse_form($raw);
    $envelope = [
        'form' => $data['form'] ?? '',
        'lang' => $data['lang'] ?? '',
        'ts' => $data['ts'] ?? '',
        'page' => $data['page'] ?? null,
        'pageTitle' => $data['pageTitle'] ?? null,
        'encrypted' => false,
        'fields' => $data,
        'pow' => null,
        'captcha' => $data['cf-turnstile-response'] ?? ($data['h-captcha-response'] ?? null),
        QF_HONEYPOT => $data[QF_HONEYPOT] ?? '',
    ];
    foreach (['form', 'lang', 'ts', 'page', 'pageTitle', QF_HONEYPOT, 'cf-turnstile-response', 'h-captcha-response'] as $k) {
        unset($envelope['fields'][$k]);
    }
} else {
    $envelope = json_decode($raw, true);
    if (!is_array($envelope)) {
        qf_fail(400, 'bad_json', 'the body is not JSON');
    }
}

$lang = preg_replace('/[^A-Za-z0-9_-]/', '', qf_str($envelope['lang'] ?? null)) ?: 'en';
$qfLang = $lang; // read by the no-JavaScript answer page

$formId = qf_str($envelope['form'] ?? null);
if ($formId === '' || !isset($forms[$formId])) {
    qf_fail(404, 'unknown_form', 'no such form');
}
$formCfg = $forms[$formId];
$spam = $formCfg['spam'];
$redirect = $formCfg['redirect'] ?? null;

// The body was read up to the largest limit of any form; this form's own limit applies now
// (review finding, 2026-10-19: a form with maxBytes 300 took a thousand bytes).
if (strlen($raw) > (int) ($spam['maxBytes'] ?? 65536)) {
    qf_fail(413, 'too_large', 'the submission is too large');
}

if (!qf_origin_allowed($config)) {
    qf_fail(403, 'origin', 'origin not allowed');
}

// A plain form post comes from a browser without JavaScript (the script posts JSON). The form
// decides whether to accept that; such a post carries neither a time stamp nor a proof of work.
if ($isForm && empty($spam['noScript'])) {
    qf_fail(400, 'javascript', 'this form needs JavaScript');
}
// The page renders the "send encrypted" box disabled until the script ticks it, so a plain post
// that carries it asked for encryption and sent plaintext: refused, never mailed.
if ($isForm && ($envelope['fields']['_encrypt'] ?? '') !== '') {
    qf_fail(400, 'javascript', 'sending encrypted needs JavaScript');
}

// Honeypot: a filled field means a bot. It is told "sent"; nothing is sent.
if (!empty($spam['honeypot'])) {
    $hp = $envelope[QF_HONEYPOT] ?? ($envelope['fields'][QF_HONEYPOT] ?? '');
    if ($hp !== '' && $hp !== null) {
        if (qf_wants_html()) {
            $w = qf_words($lang);
            qf_html(200, $w['sent'], $w['sentText'], $redirect);
        }
        qf_json(200, ['ok' => true]);
    }
    if (is_array($envelope['fields'] ?? null)) {
        unset($envelope['fields'][QF_HONEYPOT]);
    }
}

// Time trap: the script fetched a signed stamp when the page was opened and sends it as `ts`;
// a bot posts within a second of fetching one, or without one.
$minSeconds = (int) ($spam['minSeconds'] ?? 0);
if ($minSeconds > 0 && !$isForm) {
    $age = qf_stamp_age($config, $envelope['ts'] ?? null);
    if ($age === null) {
        qf_fail(400, 'stamp', 'the time stamp is missing or not this relay\'s; please reload the page');
    }
    if ($age < $minSeconds) {
        qf_fail(400, 'too_fast', 'please wait a moment before sending');
    }
}

if (!empty($spam['pow']) && !$isForm) {
    $pow = $envelope['pow'] ?? null;
    if (!qf_pow_valid($config, $formId, (int) ($spam['powDifficulty'] ?? 16), $pow)) {
        qf_fail(400, 'pow', 'the proof of work is missing or wrong');
    }
    if (qf_pow_spent($config, $pow['challenge'], $pow['nonce'])) {
        qf_fail(400, 'pow', 'this proof of work was already used');
    }
}

$captchaProvider = (string) ($spam['captcha'] ?? 'none');
if ($captchaProvider !== 'none' && empty($formCfg['anonymous'])) {
    if (qf_captcha_secret($config, $formId) === '') {
        // The owner's mistake, not the visitor's: said as such, and never a silent 400.
        qf_fail(500, 'captcha_config', 'captchaSecret is not set in config.php');
    }
    $why = qf_http_unavailable();
    if ($why !== '') {
        qf_fail(500, 'captcha_config', $why);
    }
    $valid = qf_captcha_valid($config, $formId, $captchaProvider, $envelope['captcha'] ?? null);
    if ($valid === null) {
        qf_fail(502, 'captcha_verify', 'the captcha provider could not be reached');
    }
    if (!$valid) {
        qf_fail(400, 'captcha', 'the captcha was not solved');
    }
}

$encrypted = !empty($envelope['encrypted']);
$replyTo = null;

// The page a plaintext message refers to: slug and title, read as "Title (slug)" like the line
// the script writes into an encrypted text. An encrypted message carries its page inside the
// ciphertext; the relay used to write the slug beside the armor a second time, in the clear
// (review finding 23, 2026-10-19), so nothing of the envelope is mailed on that path.
$page = null;
if (!$encrypted && !empty($formCfg['pageContext']) && empty($formCfg['anonymous']) && is_string($envelope['page'] ?? null)) {
    $slug = preg_replace('/[^A-Za-z0-9\/._-]/', '', $envelope['page']);
    $title = $envelope['pageTitle'] ?? '';
    $title = is_string($title) ? trim(preg_replace('/[\x00-\x20\x7F]+/', ' ', $title) ?? '') : '';
    if ($slug !== '') {
        $page = ['slug' => $slug, 'title' => mb_substr($title, 0, 200)];
    }
}

if ($encrypted) {
    if (($formCfg['encryption'] ?? 'off') === 'off') {
        qf_fail(400, 'encryption', 'this form does not accept encrypted messages');
    }
    // Exactly one armor block, as OpenPGP.js writes it: the markers, an empty line, Base64 lines,
    // an optional checksum line. No header lines, nothing beside the block: the check used to
    // look for the two markers only, and a phishing text between or after them was mailed as the
    // message (review finding, 2026-10-19). Base64 has no "-", so a second marker cannot hide.
    $cipher = $envelope['ciphertext'] ?? null;
    $armor = '/^-----BEGIN PGP MESSAGE-----\R\R?(?:[A-Za-z0-9+\/]+={0,2}\R)+(?:=[A-Za-z0-9+\/]{4}\R)?-----END PGP MESSAGE-----$/';
    if (!is_string($cipher) || preg_match($armor, trim($cipher)) !== 1) {
        qf_fail(400, 'ciphertext', 'the ciphertext is not an armored PGP message');
    }
    $body = trim($cipher) . "\n";
} else {
    if (($formCfg['encryption'] ?? 'off') === 'required') {
        qf_fail(400, 'encryption', 'this form accepts encrypted messages only');
    }
    $fields = $envelope['fields'] ?? null;
    if (!is_array($fields)) {
        qf_fail(400, 'fields', 'no fields');
    }
    $fields = qf_newlines($fields);
    $rules = [];
    foreach ($formCfg['fields'] as $rule) {
        $rules[$rule['name']] = $rule;
    }
    $errors = [];
    foreach ($fields as $name => $value) {
        if ($name === '_encrypt' || $name === '_key_file') {
            unset($fields[$name]);
            continue;
        }
        if (!isset($rules[$name])) {
            $errors[] = ['field' => (string) $name, 'code' => 'unknown_field'];
        }
    }
    foreach ($rules as $name => $rule) {
        if ($rule['type'] === 'hidden') {
            // A fixed value the page sends along, invisible: the mail shows what the config says,
            // never what was posted (review finding, 2026-10-19: 900 × "x" arrived under the
            // name of a fixed value, looking like one).
            $fields[$name] = (string) ($rule['value'] ?? '');
            continue;
        }
        $code = qf_check_field($rule, $fields[$name] ?? null);
        if ($code !== null) {
            $errors[] = ['field' => $name, 'code' => $code];
        }
    }
    if ($errors !== []) {
        qf_fail(400, 'invalid', 'some fields were not accepted', $errors);
    }
    $body = qf_serialize($formCfg, $fields, $lang, $page);
    if (empty($formCfg['anonymous'])) {
        foreach ($rules as $name => $rule) {
            if ($rule['type'] === 'email' && !empty($fields[$name]) && is_string($fields[$name])) {
                // Only an ASCII address goes into the header: mail() does not negotiate SMTPUTF8,
                // and an address with umlauts would arrive broken. It stays readable in the body.
                $address = trim($fields[$name]);
                if (filter_var($address, FILTER_VALIDATE_EMAIL) !== false) {
                    $replyTo = $address;
                }
                break;
            }
        }
    }
}

$recipientName = (string) ($formCfg['recipient'] ?? '');
$to = $config['recipients'][$recipientName] ?? null;
if (!is_string($to) || $to === '' || str_contains($to, '@example.')) {
    qf_fail(500, 'recipient', 'the relay has no address for this form');
}

$subject = qf_text($formCfg['subject'] ?? $formCfg['title'] ?? null, $lang, $formId);
if (!empty($config['subjectPrefix'])) {
    $subject = $config['subjectPrefix'] . ' ' . $subject;
}

// The hour's quota counts mails, not posts: counted here, after every check, so refused posts
// cannot use it up (review finding, 2026-10-19: two invalid posts spent two of three).
if (qf_rate_limited($config, $formId, (int) ($spam['rateLimitPerHour'] ?? 0))) {
    qf_fail(429, 'rate_limited', 'too many messages at the moment');
}

if (!qf_mail($config, $to, $subject, $body, $replyTo)) {
    qf_fail(502, 'mail', 'the mail could not be handed over');
}

if (qf_wants_html()) {
    $w = qf_words($lang);
    qf_html(200, $w['sent'], $w['sentText'], $redirect);
}
qf_json(200, ['ok' => true]);
