begin;
-- One immutable intent couples an existing selection preview to a desired value.
-- No variable, binding, queue slot or provider write is created while preparing.
create table public.scan_variable_previews (
  id uuid primary key references public.managed_value_previews(id),
  connection_id uuid not null references public.webflow_connections(id),
  after_value jsonb not null check(public.valid_managed_canonical(after_value)),
  slug_updates jsonb not null,
  confirmed_at timestamptz
);
alter table public.scan_variable_previews enable row level security;
create policy scan_variable_preview_owner on public.scan_variable_previews for select to authenticated using (
  exists(select 1 from public.managed_value_previews p where p.id=scan_variable_previews.id and p.actor_id=(select auth.uid()))
);
grant select on public.scan_variable_previews to authenticated;

create function public.preview_scan_variable(p_id uuid,p_scan_id uuid,p_name text,p_occurrence_ids uuid[],p_after jsonb,p_connection_id uuid,p_slugs jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; v public.managed_value_previews%rowtype; intent public.scan_variable_previews%rowtype;
begin
  s:=public.require_scan_owner(p_scan_id);
  if not exists(select 1 from public.sites t join public.webflow_connections c on c.id=t.connection_id
    where t.id=s.site_id and c.id=p_connection_id and c.actor_id=auth.uid() and c.status='ready') then raise exception 'Connection unavailable'; end if;
  perform public.preview_managed_value(p_id,p_scan_id,p_name,p_occurrence_ids);
  select * into v from public.managed_value_previews where id=p_id for update;
  if v.managed_value_id is not null or v.expires_at<=clock_timestamp() then raise exception 'Preview unavailable'; end if;
  if p_after is null or not public.valid_managed_canonical(p_after) or p_after->>'type' is distinct from v.canonical->>'type'
    or (v.canonical->>'type'='money' and p_after->>'currency' is distinct from v.canonical->>'currency')
    or p_slugs is null or jsonb_typeof(p_slugs)<>'object' then raise exception 'Invalid target'; end if;
  insert into public.scan_variable_previews(id,connection_id,after_value,slug_updates) values(p_id,p_connection_id,p_after,p_slugs) on conflict(id) do nothing;
  select * into intent from public.scan_variable_previews where id=p_id for update;
  if intent.connection_id<>p_connection_id or intent.after_value<>p_after or intent.slug_updates<>p_slugs then raise exception 'Operation key conflict'; end if;
  return p_id;
end $$;

create function public.confirm_scan_variable(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.managed_value_previews%rowtype; intent public.scan_variable_previews%rowtype; s public.cms_scans%rowtype; value_id uuid;
begin
  select * into v from public.managed_value_previews where id=p_id for update;
  if not found or auth.uid() is null or v.actor_id<>auth.uid() then raise exception 'Preview unavailable' using errcode='42501'; end if;
  s:=public.require_scan_owner(v.scan_id);
  select * into intent from public.scan_variable_previews where id=p_id for update;
  if not found then raise exception 'Preview unavailable'; end if;
  if intent.confirmed_at is not null then return p_id; end if;
  if v.managed_value_id is not null or v.expires_at<=clock_timestamp() then raise exception 'Preview unavailable'; end if;
  if not exists(select 1 from public.sites t join public.webflow_connections c on c.id=t.connection_id
    where t.id=v.site_id and c.id=intent.connection_id and c.actor_id=auth.uid() and c.status='ready') then raise exception 'Connection changed'; end if;
  -- The existing allocation, quota, binding protection and queue guards all run
  -- inside this transaction. Any failure rolls back the variable and its bindings.
  value_id:=public.confirm_managed_value(p_id);
  perform public.preview_managed_value_sync(p_id,value_id,1,intent.after_value);
  perform public.prepare_cms_item_slugs(p_id,intent.slug_updates);
  perform public.confirm_cms_changes(p_id);
  update public.scan_variable_previews set confirmed_at=clock_timestamp() where id=p_id;
  return p_id;
end $$;
revoke all on function public.preview_scan_variable(uuid,uuid,text,uuid[],jsonb,uuid,jsonb),public.confirm_scan_variable(uuid) from public,anon;
grant execute on function public.preview_scan_variable(uuid,uuid,text,uuid[],jsonb,uuid,jsonb),public.confirm_scan_variable(uuid) to authenticated;
commit;
