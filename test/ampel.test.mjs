import { test } from "node:test";
import assert from "node:assert/strict";
import { inSector, isOnshore, levelForRun, computeLevel, applyJellyReport, recommendBay, clipToCutoff } from "../public/lib/ampel.js";
import { evaluate } from "../public/lib/weather.js";
import { AMPEL, BAYS } from "../public/lib/config.js";

const S = { from: 135, to: 225 }; // Binisafúa (Süden)
const on = (n, speed = 20, dir = 180) => Array.from({ length: n }, (_, i) => ({ time: `t${i}`, speed, dir }));
const off = (n, speed = 20, dir = 0) => on(n, speed, dir);

test("inSector: normaler Sektor und Wrap über 0°", () => {
  assert.equal(inSector(180, 135, 225), true);
  assert.equal(inSector(100, 135, 225), false);
  assert.equal(inSector(350, 330, 30), true);
  assert.equal(inSector(10, 330, 30), true);
  assert.equal(inSector(100, 330, 30), false);
  assert.equal(inSector(-10, 330, 30), true);
});

test("isOnshore: Mindeststärke 10 km/h", () => {
  assert.equal(isOnshore({ speed: 9.9, dir: 180 }, S), false);
  assert.equal(isOnshore({ speed: 10, dir: 180 }, S), true);
  assert.equal(isOnshore({ speed: 30, dir: 300 }, S), false);
  assert.equal(isOnshore({ speed: null, dir: 180 }, S), false);
});

test("levelForRun: Schwellen 12/24/48", () => {
  assert.equal(levelForRun(0), 0);
  assert.equal(levelForRun(11), 0);
  assert.equal(levelForRun(12), 1);
  assert.equal(levelForRun(23), 1);
  assert.equal(levelForRun(24), 2);
  assert.equal(levelForRun(47), 2);
  assert.equal(levelForRun(48), 3);
});

test("computeLevel: grün bei < 12 h auflandig", () => {
  const r = computeLevel(on(11), S);
  assert.equal(r.level, 0); assert.equal(r.color, "green"); assert.equal(r.switchBay, false);
});
test("computeLevel: orange ab 12 h", () => {
  const r = computeLevel(on(12), S);
  assert.equal(r.level, 1); assert.equal(r.color, "orange");
});
test("computeLevel: rot ab 24 h", () => {
  const r = computeLevel(on(24), S);
  assert.equal(r.level, 2); assert.equal(r.color, "red"); assert.equal(r.switchBay, false);
});
test("computeLevel: rot! mit Buchtwechsel ab 48 h", () => {
  const r = computeLevel(on(48), S);
  assert.equal(r.level, 3); assert.equal(r.color, "red-alert"); assert.equal(r.switchBay, true);
});
test("computeLevel: schwacher Wind aus dem Sektor zählt nicht", () => {
  assert.equal(computeLevel(on(60, 8), S).level, 0);
});
test("computeLevel: ablandiger Wind zählt nicht", () => {
  assert.equal(computeLevel(off(60), S).level, 0);
});

test("Abklingen: Winddrehung senkt nicht sofort auf grün, sondern eine Stufe je 12 h", () => {
  const base = on(48); // rot!
  assert.equal(computeLevel([...base, ...off(1)], S).level, 3);
  assert.equal(computeLevel([...base, ...off(11)], S).level, 3);
  assert.equal(computeLevel([...base, ...off(12)], S).level, 2);
  assert.equal(computeLevel([...base, ...off(23)], S).level, 2);
  assert.equal(computeLevel([...base, ...off(24)], S).level, 1);
  assert.equal(computeLevel([...base, ...off(36)], S).level, 0);
  assert.equal(computeLevel([...base, ...off(100)], S).level, 0);
});

test("Abklingen: Flaute (unter Mindeststärke) wirkt wie ablandig", () => {
  assert.equal(computeLevel([...on(24), ...on(12, 5)], S).level, 1);
});

test("Kurze Flaute innerhalb der Toleranz unterbricht den Lauf nicht", () => {
  const r = computeLevel([...on(10), ...on(AMPEL.gapToleranceHours, 3), ...on(2)], S);
  assert.equal(r.level, 1); // 12 auflandige Stunden trotz 2 h Pause
});
test("Längere Flaute setzt den Lauf zurück", () => {
  const r = computeLevel([...on(10), ...on(AMPEL.gapToleranceHours + 1, 3), ...on(2)], S);
  assert.equal(r.level, 0);
  assert.equal(r.onshoreRun, 2);
});

