-- Update: Französisch als Sprache zulassen, Marie Solange auf Französisch stellen.
-- Im Supabase SQL-Editor ausführen (Projekt yjwqqupabzwxqonxdzcm). Mehrfach ausführbar.

alter table public.members drop constraint if exists members_lang_check;
alter table public.members add constraint members_lang_check check (lang in ('de','en','fr'));

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

update public.members set lang = 'fr' where name = 'Marie Solange';
