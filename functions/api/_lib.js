// Gemeinsame Helfer für die API-Functions
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

export const error = (message, status = 400) => json({ error: message }, status);

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export function randomToken(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const clean = (s, max = 500) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function postSystemMessage(db, text) {
  await db.prepare("INSERT INTO messages (member_id, kind, text) VALUES (NULL, 'system', ?)").bind(text).run();
}

export function memberPublic(m) {
  return { id: m.id, name: m.name, lang: m.lang, active: !!m.active, isAdmin: !!m.is_admin, invitedBy: m.invited_by, createdAt: m.created_at };
}
