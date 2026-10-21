// Erzeugt Seed-SQL mit zufälligen Tokens + Link-Liste für die Startgruppe.
// Aufruf: node scripts/seed.mjs [https://deine-domain.pages.dev]
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const base = (process.argv[2] ?? "https://schwimmgrueppchen.pages.dev").replace(/\/$/, "");
const START = [
  { name: "Kai", lang: "de", admin: 1 },
  { name: "Monika", lang: "de", admin: 0 },
  { name: "Amy", lang: "en", admin: 0 },
  { name: "Lindsay", lang: "en", admin: 0 },
  { name: "Marie Solange", lang: "en", admin: 0 },
];
const date = new Date().toISOString().slice(0, 10);
const rows = START.map((m) => ({ ...m, token: randomBytes(16).toString("hex") }));
const sql = rows.map((m) => `INSERT INTO members (token, name, lang, is_admin, invited_by) VALUES ('${m.token}', '${m.name.replace(/'/g, "''")}', '${m.lang}', ${m.admin}, NULL);`).join("\n") + "\n";
const links = [`# Persönliche Links (${date}) – vertraulich, nicht committen`, "", ...rows.map((m) => `- ${m.name}${m.admin ? " (Admin)" : ""} [${m.lang}]: ${base}/?u=${m.token}`), ""].join("\n");
mkdirSync("handover", { recursive: true });
writeFileSync(`handover/${date}-seed.sql`, sql);
writeFileSync(`handover/${date}-links.md`, links);
console.log(`Geschrieben: handover/${date}-seed.sql und handover/${date}-links.md`);
console.log(links);
