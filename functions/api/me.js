// Eigene Einstellungen (Sprache)
import { json, error, readJson, memberPublic } from "./_lib.js";

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  if (body.lang !== undefined) {
    const lang = body.lang === "en" ? "en" : "de";
    await env.DB.prepare("UPDATE members SET lang = ? WHERE id = ?").bind(lang, data.me.id).run();
    data.me.lang = lang;
  }
  return json(memberPublic(data.me));
}
