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
const QF_VERSION = '0.1.0';

$config = require __DIR__ . '/config.php';

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

/** Answer for the no-JavaScript path: a redirect when the form has one, else a plain page. */
function qf_html(int $status, string $title, string $text, ?string $redirect = null): never
{
    if ($redirect !== null && $status < 400) {
        header('Location: ' . $redirect, true, 303);
        exit;
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $t = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $p = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    echo "<!doctype html><meta charset=\"utf-8\"><title>$t</title><h1>$t</h1><p>$p</p>";
    exit;
}

function qf_fail(int $status, string $error, string $message, array $errors = [], ?string $redirect = null): never
{
    if (qf_wants_html()) {
        qf_html($status, 'Not sent', $message, null);
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
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '' && isset($_SERVER['HTTP_REFERER'])) {
        $p = parse_url($_SERVER['HTTP_REFERER']);
        if (is_array($p) && isset($p['scheme'], $p['host'])) {
            $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        }
    }
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
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
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

/** Counts a submission for this form in this hour; no address, no time beyond the hour. */
function qf_rate_limited(array $config, string $form, int $perHour): bool
{
    if ($perHour <= 0) {
        return false;
    }
    $dir = $config['counterDir'] ?? (__DIR__ . '/counters');
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
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

function qf_captcha_valid(array $spam, mixed $token): bool
{
    $provider = $spam['captcha'] ?? 'none';
    if ($provider === 'none') {
        return true;
    }
    if (!is_string($token) || $token === '' || ($spam['captchaSecret'] ?? '') === '') {
        return false;
    }
    $url = $provider === 'turnstile'
        ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
        : 'https://api.hcaptcha.com/siteverify';
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query(['secret' => $spam['captchaSecret'], 'response' => $token]),
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
        if (!is_array($value)) {
            return 'invalid';
        }
        foreach ($value as $v) {
            if (!is_string($v)) {
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
        $re = '/^(?:' . str_replace('/', '\/', $rule['pattern']) . ')$/u';
        $m = @preg_match($re, $value);
        if ($m === 0) {
            return 'invalid';
        }
        // $m === false: a pattern PCRE cannot read; the browser already checked it, let it pass.
    }
    return null;
}

function qf_label(array $rule, string $lang): string
{
    $label = $rule['label'] ?? $rule['name'];
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
        $shown = is_array($value) ? implode(', ', $value) : trim((string) $value);
        if ($shown === '' && empty($rule['required'])) {
            continue;
        }
        $label = qf_label($rule, $lang);
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
    if (empty($spam['pow'])) {
        qf_json(200, ['ok' => true, 'pow' => false]);
    }
    qf_json(200, [
        'ok' => true,
        'pow' => true,
        'challenge' => qf_challenge($config, $form, (int) floor(time() / 3600)),
        'difficulty' => (int) ($spam['powDifficulty'] ?? 16),
    ]);
}

if ($method !== 'POST') {
    qf_json(405, ['ok' => false, 'error' => 'method', 'message' => 'POST only']);
}

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
    parse_str($raw, $data);
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

$formId = (string) ($envelope['form'] ?? '');
if ($formId === '' || !isset($forms[$formId])) {
    qf_fail(404, 'unknown_form', 'no such form');
}
$formCfg = $forms[$formId];
$spam = $formCfg['spam'];
$redirect = $formCfg['redirect'] ?? null;

if (!qf_origin_allowed($config)) {
    qf_fail(403, 'origin', 'origin not allowed');
}

// Honeypot: a filled field means a bot. It is told "sent"; nothing is sent.
if (!empty($spam['honeypot'])) {
    $hp = $envelope[QF_HONEYPOT] ?? ($envelope['fields'][QF_HONEYPOT] ?? '');
    if ($hp !== '' && $hp !== null) {
        if (qf_wants_html()) {
            qf_html(200, 'Sent', 'Thank you.', $redirect);
        }
        qf_json(200, ['ok' => true]);
    }
    unset($envelope['fields'][QF_HONEYPOT]);
}

// Time trap: the page writes the time it was opened (ms); a bot posts within a second.
$minSeconds = (int) ($spam['minSeconds'] ?? 0);
if ($minSeconds > 0) {
    $ts = (float) ($envelope['ts'] ?? 0);
    if ($ts <= 0 || (microtime(true) * 1000 - $ts) < $minSeconds * 1000) {
        qf_fail(400, 'too_fast', 'please wait a moment before sending');
    }
}

if (!empty($spam['pow']) && !$isForm) {
    if (!qf_pow_valid($config, $formId, (int) ($spam['powDifficulty'] ?? 16), $envelope['pow'] ?? null)) {
        qf_fail(400, 'pow', 'the proof of work is missing or wrong');
    }
}

if (($spam['captcha'] ?? 'none') !== 'none' && empty($formCfg['anonymous'])) {
    if (!qf_captcha_valid($spam, $envelope['captcha'] ?? null)) {
        qf_fail(400, 'captcha', 'the captcha was not solved');
    }
}

if (qf_rate_limited($config, $formId, (int) ($spam['rateLimitPerHour'] ?? 0))) {
    qf_fail(429, 'rate_limited', 'too many messages at the moment');
}

$lang = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($envelope['lang'] ?? '')) ?: 'en';
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

$subject = $formCfg['subject'] ?? null;
if (is_array($subject)) {
    $subject = qf_label(['label' => $subject, 'name' => $formId], $lang);
}
$subject = (string) ($subject ?? $formId);
if (!empty($config['subjectPrefix'])) {
    $subject = $config['subjectPrefix'] . ' ' . $subject;
}

if (!qf_mail($config, $to, $subject, $body, $replyTo)) {
    qf_fail(502, 'mail', 'the mail could not be handed over');
}

if (qf_wants_html()) {
    qf_html(200, 'Sent', 'Thank you, your message has been sent.', $redirect);
}
qf_json(200, ['ok' => true]);
