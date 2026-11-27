# Security Policy

[Deutsch](#deutsch) · [English](#english)

## English

### Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities privately through GitHub Private Vulnerability Reporting:
<https://github.com/Parcelschnitt/parcelschnitt/security/advisories/new>

Please include:

- what is affected and how it can be exploited,
- steps or a minimal **synthetic** file to reproduce it,
- the version or commit you tested.

**Never attach real shipping labels.** They contain personal data of third parties. If a
real PDF triggers the issue, describe its structure or build a synthetic file instead.

You will get an acknowledgement within 7 days. We will keep you informed about the fix and
credit you in the advisory unless you prefer otherwise.

### Supported versions

Parcelschnitt is in early development. Only the latest state of the `main` branch is
supported.

### Scope

Parcelschnitt processes untrusted PDF files entirely in the browser. Of particular interest
are issues that let a crafted PDF execute code, exfiltrate data (the app must make no
network requests), or exhaust resources despite the size and page limits.

## Deutsch

### Sicherheitslücke melden

Bitte **kein** öffentliches Issue für Sicherheitsprobleme eröffnen.

Meldungen bitte vertraulich über GitHub Private Vulnerability Reporting:
<https://github.com/Parcelschnitt/parcelschnitt/security/advisories/new>

Hilfreich sind:

- was betroffen ist und wie es ausgenutzt werden kann,
- Schritte oder eine minimale **synthetische** Datei zum Nachstellen,
- die getestete Version bzw. der Commit.

**Bitte niemals echte Versandetiketten anhängen.** Sie enthalten personenbezogene Daten
Dritter. Wenn ein echtes PDF das Problem auslöst, beschreibe seinen Aufbau oder baue eine
synthetische Datei nach.

Du erhältst innerhalb von 7 Tagen eine Eingangsbestätigung. Wir halten dich über die
Behebung auf dem Laufenden und nennen dich im Advisory, sofern du nichts anderes wünschst.

### Unterstützte Versionen

Parcelschnitt ist in früher Entwicklung. Unterstützt wird nur der aktuelle Stand von `main`.
