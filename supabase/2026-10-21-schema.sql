-- =====================================================================
-- Schwimmgrüppchen – Supabase: Schema + API als SQL-Funktionen (RPC)
-- Komplett im Supabase SQL-Editor ausführen. Idempotent (mehrfach ausführbar).
-- Zugriff: nur über api_*-Funktionen mit persönlichem Token; Tabellen sind
-- per Row Level Security ohne Policies für anon/authenticated gesperrt.
-- =====================================================================

create table if not exists public.members (
  id          bigint generated always as identity primary key,
  token       text not null unique,
  name        text not null,
  lang        text not null default 'de' check (lang in ('de','en','fr')),
  active      boolean not null default true,
  is_admin    boolean not null default false,
  invited_by  bigint references public.members(id),
  created_at  timestamptz not null default now()
);

-- Tagesstatus pro Tag (Europe/Madrid) und Person -> automatischer Reset um 00:00
create table if not exists public.attendance (
  day         date not null,
  member_id   bigint not null references public.members(id),
  status      text not null check (status in ('yes','no','away')),
  updated_at  timestamptz not null default now(),
  primary key (day, member_id)
);

create table if not exists public.day_settings (
  day          date primary key,
  meet_time    text,                                   -- HH:MM, null = Standard
  proposed_by  bigint references public.members(id),  -- wer die Uhrzeit vorgeschlagen hat
  meet_bay     text,                                   -- Bucht-ID, null = Standard
  bay_by       bigint references public.members(id),  -- wer die Bucht vorgeschlagen hat
  updated_at   timestamptz not null default now()
);
-- Erweiterungen für bestehende Datenbanken
alter table public.day_settings alter column meet_time drop not null;
alter table public.day_settings add column if not exists meet_bay text;
alter table public.day_settings add column if not exists bay_by bigint references public.members(id);

create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  member_id   bigint references public.members(id),
  kind        text not null default 'msg' check (kind in ('msg','system')),
  text        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.jelly_reports (
  id          bigint generated always as identity primary key,
  day         date not null,
  bay         text not null,
  member_id   bigint references public.members(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_jelly_day on public.jelly_reports(day, bay);

-- Sprachen nachträglich erweitern (für bestehende Datenbanken)
alter table public.members drop constraint if exists members_lang_check;
alter table public.members add constraint members_lang_check check (lang in ('de','en','fr'));

alter table public.members       enable row level security;
alter table public.attendance    enable row level security;
alter table public.day_settings  enable row level security;
alter table public.messages      enable row level security;
alter table public.jelly_reports enable row level security;
revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------
-- Interne Helfer (nicht für anon freigegeben)
-- ---------------------------------------------------------------------
create or replace function public.app_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Madrid')::date $$;

-- Standard-Treffzeit (muss mit DEFAULT_MEET_TIME in public/lib/config.js übereinstimmen)
create or replace function public.app_default_meet_time() returns text
language sql immutable as $$ select '16:15' $$;

-- Zieltag: bis 1 h nach der (ggf. geänderten) Treffzeit ist es "heute", danach "morgen".
create or replace function public.app_target_day() returns date
language plpgsql stable as $$
declare
  now_local timestamp := now() at time zone 'Europe/Madrid';
  d date := now_local::date;
  mt text;
begin
  select meet_time into mt from public.day_settings where day = d;
  if now_local >= (d + coalesce(mt, public.app_default_meet_time())::time + interval '1 hour') then
    return d + 1;
  end if;
  return d;
end $$;

create or replace function public.app_clean(p text, p_max int) returns text
language sql immutable as $$ select left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), p_max) $$;

create or replace function public.app_me(p_token text) returns public.members
language plpgsql stable as $$
declare m public.members;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{16,64}$' then
    raise exception 'Ungültiger Link' using errcode = 'PT401';
  end if;
  select * into m from public.members where token = p_token;
  if not found then raise exception 'Ungültiger Link' using errcode = 'PT401'; end if;
  if not m.active then raise exception 'Zugang deaktiviert' using errcode = 'PT403'; end if;
  return m;
end $$;

create or replace function public.app_member_json(m public.members) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', m.id, 'name', m.name, 'lang', m.lang, 'active', m.active,
                            'isAdmin', m.is_admin, 'invitedBy', m.invited_by, 'createdAt', m.created_at)
$$;

