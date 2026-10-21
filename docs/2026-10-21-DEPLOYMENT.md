# Deployment-Anleitung – Schwimmgrüppchen (Cloudflare Pages + D1)

Stand: 2026-10-21. Kosten: 0 € (Free-Tier reicht bei Weitem).

## Voraussetzungen
- Cloudflare-Konto (kostenlos), Node ≥ 20, `npm install` im Projekt ausgeführt
- Dieses Repository lokal ausgecheckt

## 1. Anmelden
```bash
npx wrangler login
```

## 2. D1-Datenbank anlegen
```bash
npx wrangler d1 create schwimmgrueppchen
```
Die ausgegebene `database_id` in `wrangler.toml` unter `[[d1_databases]]` eintragen (ersetzt die Nullen).

## 3. Schema einspielen
```bash
npm run db:schema:remote
```

## 4. Start-Teilnehmer + persönliche Links erzeugen
```bash
npm run seed -- https://<DEIN-PROJEKT>.pages.dev
```
Erzeugt `handover/<datum>-seed.sql` (Tokens) und `handover/<datum>-links.md` (Links). Beide Dateien sind
in `.gitignore` und dürfen nicht committet werden. Dann:
```bash
npx wrangler d1 execute schwimmgrueppchen --remote --file=handover/<datum>-seed.sql
```
Hinweis: Die Projekt-URL steht erst nach Schritt 5 fest. Du kannst den Seed vorher mit einem Platzhalter
erzeugen; im Link ist nur der Token wichtig (`https://<URL>/?u=<token>`). Die Links sind später auch
in der App unter „Mehr → Admin“ (nur Kai) abrufbar.

## 5. Pages-Projekt anlegen und deployen
```bash
npx wrangler pages project create schwimmgrueppchen --production-branch main
npm run deploy
```
Die Ausgabe enthält die URL (z. B. `https://schwimmgrueppchen.pages.dev`). Das D1-Binding `DB` kommt aus
`wrangler.toml` automatisch mit. Kontrolle im Dashboard: Pages → Projekt → Settings → Bindings.

Alternativ: Pages-Projekt im Dashboard mit dem GitHub-Repo verbinden (Build command leer, Output `public`),
dann deployt jeder Push auf `main` automatisch. Das D1-Binding muss dann einmal in den Settings gesetzt werden.

## 6. Admin-Link und Start-Links
Nach Schritt 4 stehen sie in `handover/<datum>-links.md`:
- Kai (Admin), Monika, Amy, Lindsay, Marie Solange
Versand z. B. per WhatsApp/Signal. Jede Person öffnet den Link einmal; der Token wird im Browser gespeichert,
danach „Zum Startbildschirm hinzufügen“.

## 7. Windsektoren vor Betrieb mit Karte prüfen
Konfiguration in `src/config.js` (`BAYS[].onshore`, Richtung = woher der Wind kommt):

| Bucht | Koordinaten (ca.) | Öffnung | auflandig |
|---|---|---|---|
| Cala Binisafúa (Binissafúller) | 39.8227, 4.2300 | nach Süden | 135–225° |
| Cala Alcaufar | 39.8338, 4.2960 | nach Osten/Südosten | 60–150° |
| Cala Mesquida | 39.9075, 4.3035 | nach Norden/Nordosten | 0–90° |

Plausibilitätsprüfung (Kartenbild): Binisafúa und Alcaufar passen gut. Cala Mesquida öffnet eher nach
Nord-Nordost; falls Nordwestwind dort erfahrungsgemäß Quallen bringt, Sektor auf `{ from: 330, to: 90 }`
erweitern (Wrap über 0° wird unterstützt). Koordinaten ggf. um wenige hundert Meter auf den Strand verschieben.

## 8. Ampel-Schwellen anpassen
In `src/config.js` (`AMPEL`): Mindestwind 10 km/h, Stufen 12/24/48 h, Abklingen 1 Stufe je 12 h,
Flautentoleranz 2 h, Betrachtungsfenster 3 Tage + heute bis 16:00. Nach Änderung `npm test` und `npm run deploy`.

## 9. Betrieb
- Täglicher Reset passiert automatisch (Status ist pro Datum gespeichert, Zeitzone Europe/Madrid).
- Wetter wird im Worker 15 Minuten gecacht; die App lädt alle 15 Minuten bzw. beim Öffnen nach.
- Offline: letzter Stand bleibt sichtbar mit Zeitstempel.
- Neue Teilnehmer: jedes Mitglied über „Mehr → Jemanden einladen“. Admin (Kai) kann umbenennen,
  deaktivieren, Link neu erzeugen (alter Link wird ungültig).
- Datensicherung bei Bedarf: `npx wrangler d1 export schwimmgrueppchen --remote --output backup.sql`

## Lokale Entwicklung
```bash
npm run db:schema:local
npm run seed -- http://localhost:8788
npx wrangler d1 execute schwimmgrueppchen --local --file=handover/<datum>-seed.sql
echo "WEATHER_MOCK=1" > .dev.vars     # simuliertes Wetter ohne Internet (optional)
npm run dev
```