test("Erneut auflandig nach Abklingen: Stufe steigt erst, wenn neuer Lauf höher ist", () => {
  // 48 h rot! -> 24 h ablandig => Stufe 1 -> dann 6 h auflandig: bleibt 1, nach 12 h weiterhin 1, nach 24 h -> 2
  assert.equal(computeLevel([...on(48), ...off(24), ...on(6)], S).level, 1);
  assert.equal(computeLevel([...on(48), ...off(24), ...on(12)], S).level, 1);
  assert.equal(computeLevel([...on(48), ...off(24), ...on(24)], S).level, 2);
});

test("Quallenmeldung: hebt mindestens auf rot, senkt nie", () => {
  const g = applyJellyReport(computeLevel(on(2), S), true);
  assert.equal(g.level, 2); assert.equal(g.jelly, true); assert.equal(g.color, "red");
  const ra = applyJellyReport(computeLevel(on(50), S), true);
  assert.equal(ra.level, 3); assert.equal(ra.switchBay, true);
  const none = applyJellyReport(computeLevel(on(2), S), false);
  assert.equal(none.level, 0); assert.equal(none.jelly, false);
});

test("Empfehlung: niedrigste Stufe, Gleichstand -> Binisafúa", () => {
  assert.equal(recommendBay({ binisafua: { level: 1 }, alcaufar: { level: 1 }, mesquida: { level: 1 } }), "binisafua");
  assert.equal(recommendBay({ binisafua: { level: 2 }, alcaufar: { level: 0 }, mesquida: { level: 0 } }), "alcaufar");
  assert.equal(recommendBay({ binisafua: { level: 3 }, alcaufar: { level: 2 }, mesquida: { level: 1 } }), "mesquida");
  assert.equal(recommendBay({ binisafua: { level: 0 }, alcaufar: { level: 3 } }), "binisafua");
});

test("clipToCutoff: nur Stunden bis einschließlich Cutoff", () => {
  const rows = [{ time: "2026-10-21T15:00" }, { time: "2026-10-21T16:00" }, { time: "2026-10-21T17:00" }];
  assert.deepEqual(clipToCutoff(rows, "2026-10-21T16:00").map((r) => r.time), ["2026-10-21T15:00", "2026-10-21T16:00"]);
});

// --- Integration der Auswertung mit synthetischen Open-Meteo-Daten ---
function fakeForecast(fnHour) {
  const time = [], wind_speed_10m = [], wind_direction_10m = [], temperature_2m = [], weather_code = [];
  const days = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"];
  let i = 0;
  for (const d of days) for (let h = 0; h < 24; h++) {
    const v = fnHour(i++, d, h);
    time.push(`${d}T${String(h).padStart(2, "0")}:00`);
    wind_speed_10m.push(v.speed); wind_direction_10m.push(v.dir); temperature_2m.push(v.temp ?? 22); weather_code.push(v.code ?? 1);
  }
  return { hourly: { time, wind_speed_10m, wind_direction_10m, temperature_2m, weather_code } };
}
function fakeMarine() {
  const time = [], wave_height = [], sea_surface_temperature = [];
  for (const d of ["2026-10-21", "2026-10-22"]) for (let h = 0; h < 24; h++) {
    time.push(`${d}T${String(h).padStart(2, "0")}:00`); wave_height.push(0.4); sea_surface_temperature.push(23.1);
  }
  return { hourly: { time, wave_height, sea_surface_temperature } };
}
const now = new Date("2026-10-21T10:00:00+02:00"); // 10:00 Madrid (CEST)

