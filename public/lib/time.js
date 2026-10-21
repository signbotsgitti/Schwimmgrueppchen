import { TIMEZONE } from "./config.js?v=2.4.0";

/** Liefert Datum/Uhrzeit-Teile in Europe/Madrid. */
export function localParts(date = new Date(), tz = TIMEZONE) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === "24" ? "00" : p.hour;
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(hour), minute: Number(p.minute),
           iso: `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}` };
}

export function todayLocal(date = new Date()) {
  return localParts(date).day;
}
