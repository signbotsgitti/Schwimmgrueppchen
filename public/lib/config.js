// Zentrale Konfiguration: Buchten, Windsektoren, Ampel-Schwellen.
// Alle Werte hier sind bewusst ohne Code-Änderung anpassbar.

export const TIMEZONE = "Europe/Madrid";

// Standard-Treffpunkt
export const DEFAULT_MEET_TIME = "16:15";
export const DEFAULT_BAY = "binisafua";

// Menorca-Bounding-Box für die Geolokation (grob)
export const ISLAND_BOUNDS = { latMin: 39.79, latMax: 40.10, lonMin: 3.78, lonMax: 4.33 };

// Buchten in Prioritätsreihenfolge (bei Gleichstand gewinnt die erste)
// Windrichtung = Richtung, AUS der der Wind kommt (Open-Meteo-Konvention).
// Auflandig = Wind kommt vom offenen Meer in die Bucht hinein.
// Sektoren nach Ortskenntnis (Kai, 2026-10-22): Einzelrichtung ±45°, Son Bou Süd bis West ±15°.
// Hinweis: Standard-Treffzeit/-Bucht gelten nur im Client; die Datenbank speichert nur Abweichungen.
export const BAYS = [
  {
    id: "binisafua",
    name: "Cala Binisafúa",
    lat: 39.8227, lon: 4.2300,
    // Südwind (S ±45°)
    onshore: { from: 135, to: 225 },
  },
  {
    id: "alcaufar",
    name: "Cala Alcaufar",
    lat: 39.8338, lon: 4.2960,
    // Südostwind (SE ±45°)
    onshore: { from: 90, to: 180 },
  },
  {
    id: "mesquida",
    name: "Cala Mesquida",
    lat: 39.9075, lon: 4.3035,
    // Ostwind (E ±45°)
    onshore: { from: 45, to: 135 },
  },
  {
    id: "sonbou",
    name: "Son Bou",
    lat: 39.8975, lon: 4.0750,
    // Südwind bis Westwind (S–W, ±15° Rand)
    onshore: { from: 165, to: 285 },
  },
];

export const AMPEL = {
  // Wind zählt erst ab dieser Stärke (km/h) als auflandig
  minWindKmh: 10,
  // Stunden auflandig am Stück -> Stufe
  thresholds: { orange: 12, red: 24, redAlert: 48 },
  // Abklingen: pro so vielen Stunden ohne auflandigen Wind sinkt die Stufe um eins
  decayHours: 12,
  // Kurze Flauten bis zu dieser Länge unterbrechen die "am Stück"-Zählung nicht
  gapToleranceHours: 2,
  // Betrachtungsfenster: Vergangenheit (Tage) + heute bis zu dieser Stunde
  pastDays: 3,
  cutoffHour: 16,
  // Quallenmeldung setzt die Bucht mindestens auf diese Stufe (2 = rot)
  jellyMinLevel: 2,
};

// Gewitterwarnung: Weather-Code 95–99 zwischen diesen Stunden (heute)
export const THUNDER = { fromHour: 14, toHour: 19, codes: [95, 96, 99] };

// Wetter im Browser frühestens nach so vielen Minuten neu laden
export const WEATHER_REFRESH_MINUTES = 10;

export const LEVEL_NAMES = ["green", "orange", "red", "red-alert"];
