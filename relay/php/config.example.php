<?php
/**
 * quartz-forms relay: the part you edit by hand. Copy to config.php next to send.php.
 *
 * `npm run relay:config -- <site>` writes config.generated.php from the site's
 * quartz.config.yaml (forms, fields, spam settings) and creates this file once, with a fresh
 * secret. Later runs only rewrite config.generated.php; your addresses stay.
 */

declare(strict_types=1);

$generated = require __DIR__ . '/config.generated.php';

return $generated + [
    // Random, long, never on the site. Signs the proof-of-work challenges.
    'secret' => 'REPLACE-WITH-A-LONG-RANDOM-STRING',

    // Where the site lives; the relay answers only to these origins. Empty list: any origin.
    'allowedOrigins' => ['https://example.org'],

    // Sender address of the mails. Use an address of this domain, or SPF will reject the mail.
    'from' => 'forms@example.org',

    // Optional prefix for every subject, e.g. '[Website]'.
    'subjectPrefix' => '',

    // Secret key of the captcha provider (Turnstile or hCaptcha) for forms with `spam.captcha`.
    // Per form under 'captchaSecrets' => ['contact' => '…'] when they differ.
    'captchaSecret' => '',

    // 'mail' uses PHP's mail(); ['sendmail' => '/usr/sbin/sendmail -t -i'] pipes to sendmail;
    // ['file' => __DIR__ . '/outbox.txt'] appends to a file (testing only).
    'mailer' => 'mail',

    // Recipient name (as written in quartz.config.yaml under `recipient`) → address.
    // Addresses stay here and never reach the site.
    'recipients' => [
        'owner' => 'you@example.org',
    ],

    // Where the per-form hourly counters live (no addresses, just a number per form and hour).
    'counterDir' => __DIR__ . '/counters',
];
