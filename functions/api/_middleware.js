// Auth per persönlichem Token (?u=<token> oder Header X-Token). Kein Login, keine Passwörter.
import { json, error } from "./_lib.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return error("D1-Binding 'DB' fehlt (wrangler.toml prüfen)", 500);
  const url = new URL(request.url);
  const token = request.headers.get("X-Token") || url.searchParams.get("u") || "";
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return error("Ungültiger Link", 401);
  const me = await env.DB.prepare("SELECT * FROM members WHERE token = ?").bind(token).first();
  if (!me) return error("Ungültiger Link", 401);
  if (!me.active) return error("Zugang deaktiviert", 403);
  context.data.me = me;
  try {
    return await context.next();
  } catch (e) {
    console.error(e);
    return json({ error: "Serverfehler", detail: String(e?.message ?? e) }, 500);
  }
}
