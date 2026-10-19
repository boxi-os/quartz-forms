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

    // Where the site lives; the relay answers only to these origins. Empty list: any origin
    // (the redirect of a plain post then goes to the site's baseUrl from the generated config).
    'allowedOrigins' => ['https://example.org'],

    // Sender address of the mails. Use an address of this domain, or SPF will reject the mail.
    'from' => 'forms@example.org',

    // Optional prefix for every subject, e.g. '[Website]'.
    'subjectPrefix' => '',

    // Secret key of the captcha provider (Turnstile or hCaptcha) for forms with `spam.captcha`.
    // Per form under 'captchaSecrets' => ['contact' => '…'] when they differ.
    'captchaSecret' => '',

    // 'mail' uses PHP's mail(); ['sendmail' => '/usr/sbin/sendmail -t -i'] pipes to sendmail;
    // ['file' => '/home/you/private/outbox.txt'] appends every mail to a file (testing only:
    // use a path outside the web root, or the messages are one URL away from anyone).
    'mailer' => 'mail',

    // Recipient name (as written in quartz.config.yaml under `recipient`) → address.
    // Addresses stay here and never reach the site.
    'recipients' => [
        'owner' => 'you@example.org',
    ],

    // Where the per-form hourly counters and the used proofs of work live (no addresses, but
    // the number of messages a form got). Best outside the web root, e.g.
    // dirname($_SERVER['DOCUMENT_ROOT']) . '/quartz-forms-counters'; inside it the relay keeps
    // a .htaccess there, which Apache honours and nginx does not.
    'counterDir' => __DIR__ . '/counters',
];
