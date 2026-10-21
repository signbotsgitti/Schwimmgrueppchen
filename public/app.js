// Schwimmgrüppchen – Frontend (ohne Framework, ES-Module). Backend: Supabase-RPC, Wetter: Open-Meteo direkt.
import { STRINGS, makeT, LANGS } from "./i18n.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";
import { BAYS, DEFAULT_MEET_TIME, DEFAULT_BAY, ISLAND_BOUNDS, WEATHER_REFRESH_MINUTES } from "./lib/config.js";
import { loadWeather } from "./lib/weather.js";
import { buildXlsx } from "./lib/xlsx.js";

const $ = (sel, root = document) => root.querySelector(sel);
const LS = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------- Token aus URL übernehmen ----------
// Der Token bleibt bewusst in der Adresse (?u=…): iOS übernimmt beim "Zum Home-Bildschirm" die aktuelle URL,
// und die installierte App hat einen eigenen localStorage, getrennt von Safari.
const url = new URL(location.href);
if (url.searchParams.get("u")) LS.set("token", url.searchParams.get("u"));
const token = LS.get("token");
if (token && url.searchParams.get("u") !== token) {
  url.searchParams.set("u", token);
  history.replaceState({}, "", url.pathname + url.search + url.hash);
}

// ---------- Zustand ----------
const S = {
  lang: LS.get("lang", LANGS.find((l) => navigator.language?.startsWith(l)) ?? "de"),
  state: LS.get("cache:state"), stateAt: LS.get("cache:stateAt"),
  weather: LS.get("cache:weather"), weatherAt: LS.get("cache:weatherAt"),
  offline: !navigator.onLine, fatal: null,
  onIsland: null, // null = unbekannt/abgelehnt, true/false
  view: "today",
  lastSeenMsg: LS.get("lastSeenMsg", 0),
  invite: null, admin: null, adminOpen: false,
  history: null, historyDays: LS.get("historyDays", 90), historyLoading: false,
};
let t = makeT(S.lang);

