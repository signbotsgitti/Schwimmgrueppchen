-- Update: Standard-Treffzeit und Standard-Bucht als Admin-Einstellung.
-- Im Supabase SQL-Editor ausführen (Projekt yjwqqupabzwxqonxdzcm). Mehrfach ausführbar.
-- Im Zweifel einfach das komplette Schema (2026-10-21-schema.sql) erneut ausführen, es enthält alles.

create table if not exists public.settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;

create or replace function public.app_default_meet_time() returns text
language sql stable as $$ select coalesce((select value from public.settings where key = 'meet_time'), '16:15') $$;

create or replace function public.app_default_bay() returns text
language sql stable as $$ select coalesce((select value from public.settings where key = 'meet_bay'), 'binisafua') $$;

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
    'defaults', jsonb_build_object('time', public.app_default_meet_time(), 'bay', public.app_default_bay()),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.id) from (
        select msg.id, msg.kind, msg.text, msg.attachment, msg.created_at, msg.member_id, m.name
        from public.messages msg left join public.members m on m.id = msg.member_id
        order by msg.id desc limit 100) x), '[]'::jsonb),
    'jelly', coalesce((
      select jsonb_object_agg(q.bay, q.info) from (
        select distinct on (j.bay) j.bay, jsonb_build_object('name', coalesce(m.name, '?'), 'at', j.created_at) as info
        from public.jelly_reports j left join public.members m on m.id = j.member_id
        where j.day = d order by j.bay, j.id) q), '{}'::jsonb)
  );
end $$;

create or replace function public.api_admin_settings(p_token text, p_time text default null, p_bay text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token);
begin
  if not me.is_admin then raise exception 'Nur Admin' using errcode = 'PT403'; end if;
  if p_time is not null then
    if p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'time muss HH:MM sein' using errcode = 'PT400'; end if;
    insert into public.settings (key, value) values ('meet_time', p_time)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if p_bay is not null then
    if p_bay !~ '^[a-z0-9_-]{2,30}$' then raise exception 'Unbekannte Bucht' using errcode = 'PT400'; end if;
    insert into public.settings (key, value) values ('meet_bay', p_bay)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return public.app_state(me);
end $$;

revoke execute on function public.api_admin_settings(text, text, text) from public;
grant execute on function public.api_admin_settings(text, text, text) to anon, authenticated;
