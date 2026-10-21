// Service Worker: App-Shell offline verfügbar; Daten hält die App selbst in localStorage.
const VERSION = "v2.3.1";
const BASE = self.registration.scope; // z. B. https://user.github.io/Schwimmgrueppchen/
const SHELL = ["", "index.html", "app.js", "i18n.js", "styles.css", "manifest.webmanifest", "supabase-config.js",
  "lib/config.js", "lib/ampel.js", "lib/time.js", "lib/weather.js", "lib/xlsx.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"].map((p) => new URL(p, BASE).href);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || !url.href.startsWith(BASE)) return; // Supabase/Open-Meteo: nie cachen
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match(new URL("index.html", BASE).href)))
  );
});
