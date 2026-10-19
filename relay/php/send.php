<?php
/**
 * quartz-forms relay: receives a submission from the static site and mails it.
 *
 * Validation level 3 of three: the fields are checked against the definition that
 * `npm run relay:config` wrote into config.generated.php from quartz.config.yaml, so the relay
 * applies the same rules as the build and the browser. Recipient addresses live only here,
 * never on the site; the page sends a form id and a recipient name.
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

/** Challenge for the proof of work: stateless, bound to the form and the hour. */
function qf_challenge(array $config, string $form, int $window): string
{
    return hash_hmac('sha256', $form . '|' . $window, (string) $config['secret']);
}

/**
 * The relay's own word on when a page was opened: `issued.signature`, handed out with the
 * challenge and sent back as `ts`. The time trap is measured against it with the relay's clock.
 * The page's clock was used before, which locked out a visitor whose clock ran ahead, and a
 * made-up number such as `ts=1` passed (review findings, 2026-10-19).
 */
function qf_stamp(array $config, int $issued): string
{
    return $issued . '.' . hash_hmac('sha256', 'stamp|' . $issued, (string) $config['secret']);
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
    if (!is_array($pow) || !isset($pow['challenge'], $pow['nonce'])) {
        return false;
    }
    $challenge = (string) $pow['challenge'];
    $nonce = (string) $pow['nonce'];
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

function qf_captcha_valid(array $config, string $formId, string $provider, mixed $token): bool
{
    $secret = qf_captcha_secret($config, $formId);
    if (!is_string($token) || $token === '' || $secret === '') {
        return false;
    }
    $url = qf_captcha_verify_url($config, $provider);
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query(['secret' => $secret, 'response' => $token]),
        'timeout' => 8,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    if ($res === false) {
        return false;
    }
    $data = json_decode($res, true);
    return is_array($data) && ($data['success'] ?? false) === true;
}

/** One field against its rule; null when it passes. Same rules as the browser script. */
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
    if (is_array($value)) {
        return 'invalid';
    }
    $value = trim((string) ($value ?? ''));
    if (!mb_check_encoding($value, 'UTF-8')) {
        // Only the plain-form path can deliver this (json_decode refuses it); preg_match would
        // answer false on it, which used to count as a pass.
        return 'invalid';
    }
    if ($value === '') {
        return !empty($rule['required']) ? 'required' : null;
    }
    if (isset($rule['maxLength']) && mb_strlen($value) > (int) $rule['maxLength']) {
        return 'too_long';
    }
    switch ($type) {
        case 'email':
            if (filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                return 'invalid';
            }
            break;
        case 'url':
            if (!preg_match('~^https?://~i', $value) || filter_var($value, FILTER_VALIDATE_URL) === false) {
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
            if (!is_numeric($n)) {
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
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || strtotime($value) === false) {
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
            if (!str_contains($value, '-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
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
        $lines[] = 'Page: ' . $page['slug'];
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
        'Content-Transfer-Encoding: 8bit',
        'X-Mailer: quartz-forms-relay/' . QF_VERSION,
        'Auto-Submitted: auto-generated',
    ];
    if ($replyTo !== null) {
        $headers[] = 'Reply-To: ' . qf_header_safe($replyTo);
    }
    $encodedSubject = mb_encode_mimeheader(qf_header_safe($subject), 'UTF-8', 'B', "\r\n");
    $body = str_replace("\r\n", "\n", $body);
    $body = str_replace("\n", "\r\n", $body);

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
    $form = (string) ($_GET['challenge'] ?? '');
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
        'encrypted' => false,
        'fields' => $data,
        'pow' => null,
        'captcha' => $data['cf-turnstile-response'] ?? ($data['h-captcha-response'] ?? null),
        QF_HONEYPOT => $data[QF_HONEYPOT] ?? '',
    ];
    foreach (['form', 'lang', 'ts', 'page', QF_HONEYPOT, 'cf-turnstile-response', 'h-captcha-response'] as $k) {
        unset($envelope['fields'][$k]);
    }
} else {
    $envelope = json_decode($raw, true);
    if (!is_array($envelope)) {
        qf_fail(400, 'bad_json', 'the body is not JSON');
    }
}

$lang = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($envelope['lang'] ?? '')) ?: 'en';
$qfLang = $lang; // read by the no-JavaScript answer page

$formId = (string) ($envelope['form'] ?? '');
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
    unset($envelope['fields'][QF_HONEYPOT]);
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
    if (qf_pow_spent($config, (string) $pow['challenge'], (string) $pow['nonce'])) {
        qf_fail(400, 'pow', 'this proof of work was already used');
    }
}

$captchaProvider = (string) ($spam['captcha'] ?? 'none');
if ($captchaProvider !== 'none' && empty($formCfg['anonymous'])) {
    if (qf_captcha_secret($config, $formId) === '') {
        // The owner's mistake, not the visitor's: said as such, and never a silent 400.
        qf_fail(500, 'captcha_config', 'captchaSecret is not set in config.php');
    }
    if (!qf_captcha_valid($config, $formId, $captchaProvider, $envelope['captcha'] ?? null)) {
        qf_fail(400, 'captcha', 'the captcha was not solved');
    }
}

$page = null;
if (!empty($formCfg['pageContext']) && empty($formCfg['anonymous']) && is_string($envelope['page'] ?? null)) {
    $slug = preg_replace('/[^A-Za-z0-9\/._-]/', '', $envelope['page']);
    if ($slug !== '') {
        $page = ['slug' => $slug];
    }
}

$encrypted = !empty($envelope['encrypted']);
$replyTo = null;

if ($encrypted) {
    if (($formCfg['encryption'] ?? 'off') === 'off') {
        qf_fail(400, 'encryption', 'this form does not accept encrypted messages');
    }
    $cipher = $envelope['ciphertext'] ?? null;
    if (!is_string($cipher)
        || !preg_match('/^-----BEGIN PGP MESSAGE-----\R[\s\S]+\R-----END PGP MESSAGE-----\s*$/', trim($cipher))) {
        qf_fail(400, 'ciphertext', 'the ciphertext is not an armored PGP message');
    }
    $body = trim($cipher) . "\n";
    if ($page !== null) {
        $body .= "\nPage: " . $page['slug'] . "\n";
    }
} else {
    if (($formCfg['encryption'] ?? 'off') === 'required') {
        qf_fail(400, 'encryption', 'this form accepts encrypted messages only');
    }
    $fields = $envelope['fields'] ?? null;
    if (!is_array($fields)) {
        qf_fail(400, 'fields', 'no fields');
    }
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
                $replyTo = trim($fields[$name]);
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
