import { test, before } from "node:test";
import assert from "node:assert/strict";
import { freshDb, rpc } from "./_pg.mjs";

const K = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", M = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SEED = `insert into public.members (token, name, lang, is_admin) values ('${K}', 'Kai', 'de', true), ('${M}', 'Monika', 'de', false);`;
let db;
before(async () => { db = await freshDb(SEED); });

const fails = async (p, status, re) => { await assert.rejects(p, (e) => { assert.equal(e.status, status); if (re) assert.match(e.message, re); return true; }); };

test("Schema ist idempotent (zweimal ausführbar)", async () => {
  const db2 = await freshDb();
  const { readFileSync } = await import("node:fs");
  await db2.exec(readFileSync(new URL("../supabase/2026-10-21-schema.sql", import.meta.url), "utf8"));
});

test("Tabellen sind für anon gesperrt, API-Funktionen freigegeben", async () => {
  const t = await db.query("select has_table_privilege('anon', 'public.members', 'SELECT') as s");
  assert.equal(t.rows[0].s, false);
  const f = await db.query("select has_function_privilege('anon', 'public.api_state(text)', 'EXECUTE') as ok, has_function_privilege('anon', 'public.app_admin_list()', 'EXECUTE') as bad");
  assert.equal(f.rows[0].ok, true); assert.equal(f.rows[0].bad, false);
});

test("Auth: ungültiger/fehlender Token -> 401", async () => {
  await fails(rpc(db, "api_state", { p_token: "nope" }), 401, /Ungültiger Link/);
  await fails(rpc(db, "api_state", { p_token: "c".repeat(32) }), 401);
  await fails(rpc(db, "api_state", { p_token: null }), 401);
});

test("state: Grundstruktur", async () => {
  const s = await rpc(db, "api_state", { p_token: K });
  assert.match(s.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(s.me.name, "Kai"); assert.equal(s.me.isAdmin, true);
  assert.equal(s.members.length, 2); assert.equal(s.members[0].attendance, null);
  assert.equal(s.meet.time, null); assert.equal(s.meet.bay, null); assert.deepEqual(s.messages, []); assert.deepEqual(s.jelly, {});
});

test("attendance: yes/away/open, Validierung", async () => {
  let s = await rpc(db, "api_attendance", { p_token: K, p_status: "yes" });
  assert.equal(s.members.find((m) => m.name === "Kai").attendance.status, "yes");
  s = await rpc(db, "api_attendance", { p_token: M, p_status: "away" });
  assert.equal(s.members.find((m) => m.name === "Monika").attendance.status, "away");
  s = await rpc(db, "api_attendance", { p_token: M, p_status: "open" });
  assert.equal(s.members.find((m) => m.name === "Monika").attendance, null);
  s = await rpc(db, "api_attendance", { p_token: M, p_status: "maybe" });
  assert.equal(s.members.find((m) => m.name === "Monika").attendance.status, "maybe");
  await fails(rpc(db, "api_attendance", { p_token: M, p_status: "perhaps" }), 400);
});

test("time: Vorschlag mit Name + Systemnachricht, Validierung", async () => {
  const s = await rpc(db, "api_time", { p_token: M, p_time: "17:00" });
  assert.equal(s.meet.time, "17:00"); assert.equal(s.meet.proposedBy, "Monika");
  assert.equal(s.messages.at(-1).kind, "system"); assert.equal(s.messages.at(-1).text, "⏰ Monika: 17:00");
  await fails(rpc(db, "api_time", { p_token: M, p_time: "25:00" }), 400, /HH:MM/);
});

test("bay: Bucht für heute vorschlagen, Uhrzeit bleibt erhalten, Validierung, Update-Skript läuft", async () => {
  let s = await rpc(db, "api_bay", { p_token: K, p_bay: "sonbou" });
  assert.equal(s.meet.bay, "sonbou"); assert.equal(s.meet.bayBy, "Kai");
  assert.equal(s.meet.time, "17:00"); assert.equal(s.meet.proposedBy, "Monika");
  assert.equal(s.messages.at(-1).text, "📍 Kai: sonbou");
  s = await rpc(db, "api_time", { p_token: K, p_time: "16:45" });
  assert.equal(s.meet.bay, "sonbou"); assert.equal(s.meet.time, "16:45"); assert.equal(s.meet.proposedBy, "Kai");
  await fails(rpc(db, "api_bay", { p_token: K, p_bay: "Cala X!" }), 400);
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync(new URL("../supabase/2026-10-21-update-bucht.sql", import.meta.url), "utf8"));
  assert.equal((await rpc(db, "api_state", { p_token: K })).meet.bay, "sonbou");
});

