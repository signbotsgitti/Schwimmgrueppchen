// Lokaler Dev-Server ohne Supabase: statische Dateien aus public/ + RPC-Endpunkte wie PostgREST auf PGlite.
// Start: node scripts/dev-server.mjs [port]   -> http://localhost:8788/?u=<token aus handover/*-links.md>
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = Number(process.argv[2] ?? 8788);
const ROOT = new URL("../public/", import.meta.url).pathname;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };

const db = new PGlite();
await db.exec("do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;");
await db.exec(readFileSync(new URL("../supabase/2026-10-21-schema.sql", import.meta.url), "utf8"));
const seeds = existsSync("handover") ? readdirSync("handover").filter((f) => f.endsWith("-seed.sql")).sort() : [];
if (seeds.length) { await db.exec(readFileSync(join("handover", seeds.at(-1)), "utf8")); console.log(`Seed geladen: handover/${seeds.at(-1)}`); }
else console.log("Kein Seed in handover/ – erst `npm run seed` ausführen.");
if (process.env.DEV_SQL && existsSync(process.env.DEV_SQL)) { await db.exec(readFileSync(process.env.DEV_SQL, "utf8")); console.log(`Zusatz-SQL geladen: ${process.env.DEV_SQL}`); }

async function rpc(fn, params) {
  if (!/^api_[a-z_]+$/.test(fn)) return [404, { message: "Unbekannte Funktion" }];
  const keys = Object.keys(params ?? {});
  try {
    const r = await db.query(`select public.${fn}(${keys.map((k, i) => `${k} := $${i + 1}`).join(", ")}) as result`, keys.map((k) => params[k]));
    return [200, r.rows[0].result];
  } catch (err) {
    const code = err.code ?? "";
    return [/^PT\d{3}$/.test(code) ? Number(code.slice(2)) : 400, { message: err.message, code }];
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (status, body, type = "application/json") => { res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };
  if (url.pathname.startsWith("/rest/v1/rpc/") && req.method === "POST") {
    let raw = ""; for await (const c of req) raw += c;
    const [status, body] = await rpc(url.pathname.slice("/rest/v1/rpc/".length), raw ? JSON.parse(raw) : {});
    console.log(`${req.method} ${url.pathname} ${status}`);
    return send(status, JSON.stringify(body));
  }
  if (url.pathname === "/supabase-config.js") return send(200, 'export const SUPABASE_URL = ""; export const SUPABASE_ANON_KEY = "dev";', MIME[".js"]);
  // Storage-Emulation (Bucket pinnwand) im Ordner .dev-storage/
  const STORE = new URL("../.dev-storage/", import.meta.url).pathname;
  if (url.pathname.startsWith("/storage/v1/object/pinnwand/") && req.method === "POST") {
    const rel = url.pathname.slice("/storage/v1/object/pinnwand/".length);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}\/[0-9a-f]{16,40}\.jpg$/.test(rel) || req.headers["content-type"] !== "image/jpeg") return send(400, JSON.stringify({ message: "policy violation" }));
    const chunks = []; for await (const c of req) chunks.push(c); const buf = Buffer.concat(chunks);
    if (buf.length > 2 * 1024 * 1024) return send(413, JSON.stringify({ message: "too large" }));
    mkdirSync(join(STORE, rel.split("/")[0]), { recursive: true }); writeFileSync(join(STORE, rel), buf);
    console.log(`POST storage ${rel} ${buf.length} bytes`);
    return send(200, JSON.stringify({ Key: `pinnwand/${rel}` }));
  }
  if (url.pathname.startsWith("/storage/v1/object/public/pinnwand/")) {
    const f = join(STORE, url.pathname.slice("/storage/v1/object/public/pinnwand/".length));
    if (!f.startsWith(STORE) || !existsSync(f)) return send(404, "not found", "text/plain");
    return send(200, readFileSync(f), "image/jpeg");
  }
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) return send(403, "forbidden", "text/plain");
  if (file.endsWith("/")) file += "index.html";
  if (!existsSync(file)) return send(404, "not found", "text/plain");
  send(200, readFileSync(file), MIME[extname(file)] ?? "application/octet-stream");
}).listen(PORT, () => console.log(`Dev-Server: http://localhost:${PORT}/`));
