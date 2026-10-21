import { json, error, readJson, postSystemMessage } from "./_lib.js";
import { todayLocal } from "../../src/time.js";
import { loadState } from "./state.js";

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const time = String(body.time ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return error("time muss HH:MM sein");
  const day = todayLocal();
  await env.DB.prepare(
    "INSERT INTO day_settings (day, meet_time, proposed_by, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now')) " +
    "ON CONFLICT(day) DO UPDATE SET meet_time = excluded.meet_time, proposed_by = excluded.proposed_by, updated_at = excluded.updated_at"
  ).bind(day, time, data.me.id).run();
  await postSystemMessage(env.DB, `⏰ ${data.me.name}: ${time}`);
  return json(await loadState(env.DB, data.me));
}