test("Zieltag: bis 1 h nach Treffzeit heute, danach morgen (geänderte Treffzeit zählt)", async () => {
  const q = async (ts, mt) => (await db.query(
    `with n as (select ($1::timestamptz at time zone 'Europe/Madrid') as now_local)
     select case when (select now_local from n) >= ((select now_local from n)::date + $2::time + interval '1 hour') then 1 else 0 end as tomorrow`,
    [ts, mt])).rows[0].tomorrow;
  // Reine Formelprüfung der Zeitlogik, unabhängig von now()
  assert.equal(await q("2026-07-10T17:14:00+02:00", "16:15"), 0);
  assert.equal(await q("2026-07-10T17:15:00+02:00", "16:15"), 1);
  assert.equal(await q("2026-07-10T17:30:00+02:00", "17:00"), 0);
  assert.equal(await q("2026-07-10T18:00:00+02:00", "17:00"), 1);
  const s = await rpc(db, "api_state", { p_token: K });
  assert.ok(s.day === s.today || new Date(s.day) - new Date(s.today) === 86400000, "day ist heute oder morgen");
  const fnDay = (await db.query("select public.app_target_day() = public.app_today() as same, public.app_default_meet_time() as mt")).rows[0];
  assert.equal(typeof fnDay.same, "boolean"); assert.match(fnDay.mt, /^\d\d:\d\d$/);
});

test("history: Tage mit Einträgen, Mitglieder, Zeitraum; Update-Skript läuft", async () => {
  const h = await rpc(db, "api_history", { p_token: M, p_days: 30 });
  assert.match(h.from, /^\d{4}-\d{2}-\d{2}$/); assert.ok(h.to >= h.from);
  assert.ok(h.members.some((m) => m.name === "Kai"));
  const dayWithKai = h.days.find((d) => d.entries.some((e) => e.m === 1 && e.s === "yes"));
  if (dayWithKai) { assert.equal(dayWithKai.bay, "sonbou"); assert.equal(dayWithKai.time, "16:45"); }
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync(new URL("../supabase/2026-10-21-update-historie.sql", import.meta.url), "utf8"));
  assert.equal((await rpc(db, "api_history", { p_token: M, p_days: 30 })).members.length, h.members.length);
  await fails(rpc(db, "api_history", { p_token: "x".repeat(32), p_days: 30 }), 401);
});

test("admin attendance: Status für andere setzen, auch für vergangene Tage; nur Admin; Update-Skript läuft", async () => {
  await fails(rpc(db, "api_admin_attendance", { p_token: M, p_member_id: 1, p_status: "yes", p_day: null }), 403);
  let s = await rpc(db, "api_admin_attendance", { p_token: K, p_member_id: 2, p_status: "yes", p_day: null });
  assert.equal(s.members.find((m) => m.id === 2).attendance.status, "yes");
  s = await rpc(db, "api_admin_attendance", { p_token: K, p_member_id: 2, p_status: "yes", p_day: "2026-01-05" });
  const h = await rpc(db, "api_history", { p_token: K, p_days: 3660 });
  assert.ok(h.days.some((d) => d.day === "2026-01-05" && d.entries.some((e) => e.m === 2 && e.s === "yes")));
  s = await rpc(db, "api_admin_attendance", { p_token: K, p_member_id: 2, p_status: "open", p_day: "2026-01-05" });
  const h2 = await rpc(db, "api_history", { p_token: K, p_days: 3660 });
  assert.ok(!h2.days.some((d) => d.day === "2026-01-05"));
  await fails(rpc(db, "api_admin_attendance", { p_token: K, p_member_id: 999, p_status: "yes", p_day: null }), 404);
  await fails(rpc(db, "api_admin_attendance", { p_token: K, p_member_id: 2, p_status: "yes", p_day: "kein-datum" }), 400);
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync(new URL("../supabase/2026-10-21-update-ueberraschung.sql", import.meta.url), "utf8"));
});