// ---------- API (Supabase PostgREST RPC) ----------
async function rpc(fn, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    // Neues Key-Format sb_publishable_… nur als apikey; altes JWT-Format zusätzlich als Bearer
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY,
      ...(SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}) },
    body: JSON.stringify({ p_token: token ?? "", ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.message || data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
  return data;
}
const baseUrl = () => location.origin + location.pathname.replace(/[^/]*$/, "");
const linkFor = (tok) => `${baseUrl()}?u=${tok}`;

function setState(state) {
  S.state = state; S.stateAt = Date.now();
  LS.set("cache:state", state); LS.set("cache:stateAt", S.stateAt);
  if (state.me?.lang && state.me.lang !== S.lang) setLang(state.me.lang, false);
  S.offline = false;
  updateBadge();
}

async function refreshState() {
  if (!token) { S.fatal = "noToken"; render(); return; }
  try {
    setState(await rpc("api_state"));
    S.fatal = null;
  } catch (e) {
    if (e.status === 401) S.fatal = "invalidLink";
    else if (e.status === 403) S.fatal = "inactive";
    else if (e.status) { S.fatal = "server"; S.fatalDetail = `HTTP ${e.status}: ${e.message}`; } // Server hat geantwortet, aber mit Fehler
    else S.offline = true; // kein Netz / Verbindung blockiert
  }
  render();
}

async function refreshWeather(force = false) {
  if (!token || S.fatal) return;
  if (!force && S.weatherAt && Date.now() - S.weatherAt < WEATHER_REFRESH_MINUTES * 60 * 1000) return;
  try {
    const w = await loadWeather(S.state?.jelly ?? {}, new Date(), fetch, S.state?.day ?? null);
    S.weather = w; S.weatherAt = Date.now(); LS.set("cache:weather", w); LS.set("cache:weatherAt", S.weatherAt);
  } catch { /* alter Stand bleibt */ }
  render();
}

async function act(fn, params) {
  try {
    const data = await rpc(fn, params);
    if (data && data.members) setState(data);
    render();
    return data;
  } catch (e) {
    toast(`${t("error")}: ${e.message}`);
    throw e;
  }
}

// ---------- Sprache ----------
function setLang(lang, persist = true) {
  S.lang = lang; t = makeT(lang); LS.set("lang", lang);
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  if (persist && token) rpc("api_me", { p_lang: lang }).catch(() => {});
}

// ---------- Helfer ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LOCALE = { de: "de-DE", en: "en-GB", fr: "fr-FR" };
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString(LOCALE[S.lang] ?? "de-DE", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const fmtDateTime = (ms) => new Date(ms).toLocaleString(LOCALE[S.lang] ?? "de-DE", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDay = (ymd) => { try { return new Date(`${ymd}T12:00:00`).toLocaleDateString(LOCALE[S.lang] ?? "de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }); } catch { return ymd; } };
const compass = (deg) => t("compass")[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
let toastTimer;
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2500); }
async function copy(text) { try { await navigator.clipboard.writeText(text); toast(t("inviteCopied")); } catch { prompt("Link", text); } }
const bayName = (id) => BAYS.find((b) => b.id === id)?.name ?? id;

function systemText(text) {
  // Systemnachrichten werden kompakt gespeichert und hier übersetzt
  let m;
  if ((m = text.match(/^⏰ (.+): (\d\d:\d\d)$/))) return t("sysTime", { name: m[1], time: m[2] });
  if ((m = text.match(/^🪼 (.+?): (.+)$/))) return t("sysJelly", { name: m[1], bay: bayName(m[2]) });
  if ((m = text.match(/^👋 (.+?) → (.+)$/))) return t("sysInvite", { name: m[1], who: m[2] });
  if ((m = text.match(/^📍 (.+?): (.+)$/))) return t("sysBay", { name: m[1], bay: bayName(m[2]) });
  return text;
}

// ---------- Badge / ungelesen ----------
function unreadCount() {
  const msgs = S.state?.messages ?? [];
  const myId = S.state?.me?.id;
  return msgs.filter((m) => m.id > S.lastSeenMsg && m.member_id !== myId).length;
}
function updateBadge() {
  const n = unreadCount();
  const b = $("#unread-badge");
  b.hidden = n === 0; b.textContent = n;
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch {}
}
function markSeen() {
  const msgs = S.state?.messages ?? [];
  const maxId = msgs.reduce((m, x) => Math.max(m, x.id), 0);
  if (maxId > S.lastSeenMsg) { S.lastSeenMsg = maxId; LS.set("lastSeenMsg", maxId); }
  updateBadge();
}

// ---------- Geolokation ----------
function requestLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const b = ISLAND_BOUNDS;
      const { latitude: la, longitude: lo } = pos.coords;
      S.onIsland = la >= b.latMin && la <= b.latMax && lo >= b.lonMin && lo <= b.lonMax;
      render();
    },
    () => { S.onIsland = null; render(); },
    { timeout: 10000, maximumAge: 10 * 60 * 1000 }
  );
}

// ---------- Rendering ----------
let renderPending = false;
document.addEventListener("focusout", () => { if (renderPending) { renderPending = false; setTimeout(render, 50); } });
function render() {
  const ae = document.activeElement;
  if (ae && ["INPUT", "SELECT", "TEXTAREA"].includes(ae.tagName) && document.body.contains(ae)) { renderPending = true; return; }
  $("#me-name").textContent = S.state?.me?.name ?? "";
  const net = $("#net"); net.hidden = !S.offline; net.textContent = t("offline");
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === S.view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${S.view}`));
  if (S.fatal) {
    const msg = S.fatal === "inactive" ? "Zugang deaktiviert / access deactivated" : S.fatal === "server" ? `${t("serverError")}\n${S.fatalDetail}` : t(S.fatal);
    const paste = S.fatal === "noToken" || S.fatal === "invalidLink"
      ? `<div class="card"><h2>${t("pasteTitle")}</h2><p class="small muted">${t("pasteHint")}</p>
         <div class="row"><input type="text" id="paste-link" placeholder="https://…/?u=…" autocapitalize="off" autocorrect="off"><button class="btn primary" id="paste-go">OK</button></div></div>` : "";
    $("#view-today").innerHTML = `<div class="error" style="white-space:pre-wrap">${esc(msg)}</div>${paste}<p class="center"><button class="btn" id="retry">${t("retry")}</button></p>`;
    $("#retry")?.addEventListener("click", () => { S.fatal = null; render(); refreshState(); });
    $("#paste-go")?.addEventListener("click", () => {
      const m = $("#paste-link").value.match(/([a-f0-9]{32})/i);
      if (!m) { toast(t("invalidLink")); return; }
      LS.set("token", m[1].toLowerCase());
      location.replace(baseUrl() + "?u=" + m[1].toLowerCase());
    });
    $("#view-board").innerHTML = ""; $("#view-more").innerHTML = renderLangCard();
    return;
  }
  if (!S.state) {
    $("#view-today").innerHTML = S.offline
      ? `<div class="warn">${t("offlineNoData")}</div><p class="center"><button class="btn" id="retry">${t("retry")}</button></p>`
      : `<p class="muted center">${t("loading")}</p>`;
    $("#retry")?.addEventListener("click", () => { S.offline = false; render(); refreshState(); });
    return;
  }
  renderToday(); renderBoard(); renderStats(); renderMore();
}

// ---------- Statistik ----------
async function loadHistory(force = false) {
  if (S.historyLoading) return;
  if (!force && S.history && S.history.days_requested === S.historyDays) return;
  S.historyLoading = true; render();
  try { const h = await rpc("api_history", { p_days: S.historyDays }); h.days_requested = S.historyDays; S.history = h; LS.set("cache:history", h); }
  catch (e) { toast(`${t("error")}: ${e.message}`); if (!S.history) S.history = LS.get("cache:history"); }
  S.historyLoading = false; render();
}

function computeStats(h) {
  const byMember = new Map(h.members.map((m) => [m.id, { ...m, yes: 0, no: 0, away: 0, days: {} }]));
  let swimDays = 0, totalYes = 0;
  for (const d of h.days) {
    let anyYes = false;
    for (const e of d.entries) { const m = byMember.get(e.m); if (!m) continue; m[e.s] = (m[e.s] ?? 0) + 1; m.days[d.day] = e.s; if (e.s === "yes") { anyYes = true; totalYes++; } }
    if (anyYes) swimDays++;
  }
  const members = [...byMember.values()].filter((m) => m.active || m.yes + m.no + m.away > 0);
  members.sort((a, b) => b.yes - a.yes || (b.yes / (swimDays || 1)) - (a.yes / (swimDays || 1)) || a.name.localeCompare(b.name, "de"));
  // Tagesliste über den ganzen Zeitraum (auch Tage ohne Einträge, für den Kalender)
  const days = []; const from = new Date(`${h.from}T12:00:00Z`), to = new Date(`${h.to}T12:00:00Z`);
  for (let d = from; d <= to; d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
  const dayInfo = Object.fromEntries(h.days.map((d) => [d.day, d]));
  return { members, swimDays, totalYes, days, dayInfo };
}

function renderStats() {
  const h = S.history;
  const filters = `<div class="filters">${[30, 90, 365].map((n) => `<button class="btn sm ${S.historyDays === n ? "selected" : ""}" data-days="${n}">${t("days" + n)}</button>`).join("")}</div>`;
  if (!h) {
    $("#view-stats").innerHTML = `${filters}<p class="muted center">${S.historyLoading ? t("loading") : t("noHistory")}</p>`;
  } else {
    const st = computeStats(h);
    const maxYes = Math.max(1, ...st.members.map((m) => m.yes));
    const pct = (m) => st.swimDays ? Math.round((m.yes / st.swimDays) * 100) : 0;
    const rank = st.members.map((m, i) => `
      <div class="pos">${i + 1}.</div><div class="nm">${esc(m.name)}${m.active ? "" : ` <span class="muted">(${t("inactive")})</span>`}</div>
      <div class="bar" title="${m.yes} / ${st.swimDays}"><i style="width:${(m.yes / maxYes) * 100}%"></i></div>
      <div class="val"><b>${m.yes}</b> · ${pct(m)} %</div>`).join("");
    const wd = (d) => { try { return new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE[S.lang] ?? "de-DE", { weekday: "short" }).replace(".", ""); } catch { return ""; } };
    const head = st.days.map((d) => `<th title="${d}">${wd(d)} ${d.slice(8, 10)}</th>`).join("");
    const rows = st.members.map((m) => `<tr><th>${esc(m.name)}</th>${st.days.map((d) => {
      const sStat = m.days[d] ?? "none"; const info = st.dayInfo[d];
      const tip = `${fmtDay(d)} · ${esc(m.name)}: ${t({ yes: "legendYes", no: "legendNo", away: "legendAway", none: "legendNone" }[sStat])}${info?.bay ? " · " + bayName(info.bay) : ""}${info?.time ? " · " + info.time : ""}`;
      const wk = new Date(`${d}T12:00:00Z`).getUTCDay() === 1 ? " wk" : "";
      return `<td class="${sStat}${wk}" title="${tip}" data-tip="${tip}"></td>`;
    }).join("")}</tr>`).join("");
    $("#view-stats").innerHTML = `
      ${filters}
      <div class="tiles">
        <div class="tile"><div class="num">${st.swimDays}</div><div class="lbl">${t("swimDays")}</div><div class="lbl muted">${t("swimDaysHint")}</div></div>
        <div class="tile"><div class="num">${st.totalYes}</div><div class="lbl">${t("participations")}</div><div class="lbl muted">${fmtDay(h.from)} – ${fmtDay(h.to)}</div></div>
      </div>
      <div class="card"><h2>${t("ranking")}</h2>${st.members.length ? `<div class="rank">${rank}</div>` : `<p class="muted">${t("noHistory")}</p>`}<p class="muted small" style="margin:8px 0 0">${t("rankingHint")}</p></div>
      <div class="card"><h2>${t("presenceGrid")}</h2>
        <div class="gridwrap"><table class="pgrid"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
        <div class="legend"><span><i class="yes"></i>👍 ${t("legendYes")}</span><span><i class="no"></i>👎 ${t("legendNo")}</span><span><i class="away"></i>✈️ ${t("legendAway")}</span><span><i></i>${t("legendNone")}</span></div>
      </div>
      <div class="card row spread"><button class="btn primary" id="export-xlsx">📥 ${t("exportXlsx")}</button><span class="muted small">${S.historyLoading ? t("loading") : ""}</span></div>`;
    $("#export-xlsx").addEventListener("click", () => exportXlsx(st, h));
    $("#view-stats").querySelectorAll("td[data-tip]").forEach((td) => td.addEventListener("click", () => toast(td.dataset.tip)));
    const gw = $("#view-stats .gridwrap"); if (gw) gw.scrollLeft = gw.scrollWidth;
  }
  $("#view-stats").querySelectorAll("[data-days]").forEach((b) => b.addEventListener("click", () => { S.historyDays = Number(b.dataset.days); LS.set("historyDays", S.historyDays); loadHistory(true); }));
}

async function exportXlsx(st, h) {
  const label = { yes: t("legendYes"), no: t("legendNo"), away: t("legendAway") };
  const daysRows = [[t("colDay"), t("colBay"), t("colTime"), ...st.members.map((m) => m.name)]];
  for (const d of st.days) {
    const info = st.dayInfo[d]; if (!info) continue;
    daysRows.push([d, info.bay ? bayName(info.bay) : bayName(DEFAULT_BAY), info.time ?? DEFAULT_MEET_TIME, ...st.members.map((m) => (m.days[d] ? label[m.days[d]] : ""))]);
  }
  const rankRows = [[t("colName"), t("colYes"), t("colNo"), t("colAway"), t("colRate")], ...st.members.map((m) => [m.name, m.yes, m.no, m.away, st.swimDays ? Math.round((m.yes / st.swimDays) * 100) / 100 : 0])];
  rankRows.push([]); rankRows.push([t("swimDays"), st.swimDays]); rankRows.push([t("period"), `${h.from} – ${h.to}`]);
  const blob = buildXlsx([
    { name: t("sheetRanking"), rows: rankRows, widths: [22, 10, 10, 18, 18] },
    { name: t("sheetDays"), rows: daysRows, widths: [12, 18, 8, ...st.members.map(() => 14)] },
  ]);
  const name = `${new Date().toISOString().slice(0, 10)}-Schwimmgrueppchen-Statistik.xlsx`;
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast(t("exportDone"));
}

function renderToday() {
  const st = S.state, me = st.me;
  const mine = st.members.find((m) => m.id === me.id)?.attendance?.status ?? "open";
  const blocked = S.onIsland === false;
  const isTomorrow = st.today && st.day > st.today;
  const meetBayId = st.meet.bay ?? DEFAULT_BAY;
  const meetBay = bayName(meetBayId);
  const meetTime = st.meet.time ?? DEFAULT_MEET_TIME;
  const stamp = S.offline && S.stateAt ? `<p class="warn small">${t("offline")}: ${fmtDateTime(S.stateAt)}</p>` : "";

  const choice = blocked
    ? `<p class="warn">${t("notOnIsland")}</p>
       <div class="choice" style="grid-template-columns:1fr 1fr">
         <button class="btn ${mine === "away" ? "selected" : ""}" data-att="away">✈️ ${t("away")}</button>
         <button class="btn no ${mine === "no" ? "selected" : ""}" data-att="no">${t("no")}</button>
       </div>
       <div class="row" style="margin-top:8px"><input type="text" id="away-msg" placeholder="${t("msgToGroup")}" maxlength="500"><button class="btn sm" id="away-send">${t("send")}</button></div>`
    : `<div class="choice">
         <button class="btn yes ${mine === "yes" ? "selected" : ""}" data-att="yes">👍 ${t("yes")}</button>
         <button class="btn no ${mine === "no" ? "selected" : ""}" data-att="no">👎 ${t("no")}</button>
         <button class="btn ${mine === "open" ? "selected" : ""}" data-att="open">🤷 ${t("open")}</button>
       </div>`;

  const pill = (a) => {
    const s = a?.status ?? "open";
    return `<span class="pill ${s}">${{ yes: "👍 " + t("statusYes"), no: "👎 " + t("statusNo"), away: "✈️ " + t("statusAway"), open: t("statusOpen") }[s]}</span>`;
  };
  const sorted = [...st.members].sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  const members = sorted.map((m) => `<li><span>${esc(m.name)}${m.id === me.id ? ` <span class="muted small">(${t("you")})</span>` : ""}</span>${pill(m.attendance)}</li>`).join("");

  $("#view-today").innerHTML = `
    ${stamp}
    ${isTomorrow ? `<p class="warn small">${t("nextDayHint")}</p>` : ""}
    <div class="card">
      <h2>${t("meetAt")} <span class="daylabel">${isTomorrow ? t("dayTomorrow") : t("dayToday")} · ${fmtDay(st.day)}</span></h2>
      <div class="meet">${esc(meetBay)} · ${esc(meetTime)}</div>
      <div class="pickers">
        <label class="picker">📍 <select id="meet-bay" aria-label="${t("changeBay")}">
          ${BAYS.map((b) => `<option value="${b.id}" ${b.id === meetBayId ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
        </select></label>
        <label class="picker">⏰ <input type="time" id="meet-time" value="${esc(meetTime)}" step="300" aria-label="${t("changeTime")}"></label>
      </div>
      ${st.meet.bayBy || st.meet.proposedBy ? `<p class="muted small">${[
        st.meet.bayBy ? `${esc(meetBay)}: ${t("proposedBy")} ${esc(st.meet.bayBy)}` : "",
        st.meet.proposedBy ? `${esc(meetTime)}: ${t("proposedBy")} ${esc(st.meet.proposedBy)}` : "",
      ].filter(Boolean).join(" · ")}</p>` : ""}
    </div>
    <div class="card">
      <h2>${t("youToday")}</h2>
      ${choice}
    </div>
    <div class="card">
      <h2>${t("who")}</h2>
      <ul class="members">${members}</ul>
    </div>
    ${renderWeather()}`;

  $("#view-today").querySelectorAll("[data-att]").forEach((b) => b.addEventListener("click", () => act("api_attendance", { p_status: b.dataset.att })));
  $("#meet-time")?.addEventListener("change", async (ev) => {
    const v = ev.target.value;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v) || v === meetTime) return;
    ev.target.blur(); await act("api_time", { p_time: v }); toast(`⏰ ${v}`);
  });
  $("#meet-bay")?.addEventListener("change", async (ev) => {
    const v = ev.target.value;
    if (v === meetBayId) return;
    ev.target.blur(); await act("api_bay", { p_bay: v }); toast(`📍 ${bayName(v)}`);
  });
  $("#away-send")?.addEventListener("click", async () => {
    const inp = $("#away-msg"); const text = inp.value.trim(); if (!text) return;
    await act("api_message", { p_text: `✈️ ${text}` }); inp.value = ""; toast("✓");
  });
  $("#view-today").querySelectorAll("[data-jelly]").forEach((b) => b.addEventListener("click", async () => {
    const id = b.dataset.jelly;
    if (confirm(t("jellyConfirm", { bay: bayName(id) }))) { await act("api_jelly", { p_bay: id }); refreshWeather(true); }
  }));
}

function renderWeather() {
  const w = S.weather;
  if (!w) return `<div class="card"><h2>${t("ampel")}</h2><p class="muted">${t("weatherUnavailable")}</p></div>`;
  const jellyState = S.state?.jelly ?? {};
  const bays = Object.values(w.bays).map((b) => {
    // Quallenmeldung aus dem (frischeren) State überlagern, falls Wetter-Cache älter ist
    const jr = jellyState[b.id] ?? b.jellyReport;
    const level = jr ? Math.max(b.level, 2) : b.level;
    const wx = b.weather;
    const arrow = wx.windDir != null ? `<span class="arrow" style="transform:rotate(${(wx.windDir + 180) % 360}deg)">⬆︎</span>` : "";
    const runText = b.onshoreRun > 0 ? t("onshoreHours", { h: b.onshoreRun }) : t("calmSince", { h: b.offshoreHours });
    return `
      <div class="card bay l${level}">
        <div class="title"><span>${esc(b.name)}</span><span class="light"><span class="dot l${level}"></span>${t("level" + level)}</span></div>
        <p class="muted small" style="margin:4px 0 0">${runText}${level >= 3 ? ` · <strong>${t("switchBay")}</strong>` : ""}</p>
        ${jr ? `<div class="jelly">🪼 ${t("jellyReported", { name: esc(jr.name), time: fmtTime(jr.at) })}</div>` : ""}
        ${b.thunder ? `<div class="warn">${t("thunder")}</div>` : ""}
        <div class="wx">
          <div><span class="v">${wx.airTemp != null ? Math.round(wx.airTemp) + "°" : "–"}</span><span class="k">${t("air")}</span></div>
          <div><span class="v">${wx.waterTemp != null ? Math.round(wx.waterTemp) + "°" : "–"}</span><span class="k">${t("water")}</span></div>
          <div><span class="v">${wx.waveHeight != null ? wx.waveHeight.toFixed(1) + " m" : "–"}</span><span class="k">${t("waves")}</span></div>
          <div><span class="v">${arrow} ${wx.windKmh != null ? Math.round(wx.windKmh) : "–"}</span><span class="k">${t("wind")} km/h${wx.windDir != null ? " · " + compass(wx.windDir) : ""}</span></div>
        </div>
        <div class="row" style="margin-top:10px"><button class="btn sm" data-jelly="${b.id}">🪼 ${t("jellyBtn")}</button></div>
      </div>`;
  }).join("");
  // Empfehlung ggf. mit frischeren Quallenmeldungen neu bestimmen
  let reco = w.recommended, best = Infinity;
  for (const b of Object.values(w.bays)) { const l = jellyState[b.id] || b.jellyReport ? Math.max(b.level, 2) : b.level; if (l < best) { best = l; reco = b.id; } }
  const at = w.bays[reco]?.weather?.at?.slice(11) ?? "";
  return `
    <div class="card reco"><h2>${t("recommended")}</h2><div class="big">${esc(t("recommendedText", { bay: bayName(reco) }))}</div><div class="small">${t("noDecision")}</div></div>
    <h2 class="muted small" style="margin:0 0 8px">${t("ampel")} · ${t("weatherFor", { time: at })}</h2>
    ${bays}
    <p class="muted small">${t("lastUpdate")}: ${S.weatherAt ? fmtDateTime(S.weatherAt) : "–"}</p>`;
}

function renderBoard() {
  const st = S.state;
  const msgs = st.messages.length === 0 ? `<p class="muted center">${t("boardEmpty")}</p>` :
    `<div class="msgs">${st.messages.map((m) => m.kind === "system"
      ? `<div class="msg system"><div class="meta">${fmtDateTime(new Date(m.created_at).getTime())}</div><div class="text">${esc(systemText(m.text))}</div></div>`
      : `<div class="msg ${m.member_id === st.me.id ? "mine" : ""}"><div class="meta">${esc(m.name ?? "?")} · ${fmtDateTime(new Date(m.created_at).getTime())}</div><div class="text">${esc(m.text)}</div></div>`
    ).join("")}</div>`;
  $("#view-board").innerHTML = `${msgs}
    <div class="composer"><textarea id="msg-text" rows="1" placeholder="${t("writeMessage")}" maxlength="1000"></textarea><button class="btn primary" id="msg-send">${t("send")}</button></div>`;
  $("#msg-send").addEventListener("click", async () => {
    const ta = $("#msg-text"); const text = ta.value.trim(); if (!text) return;
    await act("api_message", { p_text: text }); ta.value = ""; markSeen();
    $("#view-board").scrollIntoView({ block: "end" });
  });
  if (S.view === "board") markSeen();
}

function renderLangCard() {
  return `<div class="card"><h2>${t("language")}</h2><div class="choice">
    <button class="btn ${S.lang === "de" ? "selected" : ""}" data-lang="de">🇩🇪 ${t("german")}</button>
    <button class="btn ${S.lang === "en" ? "selected" : ""}" data-lang="en">🇬🇧 ${t("english")}</button>
    <button class="btn ${S.lang === "fr" ? "selected" : ""}" data-lang="fr">🇫🇷 ${t("french")}</button></div></div>`;
}

function renderMore() {
  const st = S.state;
  const inv = S.invite ? `<p class="small">${t("inviteDone", { name: esc(S.invite.name) })}</p><div class="linkbox">${esc(S.invite.link)}</div>
    <div class="row"><button class="btn primary" id="inv-share">📤 ${t("inviteShare")}</button><button class="btn" id="inv-copy">${t("copyLink")}</button></div>` : "";
  const loc = S.onIsland === null ? t("locationUnknown") : S.onIsland ? t("locationOnIsland") : t("locationOff");
  const admin = st.me.isAdmin ? `
    <div class="card"><h2>${t("admin")} · ${t("members")}</h2>
      ${S.admin ? `<ul class="members">${S.admin.members.map((m) => `
        <li style="flex-direction:column;align-items:stretch;gap:6px">
          <div class="row spread"><span><strong>${esc(m.name)}</strong>${m.isAdmin ? " 👑" : ""}${m.active ? "" : ` <span class="pill">${t("inactive")}</span>`}
            ${m.invitedByName ? `<span class="muted small"> · ${t("invitedBy")} ${esc(m.invitedByName)}</span>` : ""}</span></div>
          <div class="row">
            <button class="btn sm" data-adm="copy" data-id="${m.id}">${t("copyLink")}</button>
            <button class="btn sm" data-adm="rename" data-id="${m.id}">${t("rename")}</button>
            ${m.active ? `<button class="btn sm" data-adm="deactivate" data-id="${m.id}" ${m.isAdmin ? "disabled" : ""}>${t("deactivate")}</button>` : `<button class="btn sm" data-adm="activate" data-id="${m.id}">${t("activate")}</button>`}
            <button class="btn sm" data-adm="regenerate" data-id="${m.id}">${t("regenerate")}</button>
          </div></li>`).join("")}</ul>`
        : `<button class="btn" id="adm-load">${t("members")} …</button>`}
    </div>` : "";

  $("#view-more").innerHTML = `
    ${renderLangCard()}
    <div class="card"><h2>${t("invite")}</h2>
      <div class="field"><label>${t("inviteName")}</label><input type="text" id="inv-name" maxlength="60"></div>
      <div class="field"><label>${t("inviteLang")}</label><select id="inv-lang"><option value="de">Deutsch</option><option value="en">English</option><option value="fr">Français</option></select></div>
      <button class="btn primary" id="inv-create">${t("inviteCreate")}</button>
      ${inv}
    </div>
    ${admin}
    <div class="card"><h2>${t("location")}</h2><p class="small">${loc}</p><p class="muted small">${t("install")}</p></div>`;

  $("#view-more").querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.lang); render(); }));
  $("#inv-create").addEventListener("click", async () => {
    const name = $("#inv-name").value.trim(); const lang = $("#inv-lang").value;
    if (name.length < 2) return;
    const r = await act("api_invite", { p_name: name, p_lang: lang }); S.invite = { ...r, link: linkFor(r.token) }; S.admin = null; refreshState();
  });
  $("#inv-share")?.addEventListener("click", async () => {
    const text = `${makeT(S.invite.lang)("shareText", { name: S.invite.name })} ${S.invite.link}`;
    if (navigator.share) { try { await navigator.share({ title: t("appName"), text }); } catch {} } else copy(text);
  });
  $("#inv-copy")?.addEventListener("click", () => copy(S.invite.link));
  $("#adm-load")?.addEventListener("click", loadAdmin);
  $("#view-more").querySelectorAll("[data-adm]").forEach((b) => b.addEventListener("click", async () => {
    const id = Number(b.dataset.id), m = S.admin.members.find((x) => x.id === id), action = b.dataset.adm;
    if (action === "copy") return copy(m.link);
    const params = { p_id: id, p_action: action, p_name: null };
    if (action === "rename") { const name = prompt(t("rename"), m.name); if (!name || name.trim().length < 2) return; params.p_name = name.trim(); }
    if (action === "regenerate" && !confirm(t("regenerateConfirm", { name: m.name }))) return;
    try { S.admin = adminList(await rpc("api_admin_action", params)); render(); refreshState(); } catch (e) { toast(`${t("error")}: ${e.message}`); }
  }));
}

