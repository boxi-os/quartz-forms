# quartz-forms

Ein Plugin für [Quartz v5](https://quartz.jzhao.xyz) für Web-Formulare auf einer statischen
Website: Kontakt, Feedback, Anmeldung und Umfrage, zur Build-Zeit gerendert, im Browser geprüft,
mit OpenPGP verschlüsselt, bevor sie die Seite verlassen, und über einen konfigurierbaren Versandweg
verschickt.

**Stand: 0.4.1, privat.** Gemessen in einer gebauten Site und in Chrome; das PHP-Relay misst die
Testsuite unter `php -S` (`test/relay.test.ts`). Drei unabhängige Reviews, das dritte über 0.4.0
als Ganzes (siehe CHANGELOG).

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

| Schlüssel     | Typ                                           | Vorgabe              | Beschreibung                                                                                                                                                             |
| ------------- | --------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `template`    | `contact` \| `feedback` \| `rsvp` \| `survey` | –                    | Mit einem mitgelieferten Feldsatz beginnen. Eigene `fields` ersetzen ihn ganz.                                                                                           |
| `title`       | Text                                          | –                    | Überschrift über dem Formular.                                                                                                                                           |
| `description` | Text                                          | –                    | Ein Satz unter der Überschrift.                                                                                                                                          |
| `submitLabel` | Text                                          | Plugin-Text          | Text des Senden-Buttons.                                                                                                                                                 |
| `fields`      | `Feld[]`                                      | –                    | Die Felder, in Reihenfolge. Pflicht, wenn keine Vorlage gesetzt ist.                                                                                                     |
| `recipient`   | `string`                                      | –                    | Relay: ein _Name_, den das Relay in seiner Konfiguration auf eine Adresse abbildet. `mailto`: die Adresse.                                                               |
| `subject`     | Text                                          | Titel, sonst Kennung | Fester Betreff.                                                                                                                                                          |
| `transport`   | Teil von Transport                            | global               | Überschreibt einzelne Felder des Versandwegs.                                                                                                                            |
| `encryption`  | `{mode, keys?, showFingerprint?}`             | `mode: off`          | `required`: nichts geht unverschlüsselt (braucht JavaScript). `optional`: ein gesetztes Häkchen, das der Besucher abwählen kann. `keys`: Namen aus `keys`, Vorgabe alle. |
| `anonymous`   | `boolean`                                     | `false`              | Siehe [Anonym](#anonym).                                                                                                                                                 |
| `pageContext` | `boolean`                                     | `false`              | Titel und Slug der Seite mitschicken (Feedback). Nie bei anonymen Formularen.                                                                                            |
| `spam`        | Teil von Spam                                 | global               | Überschreibt einzelne Spam-Felder.                                                                                                                                       |
| `success`     | `{mode, text?, slug?}`                        | `mode: inline`       | `inline`: ein Satz ersetzt das Formular. `redirect`: zur Seite `slug` wechseln (beim Bau geprüft).                                                                       |
| `className`   | `string`                                      | –                    | Zusätzliche Klasse(n) neben `quartz-form`.                                                                                                                               |

### Felder

Jedes Feld hat `type`, `name` (ein Buchstabe, dann Buchstaben, Ziffern, `_` oder `-`; eindeutig je
Formular) und, außer `hidden` und `consent`, ein `label` (Text). Optional bei den meisten:
`required`, `hint` (Text), `width` und `showIf` (siehe unten).

| `type`                                                      | Weitere Schlüssel                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `text`, `email`, `tel`, `url`, `number`, `date`, `textarea` | `placeholder` (Text), `autocomplete`, `pattern`, `min`, `max`, `step`, `rows`, `maxLength` |
| `select`, `radio`, `checkboxes`                             | `options: [{value, label}]`; `layout` (`radio`, `checkboxes`)                              |
| `checkbox`                                                  | –                                                                                          |
| `scale`                                                     | `min`, `max` (ganze Zahlen, höchstens 21 Stufen), `minLabel`, `maxLabel`                   |
| `consent`                                                   | `text` (Text), `link`, `linkLabel`; immer Pflicht                                          |
| `pgpKey`                                                    | der eigene öffentliche Schlüssel des Besuchers (eingefügt oder als Datei); höchstens einer |
| `hidden`                                                    | `value`                                                                                    |
| `pageBreak`                                                 | kein `name`; `title` (Text), `showIf`; beginnt einen Schritt, siehe [Schritte](#schritte)  |

Das Relay setzt `Reply-To` auf das erste ausgefüllte `email`-Feld. Bei mehreren (die eigene
Adresse und die eines Freundes) bekommt das des Besuchers `autocomplete: email`: Dann zählen nur
solche Felder.

Ein `pattern` ist ein regulärer Ausdruck in JavaScript-Schreibweise (Bau und Browser lesen ihn mit
`u`), das Relay wendet ihn mit PCRE an: Schreib nur, was beide gleich lesen. Der Bau weist ab, was
kein PCRE2 liest (`\u`-Escapes, `[^]`, Lookbehind unbegrenzter Länge), und `npm run relay:config`
kompiliert jedes Muster mit dem `php` deines Rechners und bricht bei einem ab, das PCRE nicht lesen
kann, etwa einem Eigenschaftsnamen, den nur JavaScript kennt (`--skip-pattern-check` schreibt die
Konfiguration trotzdem, für einen Host mit neuerem PCRE als deinem). Was das PCRE des Hosts dann
noch nicht liest, lässt das Relay jeden Wert dieses Feldes abweisen, und das Muster steht im
Fehlerprotokoll des Servers.

#### Breite und Anordnung

`width: half` oder `third` stellt Felder nebeneinander; `full`, die Vorgabe, nimmt die ganze
Zeile. Die Breiten richten sich nach der Breite des Formulars, nicht nach der des Fensters, ein
Formular in der Seitenleiste ist also auch auf einem breiten Bildschirm schmal: Unter 32rem wird
ein Drittel zur Hälfte, unter 22rem nimmt jedes Feld die ganze Zeile. Die beiden Breiten stehen
als Zahlen im Stylesheet, weil Container-Queries keine Custom Properties annehmen.
`layout: inline` stellt die Optionen eines `radio`- oder `checkboxes`-Felds nebeneinander und
bricht um, wo sie nicht passen; bei `select` wirkt es nicht, und der Bau sagt das.
Container-Queries brauchen Chrome 105, Safari 16 oder Firefox 110; ein älterer Browser zeigt jedes Feld über
die ganze Zeile.

#### Bedingungen

`showIf: { field, equals }` zeigt ein Feld nur, solange ein früheres Feld einen der Werte hat.
`field` nennt ein `select`-, `radio`-, `checkboxes`-, `checkbox`- oder `scale`-Feld davor;
`equals` ist ein Wert oder eine Liste: Optionswerte, `yes` bei einer `checkbox`, die Zahl als
String bei einer `scale`. Ein `checkboxes`-Feld erfüllt sie, wenn einer der Werte angehakt ist.
Bedingungen dürfen sich verketten, und ein Feld, dessen Steuerfeld nicht zählt, zählt auch nicht.
`hidden`- und `consent`-Felder können nicht bedingt sein (ein `consent`-Feld auch nicht über
seinen Schritt, siehe Schritte; ein `hidden`-Wert kommt auch aus einem Schritt an, der nicht
zählt).

Ein Feld, das nicht zählt, ist nicht Pflicht, wird nicht geprüft, nicht gesendet und steht nicht
in der Mail; ein Wert, der dafür gepostet wird, wird verworfen, nicht abgewiesen. Ohne JavaScript
stehen alle Felder da: Ein bedingtes trägt kein natives `required`, ein Satz darunter sagt, wann
es nötig ist („Nur nötig, wenn …“), und das Relay entscheidet.

#### Schritte

Ein Eintrag `{ type: pageBreak, title?, showIf? }` in `fields` beginnt einen Schritt. Er steht
zwischen Feldern, nie am Anfang, am Ende oder zweimal hintereinander. Mit JavaScript ist ein
Schritt auf einmal zu sehen, unter „Schritt 2 von 4: Titel“: „Weiter“ (und Return in einem Feld)
prüft nur den offenen Schritt, „Zurück“ geht ohne Prüfung zurück, und ein Schritt, dessen `showIf`
nicht gilt oder in dem kein Feld zählt, wird in beide Richtungen übersprungen. Verschlüsselung,
Captcha und der Senden-Button erscheinen mit dem letzten Schritt. Weist das Relay ein Feld ab,
öffnet das Formular dessen Schritt. Die Bedingung eines Schritts gilt für jedes seiner Felder außer
einem `hidden`-Wert, das Relay verwirft sie also wie jedes bedingte Feld; ein `consent`-Feld kann
deshalb nicht in einem Schritt mit `showIf` stehen, der Build weist es dort ab, und keine Nachricht
geht ohne die Einwilligung hinaus. Ohne JavaScript stehen alle Schritte untereinander, jeder unter
seinem Titel.

### Transport

| Schlüssel | Werte                                                             | Beschreibung                                                                                                      |
| --------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `kind`    | `relay`, `endpoint`, `formspree`, `web3forms`, `mailto`           | Das PHP-Relay von quartz-forms; jede POST-URL; zwei Dienst-Voreinstellungen; das Mailprogramm.                    |
| `url`     | URL oder die Formular-Kennung / der Zugangsschlüssel des Dienstes | Pflicht für `relay`, `endpoint` und die Voreinstellungen.                                                         |
| `format`  | `json` \| `form`                                                  | Kodierung des Inhalts für `endpoint`. Das Relay bekommt JSON vom Script und ohne JavaScript einen einfachen Post. |
| `extra`   | `Record<string, string>`                                          | Felder, die mit jeder Sendung an einen `endpoint` oder Dienst gehen; Relay und `mailto` nehmen keine.             |

### Spam

| Schlüssel           | Vorgabe  | Beschreibung                                                                                                                                                                                 |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `honeypot`          | `true`   | Ein unsichtbares Feld, das leer bleiben muss.                                                                                                                                                |
| `minSeconds`        | `3`      | Ganze Sekunden zwischen Öffnen der Seite und Senden, gemessen vom Relay am Post des Skripts; ein einfacher Post ohne JavaScript trägt keinen Stempel (siehe `noScript`). `0` schaltet es ab. |
| `noScript`          | `true`   | Einfache Formular-Posts aus Browsern ohne JavaScript annehmen; siehe unten.                                                                                                                  |
| `pow`               | `false`  | Proof-of-Work, das das Relay prüft, eines je Nachricht (nur `relay`).                                                                                                                        |
| `powDifficulty`     | `16`     | Führende Nullbits, 8 bis 20. Gerechnet in einem Worker: 16 dauert auf einem Desktop bis zu einer Sekunde, ab 18 auf einem Telefon Sekunden (der Bau sagt es).                                |
| `captcha`           | `none`   | `turnstile` oder `hcaptcha`; lädt das Skript des Anbieters. Bei anonym ignoriert: kein Widget, und das Relay verlangt kein Token.                                                            |
| `captchaSiteKey`    | `""`     | Der Site-Schlüssel des Anbieters; der geheime Schlüssel steht in der `config.php` des Relays.                                                                                                |
| `rateLimitPerHour`  | `60`     | Mails je Formular und Stunde, die das Relay sendet; abgewiesene Posts und gescheiterte Übergaben zählen nicht, keine Adressen (unten).                                                       |
| `maxFieldLength`    | `2000`   | Vorgabe für die Höchstlänge eines einzeiligen Felds.                                                                                                                                         |
| `maxTextareaLength` | `20000`  | Vorgabe für die Höchstlänge eines Textfelds.                                                                                                                                                 |
| `maxKeyLength`      | `16384`  | Höchstlänge eines eingefügten öffentlichen Schlüssels.                                                                                                                                       |
| `maxBytes`          | `131072` | Höchstgröße einer ganzen Sendung in Bytes; der Bau warnt, wenn die Felder mehr fassen können.                                                                                                |

Mit dem Relay holt das Skript beim Öffnen der Seite ein Ticket (`GET send.php?challenge=<id>`):
einen vom Relay signierten Stempel dieses Moments und, wenn das Formular es verlangt, die
Proof-of-Work-Aufgabe der Stunde. Die Zeitfalle misst das Relay an diesem Stempel mit seiner
eigenen Uhr; eine vorgehende Uhr des Besuchers sperrt niemanden aus, ein erfundener Stempel wird
abgewiesen. Nimmt das Relay den Stempel nicht an (beim Öffnen kam keiner, oder er ist älter als
einen Tag), holt das Skript einen neuen, wartet `minSeconds` und sendet noch einmal; erst dann
bittet es, die Seite neu zu laden. Ein gelöstes Proof-of-Work sendet eine Nachricht; verbrauchte
merkt sich das Relay
neben seinen Zählern und markiert eines erst, wenn die Nachricht angenommen ist, damit ein
abgewiesener Post den Besucher kein neues kostet. Die Nonce beginnt mit einem zufälligen Präfix,
weil die Aufgabe für alle Besucher der Stunde dieselbe ist.

Ohne JavaScript schickt ein Formular mit `encryption: off` oder `optional` einen einfachen
Formular-Post ans Relay, das mit der Weiterleitung oder einer kurzen Seite antwortet (sie nennt
abgewiesene Felder mit den Sätzen, die das Skript zeigen würde). Ein solcher
Post trägt weder Stempel noch Proof of Work; das Relay prüft daran nur Honeypot,
Ratenbegrenzung und Felder, und bei `pow: true` oder einem eigenen `minSeconds` sagt der Bau das. `noScript: false` weist diese
Posts ab und rendert das Formular ohne Ziel, bis das Skript läuft, mit einem `<noscript>`-Hinweis. Bei `optional` bleibt das Häkchen
„Verschlüsselt senden“ leer und deaktiviert, bis das Skript es setzt, und ein `<noscript>`-Hinweis
sagt, dass das Formular unverschlüsselt sendet; einen einfachen Post, der das Häkchen trotzdem
trägt, weist das Relay ab.

Die Ratenbegrenzung schützt Ihr Postfach, nicht Ihr Formular. Sie zählt die Mails eines Formulars
je Stunde, ohne Adressen, ist also ein Kontingent für alle: Ein einzelner Client, der die Mails
der Stunde selbst sendet (60 einfache Posts dauern keine Sekunde), sperrt das Formular für alle
anderen Besucher bis zum Ende der Stunde, und Sie bekommen diese 60. Nur ein Captcha macht jeden
solchen Post teuer, oder ein Proof of Work mit `noScript: false`, das ein einfacher Post nicht
überspringen kann; ein anonymes Formular lädt kein Captcha. Ohne beides sagt der Bau es bei
jedem Relay-Formular.

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

Die Verschlüsselung schützt die Nachricht unterwegs und in Ihrem Postfach, nicht auf der Seite.
Jedes Skript auf der Seite, auf der der Besucher tippt, kann die Felder lesen, bevor sie
verschlüsselt werden: das Widget des Captcha-Anbieters (der Bau sagt es bei einem verschlüsselnden
Formular mit `captcha`), Quartz' `analytics`, das Skript eines anderen Plugins. Offen reisen die
Kennung des Formulars, die Sprache der Seite, der Stempel (die Sekunde, in der die Seite geöffnet
wurde), dass die Nachricht verschlüsselt ist, und die Größe des Chiffrats; die Mail trägt den
Betreff des Formulars und kein `Reply-To`, Sie antworten also, wenn Sie die Adresse des Besuchers
entschlüsselt haben.

Kann OpenPGP.js im Browser eines Besuchers nicht geladen werden (Netz, Content-Blocker, eine
strenge CSP), sagt ein verschlüsselndes Formular das und sendet nichts. Ein Formular, das nicht
verschlüsselt, sendet weiterhin; ein Schlüssel, den der Besucher in ein `pgpKey`-Feld eingefügt
hat, geht dann so hinaus, wie er eingefügt wurde, nur auf seine Markierungen geprüft, und das Feld
sagt, dass er ungeprüft blieb.

## Validierung

Die Regeln eines Felds stehen einmal, in seiner Definition, und werden dreimal angewendet: beim
Bau (Kennungen, Namen, Optionen, Schlüssel, Versandweg, Zielseiten), im Browser (mit Sätzen in der
Seitensprache, beim Verlassen eines Felds und beim Senden) und im Relay (jedes Klartextfeld; eine
verschlüsselte Sendung nur nach Armor und Größe). Welche Felder unter ihren Bedingungen und
Schritten zählen, entscheiden alle drei gleich: Der Bau hält eine Bedingung an ein früheres Feld
und an Werte, die es haben kann, und Browser und Relay lesen eine daraus abgeleitete Liste je
Feld, in einem Durchgang in Formularreihenfolge.

## Texte

Jeder Satz, den quartz-forms zeigt, kommt aus `src/i18n/locales/` (`en-US`, `de-DE`) und lässt sich
je Sprache ersetzen: `texts: { de: { submit: "Abschicken" } }`. Schlüssel sind die von `en-US.ts`;
`{name}`-Platzhalter füllt der Code.

## Das Relay

`relay/php/` enthält ein einzelnes `send.php` für klassisches Webhosting mit PHP ab 8.1 und
dessen Erweiterung mbstring (fehlt sie, sagt das Relay es). `npm run relay:config --
/pfad/zur/site` schreibt seine erzeugte Konfiguration aus der `quartz.config.yaml`
der Website; Empfängeradressen kommen von Hand in `config.php` und gelangen nie auf die Website.
Siehe [relay/php/README.md](relay/php/README.md) (englisch).

Derselbe Generator liegt als Kommandozeile bei und läuft aus einer installierten Kopie
(`.quartz/plugins/quartz-forms` in einer Website), ohne `npm install`:

```bash
node dist/cli.js relay --site <site> --out <ordner> [--skip-pattern-check] [--json]
node dist/cli.js check --site <site> [--json]   # Probleme, Hinweise, jeder Schlüssel mit Fingerabdruck
node dist/cli.js key   --site <site> --file <key.asc> [--json]
```

`--lang de` gibt Probleme, Hinweise, Schlüsselprobleme und Ablehnungen auf Deutsch aus (ohne
Angabe englisch; das Build-Log bleibt englisch).

`relay` in einen eigenen Ordner schreibt das ganze Relay (`send.php`, `counters/.htaccess`,
`config.generated.php`, `config.php`). Mit den Werten des Betreibers als JSON in der
Umgebungsvariable `QF_RELAY_OPERATOR` (Secret, Origins, Absender, Mailer, Empfänger,
Captcha-Secrets, Zählerordner) schreibt es `config.php` bei jedem Lauf daraus; Geheimnisse gehen nie
über argv. Mit `--json` steht auf stdout ein Objekt, darin unter anderem ein `hash` der erzeugten
Regeln, der gleich bleibt, solange sie es tun. Das ruft QuartzControl auf. `config.php` wird mit
den Rechten 0600 geschrieben; ein Hochladen über SFTP oder FTP behält sie nicht, prüfen Sie die
Rechte also auf dem Host (siehe `relay/php/README.md`, Schritt 3).

Das Relay antwortet nur Anfragen vom Origin der Website. Eine Website mit `Referrer-Policy:
no-referrer` verbirgt diesen Origin bei einem einfachen Formular-Post ohne JavaScript (der
Browser sendet `Origin: null`); das Relay weist solche Posts ab und sagt, warum. Die Anfragen des
Skripts tragen den Origin unter jeder Policy.

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
