// Testhelfer: PGlite mit Schema laden und RPC wie PostgREST aufrufen (benannte Parameter).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

export async function freshDb(seedSql = "") {
  const db = new PGlite();
  // Supabase-Rollen nachbilden
  await db.exec("do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;");
  await db.exec(readFileSync(new URL("../supabase/2026-10-21-schema.sql", import.meta.url), "utf8"));
  if (seedSql) await db.exec(seedSql);
  return db;
}

/** Ruft eine api_*-Funktion wie PostgREST auf. Wirft {status, message} bei PTxxx-Fehlern. */
export async function rpc(db, fn, params) {
  if (!/^api_[a-z_]+$/.test(fn)) { const e = new Error("Unbekannte Funktion"); e.status = 404; throw e; }
  const keys = Object.keys(params);
  const args = keys.map((k, i) => `${k} := $${i + 1}`).join(", ");
  try {
    const r = await db.query(`select public.${fn}(${args}) as result`, keys.map((k) => params[k]));
    return r.rows[0].result;
  } catch (err) {
    const code = err.code ?? "";
    const e = new Error(err.message?.replace(/^.*?error:\s*/i, "") ?? String(err));
    e.status = /^PT\d{3}$/.test(code) ? Number(code.slice(2)) : 400;
    e.code = code;
    throw e;
  }
}