test("admin settings: Standardzeit und -bucht setzen, Validierung, nur Admin; Update-Skript läuft", async () => {
  let s = await rpc(db, "api_state", { p_token: K });
  assert.deepEqual(s.defaults, { time: "16:15", bay: "binisafua" });
  await fails(rpc(db, "api_admin_settings", { p_token: M, p_time: "17:00", p_bay: null }), 403);
  s = await rpc(db, "api_admin_settings", { p_token: K, p_time: "17:00", p_bay: null });
  assert.deepEqual(s.defaults, { time: "17:00", bay: "binisafua" });
  s = await rpc(db, "api_admin_settings", { p_token: K, p_time: null, p_bay: "sonbou" });
  assert.deepEqual(s.defaults, { time: "17:00", bay: "sonbou" });
  await fails(rpc(db, "api_admin_settings", { p_token: K, p_time: "25:00", p_bay: null }), 400);
  await fails(rpc(db, "api_admin_settings", { p_token: K, p_time: null, p_bay: "X!" }), 400);
  assert.equal((await db.query("select public.app_default_meet_time() as t")).rows[0].t, "17:00");
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync(new URL("../supabase/2026-10-27-update-standardwerte.sql", import.meta.url), "utf8"));
  assert.deepEqual((await rpc(db, "api_state", { p_token: K })).defaults, { time: "17:00", bay: "sonbou" });
  await rpc(db, "api_admin_settings", { p_token: K, p_time: "16:15", p_bay: "binisafua" });
});

test("message: speichert bereinigt, leere Nachricht abgelehnt, Foto-Anhang mit Validierung", async () => {
  const s = await rpc(db, "api_message", { p_token: K, p_text: "  Hallo   <b>Gruppe</b>  " });
  const last = s.messages.at(-1);
  assert.equal(last.text, "Hallo <b>Gruppe</b>"); assert.equal(last.name, "Kai"); assert.equal(last.member_id, s.me.id); assert.equal(last.attachment, null);
  await fails(rpc(db, "api_message", { p_token: K, p_text: "   " }), 400);
  const s2 = await rpc(db, "api_message", { p_token: K, p_text: "", p_attachment: "2026-10-28/0123456789abcdef0123.jpg" });
  assert.equal(s2.messages.at(-1).attachment, "2026-10-28/0123456789abcdef0123.jpg"); assert.equal(s2.messages.at(-1).text, "");
  await fails(rpc(db, "api_message", { p_token: K, p_text: "x", p_attachment: "../etc/passwd" }), 400);
  await fails(rpc(db, "api_message", { p_token: K, p_text: "x", p_attachment: "2026-10-28/abc.png" }), 400);
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync(new URL("../supabase/2026-10-28-update-fotos.sql", import.meta.url), "utf8"));
  assert.equal((await rpc(db, "api_state", { p_token: K })).messages.at(-1).attachment, "2026-10-28/0123456789abcdef0123.jpg");
});

test("jelly: Meldung je Bucht mit Name, Validierung", async () => {
  const s = await rpc(db, "api_jelly", { p_token: M, p_bay: "alcaufar" });
  assert.equal(s.jelly.alcaufar.name, "Monika"); assert.ok(s.jelly.alcaufar.at);
  await fails(rpc(db, "api_jelly", { p_token: M, p_bay: "Cala X!" }), 400);
});