const adminList = (list) => ({ members: [...list].sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" })).map((m) => ({ ...m, link: linkFor(m.token) })) });
async function loadAdmin() {
  try { S.admin = adminList(await rpc("api_admin_members")); render(); } catch (e) { toast(`${t("error")}: ${e.message}`); }
}

// ---------- Navigation / Lifecycle ----------
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  S.view = b.dataset.view; render();
  if (S.view === "board") markSeen();
  if (S.view === "stats") loadHistory();
  if (S.view === "more" && S.state?.me?.isAdmin && !S.admin) loadAdmin();
}));
window.addEventListener("online", () => { S.offline = false; refreshState(); refreshWeather(true); });
window.addEventListener("offline", () => { S.offline = true; render(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshState(); refreshWeather(); } });
setInterval(() => { if (!document.hidden) refreshState(); }, 60 * 1000);
setInterval(() => { if (!document.hidden) refreshWeather(); }, 15 * 60 * 1000);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

// Manifest zur Laufzeit mit persönlicher start_url erzeugen, damit die installierte App mit Token startet.
function installManifest() {
  if (!token) return;
  const base = location.origin + location.pathname.replace(/[^/]*$/, "");
  const manifest = {
    name: "Schwimmgrüppchen", short_name: "Schwimmen", id: base, scope: base,
    start_url: `${base}?u=${token}`, display: "standalone", orientation: "portrait",
    background_color: "#0b3d5c", theme_color: "#0b3d5c", lang: S.lang,
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}icons/icon-512-maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  const link = document.querySelector('link[rel="manifest"]') ?? Object.assign(document.createElement("link"), { rel: "manifest" });
  link.href = "data:application/manifest+json;charset=utf-8," + encodeURIComponent(JSON.stringify(manifest));
  if (!link.parentNode) document.head.appendChild(link);
}
installManifest();

setLang(S.lang, false);
render();
refreshState().then(() => { refreshWeather(true); requestLocation(); });
