// Erklärung der Quallen-Ampel, alle Zahlen kommen aus der Konfiguration.
import { BAYS, AMPEL, THUNDER, DEFAULT_MEET_TIME } from "./lib/config.js?v=2.8.0";

const HELP = {
  de: {
    title: "So funktioniert die Quallen-Ampel",
    compass: ["N", "NO", "O", "SO", "S", "SW", "W", "NW"],
    sections: [
      ["Grundidee", "Quallen im Mittelmeer schwimmen nicht gegen die Strömung, sie treiben. Weht der Wind vom Meer auf den Strand (auflandig), drückt er die oberen Wasserschichten und damit die Quallen in die Bucht. Dreht der Wind und weht vom Land aufs Meer (ablandig), treibt er sie wieder hinaus. Die App rechnet deshalb für jede Bucht aus den stündlichen Winddaten von Open-Meteo aus, wie lange der Wind schon auflandig weht."],
      ["Was zählt als auflandig", "Für jede Bucht ist ein Windsektor hinterlegt, also der Bereich der Richtungen, aus denen der Wind vom offenen Meer in die Bucht weht (Richtung = woher der Wind kommt). Wind zählt erst ab {min} km/h, darunter bewegt er das Wasser kaum.{bays}"],
      ["Die vier Stufen", "Gezählt werden die auflandigen Stunden am Stück. Unter {orange} h: grün. Ab {orange} h: orange, ein Schwarm vor der Küste kann den Strand erreichen. Ab {red} h: rot, ein Schwarm ist wahrscheinlich angekommen. Ab {redAlert} h: rot mit Ausrufezeichen, nach mehrtägigem Wind sammeln sich Quallen in hoher Dichte, die App empfiehlt den Buchtwechsel. Kurze Flauten bis {gap} h unterbrechen die Zählung nicht."],
      ["Abklingen", "Dreht der Wind, fällt die Stufe nicht sofort auf grün, sondern schrittweise. Weht aktiv ablandiger Wind mit mindestens {min} km/h aus der Gegenrichtung, sinkt die Stufe um eins je {decayOff} h, denn er treibt die Quallen innerhalb weniger Stunden hinaus. Bei Flaute oder Seitenwind bleibt der Schwarm träge liegen, dann sinkt die Stufe nur um eins je {decayCalm} h. Setzt der auflandige Wind wieder ein, steigt die Stufe erst, wenn der neue Lauf länger ist als das, was noch übrig ist."],
      ["Starkwind", "Ab {strong} km/h auflandig (etwa 6 Beaufort) zerreißt die Brandung die Schwärme. Man sieht dann weniger ganze Quallen, aber abgerissene, unsichtbare Tentakelfragmente der Leuchtqualle treiben im Flachwasser und können brennen. Trat solcher Wind in den letzten {look} h auf, zeigt die Bucht einen eigenen Hinweis. Die Stufe bleibt davon unberührt."],
      ["Zeitfenster und Zieltag", "Betrachtet werden die letzten {pastDays} Tage plus der Zieltag bis {cutoff}:00 Uhr, also bis zum Treffen. Bis eine Stunde nach der Treffzeit (Standard {meet} Uhr) ist der Zieltag heute, danach morgen. Für morgen fließt die Windvorhersage bis {cutoff}:00 Uhr ein, die Ampel kann sich bis dahin noch ändern."],
      ["Quallenmeldung vor Ort", "Wer Quallen sieht, drückt in der Bucht auf „Quallen gesehen“. Die Bucht steht dann für den Zieltag mindestens auf rot, unabhängig vom Wind, und alle sehen Name und Uhrzeit der Meldung. Eine Beobachtung schlägt die Berechnung."],
      ["Empfehlung", "Die App schlägt die Bucht mit der niedrigsten Stufe vor. Bei Gleichstand gilt die Reihenfolge {order}. Das ist ein Vorschlag, entschieden wird in der Gruppe."],
      ["Weitere Wetterdaten", "Wassertemperatur und Wellenhöhe kommen von der Open-Meteo Marine API, Lufttemperatur und Wind vom normalen Wettermodell. Angezeigt werden die Werte für {cutoff}:00 Uhr des Zieltags. Eine Gewitterwarnung erscheint, wenn zwischen {tFrom} und {tTo} Uhr Gewitter vorhergesagt sind. Die Daten werden beim Öffnen und alle paar Minuten aktualisiert, offline bleibt der letzte Stand mit Zeitstempel sichtbar."],
      ["Grenzen", "Die Ampel ist eine Abschätzung aus Wind und Dauer. Strömungen, Wassertemperatur und Zufall spielen ebenfalls eine Rolle. Ein Blick ins Wasser vor dem Schwimmen ersetzt sie nicht."],
    ],
  },
  en: {
    title: "How the jellyfish light works",
    compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
    sections: [
      ["The idea", "Mediterranean jellyfish do not swim against currents, they drift. When wind blows from the sea onto the beach (onshore), it pushes the surface water and the jellyfish into the bay. When it turns and blows from the land out to sea (offshore), it carries them away again. So for each bay the app uses hourly wind data from Open-Meteo to work out how long the wind has been onshore."],
      ["What counts as onshore", "Each bay has a wind sector: the range of directions from which wind blows from the open sea into the bay (direction = where the wind comes from). Wind only counts from {min} km/h, below that it barely moves the water.{bays}"],
      ["The four levels", "The app counts consecutive onshore hours. Below {orange} h: green. From {orange} h: orange, a swarm off the coast can reach the beach. From {red} h: red, a swarm has probably arrived. From {redAlert} h: red with an exclamation mark, after several days of wind jellyfish gather in high density and the app recommends switching bays. Short lulls of up to {gap} h do not break the count."],
      ["Decay", "When the wind turns, the level does not drop to green at once but step by step. With active offshore wind of at least {min} km/h from the opposite direction the level drops one step every {decayOff} h, because it pushes the jellyfish out within a few hours. In calm or cross-shore wind the swarm lingers, so the level drops only one step every {decayCalm} h. If onshore wind returns, the level rises only once the new run is longer than what is left."],
      ["Strong wind", "From {strong} km/h onshore (about 6 Beaufort) the surf tears swarms apart. You see fewer whole jellyfish, but torn, invisible tentacle fragments of the mauve stinger drift in shallow water and can sting. If such wind occurred in the last {look} h, the bay shows a separate warning. The level itself is unchanged."],
      ["Time window and target day", "The app looks at the last {pastDays} days plus the target day up to {cutoff}:00, i.e. the meeting. Until one hour after the meeting time (default {meet}) the target day is today, afterwards tomorrow. For tomorrow the wind forecast up to {cutoff}:00 is included, so the light may still change until then."],
      ["Jellyfish report on site", "Anyone who sees jellyfish taps “Jellyfish spotted” on the bay. That bay is then at least red for the target day regardless of wind, and everyone sees the name and time of the report. An observation beats the calculation."],
      ["Suggestion", "The app suggests the bay with the lowest level. On a tie the order is {order}. It is a suggestion, the group decides."],
      ["Other weather data", "Water temperature and wave height come from the Open-Meteo Marine API, air temperature and wind from the regular weather model. Values shown are for {cutoff}:00 on the target day. A thunderstorm warning appears when storms are forecast between {tFrom}:00 and {tTo}:00. Data refreshes on opening and every few minutes; offline the last state stays visible with a timestamp."],
      ["Limits", "The light is an estimate from wind and duration. Currents, water temperature and chance also play a role. It does not replace a look into the water before swimming."],
    ],
  },
  fr: {
    title: "Comment fonctionne le feu méduses",
    compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
    sections: [
      ["L'idée", "En Méditerranée, les méduses ne nagent pas contre le courant, elles dérivent. Quand le vent souffle de la mer vers la plage (vent de mer), il pousse l'eau de surface et donc les méduses dans la crique. Quand il tourne et souffle de la terre vers le large (vent de terre), il les emporte à nouveau. L'application calcule donc pour chaque crique, à partir des données horaires de vent d'Open-Meteo, depuis combien de temps le vent est de mer."],
      ["Ce qui compte comme vent de mer", "Chaque crique a un secteur de vent : la plage de directions d'où le vent souffle du large vers la crique (direction = d'où vient le vent). Le vent ne compte qu'à partir de {min} km/h, en dessous il déplace à peine l'eau.{bays}"],
      ["Les quatre niveaux", "On compte les heures de vent de mer d'affilée. Moins de {orange} h : vert. À partir de {orange} h : orange, un banc au large peut atteindre la plage. À partir de {red} h : rouge, un banc est probablement arrivé. À partir de {redAlert} h : rouge avec point d'exclamation, après plusieurs jours de vent les méduses s'accumulent en forte densité et l'application conseille de changer de crique. Les accalmies courtes jusqu'à {gap} h n'interrompent pas le compte."],
      ["Décroissance", "Quand le vent tourne, le niveau ne retombe pas au vert d'un coup mais par paliers. Avec un vent de terre actif d'au moins {min} km/h venant de la direction opposée, le niveau baisse d'un cran toutes les {decayOff} h, car il chasse les méduses en quelques heures. Par calme plat ou vent de travers, le banc reste sur place et le niveau ne baisse que d'un cran toutes les {decayCalm} h. Si le vent de mer reprend, le niveau ne remonte que lorsque la nouvelle série dépasse ce qui reste."],
      ["Vent fort", "À partir de {strong} km/h de vent de mer (environ 6 Beaufort), les vagues déchirent les bancs. On voit moins de méduses entières, mais des fragments de tentacules invisibles de la pélagie dérivent dans l'eau peu profonde et peuvent brûler. Si un tel vent a soufflé dans les {look} dernières heures, la crique affiche un avertissement séparé. Le niveau lui-même ne change pas."],
      ["Fenêtre de temps et jour cible", "L'application regarde les {pastDays} derniers jours plus le jour cible jusqu'à {cutoff}h00, c'est-à-dire jusqu'au rendez-vous. Jusqu'à une heure après l'heure de rendez-vous ({meet} par défaut), le jour cible est aujourd'hui, ensuite demain. Pour demain, la prévision de vent jusqu'à {cutoff}h00 est prise en compte, le feu peut donc encore changer d'ici là."],
      ["Signalement sur place", "Qui voit des méduses touche « Méduses vues » sur la crique. Celle-ci passe alors au moins au rouge pour le jour cible, quel que soit le vent, et tout le monde voit le nom et l'heure du signalement. Une observation l'emporte sur le calcul."],
      ["Suggestion", "L'application propose la crique au niveau le plus bas. En cas d'égalité, l'ordre est {order}. C'est une suggestion, le groupe décide."],
      ["Autres données météo", "La température de l'eau et la hauteur des vagues viennent de l'API Marine d'Open-Meteo, la température de l'air et le vent du modèle météo classique. Les valeurs affichées sont celles de {cutoff}h00 du jour cible. Un avertissement d'orage apparaît quand des orages sont prévus entre {tFrom}h et {tTo}h. Les données se rafraîchissent à l'ouverture et toutes les quelques minutes ; hors ligne, le dernier état reste visible avec l'heure."],
      ["Limites", "Le feu est une estimation à partir du vent et de sa durée. Les courants, la température de l'eau et le hasard jouent aussi. Il ne remplace pas un coup d'œil dans l'eau avant de nager."],
    ],
  },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** HTML der Erklärung in der gewünschten Sprache. */
export function renderHelp(lang, defaults = {}) {
  const h = HELP[lang] ?? HELP.de;
  const compass = (deg) => h.compass[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
  const bays = `<ul>${BAYS.map((b) => `<li><strong>${esc(b.name)}</strong>: ${compass(b.onshore.from)}–${compass(b.onshore.to)} (${b.onshore.from}°–${b.onshore.to}°)</li>`).join("")}</ul>`;
  const vars = {
    min: AMPEL.minWindKmh, orange: AMPEL.thresholds.orange, red: AMPEL.thresholds.red, redAlert: AMPEL.thresholds.redAlert,
    gap: AMPEL.gapToleranceHours, decayOff: AMPEL.decayHoursOffshore, decayCalm: AMPEL.decayHoursCalm,
    strong: AMPEL.strongWindKmh, look: AMPEL.strongWindLookbackHours, pastDays: AMPEL.pastDays, cutoff: String(AMPEL.cutoffHour).padStart(2, "0"),
    meet: defaults.time ?? DEFAULT_MEET_TIME, tFrom: THUNDER.fromHour, tTo: THUNDER.toHour, order: BAYS.map((b) => b.name).join(" → "),
  };
  const fill = (s) => esc(s).replace(/\{(\w+)\}/g, (_, k) => (k === "bays" ? bays : esc(vars[k])));
  return `<div class="card help"><h2>${esc(h.title)}</h2>${h.sections.map(([head, text]) => `<h3>${esc(head)}</h3><p>${fill(text)}</p>`).join("")}</div>`;
}