test("invite: neuer Teilnehmer mit Token, Einladender, Duplikat 409", async () => {
  const r = await rpc(db, "api_invite", { p_token: M, p_name: " Testperson ", p_lang: "en" });
  assert.match(r.token, /^[0-9a-f]{32}$/); assert.equal(r.name, "Testperson"); assert.equal(r.lang, "en");
  const s = await rpc(db, "api_state", { p_token: r.token });
  assert.equal(s.me.invitedBy, 2); assert.equal(s.messages.at(-1).text, "👋 Monika → Testperson");
  await fails(rpc(db, "api_invite", { p_token: M, p_name: "testperson", p_lang: "de" }), 409);
  await fails(rpc(db, "api_invite", { p_token: M, p_name: "x", p_lang: "de" }), 400);
});

test("me: Sprache setzen", async () => {
  const r = await rpc(db, "api_me", { p_token: K, p_lang: "en" });
  assert.equal(r.lang, "en");
  assert.equal((await rpc(db, "api_me", { p_token: K, p_lang: "de" })).lang, "de");
});

test("admin: nur Admin; rename, deactivate (sperrt Zugang), activate, regenerate, Admin nicht deaktivierbar", async () => {
  await fails(rpc(db, "api_admin_members", { p_token: M }), 403);
  const list = await rpc(db, "api_admin_members", { p_token: K });
  const tp = list.find((m) => m.name === "Testperson");
  assert.equal(tp.invitedByName, "Monika"); assert.match(tp.token, /^[0-9a-f]{32}$/);
  let l = await rpc(db, "api_admin_action", { p_token: K, p_id: tp.id, p_action: "rename", p_name: "Test Renamed" });
  assert.equal(l.find((m) => m.id === tp.id).name, "Test Renamed");
  l = await rpc(db, "api_admin_action", { p_token: K, p_id: tp.id, p_action: "deactivate", p_name: null });
  assert.equal(l.find((m) => m.id === tp.id).active, false);
  await fails(rpc(db, "api_state", { p_token: tp.token }), 403, /deaktiviert/);
  const st = await rpc(db, "api_state", { p_token: K });
  assert.equal(st.members.some((m) => m.id === tp.id), false, "deaktivierte Mitglieder nicht in der Liste");
  l = await rpc(db, "api_admin_action", { p_token: K, p_id: tp.id, p_action: "activate", p_name: null });
  assert.equal(l.find((m) => m.id === tp.id).active, true);
  l = await rpc(db, "api_admin_action", { p_token: K, p_id: tp.id, p_action: "regenerate", p_name: null });
  const nt = l.find((m) => m.id === tp.id).token;
  assert.notEqual(nt, tp.token);
  await fails(rpc(db, "api_state", { p_token: tp.token }), 401);
  assert.equal((await rpc(db, "api_state", { p_token: nt })).me.name, "Test Renamed");
  await fails(rpc(db, "api_admin_action", { p_token: K, p_id: 1, p_action: "deactivate", p_name: null }), 400);
  await fails(rpc(db, "api_admin_action", { p_token: K, p_id: 999, p_action: "rename", p_name: "x" }), 404);
  await fails(rpc(db, "api_admin_action", { p_token: K, p_id: tp.id, p_action: "explode", p_name: null }), 400);
});

test("Sprachen: fr erlaubt, Unbekanntes fällt auf de zurück; Update-Skript läuft", async () => {
  assert.equal((await rpc(db, "api_me", { p_token: K, p_lang: "fr" })).lang, "fr");
  assert.equal((await rpc(db, "api_me", { p_token: K, p_lang: "xx" })).lang, "de");
  const r = await rpc(db, "api_invite", { p_token: K, p_name: "Pierre", p_lang: "fr" });
  assert.equal(r.lang, "fr");
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync(new URL("../supabase/2026-10-21-update-franzoesisch.sql", import.meta.url), "utf8"));
});
