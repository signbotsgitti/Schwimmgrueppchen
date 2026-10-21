-- Update: Bucht pro Tag wählbar (Vorschlag mit Name), Uhrzeit optional.
-- Im Supabase SQL-Editor ausführen (Projekt yjwqqupabzwxqonxdzcm). Mehrfach ausführbar.

alter table public.day_settings alter column meet_time drop not null;
alter table public.day_settings add column if not exists meet_bay text;
alter table public.day_settings add column if not exists bay_by bigint references public.members(id);

create or replace function public.app_state(me public.members) returns jsonb
language plpgsql stable as $$
declare
  d date := public.app_today();
  v_time text; v_time_by text; v_bay text; v_bay_by text;
begin
  select ds.meet_time, mt.name, ds.meet_bay, mb.name into v_time, v_time_by, v_bay, v_bay_by
    from public.day_settings ds
    left join public.members mt on mt.id = ds.proposed_by
    left join public.members mb on mb.id = ds.bay_by
    where ds.day = d;
  return jsonb_build_object(
    'day', to_char(d, 'YYYY-MM-DD'),
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

create or replace function public.api_bay(p_token text, p_bay text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.members := public.app_me(p_token); d date := public.app_today();
begin
  if p_bay !~ '^[a-z0-9_-]{2,30}$' then raise exception 'Unbekannte Bucht' using errcode = 'PT400'; end if;
  insert into public.day_settings (day, meet_bay, bay_by) values (d, p_bay, me.id)
  on conflict (day) do update set meet_bay = excluded.meet_bay, bay_by = excluded.bay_by, updated_at = now();
  perform public.app_system_message('📍 ' || me.name || ': ' || p_bay);
  return public.app_state(me);
end $$;

revoke execute on function public.api_bay(text, text) from public;
grant execute on function public.api_bay(text, text) to anon, authenticated;
