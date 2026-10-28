-- Update: Fotos in der Pinnwand (Spalte attachment, api_message mit Anhang, Storage-Bucket "pinnwand").
-- Im Supabase SQL-Editor ausführen (Projekt yjwqqupabzwxqonxdzcm). Mehrfach ausführbar.

alter table public.messages add column if not exists attachment text;

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

drop function if exists public.api_message(text, text);
create or replace function public.api_message(p_token text, p_text text, p_attachment text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); t text := public.app_clean(p_text, 1000);
begin
  if p_attachment is not null and p_attachment !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f]{16,40}\.jpg$' then
    raise exception 'Ungültiger Anhang' using errcode = 'PT400';
  end if;
  if length(t) = 0 and p_attachment is null then raise exception 'Leere Nachricht' using errcode = 'PT400'; end if;
  insert into public.messages (member_id, kind, text, attachment) values (me.id, 'msg', t, p_attachment);
  return public.app_state(me);
end $$;

revoke execute on function public.api_message(text, text, text) from public;
grant execute on function public.api_message(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: Bucket "pinnwand" für Fotos (öffentlich lesbar, Upload nur JPEG bis 2 MB)
-- Läuft nur in Supabase (Schema storage); in Tests ohne Storage wird der Block übersprungen.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('pinnwand', 'pinnwand', true, 2097152, array['image/jpeg'])
    on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];
    drop policy if exists "pinnwand upload" on storage.objects;
    create policy "pinnwand upload" on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'pinnwand' and name ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f]{16,40}\.jpg$');
    drop policy if exists "pinnwand read" on storage.objects;
    create policy "pinnwand read" on storage.objects for select to anon, authenticated using (bucket_id = 'pinnwand');
  end if;
end $$;