create or replace function public.app_system_message(p_text text) returns void
language sql as $$ insert into public.messages (member_id, kind, text) values (null, 'system', p_text) $$;

create or replace function public.app_state(me public.members) returns jsonb
language plpgsql stable as $$
declare
  d date := public.app_target_day();
  v_time text; v_time_by text; v_bay text; v_bay_by text;
begin
  select ds.meet_time, mt.name, ds.meet_bay, mb.name into v_time, v_time_by, v_bay, v_bay_by
    from public.day_settings ds
    left join public.members mt on mt.id = ds.proposed_by
    left join public.members mb on mb.id = ds.bay_by
    where ds.day = d;
  return jsonb_build_object(
    'day', to_char(d, 'YYYY-MM-DD'),
    'today', to_char(public.app_today(), 'YYYY-MM-DD'),
    'me', public.app_member_json(me),
    'members', coalesce((
      select jsonb_agg(public.app_member_json(m) || jsonb_build_object('attendance',
               case when a.status is null then null
                    else jsonb_build_object('status', a.status, 'updatedAt', a.updated_at) end) order by m.id)
      from public.members m left join public.attendance a on a.member_id = m.id and a.day = d
      where m.active), '[]'::jsonb),
    'meet', jsonb_build_object('time', v_time, 'proposedBy', v_time_by, 'bay', v_bay, 'bayBy', v_bay_by),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.id) from (
        select msg.id, msg.kind, msg.text, msg.created_at, msg.member_id, m.name
        from public.messages msg left join public.members m on m.id = msg.member_id
        order by msg.id desc limit 100) x), '[]'::jsonb),
    'jelly', coalesce((
      select jsonb_object_agg(q.bay, q.info) from (
        select distinct on (j.bay) j.bay, jsonb_build_object('name', coalesce(m.name, '?'), 'at', j.created_at) as info
        from public.jelly_reports j left join public.members m on m.id = j.member_id
        where j.day = d order by j.bay, j.id) q), '{}'::jsonb)
  );
end $$;

create or replace function public.app_admin_list() returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(public.app_member_json(m) || jsonb_build_object('token', m.token, 'invitedByName', i.name) order by m.id), '[]'::jsonb)
  from public.members m left join public.members i on i.id = m.invited_by
$$;