test("evaluate: Südwind seit 3 Tagen -> Binisafúa rot!, Alcaufar+Mesquida grün, Empfehlung Alcaufar; Gewitter erkannt", () => {
  const southAll = fakeForecast((i, d, h) => ({ speed: 25, dir: 200, code: d === "2026-10-21" && h === 15 ? 95 : 1 })); // SSW
  const fcs = BAYS.map(() => southAll);
  const out = evaluate(fcs, BAYS.map(() => fakeMarine()), {}, now);
  assert.equal(out.day, "2026-10-21");
  assert.equal(out.cutoff, "2026-10-21T16:00");
  assert.equal(out.bays.binisafua.level, 3);
  assert.equal(out.bays.alcaufar.level, 0); // 200° liegt nicht in 90–180 (SE)
  assert.equal(out.bays.mesquida.level, 0);
  assert.equal(out.bays.sonbou.level, 3); // 200° liegt in 165–285 (S–W)
  assert.equal(out.recommended, "alcaufar"); // Gleichstand 0/0 -> Reihenfolge: alcaufar vor mesquida
  assert.equal(out.bays.binisafua.thunder, true);
  assert.equal(out.bays.binisafua.weather.at, "2026-10-21T16:00");
  assert.equal(out.bays.binisafua.weather.waterTemp, 23.1);
  assert.equal(out.bays.binisafua.weather.waveHeight, 0.4);
  assert.equal(out.bays.binisafua.weather.windDir, 200);
});

test("evaluate: Stunden nach 16:00 heute zählen nicht (Forecast-Südwind erst ab 17 Uhr)", () => {
  const lateSouth = fakeForecast((i, d, h) => ((d === "2026-10-21" && h >= 17) || d === "2026-10-22") ? { speed: 30, dir: 180 } : { speed: 2, dir: 0 });
  const out = evaluate(BAYS.map(() => lateSouth), [], {}, now);
  assert.equal(out.bays.binisafua.level, 0);
});

test("evaluate: Quallenmeldung hat Vorrang, Empfehlung wechselt", () => {
  const calm = fakeForecast(() => ({ speed: 2, dir: 0 }));
  const out = evaluate(BAYS.map(() => calm), [], { binisafua: { name: "Kai", at: "2026-10-21T09:00:00Z" } }, now);
  assert.equal(out.bays.binisafua.level, 2);
  assert.equal(out.bays.binisafua.jelly, true);
  assert.equal(out.bays.binisafua.jellyReport.name, "Kai");
  assert.equal(out.recommended, "alcaufar");
});

test("evaluate: fehlende Marine-Daten ergeben null statt Fehler", () => {
  const calm = fakeForecast(() => ({ speed: 2, dir: 0 }));
  const out = evaluate(BAYS.map(() => calm), [], {}, now);
  assert.equal(out.bays.mesquida.weather.waterTemp, null);
  assert.equal(BAYS.length, Object.keys(out.bays).length);
});

test("evaluate: Zieltag morgen -> Fenster bis morgen 16:00, Südwind heute Abend zählt, Gewitter morgen", () => {
  const eveningSouth = fakeForecast((i, d, h) => ((d === "2026-10-21" && h >= 17) || d === "2026-10-22") ? { speed: 30, dir: 180, code: d === "2026-10-22" && h === 16 ? 96 : 1 } : { speed: 2, dir: 0 });
  const out = evaluate(BAYS.map(() => eveningSouth), [], {}, new Date("2026-10-21T18:00:00+02:00"), "2026-10-22");
  assert.equal(out.day, "2026-10-22"); assert.equal(out.cutoff, "2026-10-22T16:00");
  assert.equal(out.bays.binisafua.level, 2); // 17:00 heute bis 16:00 morgen = 24 Stunden auflandig -> rot
  assert.equal(out.bays.binisafua.thunder, true);
  assert.equal(out.bays.binisafua.weather.at, "2026-10-22T16:00");
});

test("Windsektoren je Bucht entsprechen der Ortskenntnis", () => {
  const sec = Object.fromEntries(BAYS.map((b) => [b.id, b.onshore]));
  const on = (id, dir) => inSector(dir, sec[id].from, sec[id].to);
  assert.ok(on("mesquida", 90) && !on("mesquida", 180) && !on("mesquida", 0), "Mesquida: Ostwind");
  assert.ok(on("alcaufar", 135) && !on("alcaufar", 45) && !on("alcaufar", 225), "Alcaufar: Südostwind");
  assert.ok(on("binisafua", 180) && !on("binisafua", 90) && !on("binisafua", 270), "Binisafúa: Südwind");
  assert.ok(on("sonbou", 180) && on("sonbou", 225) && on("sonbou", 270) && !on("sonbou", 135) && !on("sonbou", 315), "Son Bou: Süd bis West");
});
