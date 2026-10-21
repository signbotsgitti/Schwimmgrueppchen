// Gesamter Tageszustand in einem Aufruf: Mitglieder, Status, Treffzeit, Pinnwand, Quallenmeldungen.
import { json, memberPublic } from "./_lib.js";
import { todayLocal } from "../../src/time.js";
import { DEFAULT_MEET_TIME, DEFAULT_BAY, ISLAND_BOUNDS, BAYS } from "../../src/config.js";

export async function loadState(db, me) {
  const day = todayLocal();
  const [members, attendance, daySetting, messages, jelly] = await Promise.all([
    db.prepare("SELECT * FROM members WHERE active = 1 ORDER BY id").all(),
    db.prepare("SELECT member_id, status, updated_at FROM attendance WHERE day = ?").bind(day).all(),
    db.prepare("SELECT d.meet_time, d.updated_at, m.name AS proposed_by FROM day_settings d LEFT JOIN members m ON m.id = d.proposed_by WHERE d.day = ?").bind(day).first(),
    db.prepare("SELECT msg.id, msg.kind, msg.text, msg.created_at, msg.member_id, m.name FROM messages msg LEFT JOIN members m ON m.id = msg.member_id ORDER BY msg.id DESC LIMIT 100").all(),
    db.prepare("SELECT j.bay, j.created_at, m.name FROM jelly_reports j LEFT JOIN members m ON m.id = j.member_id WHERE j.day = ? ORDER BY j.id").bind(day).all(),
  ]);
  const att = Object.fromEntries(attendance.results.map((a) => [a.member_id, { status: a.status, updatedAt: a.updated_at }]));
  const jellyByBay = {};
  for (const j of jelly.results) if (!jellyByBay[j.bay]) jellyByBay[j.bay] = { name: j.name ?? "?", at: j.created_at };
  return {
    day,
    me: memberPublic(me),
    members: members.results.map((m) => ({ ...memberPublic(m), attendance: att[m.id] ?? null })),
    meet: {
      bay: DEFAULT_BAY,
      time: daySetting?.meet_time ?? DEFAULT_MEET_TIME,
      defaultTime: DEFAULT_MEET_TIME,
      proposedBy: daySetting?.proposed_by ?? null,
    },
    messages: messages.results.reverse(),
    jelly: jellyByBay,
    island: ISLAND_BOUNDS,
    bays: BAYS.map((b) => ({ id: b.id, name: b.name })),
  };
}

export async function onRequestGet({ env, data }) {
  return json(await loadState(env.DB, data.me));
}
