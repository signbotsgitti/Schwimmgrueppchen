-- Update: Status "Überraschung" (maybe), Admin kann Status anderer Personen setzen.
-- Im Supabase SQL-Editor ausführen (Projekt yjwqqupabzwxqonxdzcm). Mehrfach ausführbar.
-- Im Zweifel einfach das komplette Schema (2026-10-21-schema.sql) erneut ausführen, es enthält alles.

alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check check (status in ('yes','no','away','maybe'));

create or replace function public.api_attendance(p_token text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); d date := public.app_target_day();
begin
  if p_status not in ('yes', 'no', 'away', 'maybe', 'open') then
    raise exception 'status muss yes|no|away|maybe|open sein' using errcode = 'PT400';
  end if;
  if p_status = 'open' then
    delete from public.attendance where day = d and member_id = me.id;
  else
    insert into public.attendance (day, member_id, status) values (d, me.id, p_status)
    on conflict (day, member_id) do update set status = excluded.status, updated_at = now();
  end if;
  return public.app_state(me);
end $$;

-- Admin: Status einer anderen Person setzen (Zieltag oder beliebiger Tag, z. B. Nachtrag für Personen ohne Link)
create or replace function public.api_admin_attendance(p_token text, p_member_id bigint, p_status text, p_day text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); d date;
begin
  if not me.is_admin then raise exception 'Nur Admin' using errcode = 'PT403'; end if;
  if p_status not in ('yes', 'no', 'away', 'maybe', 'open') then
    raise exception 'status muss yes|no|away|maybe|open sein' using errcode = 'PT400';
  end if;
  if not exists (select 1 from public.members where id = p_member_id) then
    raise exception 'Mitglied nicht gefunden' using errcode = 'PT404';
  end if;
  d := coalesce(p_day::date, public.app_target_day());
  if p_status = 'open' then
    delete from public.attendance where day = d and member_id = p_member_id;
  else
    insert into public.attendance (day, member_id, status) values (d, p_member_id, p_status)
    on conflict (day, member_id) do update set status = excluded.status, updated_at = now();
  end if;
  return public.app_state(me);
end $$;

revoke execute on function public.api_admin_attendance(text, bigint, text, text) from public;
grant execute on function public.api_admin_attendance(text, bigint, text, text) to anon, authenticated;
