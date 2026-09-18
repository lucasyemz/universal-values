begin;
alter table public.managed_values add column archived_at timestamptz;

-- Serialize CMS dispatch and binding creation at site scope. Existing previews
-- must also be rechecked when confirmed or dispatched, including reversions.
create function public.protect_managed_sources() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.site_id::text,0));
  if tg_table_name='managed_value_bindings' then
    if exists(select 1 from public.managed_values where id=new.managed_value_id and archived_at is not null) then raise exception 'Managed value archived'; end if;
    if exists(select 1 from public.cms_change_requests where site_id=new.site_id and status='confirmed') then raise exception 'Site operation in progress'; end if;
  else
    if tg_op='UPDATE' then
      if not ((old.status='preview' and new.status='confirmed') or (not old.dispatched and new.dispatched)) then return new; end if;
    end if;
    if new.managed_value_id is not null then
      if exists(select 1 from public.managed_values where id=new.managed_value_id and archived_at is not null) then raise exception 'Managed value archived'; end if;
    elsif exists(select 1 from public.scan_occurrences o join public.managed_value_bindings b on b.site_id=o.site_id and b.source_key=o.source_key
      where o.scan_id=new.scan_id and o.id in (select (e->>'occurrenceId')::uuid from jsonb_array_elements(new.changes) e)) then
      raise exception 'Source managed: edit through its Managed Value' using errcode='22023';
    end if;
  end if;
  return new;
end $$;
create trigger protect_managed_sources before insert or update on public.cms_change_requests for each row execute function public.protect_managed_sources();
create trigger protect_managed_sources before insert on public.managed_value_bindings for each row execute function public.protect_managed_sources();
revoke all on function public.protect_managed_sources() from public,anon,authenticated;

create table public.managed_value_archives (
  id uuid primary key, managed_value_id uuid not null references public.managed_values(id),
  workspace_id uuid not null references public.workspaces(id), actor_id uuid not null references auth.users(id),
  version integer not null, snapshot jsonb not null, created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 minutes', confirmed_at timestamptz
);
alter table public.managed_value_archives enable row level security;
create policy archive_read on public.managed_value_archives for select to authenticated using(actor_id=auth.uid() and exists(select 1 from public.workspace_members where workspace_id=managed_value_archives.workspace_id and user_id=auth.uid() and role='owner'));
revoke all on public.managed_value_archives from anon,authenticated;
grant select on public.managed_value_archives to authenticated;

create table public.managed_value_archive_audit (
  operation_id uuid not null references public.managed_value_archives(id),
  action text not null check(action in ('previewed','confirmed')), actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(), primary key(operation_id,action)
);
alter table public.managed_value_archive_audit enable row level security;
create policy archive_audit_read on public.managed_value_archive_audit for select to authenticated using(exists(select 1 from public.managed_value_archives where id=operation_id));
revoke all on public.managed_value_archive_audit from anon,authenticated;
grant select on public.managed_value_archive_audit to authenticated;

create function public.preview_managed_value_archive(p_id uuid,p_value_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.managed_values%rowtype; a public.managed_value_archives%rowtype; snapshot jsonb;
begin
  select * into v from public.managed_values where id=p_value_id for update;
  if not found or auth.uid() is null or not exists(select 1 from public.workspace_members where workspace_id=v.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Value unavailable' using errcode='42501'; end if;
  select * into a from public.managed_value_archives where id=p_id;
  if found then
    if a.actor_id<>auth.uid() or a.managed_value_id<>p_value_id then raise exception 'Operation key conflict'; end if;
    return p_id;
  end if;
  if v.archived_at is not null then raise exception 'Managed value archived'; end if;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.source_key collate "C"),'[]') into snapshot from public.managed_value_bindings b where managed_value_id=v.id;
  insert into public.managed_value_archives(id,managed_value_id,workspace_id,actor_id,version,snapshot) values(p_id,v.id,v.workspace_id,auth.uid(),v.version,snapshot);
  insert into public.managed_value_archive_audit(operation_id,actor_id,action) values(p_id,auth.uid(),'previewed');
  return p_id;
end $$;

create function public.confirm_managed_value_archive(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.managed_value_archives%rowtype; v public.managed_values%rowtype; snapshot jsonb;
begin
  select * into a from public.managed_value_archives where id=p_id for update;
  if not found or a.actor_id is distinct from auth.uid() or not exists(select 1 from public.workspace_members where workspace_id=a.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Preview unavailable' using errcode='42501'; end if;
  if a.confirmed_at is not null then return a.managed_value_id; end if;
  select * into v from public.managed_values where id=a.managed_value_id for update;
  perform pg_advisory_xact_lock(hashtextextended(v.site_id::text,0));
  if a.expires_at<=clock_timestamp() or v.archived_at is not null or v.version<>a.version then raise exception 'Archive preview stale'; end if;
  if exists(select 1 from public.cms_change_requests where site_id=v.site_id and status='confirmed') then raise exception 'Site operation in progress'; end if;
  if exists(select 1 from public.managed_value_bindings where managed_value_id=v.id and uncertain) then raise exception 'Reconcile uncertain sources first'; end if;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.source_key collate "C"),'[]') into snapshot from public.managed_value_bindings b where managed_value_id=v.id;
  if snapshot is distinct from a.snapshot then raise exception 'Bindings changed'; end if;
  delete from public.managed_value_bindings where managed_value_id=v.id;
  update public.managed_values set archived_at=clock_timestamp() where id=v.id;
  update public.managed_value_archives set confirmed_at=clock_timestamp() where id=a.id;
  insert into public.managed_value_archive_audit(operation_id,actor_id,action) values(p_id,auth.uid(),'confirmed');
  return v.id;
end $$;
revoke all on function public.preview_managed_value_archive(uuid,uuid), public.confirm_managed_value_archive(uuid) from public,anon;
grant execute on function public.preview_managed_value_archive(uuid,uuid), public.confirm_managed_value_archive(uuid) to authenticated;
commit;
