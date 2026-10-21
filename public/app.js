// Schwimmgrüppchen – Frontend (ohne Framework, ES-Module). Backend: Supabase-RPC, Wetter: Open-Meteo direkt.
import { STRINGS, makeT } from "./i18n.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";
import { BAYS, DEFAULT_MEET_TIME, DEFAULT_BAY, ISLAND_BOUNDS, WEATHER_REFRESH_MINUTES } from "./lib/config.js";
import { loadWeather } from "./lib/weather.js";

const $ = (sel, root = document) => root.querySelector(sel);
const LS = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------- Token aus URL übernehmen ----------
const url = new URL(location.href);
if (url.searchParams.get("u")) {
  LS.set("token", url.searchParams.get("u"));
  url.searchParams.delete("u");
  history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
}
const token = LS.get("token");

// ---------- Zustand ----------
const S = {
  lang: LS.get("lang", navigator.language?.startsWith("en") ? "en" : "de"),
  state: LS.get("cache:state"), stateAt: LS.get("cache:stateAt"),
  weather: LS.get("cache:weather"), weatherAt: LS.get("cache:weatherAt"),
  offline: !navigator.onLine, fatal: null,
  onIsland: null, // null = unbekannt/abgelehnt, true/false
  view: "today",
  lastSeenMsg: LS.get("lastSeenMsg", 0),
  invite: null, admin: null, adminOpen: false,
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
    const w = await loadWeather(S.state?.jelly ?? {});
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
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString(S.lang === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const fmtDateTime = (ms) => new Date(ms).toLocaleString(S.lang === "de" ? "de-DE" : "en-GB", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
function render() {
  $("#me-name").textContent = S.state?.me?.name ?? "";
  const net = $("#net"); net.hidden = !S.offline; net.textContent = t("offline");
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === S.view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${S.view}`));
  if (S.fatal) {
    const msg = S.fatal === "inactive" ? "Zugang deaktiviert / access deactivated" : S.fatal === "server" ? `${t("serverError")}\n${S.fatalDetail}` : t(S.fatal);
    $("#view-today").innerHTML = `<div class="error" style="white-space:pre-wrap">${esc(msg)}</div><p class="center"><button class="btn" id="retry">${t("retry")}</button></p>`;
    $("#retry")?.addEventListener("click", () => { S.fatal = null; render(); refreshState(); });
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
  renderToday(); renderBoard(); renderMore();
}

function renderToday() {
  const st = S.state, me = st.me;
  const mine = st.members.find((m) => m.id === me.id)?.attendance?.status ?? "open";
  const blocked = S.onIsland === false;
  const meetBay = bayName(DEFAULT_BAY);
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
  const members = st.members.map((m) => `<li><span>${esc(m.name)}${m.id === me.id ? ` <span class="muted small">(${t("you")})</span>` : ""}</span>${pill(m.attendance)}</li>`).join("");

  $("#view-today").innerHTML = `
    ${stamp}
    <div class="card">
      <h2>${t("meetAt")}</h2>
      <div class="row spread">
        <div class="meet">${esc(meetBay)} · ${esc(meetTime)}</div>
        <button class="btn sm" id="change-time">⏰ ${t("changeTime")}</button>
      </div>
      ${st.meet.proposedBy ? `<p class="muted small">${t("proposedBy")} ${esc(st.meet.proposedBy)}</p>` : ""}
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
  $("#change-time")?.addEventListener("click", async () => {
    const v = prompt(t("newTime"), meetTime);
    if (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim())) await act("api_time", { p_time: v.trim() });
    else if (v) toast("HH:MM");
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
  return `<div class="card"><h2>${t("language")}</h2><div class="choice" style="grid-template-columns:1fr 1fr">
    <button class="btn ${S.lang === "de" ? "selected" : ""}" data-lang="de">🇩🇪 ${t("german")}</button>
    <button class="btn ${S.lang === "en" ? "selected" : ""}" data-lang="en">🇬🇧 ${t("english")}</button></div></div>`;
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
      <div class="field"><label>${t("inviteLang")}</label><select id="inv-lang"><option value="de">Deutsch</option><option value="en">English</option></select></div>
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

const adminList = (list) => ({ members: list.map((m) => ({ ...m, link: linkFor(m.token) })) });
async function loadAdmin() {
  try { S.admin = adminList(await rpc("api_admin_members")); render(); } catch (e) { toast(`${t("error")}: ${e.message}`); }
}

// ---------- Navigation / Lifecycle ----------
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  S.view = b.dataset.view; render();
  if (S.view === "board") markSeen();
  if (S.view === "more" && S.state?.me?.isAdmin && !S.admin) loadAdmin();
}));
window.addEventListener("online", () => { S.offline = false; refreshState(); refreshWeather(true); });
window.addEventListener("offline", () => { S.offline = true; render(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshState(); refreshWeather(); } });
setInterval(() => { if (!document.hidden) refreshState(); }, 60 * 1000);
setInterval(() => { if (!document.hidden) refreshWeather(); }, 15 * 60 * 1000);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

setLang(S.lang, false);
render();
refreshState().then(() => { refreshWeather(true); requestLocation(); });
