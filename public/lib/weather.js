// Open-Meteo abrufen und je Bucht auswerten. Läuft im Browser (Open-Meteo erlaubt CORS) und in Tests.
import { BAYS, AMPEL, THUNDER, TIMEZONE } from "./config.js?v=2.3.3";
import { computeLevel, applyJellyReport, recommendBay, clipToCutoff } from "./ampel.js?v=2.3.3";
import { localParts } from "./time.js?v=2.3.3";

function buildUrls() {
  const lat = BAYS.map((b) => b.lat).join(",");
  const lon = BAYS.map((b) => b.lon).join(",");
  const forecast = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code` +
    `&past_days=${AMPEL.pastDays}&forecast_days=2&timezone=${encodeURIComponent(TIMEZONE)}&wind_speed_unit=kmh`;
  const marine = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&hourly=wave_height,sea_surface_temperature&forecast_days=2&timezone=${encodeURIComponent(TIMEZONE)}&cell_selection=sea`;
  return { forecast, marine };
}

async function fetchJson(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

const asArray = (x) => (Array.isArray(x) ? x : [x]);

/** Stündliche Open-Meteo-Daten in [{time, ...}] umbauen. */
export function hourlyRows(hourly, map) {
  const out = [];
  const n = hourly?.time?.length ?? 0;
  for (let i = 0; i < n; i++) {
    const row = { time: hourly.time[i] };
    for (const [key, src] of Object.entries(map)) row[key] = hourly[src]?.[i] ?? null;
    out.push(row);
  }
  return out;
}

/** Nächstliegende Zeile zu einer Zielzeit (letzte Zeile <= target, sonst erste). */
function rowAt(rows, targetIso) {
  let best = null;
  for (const r of rows) { if (r.time <= targetIso) best = r; else break; }
  return best ?? rows[0] ?? null;
}

/**
 * Reine Auswertung (testbar): aus Forecast-/Marine-Daten je Bucht ein Ergebnis bauen.
 * @param {object[]} forecasts  Open-Meteo-Antworten (eine je Bucht, gleiche Reihenfolge wie BAYS)
 * @param {object[]} marines    Marine-Antworten (eine je Bucht)
 * @param {Record<string,{name:string,at:string}|null>} jelly  Quallenmeldung je Bucht-ID
 * @param {Date} now
 * @param {string|null} targetDay  Zieltag YYYY-MM-DD (heute oder morgen); Default heute
 */
export function evaluate(forecasts, marines, jelly = {}, now = new Date(), targetDay = null) {
  const { day: today, iso: nowIso } = localParts(now);
  const day = targetDay ?? today;
  const cutoffIso = `${day}T${String(AMPEL.cutoffHour).padStart(2, "0")}:00`;
  const bays = {};
  BAYS.forEach((bay, i) => {
    const fc = forecasts[i] ?? {};
    const mr = marines[i] ?? {};
    const wind = hourlyRows(fc.hourly, { speed: "wind_speed_10m", dir: "wind_direction_10m", temp: "temperature_2m", code: "weather_code" });
    const sea = hourlyRows(mr.hourly, { wave: "wave_height", sst: "sea_surface_temperature" });
    const windWindow = clipToCutoff(wind, cutoffIso);
    const base = computeLevel(windWindow, bay.onshore);
    const result = applyJellyReport(base, Boolean(jelly[bay.id]));
    const at = nowIso < cutoffIso ? cutoffIso : nowIso; // Wetter für den Treffzeitpunkt zeigen
    const w = rowAt(wind, at);
    const s = rowAt(sea, at);
    const thunder = wind.some((h) => h.time.startsWith(day) && THUNDER.codes.includes(h.code) &&
      Number(h.time.slice(11, 13)) >= THUNDER.fromHour && Number(h.time.slice(11, 13)) <= THUNDER.toHour);
    bays[bay.id] = {
      id: bay.id, name: bay.name, lat: bay.lat, lon: bay.lon, onshore: bay.onshore,
      ...result,
      jellyReport: jelly[bay.id] ?? null,
      weather: {
        at: w?.time ?? null,
        airTemp: w?.temp ?? null, windKmh: w?.speed ?? null, windDir: w?.dir ?? null,
        weatherCode: w?.code ?? null,
        waveHeight: s?.wave ?? null, waterTemp: s?.sst ?? null,
      },
      thunder,
    };
  });
  const recommended = recommendBay(Object.fromEntries(Object.entries(bays).map(([k, v]) => [k, { level: v.level }])));
  return {
    generatedAt: now.toISOString(), day, cutoff: cutoffIso,
    config: { minWindKmh: AMPEL.minWindKmh, thresholds: AMPEL.thresholds, decayHours: AMPEL.decayHours },
    bays, recommended,
  };
}

/** Komplettabruf: beide Open-Meteo-Dienste, dann Auswertung. Marine darf ausfallen. */
export async function loadWeather(jelly = {}, now = new Date(), fetchImpl = fetch, targetDay = null) {
  const { forecast, marine } = buildUrls();
  const [fc, mr] = await Promise.all([
    fetchJson(forecast, fetchImpl),
    fetchJson(marine, fetchImpl).catch((e) => ({ error: String(e) })),
  ]);
  const forecasts = asArray(fc);
  const marines = mr?.error ? [] : asArray(mr);
  const out = evaluate(forecasts, marines, jelly, now, targetDay);
  if (mr?.error) out.marineError = mr.error;
  return out;
}
