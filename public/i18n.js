// Oberflächentexte Deutsch/Englisch
export const STRINGS = {
  de: {
    appName: "Schwimmgrüppchen",
    tabToday: "Heute", tabBoard: "Pinnwand", tabMore: "Mehr",
    loading: "Lade …", offline: "Offline – letzter Stand", lastUpdate: "Stand",
    invalidLink: "Dieser Link ist ungültig. Bitte einen neuen persönlichen Link anfordern.",
    noToken: "Bitte die App über deinen persönlichen Link öffnen.",
    meetAt: "Treffpunkt", at: "um", proposedBy: "Vorschlag von", changeTime: "Uhrzeit ändern", newTime: "Neue Uhrzeit (HH:MM)",
    youToday: "Kommst du heute?", yes: "Ich komme", no: "Ich komme nicht", open: "offen", away: "Nicht auf der Insel",
    notOnIsland: "Du bist gerade nicht auf Menorca – Zusage ist gesperrt.", msgToGroup: "Nachricht an die Gruppe",
    who: "Wer kommt?", statusYes: "kommt", statusNo: "kommt nicht", statusAway: "nicht auf der Insel", statusOpen: "offen",
    ampel: "Wind-/Quallen-Ampel", recommended: "Empfehlung", recommendedText: "Vorschlag für heute: {bay}", noDecision: "(Die Gruppe entscheidet.)",
    level0: "grün", level1: "orange", level2: "rot", level3: "rot !", switchBay: "Buchtwechsel empfohlen",
    onshoreHours: "{h} h auflandig am Stück", calmSince: "seit {h} h kein auflandiger Wind", jellyReported: "Quallen gemeldet von {name} um {time}",
    jellyBtn: "Quallen gesehen", jellyConfirm: "Quallen in {bay} melden? Die Bucht wird für heute auf rot gesetzt.",
    air: "Luft", water: "Wasser", waves: "Wellen", wind: "Wind", thunder: "⚡ Gewitter zwischen 14 und 19 Uhr vorhergesagt",
    weatherUnavailable: "Wetterdaten gerade nicht verfügbar.", weatherFor: "Wetter für {time} Uhr",
    boardEmpty: "Noch keine Nachrichten.", writeMessage: "Nachricht …", send: "Senden", unread: "ungelesen",
    language: "Sprache", german: "Deutsch", english: "English",
    invite: "Jemanden einladen", inviteName: "Name", inviteLang: "Sprache", inviteCreate: "Link erzeugen", inviteShare: "Link teilen",
    inviteCopied: "Link kopiert", inviteDone: "Persönlicher Link für {name}:", shareText: "Hallo {name}, hier ist dein persönlicher Link zur Schwimmgrüppchen-App:",
    invitedBy: "eingeladen von", admin: "Admin", members: "Teilnehmer", rename: "Umbenennen", deactivate: "Deaktivieren", activate: "Aktivieren",
    regenerate: "Link neu erzeugen", regenerateConfirm: "Neuen Link für {name} erzeugen? Der alte Link funktioniert dann nicht mehr.", copyLink: "Link kopieren",
    inactive: "deaktiviert", install: "Zum Startbildschirm hinzufügen, dann funktioniert die App wie eine normale App.",
    location: "Standort", locationUnknown: "nicht abgefragt / abgelehnt", locationOnIsland: "auf Menorca", locationOff: "nicht auf Menorca",
    error: "Fehler", retry: "Erneut versuchen", you: "du",
    serverError: "Der Server hat mit einem Fehler geantwortet:", offlineNoData: "Keine Verbindung zum Server. Bitte Internetverbindung prüfen und erneut versuchen.",
    sysTime: "{name} schlägt {time} Uhr vor", sysJelly: "{name} meldet Quallen in {bay}", sysInvite: "{name} hat {who} eingeladen",
    compass: ["N", "NO", "O", "SO", "S", "SW", "W", "NW"],
  },
  en: {
    appName: "Schwimmgrüppchen",
    tabToday: "Today", tabBoard: "Board", tabMore: "More",
    loading: "Loading …", offline: "Offline – last known state", lastUpdate: "Updated",
    invalidLink: "This link is invalid. Please ask for a new personal link.",
    noToken: "Please open the app via your personal link.",
    meetAt: "Meeting point", at: "at", proposedBy: "proposed by", changeTime: "Change time", newTime: "New time (HH:MM)",
    youToday: "Are you coming today?", yes: "I'm in", no: "I'm out", open: "undecided", away: "Not on the island",
    notOnIsland: "You are not on Menorca right now – joining is disabled.", msgToGroup: "Message to the group",
    who: "Who's coming?", statusYes: "in", statusNo: "out", statusAway: "not on the island", statusOpen: "undecided",
    ampel: "Wind / jellyfish light", recommended: "Suggestion", recommendedText: "Suggestion for today: {bay}", noDecision: "(The group decides.)",
    level0: "green", level1: "orange", level2: "red", level3: "red !", switchBay: "Consider another bay",
    onshoreHours: "{h} h of onshore wind in a row", calmSince: "no onshore wind for {h} h", jellyReported: "Jellyfish reported by {name} at {time}",
    jellyBtn: "Jellyfish spotted", jellyConfirm: "Report jellyfish at {bay}? The bay will be set to red for today.",
    air: "Air", water: "Water", waves: "Waves", wind: "Wind", thunder: "⚡ Thunderstorms forecast between 2 and 7 pm",
    weatherUnavailable: "Weather data currently unavailable.", weatherFor: "Weather for {time}",
    boardEmpty: "No messages yet.", writeMessage: "Message …", send: "Send", unread: "unread",
    language: "Language", german: "Deutsch", english: "English",
    invite: "Invite someone", inviteName: "Name", inviteLang: "Language", inviteCreate: "Create link", inviteShare: "Share link",
    inviteCopied: "Link copied", inviteDone: "Personal link for {name}:", shareText: "Hi {name}, here is your personal link to the Schwimmgrüppchen app:",
    invitedBy: "invited by", admin: "Admin", members: "Members", rename: "Rename", deactivate: "Deactivate", activate: "Activate",
    regenerate: "New link", regenerateConfirm: "Create a new link for {name}? The old link will stop working.", copyLink: "Copy link",
    inactive: "deactivated", install: "Add to home screen to use it like a regular app.",
    location: "Location", locationUnknown: "not requested / denied", locationOnIsland: "on Menorca", locationOff: "not on Menorca",
    error: "Error", retry: "Retry", you: "you",
    serverError: "The server responded with an error:", offlineNoData: "No connection to the server. Please check your internet connection and retry.",
    sysTime: "{name} suggests {time}", sysJelly: "{name} reports jellyfish at {bay}", sysInvite: "{name} invited {who}",
    compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  },
};

export function makeT(lang) {
  const d = STRINGS[lang] ?? STRINGS.de;
  return (key, vars = {}) => {
    let s = d[key] ?? STRINGS.de[key] ?? key;
    if (typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
