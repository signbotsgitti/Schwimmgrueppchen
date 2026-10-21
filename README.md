# Schwimmgrüppchen

Installierbare PWA für die Schwimmgruppe auf Menorca: täglich zu-/absagen, Pinnwand,
Wind-/Quallen-Ampel je Bucht mit Buchtempfehlung. Kein Login, keine Push-Nachrichten.

- **Frontend:** statische PWA (`public/`), gehostet auf GitHub Pages, mobil zuerst, Deutsch/Englisch
- **Backend:** Supabase Postgres. Die API besteht aus SQL-Funktionen (`supabase/*.sql`), die die App per RPC
  mit dem öffentlichen anon-Key aufruft. Tabellen sind per Row Level Security gesperrt.
- **Wetter:** Open-Meteo Forecast + Marine API direkt aus dem Browser (kein API-Schlüssel), Zeitzone Europe/Madrid
- **Zugang:** persönlicher Link `?u=<token>` je Person, Token im localStorage

## Schnellstart (lokal, ohne Supabase)

```bash
npm install
npm test            # Ampellogik + SQL-API (läuft auf PGlite, einer Postgres-Variante in Node)
npm run seed        # Seed-SQL + Links für Kai, Monika, Amy, Lindsay, Marie Solange nach handover/
npm run dev         # http://localhost:8788/?u=<token aus handover/*-links.md>
```

Der Dev-Server bildet die Supabase-RPC-Schnittstelle auf einer PGlite-Datenbank nach. Open-Meteo braucht Internet.

Deployment: siehe `docs/2026-10-21-DEPLOYMENT.md`.

## Struktur

```
public/                 PWA (index.html, app.js, i18n.js, styles.css, sw.js, manifest, icons)
public/supabase-config.js  Project URL + anon-Key (öffentlich)
public/lib/config.js    Buchten, Windsektoren, Ampel-Schwellen (alles konfigurierbar)
public/lib/ampel.js     Ampellogik (rein, getestet)
public/lib/weather.js   Open-Meteo-Abruf + Auswertung je Bucht
supabase/*.sql          Schema + API-Funktionen (im Supabase SQL-Editor ausführen)
scripts/seed.mjs        Start-Teilnehmer mit zufälligen Tokens erzeugen
scripts/dev-server.mjs  lokaler Server (statisch + RPC auf PGlite)
test/                   node:test (Ampel, SQL-API)
.github/workflows/      Tests + Deployment auf GitHub Pages bei Push auf main
```

## API (RPC, erster Parameter immer `p_token`)

| Funktion | Parameter | Zweck |
|---|---|---|
| `api_state` | – | Mitglieder, Tagesstatus, Treffzeit, Pinnwand, Quallenmeldungen |
| `api_attendance` | `p_status` yes/no/away/open | eigener Status heute |
| `api_time` | `p_time` HH:MM | Uhrzeit für heute vorschlagen |
| `api_message` | `p_text` | Pinnwand-Nachricht |
| `api_jelly` | `p_bay` | Quallen gesehen (Bucht heute mind. rot) |
| `api_invite` | `p_name`, `p_lang` | neuen Teilnehmer anlegen, Token zurück |
| `api_me` | `p_lang` | eigene Sprache |
| `api_admin_members` | – | Admin: Liste mit Tokens |
| `api_admin_action` | `p_id`, `p_action`, `p_name` | Admin: rename/deactivate/activate/regenerate |
