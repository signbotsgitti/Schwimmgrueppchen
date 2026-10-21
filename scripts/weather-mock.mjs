// Synthetische Open-Meteo-Antworten für lokale Entwicklung/Tests ohne Internet.
import { BAYS, AMPEL } from "../public/lib/config.js";
import { localParts } from "../public/lib/time.js";

function dayStr(d) { return d.toISOString().slice(0, 10); }

export function mockForecasts(now = new Date()) {
  const { day } = localParts(now);
  const days = [];
  for (let i = -AMPEL.pastDays; i <= 1; i++) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); days.push(dayStr(d)); }
  // Szenario: 2 Tage Südwind (Binisafúa rot), dann Drehung auf Nord; Gewitter heute 15 Uhr
  const forecasts = BAYS.map(() => {
    const h = { time: [], temperature_2m: [], wind_speed_10m: [], wind_direction_10m: [], weather_code: [] };
    days.forEach((d, di) => { for (let hh = 0; hh < 24; hh++) {
      h.time.push(`${d}T${String(hh).padStart(2, "0")}:00`);
      h.temperature_2m.push(21 + 4 * Math.sin((hh - 6) / 24 * Math.PI * 2));
      const south = di < 2 || (di === 2 && hh < 6);
      h.wind_speed_10m.push(south ? 22 : 14);
      h.wind_direction_10m.push(south ? 175 : 20);
      h.weather_code.push(d === day && hh === 15 ? 95 : 2);
    } });
    return { hourly: h };
  });
  const marines = BAYS.map((b, i) => {
    const h = { time: [], wave_height: [], sea_surface_temperature: [] };
    days.slice(-2).forEach((d) => { for (let hh = 0; hh < 24; hh++) { h.time.push(`${d}T${String(hh).padStart(2, "0")}:00`); h.wave_height.push(0.3 + 0.3 * i); h.sea_surface_temperature.push(22.4); } });
    return { hourly: h };
  });
  return { forecasts, marines };
}
