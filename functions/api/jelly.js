import { json, error, readJson, postSystemMessage } from "./_lib.js";
import { todayLocal } from "../../src/time.js";
import { BAYS } from "../../src/config.js";
import { loadState } from "./state.js";

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request);
  const bay = BAYS.find((b) => b.id === body.bay);
  if (!bay) return error("Unbekannte Bucht");
  const day = todayLocal();
  await env.DB.prepare("INSERT INTO jelly_reports (day, bay, member_id) VALUES (?, ?, ?)").bind(day, bay.id, data.me.id).run();
  await postSystemMessage(env.DB, `🪼 ${data.me.name}: ${bay.name}`);
  return json(await loadState(env.DB, data.me));
}
