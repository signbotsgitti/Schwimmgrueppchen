import { json, error, readJson, clean } from "./_lib.js";
import { loadState } from "./state.js";

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const text = clean(body.text, 1000);
  if (!text) return error("Leere Nachricht");
  await env.DB.prepare("INSERT INTO messages (member_id, kind, text) VALUES (?, 'msg', ?)").bind(data.me.id, text).run();
  return json(await loadState(env.DB, data.me));
}
