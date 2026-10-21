// Admin: Teilnehmer verwalten (umbenennen, deaktivieren/aktivieren, Link neu erzeugen), Links einsehen.
import { json, error, readJson, clean, randomToken, memberPublic } from "../_lib.js";

async function list(db, origin) {
  const rows = await db.prepare(
    "SELECT m.*, i.name AS invited_by_name FROM members m LEFT JOIN members i ON i.id = m.invited_by ORDER BY m.id"
  ).all();
  return rows.results.map((m) => ({ ...memberPublic(m), invitedByName: m.invited_by_name ?? null, link: `${origin}/?u=${m.token}` }));
}

export async function onRequestGet({ request, env, data }) {
  if (!data.me.is_admin) return error("Nur Admin", 403);
  return json({ members: await list(env.DB, new URL(request.url).origin) });
}

export async function onRequestPost({ request, env, data }) {
  if (!data.me.is_admin) return error("Nur Admin", 403);
  const body = await readJson(request);
  const id = Number(body.id);
  const target = await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first();
  if (!target) return error("Mitglied nicht gefunden", 404);
  switch (body.action) {
    case "rename": {
      const name = clean(body.name, 60);
      if (name.length < 2) return error("Name zu kurz");
      await env.DB.prepare("UPDATE members SET name = ? WHERE id = ?").bind(name, id).run();
      break;
    }
    case "deactivate":
      if (target.is_admin) return error("Admin kann nicht deaktiviert werden");
      await env.DB.prepare("UPDATE members SET active = 0 WHERE id = ?").bind(id).run();
      break;
    case "activate":
      await env.DB.prepare("UPDATE members SET active = 1 WHERE id = ?").bind(id).run();
      break;
    case "regenerate":
      await env.DB.prepare("UPDATE members SET token = ? WHERE id = ?").bind(randomToken(), id).run();
      break;
    default:
      return error("Unbekannte Aktion");
  }
  return json({ members: await list(env.DB, new URL(request.url).origin) });
}
