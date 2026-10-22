# Deployment-Anleitung – Schwimmgrüppchen (Supabase + GitHub Pages)

Stand: 2026-10-21. Kosten: 0 €. Alles läuft im Browser, kein Terminal nötig.
Eine GitHub-Verbindung im Supabase-Dashboard ist **nicht** erforderlich.

## 1. Supabase-Projekt anlegen
1. https://supabase.com/dashboard → „New project“.
2. Name frei (z. B. `schwimmgrueppchen`), Datenbank-Passwort merken (wird nicht in der App gebraucht),
   Region `Central EU (Frankfurt)`.
3. Warten, bis das Projekt bereit ist (ca. 1 Minute).

## 2. Schema und API einspielen
1. Links „SQL Editor“ → „New query“.
2. Den kompletten Inhalt von `supabase/2026-10-21-schema.sql` einfügen → „Run“.
   Die Datei ist idempotent, sie kann bei Updates einfach erneut ausgeführt werden.

## 3. Startgruppe einspielen
1. Neue Query, Inhalt von `handover/<datum>-seed.sql` einfügen → „Run“.
   Die Datei entsteht lokal mit `npm run seed` und liegt nicht im Repository (enthält die Tokens).
   Dazu gehört `handover/<datum>-links.md` mit den fertigen Links.
2. Kontrolle: „Table Editor“ → `members` zeigt fünf Zeilen, Kai mit `is_admin = true`.

## 4. Zugangsdaten in die App eintragen
1. „Project Settings“ → „API“: **Project URL** und **anon public** Key kopieren.
2. In `public/supabase-config.js` eintragen (beide Werte sind öffentlich, sie landen ohnehin im Browser):
   ```js
   export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";
   ```
3. Committen und auf `main` pushen (oder die Datei direkt auf GitHub im Browser bearbeiten).

## 5. GitHub Pages aktivieren
1. Repository auf GitHub → „Settings“ → „Pages“.
2. Unter „Build and deployment“ bei „Source“ **GitHub Actions** wählen. Mehr ist nicht nötig.
3. Der Workflow `.github/workflows/pages.yml` läuft bei jedem Push auf `main`: erst Tests, dann Deployment.
   Fortschritt unter „Actions“. Die URL lautet `https://signbotsgitti.github.io/Schwimmgrueppchen/`.

## 6. Links verschicken
Die Links aus `handover/<datum>-links.md` haben die Form
`https://signbotsgitti.github.io/Schwimmgrueppchen/?u=<token>`.
Jede Person öffnet ihren Link einmal (Token wird im Browser gespeichert), dann „Zum Startbildschirm hinzufügen“.
Admin-Link = Kais Link. Die Links sind später auch in der App unter „Mehr → Admin“ (nur Kai) abrufbar.

## 7. Windsektoren je Bucht
Konfiguration in `public/lib/config.js` (`BAYS[].onshore`, Richtung = woher der Wind kommt). Stand 2026-10-22 nach
Ortskenntnis: Einzelrichtung ±45°, Son Bou als Bereich Süd bis West mit 15° Rand.

| Bucht | Koordinaten (ca.) | auflandig laut Ortskenntnis | Sektor |
|---|---|---|---|
| Cala Binisafúa | 39.8227, 4.2300 | Südwind | 135–225° |
| Cala Alcaufar | 39.8338, 4.2960 | Südostwind | 90–180° |
| Cala Mesquida | 39.9075, 4.3035 | Ostwind | 45–135° |
| Son Bou | 39.8975, 4.0750 | Südwind bis Westwind | 165–285° |

Sektoren dürfen über 0° wrappen (z. B. `{ from: 330, to: 30 }`). Nach Änderung `npm test` und pushen.

## 7a. Sprachen
Deutsch, Englisch, Französisch. Neue Sprache: Block in `public/i18n.js` ergänzen, `LANGS` erweitern und in Supabase
die Prüfung `members_lang_check` sowie `api_invite`/`api_me` anpassen (Vorlage: `supabase/2026-10-21-update-franzoesisch.sql`).

## 8. Ampel-Schwellen anpassen
In `public/lib/config.js` (`AMPEL`), Stand 2026-10-22, abgeglichen mit der Zusammenfassung zu Quallenrisiken im Mittelmeer:

| Parameter | Wert | Begründung |
|---|---|---|
| `minWindKmh` | 10 | ab ca. 3 Bft transportiert Wind Quallen; 10–25 km/h ist der „ideale“ Transport |
| `thresholds` | 12 / 24 / 48 h | 12–24 h konstanter auflandiger Wind bis ein Schwarm den Strand erreicht; mehrtägig = Bloom |
| `gapToleranceHours` | 2 | kurze Flauten unterbrechen „am Stück“ nicht |
| `decayHoursOffshore` | 4 | aktiver ablandiger Wind (≥ 10 km/h aus dem Gegensektor) treibt Quallen „innerhalb weniger Stunden“ hinaus |
| `decayHoursCalm` | 12 | Flaute oder Seitenwind: Schwarm bleibt träge liegen |
| `strongWindKmh` | 40 | ab ca. 6 Bft zerreißt die Brandung Schwärme; Hinweis auf unsichtbare Tentakelfragmente |
| `strongWindLookbackHours` | 12 | Zeitraum, in dem Starkwind den Hinweis auslöst |
| `pastDays` / `cutoffHour` | 3 / 16 | Betrachtungsfenster bis zum Treffen des Zieltags |

Nach Änderung `npm test` und pushen, der Workflow deployt.

## 9. Betrieb
- Täglicher Reset automatisch (Status pro Datum, Zeitzone Europe/Madrid in der Datenbank).
- Wetter lädt die App beim Öffnen und alle 15 Minuten; Open-Meteo ist kostenlos und ohne Schlüssel.
- Offline: letzter Stand bleibt sichtbar mit Zeitstempel.
- Neue Teilnehmer: jedes Mitglied über „Mehr → Jemanden einladen“. Admin (Kai) kann umbenennen,
  deaktivieren, Link neu erzeugen (alter Link wird ungültig).
- **Supabase Free-Tier pausiert Projekte nach 7 Tagen ohne Anfragen.** Bei täglicher Nutzung passiert das nicht.
  Nach einer längeren Pause im Dashboard „Restore project“ klicken, Daten bleiben erhalten.
- Datensicherung bei Bedarf: Dashboard → „Database“ → „Backups“ (Free-Tier: keine automatischen Backups;
  alternativ im SQL-Editor `select * from members` exportieren).

## Lokale Entwicklung
```bash
npm install
npm run seed          # erzeugt handover/<datum>-seed.sql + -links.md
npm run dev           # http://localhost:8788/?u=<token>; RPC läuft auf PGlite, Wetter live von Open-Meteo
npm test
```
