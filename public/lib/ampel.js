// Wind-/Quallen-Ampel: reine Funktionen, ohne I/O. Wird von Worker und Tests genutzt.
import { AMPEL, BAYS, LEVEL_NAMES } from "./config.js?v=2.5.2";

/** Liegt Richtung `dir` (Grad) im Sektor from..to? Sektor darf über 0° wrappen (z. B. 330..30). */
export function inSector(dir, from, to) {
  const d = ((dir % 360) + 360) % 360;
  if (from <= to) return d >= from && d <= to;
  return d >= from || d <= to;
}

export function isOnshore(hour, sector, minWindKmh = AMPEL.minWindKmh) {
  if (hour == null || hour.speed == null || hour.dir == null) return false;
  if (hour.speed < minWindKmh) return false;
  return inSector(hour.dir, sector.from, sector.to);
}

/** Gegenüberliegender Sektor (gleiche Breite, um 180° gedreht). */
export function oppositeSector(sector) {
  return { from: (sector.from + 180) % 360, to: (sector.to + 180) % 360 };
}

/** Aktiver ablandiger Wind: Mindeststärke erreicht und aus dem gegenüberliegenden Sektor. */
export function isOffshore(hour, sector, minWindKmh = AMPEL.minWindKmh) {
  if (hour == null || hour.speed == null || hour.dir == null) return false;
  if (hour.speed < minWindKmh) return false;
  const o = oppositeSector(sector);
  return inSector(hour.dir, o.from, o.to);
}

export function levelForRun(hours, thresholds = AMPEL.thresholds) {
  if (hours >= thresholds.redAlert) return 3;
  if (hours >= thresholds.red) return 2;
  if (hours >= thresholds.orange) return 1;
  return 0;
}

/**
 * Berechnet die Ampelstufe für eine Bucht.
 * @param {Array<{time:string,speed:number,dir:number}>} hours chronologisch, bereits auf das Fenster (bis heute 16:00) beschnitten
 * @param {{from:number,to:number}} sector auflandiger Sektor
 * @param {object} cfg Ampel-Konfiguration (Default: AMPEL)
 * @returns {{level:number, color:string, onshoreRun:number, offshoreHours:number, peakRun:number, switchBay:boolean, strongWind:boolean, maxOnshoreKmh:number}}
 */
export function computeLevel(hours, sector, cfg = AMPEL) {
  let level = 0;
  let run = 0;          // auflandige Stunden am Stück (Flauten bis Toleranz ignoriert)
  let pause = 0;        // aktuelle Flautenlänge innerhalb eines Laufs
  let offshore = 0;     // Stunden seit letztem auflandigen Wind
  let decay = 0;        // angesammeltes Abkling-Guthaben (1 = eine Stufe)
  let peakRun = 0;
  for (const h of hours) {
    if (isOnshore(h, sector, cfg.minWindKmh)) {
      run += 1;
      pause = 0;
      offshore = 0;
      decay = 0;
      peakRun = Math.max(peakRun, run);
      level = Math.max(level, levelForRun(run, cfg.thresholds));
    } else {
      offshore += 1;
      pause += 1;
      if (pause > cfg.gapToleranceHours) run = 0;
      // Abklingen: aktiver ablandiger Wind schnell, Flaute/Seitenwind langsam
      decay += 1 / (isOffshore(h, sector, cfg.minWindKmh) ? cfg.decayHoursOffshore : cfg.decayHoursCalm);
      while (decay >= 1 - 1e-9 && level > 0) { level -= 1; decay -= 1; }
      if (level === 0) decay = 0;
    }
  }
  // Starkwind-Hinweis: auflandiger Wind >= strongWindKmh innerhalb der letzten Stunden des Fensters
  const tail = hours.slice(-cfg.strongWindLookbackHours);
  const maxOnshoreKmh = tail.reduce((m, h) => (isOnshore(h, sector, cfg.minWindKmh) ? Math.max(m, h.speed) : m), 0);
  return {
    level,
    color: LEVEL_NAMES[level],
    onshoreRun: run,
    offshoreHours: offshore,
    peakRun,
    switchBay: level >= 3,
    strongWind: maxOnshoreKmh >= cfg.strongWindKmh,
    maxOnshoreKmh,
  };
}

/** Quallenmeldung hat Vorrang: hebt die Stufe mindestens auf jellyMinLevel. */
export function applyJellyReport(result, reported, cfg = AMPEL) {
  if (!reported) return { ...result, jelly: false };
  const level = Math.max(result.level, cfg.jellyMinLevel);
  return { ...result, level, color: LEVEL_NAMES[level], jelly: true, switchBay: level >= 3 };
}

/**
 * Empfehlung: Bucht mit der niedrigsten Stufe; bei Gleichstand die erste in der Reihenfolge von `order`.
 * @param {Record<string,{level:number}>} byBay  Ergebnis je Bucht-ID
 * @param {string[]} order  Prioritätsreihenfolge (Default: BAYS-Reihenfolge)
 */
export function recommendBay(byBay, order = BAYS.map((b) => b.id)) {
  let best = null;
  for (const id of order) {
    const r = byBay[id];
    if (!r) continue;
    if (best === null || r.level < byBay[best].level) best = id;
  }
  return best;
}

/** Schneidet stündliche Daten auf das Fenster bis `cutoffIso` (inklusive). Zeiten als "YYYY-MM-DDTHH:MM". */
export function clipToCutoff(hours, cutoffIso) {
  return hours.filter((h) => h.time <= cutoffIso);
}
