# quartz-forms

Ein Plugin für [Quartz v5](https://quartz.jzhao.xyz) für Web-Formulare auf einer statischen
Website: Kontakt, Feedback, Anmeldung und Umfrage, zur Build-Zeit gerendert, im Browser geprüft,
mit OpenPGP verschlüsselt, bevor sie die Seite verlassen, und über einen konfigurierbaren Versandweg
verschickt.

**Stand: 0.1.1 plus unveröffentlichte Korrekturen, privat.** Gemessen in einer gebauten Site und in Chrome; das PHP-Relay misst die Testsuite unter `php -S` (`test/relay.test.ts`), dazu kam ein unabhängiges Review (siehe CHANGELOG).

- Formulare werden einmal in `quartz.config.yaml` definiert (`options.forms`), nach Kennung
- Eine Seite bindet ein Formular mit einem ` ```quartz-form `-Codeblock, einem
  `{{form:kennung}}`-Platzhalter oder dem Frontmatter-Schlüssel `form:` ein; ein Formular kann
  auch in einem Layout-Bereich auf jeder Seite stehen
- Feldtypen: Text, E-Mail, Telefon, URL, Zahl, Datum, Textfeld, Auswahl, Radio, Mehrfachauswahl,
  einzelnes Häkchen, Skala, Einwilligung, versteckter Wert und ein Feld für den eigenen öffentlichen
  PGP-Schlüssel des Besuchers
- Je Formular: Verschlüsselung `required`, `optional` oder `off`; ein anonymer Modus ohne
  Personendaten
- Versandwege: eigenes Relay (ein PHP-Skript liegt in `relay/php/`), generischer HTTP-Endpunkt,
  Voreinstellungen für Formular-Dienste oder `mailto:`
- Spam-Schutz, alles konfigurierbar: Honeypot und Zeitfalle, Proof-of-Work und Ratenbegrenzung im
  Relay, Turnstile/hCaptcha
- Bezeichnungen in mehreren Sprachen, funktioniert mit quartz-multilanguage

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

## Ein Formular einbinden

Drei Wege auf einer Seite, einer über das Layout:

````markdown
```quartz-form
kontakt
```
````

```markdown
{{form:kontakt}}
```

```yaml
---
form: kontakt # oder eine Liste: [kontakt, feedback]; `form: false` blendet das Layout-Formular hier aus
---
```

```yaml
# quartz.config.yaml: dasselbe Formular auf jeder Seite, platziert wie jede Komponente
options:
  layoutForm: feedback
layout:
  position: afterBody
  priority: 20
```

## Optionen

Alle Optionen stehen unter `options:` des Plugin-Eintrags. Ein _Text_ ist eine Zeichenkette oder
ein Record nach Sprachcode (`{ de: "Name", en: "Name" }`); die Seitensprache wählt den Eintrag.

| Option           | Typ                                   | Vorgabe         | Beschreibung                                                                                     |
| ---------------- | ------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `forms`          | `Record<kennung, Formular>`           | `{}`            | Die Formulare, nach Kennung (`[a-z0-9-]`). Siehe unten.                                          |
| `transport`      | `Transport`                           | `{kind: relay}` | Wohin Sendungen gehen; jedes Formular kann einzelne Felder überschreiben.                        |
| `keys`           | `Record<name, {file} \| {armored}>`   | `{}`            | Öffentliche PGP-Schlüssel: Datei relativ zum Site-Ordner oder der armierte Text.                 |
| `spam`           | `Spam`                                | siehe unten     | Spam-Schutz und Grenzen; jedes Formular kann einzelne Felder überschreiben.                      |
| `frontmatterKey` | `string`                              | `"form"`        | Frontmatter-Schlüssel, der ein Formular einbindet oder das Layout-Formular ausblendet (`false`). |
| `codeBlockLang`  | `string`                              | `"quartz-form"` | Sprachkennung des Codeblocks, der ein Formular einbindet.                                        |
| `layoutForm`     | `string`                              | `""`            | Kennung des Formulars, das über den `layout`-Block dieses Eintrags platziert wird. Leer: keins.  |
| `language`       | `"auto"` \| Code                      | `"auto"`        | Sprache des Layout-Formulars: die der Seite oder ein fester Code.                                |
| `texts`          | `Record<locale, Record<key, string>>` | `{}`            | Eigener Wortlaut für die Texte von quartz-forms, z. B. `de: { submit: "Abschicken" }`.           |

### Formular

| Schlüssel     | Typ                                           | Vorgabe        | Beschreibung                                                                                                                                                             |
| ------------- | --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `template`    | `contact` \| `feedback` \| `rsvp` \| `survey` | –              | Mit einem mitgelieferten Feldsatz beginnen. Eigene `fields` ersetzen ihn ganz.                                                                                           |
| `title`       | Text                                          | –              | Überschrift über dem Formular.                                                                                                                                           |
| `description` | Text                                          | –              | Ein Satz unter der Überschrift.                                                                                                                                          |
| `submitLabel` | Text                                          | Plugin-Text    | Text des Senden-Buttons.                                                                                                                                                 |
| `fields`      | `Feld[]`                                      | –              | Die Felder, in Reihenfolge. Pflicht, wenn keine Vorlage gesetzt ist.                                                                                                     |
| `recipient`   | `string`                                      | –              | Relay: ein _Name_, den das Relay in seiner Konfiguration auf eine Adresse abbildet. `mailto`: die Adresse.                                                               |
| `subject`     | Text                                          | Kennung        | Fester Betreff.                                                                                                                                                          |
| `transport`   | Teil von Transport                            | global         | Überschreibt einzelne Felder des Versandwegs.                                                                                                                            |
| `encryption`  | `{mode, keys?, showFingerprint?}`             | `mode: off`    | `required`: nichts geht unverschlüsselt (braucht JavaScript). `optional`: ein gesetztes Häkchen, das der Besucher abwählen kann. `keys`: Namen aus `keys`, Vorgabe alle. |
| `anonymous`   | `boolean`                                     | `false`        | Siehe [Anonym](#anonym).                                                                                                                                                 |
| `pageContext` | `boolean`                                     | `false`        | Titel und Slug der Seite mitschicken (Feedback). Nie bei anonymen Formularen.                                                                                            |
| `spam`        | Teil von Spam                                 | global         | Überschreibt einzelne Spam-Felder.                                                                                                                                       |
| `success`     | `{mode, text?, slug?}`                        | `mode: inline` | `inline`: ein Satz ersetzt das Formular. `redirect`: zur Seite `slug` wechseln (beim Bau geprüft).                                                                       |
| `className`   | `string`                                      | –              | Zusätzliche Klasse(n) neben `quartz-form`.                                                                                                                               |

### Felder

Jedes Feld hat `type`, `name` (ein Buchstabe, dann Buchstaben, Ziffern, `_` oder `-`; eindeutig je
Formular) und, außer `hidden` und `consent`, ein `label` (Text). Optional bei den meisten:
`required`, `hint` (Text).

| `type`                                                      | Weitere Schlüssel                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `text`, `email`, `tel`, `url`, `number`, `date`, `textarea` | `placeholder` (Text), `autocomplete`, `pattern`, `min`, `max`, `step`, `rows`, `maxLength` |
| `select`, `radio`, `checkboxes`                             | `options: [{value, label}]`                                                                |
| `checkbox`                                                  | –                                                                                          |
| `scale`                                                     | `min`, `max` (ganze Zahlen, höchstens 21 Stufen), `minLabel`, `maxLabel`                   |
| `consent`                                                   | `text` (Text), `link`, `linkLabel`; immer Pflicht                                          |
| `pgpKey`                                                    | der eigene öffentliche Schlüssel des Besuchers (eingefügt oder als Datei); höchstens einer |
| `hidden`                                                    | `value`                                                                                    |

Ein `pattern` ist ein regulärer Ausdruck in JavaScript-Schreibweise (Bau und Browser lesen ihn mit
`u`), das Relay wendet ihn mit PCRE an: Schreib nur, was beide gleich lesen. Lookbehind mit
variabler Länge und lange Unicode-Eigenschaftsnamen kennt nur JavaScript; das Relay weist dann jeden
Wert dieses Feldes ab und nennt das Muster im Fehlerprotokoll des Servers.

### Transport

| Schlüssel | Werte                                                             | Beschreibung                                                                                                      |
| --------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `kind`    | `relay`, `endpoint`, `formspree`, `web3forms`, `mailto`           | Das PHP-Relay von quartz-forms; jede POST-URL; zwei Dienst-Voreinstellungen; das Mailprogramm.                    |
| `url`     | URL oder die Formular-Kennung / der Zugangsschlüssel des Dienstes | Pflicht für `relay`, `endpoint` und die Voreinstellungen.                                                         |
| `format`  | `json` \| `form`                                                  | Kodierung des Inhalts für `endpoint`. Das Relay bekommt JSON vom Script und ohne JavaScript einen einfachen Post. |
| `extra`   | `Record<string, string>`                                          | Felder, die mit jeder Sendung an einen `endpoint` oder Dienst gehen; Relay und `mailto` nehmen keine.             |

### Spam

| Schlüssel           | Vorgabe  | Beschreibung                                                                                                                                                  |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `honeypot`          | `true`   | Ein unsichtbares Feld, das leer bleiben muss.                                                                                                                 |
| `minSeconds`        | `3`      | Sekunden zwischen Öffnen der Seite und Senden, gemessen vom Relay; `0` schaltet es ab.                                                                        |
| `noScript`          | `true`   | Einfache Formular-Posts aus Browsern ohne JavaScript annehmen; siehe unten.                                                                                   |
| `pow`               | `false`  | Proof-of-Work, das das Relay prüft, eines je Nachricht (nur `relay`).                                                                                         |
| `powDifficulty`     | `16`     | Führende Nullbits, 8 bis 20. Gerechnet in einem Worker: 16 dauert auf einem Desktop bis zu einer Sekunde, ab 18 auf einem Telefon Sekunden (der Bau sagt es). |
| `captcha`           | `none`   | `turnstile` oder `hcaptcha`; lädt das Skript des Anbieters. Bei anonym ignoriert.                                                                             |
| `captchaSiteKey`    | `""`     | Der Site-Schlüssel des Anbieters; der geheime Schlüssel steht in der `config.php` des Relays.                                                                 |
| `rateLimitPerHour`  | `60`     | Mails je Formular und Stunde, die das Relay sendet; abgewiesene Posts zählen nicht, keine Adressen.                                                           |
| `maxFieldLength`    | `2000`   | Vorgabe für die Höchstlänge eines einzeiligen Felds.                                                                                                          |
| `maxTextareaLength` | `20000`  | Vorgabe für die Höchstlänge eines Textfelds.                                                                                                                  |
| `maxKeyLength`      | `16384`  | Höchstlänge eines eingefügten öffentlichen Schlüssels.                                                                                                        |
| `maxBytes`          | `131072` | Höchstgröße einer ganzen Sendung in Bytes; der Bau warnt, wenn die Felder mehr fassen können.                                                                 |

Mit dem Relay holt das Skript beim Öffnen der Seite ein Ticket (`GET send.php?challenge=<id>`):
einen vom Relay signierten Stempel dieses Moments und, wenn das Formular es verlangt, die
Proof-of-Work-Aufgabe der Stunde. Die Zeitfalle misst das Relay an diesem Stempel mit seiner
eigenen Uhr; eine vorgehende Uhr des Besuchers sperrt niemanden aus, ein erfundener Stempel wird
abgewiesen. Ein gelöstes Proof-of-Work sendet eine Nachricht; verbrauchte merkt sich das Relay
neben seinen Zählern.

Ohne JavaScript schickt ein Formular mit `encryption: off` oder `optional` einen einfachen
Formular-Post ans Relay, das mit der Weiterleitung oder einer kurzen Seite antwortet. Ein solcher
Post trägt weder Stempel noch Proof of Work; das Relay prüft daran nur Honeypot,
Ratenbegrenzung und Felder, und bei `pow: true` sagt der Bau das. `noScript: false` weist diese
Posts ab und rendert das Formular ohne Ziel, bis das Skript läuft, mit einem `<noscript>`-Hinweis. Bei `optional` bleibt das Häkchen
„Verschlüsselt senden“ leer und deaktiviert, bis das Skript es setzt, und ein `<noscript>`-Hinweis
sagt, dass das Formular unverschlüsselt sendet; einen einfachen Post, der das Häkchen trotzdem
trägt, weist das Relay ab.

## Anonym

`anonymous: true` an einem Formular heißt, und der Code setzt es durch:

- Kein Pflicht-Personenfeld: `email`, `tel`, `pgpKey` und Felder, deren `autocomplete` eine Person
  nennt, werden optional (der Bau sagt es).
- Kein Seitenkontext, kein `Reply-To`, kein fremdes Captcha (nichts vom Besucher geht an Dritte),
  und das Relay protokolliert nichts.

Was es nicht versprechen kann: das Zugriffsprotokoll des Hosters, das Netz dazwischen und was ein
Formular-Dienst (`formspree`, `web3forms`) auf seiner Seite festhält. Der Bau warnt vor dieser
Kombination.

## Verschlüsselung

OpenPGP.js läuft im Browser des Besuchers, geladen aus `static/quartz-forms/openpgp/` nur auf
Seiten, die es brauchen. Die Nachricht (`Bezeichnung: Wert` je Feld, die Seite, der Schlüssel des
Besuchers) wird für die konfigurierten öffentlichen Schlüssel verschlüsselt; nur das armierte
Chiffrat verlässt die Seite, als Inhalt der Mail. Lesbar mit `gpg`, Thunderbird, Mailvelope oder
GPG Suite. Der Fingerabdruck des Empfängerschlüssels steht unter dem Formular, damit ein Besucher
ihn mit dem vergleichen kann, den Sie veröffentlichen.

Der Bau prüft jeden benutzten Schlüssel: lesbar, öffentlich, nicht widerrufen, nicht abgelaufen,
verschlüsselungsfähig; er schreibt den Fingerabdruck ins Protokoll und bricht bei einem Problem ab.

## Validierung

Die Regeln eines Felds stehen einmal, in seiner Definition, und werden dreimal angewendet: beim
Bau (Kennungen, Namen, Optionen, Schlüssel, Versandweg, Zielseiten), im Browser (mit Sätzen in der
Seitensprache, beim Verlassen eines Felds und beim Senden) und im Relay (jedes Klartextfeld; eine
verschlüsselte Sendung nur nach Armor und Größe).

## Texte

Jeder Satz, den quartz-forms zeigt, kommt aus `src/i18n/locales/` (`en-US`, `de-DE`) und lässt sich
je Sprache ersetzen: `texts: { de: { submit: "Abschicken" } }`. Schlüssel sind die von `en-US.ts`;
`{name}`-Platzhalter füllt der Code.

## Das Relay

`relay/php/` enthält ein einzelnes `send.php` für klassisches Webhosting mit PHP. `npm run
relay:config -- /pfad/zur/site` schreibt seine erzeugte Konfiguration aus der `quartz.config.yaml`
der Website; Empfängeradressen kommen von Hand in `config.php` und gelangen nie auf die Website.
Siehe [relay/php/README.md](relay/php/README.md) (englisch).

## Entwicklung

```bash
npm install
npm run check   # typecheck + lint + format + tests
npm run build   # schreibt dist/ (committet, Quartz installiert daraus)
```

`dist/` ist absichtlich committet. Nach jeder Änderung unter `src/` `npm run build` ausführen und
das aktualisierte `dist/` mit committen.

Die englische Fassung dieser README ist [README.md](README.md).

## Lizenz

Noch nicht entschieden; das Paket ist bis dahin als `UNLICENSED` markiert. OpenPGP.js, das das
Plugin als eigene Datei mitliefert, steht unter LGPL-3.0-or-later.
