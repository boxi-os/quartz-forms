# quartz-forms

Ein Plugin für [Quartz v5](https://quartz.jzhao.xyz) für Web-Formulare auf einer statischen
Website: Kontakt, Feedback, Anmeldung und Umfrage, zur Build-Zeit gerendert, im Browser geprüft,
mit OpenPGP verschlüsselt, bevor sie die Seite verlassen, und über einen konfigurierbaren Versandweg
verschickt.

**Stand: frühe Entwicklung, privat.** Noch nichts veröffentlicht.

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

## Optionen

Die Optionstabelle folgt mit dem Datenmodell.

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
