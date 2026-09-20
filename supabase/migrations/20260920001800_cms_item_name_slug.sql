begin;
alter table public.cms_change_requests add column slug_updates jsonb;
create function app_private.item_name_sources(r public.cms_change_requests) returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct source_key),'{}'::text[]) from (
    select o.source_key from public.scan_occurrences o where r.managed_value_id is null and o.scan_id=r.scan_id and o.field_slug='name' and o.field_type='PlainText'
      and o.id in (select (c->>'occurrenceId')::uuid from jsonb_array_elements(r.changes) c)
    union all
    select b->>'source_key' from jsonb_array_elements(coalesce(r.managed_snapshot,'[]')) b where r.managed_value_id is not null and b->>'field_slug'='name' and b->>'field_type'='PlainText'
  ) sources
$$;
create function public.prepare_cms_item_slugs(p_id uuid,p_updates jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype; keys text[]; entry record;
begin
  r:=public.require_change_owner(p_id);
  if r.slug_updates is not null then
    if r.slug_updates<>p_updates then raise exception 'Slug preview already prepared'; end if;
    return;
  end if;
  if r.status<>'preview' or r.expires_at<=clock_timestamp() then raise exception 'Preview unavailable'; end if;
  if p_updates is null or jsonb_typeof(p_updates)<>'object' then raise exception 'Invalid slug preview'; end if;
  keys:=app_private.item_name_sources(r);
  if (select count(*) from jsonb_object_keys(p_updates))<>cardinality(keys) then raise exception 'Missing name slug'; end if;
  for entry in select * from jsonb_each(p_updates) loop
    if not(entry.key=any(keys)) or jsonb_typeof(entry.value)<>'object'
      or jsonb_typeof(entry.value->'before') is distinct from 'string'
      or jsonb_typeof(entry.value->'after') is distinct from 'string'
      or length(entry.value->>'before') not between 1 and 256
      or length(entry.value->>'after') not between 1 and 256
      or entry.value->>'after' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or (select count(*) from jsonb_object_keys(entry.value))<>2 then raise exception 'Invalid slug preview'; end if;
  end loop;
  update public.cms_change_requests set slug_updates=p_updates where id=p_id;
  insert into public.cms_change_audit(request_id,actor_id,action,detail) values(p_id,auth.uid(),'slugs_previewed',p_updates) on conflict do nothing;
end $$;
create function app_private.guard_item_slugs() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.slug_updates is not null and new.slug_updates is distinct from old.slug_updates then raise exception 'Immutable slug preview'; end if;
  if old.status<>'preview' and new.slug_updates is distinct from old.slug_updates then raise exception 'Immutable slug preview'; end if;
  if old.status='preview' and new.status='confirmed' and cardinality(app_private.item_name_sources(new))>0 and new.slug_updates is null then raise exception 'Review item slugs before confirming'; end if;
  return new;
end $$;
create trigger guard_item_slugs before update on public.cms_change_requests for each row execute function app_private.guard_item_slugs();
-- The cursor still advances one source per step; its paired slug is an extra CMS field.
create or replace function app_private.guard_change() returns trigger language plpgsql security definer set search_path='' as $$
declare extra integer;
begin
  if old.status='preview' and new.status='confirmed' then
    perform app_private.check_active(new.actor_id,new.id);
    select count(*) into extra from jsonb_each(coalesce(new.slug_updates,'{}')) where value->>'before'<>value->>'after';
    perform app_private.reserve_quota(new.actor_id,new.id,'fields',new.total+extra);
  end if;
  return new;
end $$;
revoke all on function app_private.item_name_sources(public.cms_change_requests),app_private.guard_item_slugs() from public,anon,authenticated,service_role;
revoke all on function public.prepare_cms_item_slugs(uuid,jsonb) from public,anon,service_role;
grant execute on function public.prepare_cms_item_slugs(uuid,jsonb) to authenticated;
commit;
