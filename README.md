# Schwimmgrüppchen

Installierbare PWA für die Schwimmgruppe auf Menorca: täglich zu-/absagen, Pinnwand,
Wind-/Quallen-Ampel je Bucht mit Buchtempfehlung. Kein Login, keine Push-Nachrichten.

- **Frontend:** statische PWA (`public/`), mobil zuerst, Deutsch/Englisch
- **Backend:** Cloudflare Pages Functions (`functions/api/`) + D1 (SQLite)
- **Wetter:** Open-Meteo Forecast + Marine API (ohne API-Schlüssel), Zeitzone Europe/Madrid
- **Zugang:** persönlicher Link `?u=<token>` je Person, Token im localStorage

## Schnellstart

```bash
npm install
npm test                                     # Unit-Tests der Ampellogik
npm run db:schema:local                      # Schema in lokale D1
npm run seed -- http://localhost:8788        # Seed + Links für Kai, Monika, Amy, Lindsay, Marie Solange
npx wrangler d1 execute schwimmgrueppchen --local --file=handover/<datum>-seed.sql
echo "WEATHER_MOCK=1" > .dev.vars            # optional: Wetter ohne Internet simulieren
npm run dev                                  # http://localhost:8788/?u=<token>
```

Deployment: siehe `docs/2026-10-21-DEPLOYMENT.md`.

## Struktur

```
public/            PWA (index.html, app.js, i18n.js, styles.css, sw.js, manifest, icons)
functions/api/     API-Endpunkte (Pages Functions), _middleware.js = Token-Auth
src/config.js      Buchten, Windsektoren, Ampel-Schwellen (alles konfigurierbar)
src/ampel.js       Ampellogik (rein, getestet)
src/weather.js     Open-Meteo-Abruf + Auswertung je Bucht
schema.sql         D1-Schema
scripts/seed.mjs   Start-Teilnehmer mit zufälligen Tokens erzeugen
test/              node:test
```

## API (alle Aufrufe mit Header `X-Token` oder `?u=`)

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/state` | Mitglieder, Tagesstatus, Treffzeit, Pinnwand, Quallenmeldungen |
| POST | `/api/attendance` `{status: yes|no|away|open}` | eigener Status heute |
| POST | `/api/time` `{time: "HH:MM"}` | Uhrzeit für heute vorschlagen |
| POST | `/api/messages` `{text}` | Pinnwand-Nachricht |
| POST | `/api/jelly` `{bay}` | Quallen gesehen (Bucht heute mind. rot) |
| POST | `/api/invite` `{name, lang}` | neuen Teilnehmer anlegen, Link zurück |
| POST | `/api/me` `{lang}` | eigene Sprache |
| GET | `/api/weather` | Ampel + Wetter je Bucht, Empfehlung |
| GET/POST | `/api/admin/members` | Admin: Liste mit Links; rename/deactivate/activate/regenerate |
