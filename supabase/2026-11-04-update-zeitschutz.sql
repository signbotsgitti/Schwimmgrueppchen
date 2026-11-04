-- Update: Schutz gegen versehentlichen Tageswechsel durch Uhrzeit in der Vergangenheit, Korrektur der heutigen Zeit.
-- Im Supabase SQL-Editor ausführen (Projekt yjwqqupabzwxqonxdzcm). Mehrfach ausführbar.

create or replace function public.app_state(me public.members) returns jsonb
language plpgsql stable as $$
declare
  d date := public.app_target_day();
  v_time text; v_time_by text; v_bay text; v_bay_by text; t_time text; t_bay text;
begin
  select ds.meet_time, mt.name, ds.meet_bay, mb.name into v_time, v_time_by, v_bay, v_bay_by
    from public.day_settings ds
    left join public.members mt on mt.id = ds.proposed_by
    left join public.members mb on mb.id = ds.bay_by
    where ds.day = d;
  select ds.meet_time, ds.meet_bay into t_time, t_bay from public.day_settings ds where ds.day = public.app_today();
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
    'todayMeet', jsonb_build_object('time', t_time, 'bay', t_bay),
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

drop function if exists public.api_time(text, text);
create or replace function public.api_time(p_token text, p_time text, p_day text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.members := public.app_me(p_token);
  today date := public.app_today();
  d date := case when p_day = 'today' then today else public.app_target_day() end;
  now_local timestamp := now() at time zone 'Europe/Madrid';
begin
  if p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'time muss HH:MM sein' using errcode = 'PT400';
  end if;
  if d = today and now_local >= (d + p_time::time + interval '1 hour') then
    raise exception 'Uhrzeit liegt bereits in der Vergangenheit' using errcode = 'PT409';
  end if;
  insert into public.day_settings (day, meet_time, proposed_by) values (d, p_time, me.id)
  on conflict (day) do update set meet_time = excluded.meet_time, proposed_by = excluded.proposed_by, updated_at = now();
  perform public.app_system_message('⏰ ' || me.name || ': ' || p_time);
  return public.app_state(me);
end $$;

revoke execute on function public.api_time(text, text, text) from public;
grant execute on function public.api_time(text, text, text) to anon, authenticated;
