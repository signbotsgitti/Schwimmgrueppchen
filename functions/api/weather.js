import { json } from "./_lib.js";
import { todayLocal } from "../../src/time.js";
import { loadWeather, evaluate } from "../../src/weather.js";
import { mockForecasts } from "../../src/weather-mock.js";

export async function onRequestGet(context) {
  const { env } = context;
  const day = todayLocal();
  const jelly = {};
  const rows = await env.DB.prepare(
    "SELECT j.bay, j.created_at, m.name FROM jelly_reports j LEFT JOIN members m ON m.id = j.member_id WHERE j.day = ? ORDER BY j.id"
  ).bind(day).all();
  for (const j of rows.results) if (!jelly[j.bay]) jelly[j.bay] = { name: j.name ?? "?", at: j.created_at };
  if (env.WEATHER_MOCK === "1") {
    const { forecasts, marines } = mockForecasts();
    return json({ ...evaluate(forecasts, marines, jelly), mock: true });
  }
  try {
    return json(await loadWeather(jelly, context));
  } catch (e) {
    return json({ error: "Wetterdaten nicht verfügbar", detail: String(e?.message ?? e) }, 502);
  }
}
