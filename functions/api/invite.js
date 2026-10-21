// Jedes Mitglied darf einladen. Erzeugt Token + persönlichen Link, vermerkt den Einladenden.
import { json, error, readJson, clean, randomToken, postSystemMessage } from "./_lib.js";

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const name = clean(body.name, 60);
  const lang = body.lang === "en" ? "en" : "de";
  if (name.length < 2) return error("Name zu kurz");
  const exists = await env.DB.prepare("SELECT id FROM members WHERE lower(name) = lower(?)").bind(name).first();
  if (exists) return error("Name bereits vergeben", 409);
  const token = randomToken();
  const res = await env.DB.prepare("INSERT INTO members (token, name, lang, invited_by) VALUES (?, ?, ?, ?) RETURNING id")
    .bind(token, name, lang, data.me.id).first();
  await postSystemMessage(env.DB, `👋 ${data.me.name} → ${name}`);
  const link = `${new URL(request.url).origin}/?u=${token}`;
  return json({ id: res.id, name, lang, link });
}
