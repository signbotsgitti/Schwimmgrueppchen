// Erzeugt Seed-SQL (Postgres/Supabase) mit zufälligen Tokens + Link-Liste für die Startgruppe.
// Aufruf: node scripts/seed.mjs [https://signbotsgitti.github.io/Schwimmgrueppchen/]
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const base = (process.argv[2] ?? "https://signbotsgitti.github.io/Schwimmgrueppchen/").replace(/\/?$/, "/");
const START = [
  { name: "Kai", lang: "de", admin: true },
  { name: "Monika", lang: "de", admin: false },
  { name: "Amy", lang: "en", admin: false },
  { name: "Lindsay", lang: "en", admin: false },
  { name: "Marie Solange", lang: "en", admin: false },
];
const date = new Date().toISOString().slice(0, 10);
const rows = START.map((m) => ({ ...m, token: randomBytes(16).toString("hex") }));
const sql = "-- Startgruppe (im Supabase SQL-Editor ausführen, nach dem Schema)\n" +
  rows.map((m) => `insert into public.members (token, name, lang, is_admin) values ('${m.token}', '${m.name.replace(/'/g, "''")}', '${m.lang}', ${m.admin});`).join("\n") + "\n";
const links = [`# Persönliche Links (${date}) – vertraulich, nicht committen`, "", ...rows.map((m) => `- ${m.name}${m.admin ? " (Admin)" : ""} [${m.lang}]: ${base}?u=${m.token}`), ""].join("\n");
mkdirSync("handover", { recursive: true });
writeFileSync(`handover/${date}-seed.sql`, sql);
writeFileSync(`handover/${date}-links.md`, links);
console.log(`Geschrieben: handover/${date}-seed.sql und handover/${date}-links.md`);
console.log(links);
