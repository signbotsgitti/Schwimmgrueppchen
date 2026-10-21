import { json, error, readJson } from "./_lib.js";
import { todayLocal } from "../../src/time.js";
import { loadState } from "./state.js";

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const status = body.status;
  if (!["yes", "no", "away", "open"].includes(status)) return error("status muss yes|no|away|open sein");
  const day = todayLocal();
  if (status === "open") {
    await env.DB.prepare("DELETE FROM attendance WHERE day = ? AND member_id = ?").bind(day, data.me.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO attendance (day, member_id, status, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now')) " +
      "ON CONFLICT(day, member_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at"
    ).bind(day, data.me.id, status).run();
  }
  return json(await loadState(env.DB, data.me));
}