-- ---------------------------------------------------------------------
-- Öffentliche API (per RPC mit anon-Key; erster Parameter immer p_token)
-- ---------------------------------------------------------------------
create or replace function public.api_state(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin return public.app_state(public.app_me(p_token)); end $$;

create or replace function public.api_attendance(p_token text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); d date := public.app_target_day();
begin
  if p_status not in ('yes', 'no', 'away', 'open') then
    raise exception 'status muss yes|no|away|open sein' using errcode = 'PT400';
  end if;
  if p_status = 'open' then
    delete from public.attendance where day = d and member_id = me.id;
  else
    insert into public.attendance (day, member_id, status) values (d, me.id, p_status)
    on conflict (day, member_id) do update set status = excluded.status, updated_at = now();
  end if;
  return public.app_state(me);
end $$;

create or replace function public.api_time(p_token text, p_time text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); d date := public.app_target_day();
begin
  if p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'time muss HH:MM sein' using errcode = 'PT400';
  end if;
  insert into public.day_settings (day, meet_time, proposed_by) values (d, p_time, me.id)
  on conflict (day) do update set meet_time = excluded.meet_time, proposed_by = excluded.proposed_by, updated_at = now();
  perform public.app_system_message('⏰ ' || me.name || ': ' || p_time);
  return public.app_state(me);
end $$;

create or replace function public.api_bay(p_token text, p_bay text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); d date := public.app_target_day();
begin
  if p_bay !~ '^[a-z0-9_-]{2,30}$' then raise exception 'Unbekannte Bucht' using errcode = 'PT400'; end if;
  insert into public.day_settings (day, meet_bay, bay_by) values (d, p_bay, me.id)
  on conflict (day) do update set meet_bay = excluded.meet_bay, bay_by = excluded.bay_by, updated_at = now();
  perform public.app_system_message('📍 ' || me.name || ': ' || p_bay);
  return public.app_state(me);
end $$;

create or replace function public.api_message(p_token text, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); t text := public.app_clean(p_text, 1000);
begin
  if length(t) = 0 then raise exception 'Leere Nachricht' using errcode = 'PT400'; end if;
  insert into public.messages (member_id, kind, text) values (me.id, 'msg', t);
  return public.app_state(me);
end $$;

create or replace function public.api_jelly(p_token text, p_bay text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token);
begin
  if p_bay !~ '^[a-z0-9_-]{2,30}$' then raise exception 'Unbekannte Bucht' using errcode = 'PT400'; end if;
  insert into public.jelly_reports (day, bay, member_id) values (public.app_target_day(), p_bay, me.id);
  perform public.app_system_message('🪼 ' || me.name || ': ' || p_bay);
  return public.app_state(me);
end $$;

create or replace function public.api_invite(p_token text, p_name text, p_lang text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.members := public.app_me(p_token);
  n text := public.app_clean(p_name, 60);
  l text := case when p_lang in ('en','fr') then p_lang else 'de' end;
  tok text := replace(gen_random_uuid()::text, '-', '');
  new_id bigint;
begin
  if length(n) < 2 then raise exception 'Name zu kurz' using errcode = 'PT400'; end if;
  if exists (select 1 from public.members where lower(name) = lower(n)) then
    raise exception 'Name bereits vergeben' using errcode = 'PT409';
  end if;
  insert into public.members (token, name, lang, invited_by) values (tok, n, l, me.id) returning id into new_id;
  perform public.app_system_message('👋 ' || me.name || ' → ' || n);
  return jsonb_build_object('id', new_id, 'name', n, 'lang', l, 'token', tok);
end $$;

create or replace function public.api_me(p_token text, p_lang text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token);
begin
  if p_lang is not null then
    update public.members set lang = case when p_lang in ('en','fr') then p_lang else 'de' end where id = me.id returning * into me;
  end if;
  return public.app_member_json(me);
end $$;

-- Historie: Tagesstatus aller Mitglieder der letzten p_days Tage (bis heute, ohne Vorab-Zusagen für morgen)
create or replace function public.api_history(p_token text, p_days int default 90) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); d1 date := public.app_today(); d0 date;
begin
  d0 := d1 - greatest(least(coalesce(p_days, 90), 3660), 1) + 1;
  return jsonb_build_object(
    'from', to_char(d0, 'YYYY-MM-DD'), 'to', to_char(d1, 'YYYY-MM-DD'),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'active', active) order by lower(name)) from public.members), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(a.day, 'YYYY-MM-DD'), 'time', ds.meet_time, 'bay', ds.meet_bay, 'entries', a.entries) order by a.day)
      from (select day, jsonb_agg(jsonb_build_object('m', member_id, 's', status) order by member_id) as entries
            from public.attendance where day between d0 and d1 group by day) a
      left join public.day_settings ds on ds.day = a.day), '[]'::jsonb)
  );
end $$;

create or replace function public.api_admin_members(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token);
begin
  if not me.is_admin then raise exception 'Nur Admin' using errcode = 'PT403'; end if;
  return public.app_admin_list();
end $$;

create or replace function public.api_admin_action(p_token text, p_id bigint, p_action text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); target public.members; n text;
begin
  if not me.is_admin then raise exception 'Nur Admin' using errcode = 'PT403'; end if;
  select * into target from public.members where id = p_id;
  if not found then raise exception 'Mitglied nicht gefunden' using errcode = 'PT404'; end if;
  case p_action
    when 'rename' then
      n := public.app_clean(p_name, 60);
      if length(n) < 2 then raise exception 'Name zu kurz' using errcode = 'PT400'; end if;
      update public.members set name = n where id = p_id;
    when 'deactivate' then
      if target.is_admin then raise exception 'Admin kann nicht deaktiviert werden' using errcode = 'PT400'; end if;
      update public.members set active = false where id = p_id;
    when 'activate' then
      update public.members set active = true where id = p_id;
    when 'regenerate' then
      update public.members set token = replace(gen_random_uuid()::text, '-', '') where id = p_id;
    else
      raise exception 'Unbekannte Aktion' using errcode = 'PT400';
  end case;
  return public.app_admin_list();
end $$;

-- ---------------------------------------------------------------------
-- Rechte: Helfer sperren, API für anon freigeben
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.api_state(text), public.api_attendance(text, text), public.api_time(text, text), public.api_bay(text, text),
  public.api_message(text, text), public.api_jelly(text, text), public.api_invite(text, text, text),
  public.api_me(text, text), public.api_history(text, int), public.api_admin_members(text), public.api_admin_action(text, bigint, text, text)
to anon, authenticated;
