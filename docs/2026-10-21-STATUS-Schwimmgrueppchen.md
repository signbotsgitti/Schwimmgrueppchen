# STATUS – Schwimmgrüppchen PWA (2026-10-21)

## Aktuelle Version
- v2.0.0 (Supabase + GitHub Pages), Repository `signbotsgitti/Schwimmgrueppchen`
- v1 (Cloudflare Pages + D1) wurde am selben Tag gemerged und durch v2 ersetzt, weil kein Cloudflare-Konto vorhanden ist
- Deployt: https://signbotsgitti.github.io/Schwimmgrueppchen/ (GitHub Pages, Repo public), Supabase-Projekt `yjwqqupabzwxqonxdzcm` (Irland)
- Sprachen: de/en/fr; Buchten: Binisafúa, Alcaufar, Mesquida, Son Bou

## Architektur
- Statische PWA in `public/` (Vanilla JS, Service Worker für App-Shell mit relativen Pfaden, Manifest, Icons), Hosting GitHub Pages unter `/Schwimmgrueppchen/`
- Supabase Postgres; API = SQL-Funktionen `api_*` (SECURITY DEFINER), Aufruf per PostgREST-RPC mit anon-Key
- Token-Prüfung in `app_me()`; Fehler als `PTxxx`-Errcodes → PostgREST liefert passende HTTP-Status (401/403/404/409)
- Tabellen mit RLS ohne Policies, Rechte für anon/authenticated entzogen; nur `api_*` sind ausführbar
- Tagesdaten pro Datum (Europe/Madrid in SQL) → automatischer Reset 00:00
- Wetter: Browser holt Open-Meteo Forecast (past_days=3) + Marine für alle Buchten in je einem Request, Auswertung in `public/lib/weather.js`
- Ampellogik in `public/lib/ampel.js` (rein, 21 Tests), Konfiguration in `public/lib/config.js`
- Standard-Treffzeit/-Bucht nur im Client; DB speichert nur Abweichungen
- Quallenmeldung überlagert die Berechnung (mind. rot); Empfehlung = niedrigste Stufe, Gleichstand → Reihenfolge in `BAYS`
- Geolokation nur im Client; außerhalb der Bounding-Box ist „Ich komme“ gesperrt
- Ungelesene Pinnwand-Nachrichten: Badging API + Zähler am Tab
- Tests: 21 Ampel + 11 SQL-API auf PGlite (Postgres in WASM), GitHub Actions führt sie vor jedem Deploy aus

## Entscheidungen
- Supabase statt Cloudflare: vorhandenes Konto. Konsequenz: Backend in SQL statt JavaScript, Wetterabruf in den Browser verlegt.
- RPC-Funktionen statt Edge Functions: kein CLI, kein Deploy-Schritt, eine SQL-Datei im Editor genügt. Nachteil: Logik in plpgsql, dafür mit Tests abgedeckt.
- Wetter im Browser statt im Backend: Open-Meteo erlaubt CORS, 5 Personen erzeugen vernachlässigbare Last; dafür kein serverseitiger Cache mehr.
- GitHub Pages statt Supabase Storage für das Frontend: sauberer Pfad für Service-Worker-Scope und PWA-Installation.
- Lovable nicht genutzt: erwartet eigene React-Projekte und würde den Code überschreiben.
- Seeds/Links bleiben in `handover/` und sind per `.gitignore` ausgeschlossen (Tokens = Zugang).

## Offene Punkte
- [x] Supabase-Projekt, Schema, Seed, Key/URL, GitHub Pages: erledigt am 2026-10-21
- [ ] `supabase/2026-10-21-update-franzoesisch.sql` im SQL-Editor ausführen (fr zulassen, Marie Solange auf fr)
- [ ] Windsektoren mit Karte verifizieren, besonders Cala Mesquida (evtl. 330–90°) und Son Bou (120–240°)
- [ ] Open-Meteo live prüfen (aus der Entwicklungsumgebung gesperrt; lokal nur gemockt)
- [ ] Nach erstem Betrieb Schwellen (12/24/48 h, 10 km/h) mit Erfahrung abgleichen
- [ ] Supabase-Pause nach 7 Tagen Inaktivität im Blick behalten (Winterpause)

## Pfade
- Frontend: `public/index.html`, `public/app.js`, `public/i18n.js`, `public/styles.css`, `public/sw.js`, `public/manifest.webmanifest`, `public/supabase-config.js`
- Logik/Konfig: `public/lib/config.js`, `public/lib/ampel.js`, `public/lib/weather.js`, `public/lib/time.js`
- Backend: `supabase/2026-10-21-schema.sql`, Updates: `supabase/2026-10-21-update-franzoesisch.sql`
- Skripte: `scripts/seed.mjs`, `scripts/dev-server.mjs`, `scripts/make-icons.mjs`, `scripts/weather-mock.mjs`
- Tests: `test/ampel.test.mjs`, `test/api.test.mjs`, `test/_pg.mjs`
- CI/Deploy: `.github/workflows/pages.yml`
- Doku: `README.md`, `docs/2026-10-21-DEPLOYMENT.md`
