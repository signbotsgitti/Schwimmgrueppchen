# STATUS – Schwimmgrüppchen PWA (2026-10-21)

## Aktuelle Version
- v1.0.0, Repository `signbotsgitti/schwimmgrueppchen`, Branch `claude/schwimmgrueppchen-pwa`
- Noch nicht deployt; Anleitung: `docs/2026-10-21-DEPLOYMENT.md`

## Architektur
- Statische PWA in `public/` (Vanilla JS, Service Worker für App-Shell, Manifest, Icons)
- Cloudflare Pages Functions in `functions/api/` als Backend, D1 (SQLite) als Datenbank
- Token-Auth über `_middleware.js`: `?u=<token>` oder Header `X-Token`, kein Login
- Tagesdaten (Status, Treffzeit, Quallenmeldungen) sind pro Datum gespeichert → automatischer Reset 00:00 Europe/Madrid
- Wetter: Worker holt Open-Meteo Forecast (past_days=3) + Marine für alle Buchten in je einem Request, Cache 15 min
- Ampellogik in `src/ampel.js` (rein, 21 Tests), Konfiguration in `src/config.js`
- Empfehlung: niedrigste Stufe, Gleichstand → Reihenfolge in `BAYS` (Binisafúa zuerst)
- Quallenmeldung überlagert die Berechnung (mind. rot) serverseitig und clientseitig
- Geolokation nur im Client; außerhalb der Bounding-Box ist „Ich komme“ gesperrt, „Nicht auf der Insel“ + Nachricht möglich
- Ungelesene Pinnwand-Nachrichten: Badging API (`setAppBadge`) + Zähler am Tab

## Entscheidungen
- Pages Functions statt separatem Worker: ein Deploy, ein Projekt, D1-Binding in `wrangler.toml`.
- Ampel wird im Worker berechnet, nicht im Browser: ein Rechenpfad, Open-Meteo-Aufrufe gebündelt und gecacht.
- Flautentoleranz 2 h eingeführt (nicht im Auftrag): ein einstündiger Winddreher soll die „am Stück“-Zählung nicht nullen. Konfigurierbar, Tests decken es ab.
- Systemnachrichten (Uhrzeit, Quallen, Einladung) werden kompakt gespeichert und im Client übersetzt, damit die Pinnwand zweisprachig bleibt.
- Mock-Modus `WEATHER_MOCK=1` für lokale Entwicklung, weil Open-Meteo aus der Entwicklungsumgebung nicht erreichbar war.
- Seeds/Links liegen in `handover/` und sind per `.gitignore` ausgeschlossen (Tokens = Zugang).

## Offene Punkte
- [ ] Deployment durchführen (D1 anlegen, `database_id` eintragen, Seed einspielen, Pages deployen)
- [ ] Windsektoren mit Karte verifizieren, besonders Cala Mesquida (evtl. 330–90°)
- [ ] Open-Meteo-Antwort live prüfen (Multi-Location-Array, Marine `cell_selection=sea`); lokal nur gemockt
- [ ] Nach erstem Betrieb: Schwellen (12/24/48 h, 10 km/h) mit Erfahrung abgleichen
- [ ] iOS: Badging API ist in Safari-PWAs eingeschränkt; Fallback-Zähler im Tab greift

## Pfade
- Frontend: `public/index.html`, `public/app.js`, `public/i18n.js`, `public/styles.css`, `public/sw.js`, `public/manifest.webmanifest`
- Backend: `functions/api/*.js`, `functions/api/admin/members.js`
- Logik/Konfig: `src/config.js`, `src/ampel.js`, `src/weather.js`, `src/time.js`, `src/weather-mock.js`
- DB: `schema.sql`; Seed: `scripts/seed.mjs`; Icons: `scripts/make-icons.mjs`
- Tests: `test/ampel.test.mjs`
- Doku: `README.md`, `docs/2026-10-21-DEPLOYMENT.md`
