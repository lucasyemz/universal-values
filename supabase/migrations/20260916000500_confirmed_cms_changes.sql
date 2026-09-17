begin;

create table public.cms_change_requests (
  id uuid primary key, scan_id uuid not null references public.cms_scans(id),
  site_id uuid not null, workspace_id uuid not null, actor_id uuid not null references auth.users(id),
  connection_id uuid not null, changes jsonb not null,
  status text not null default 'preview' check(status in ('preview','confirmed','completed','cancelled')),
  cursor integer not null default 0, total integer not null check(total between 1 and 1000),
  dispatched boolean not null default false, lease_token uuid, lease_until timestamptz, retry_at timestamptz,
  results jsonb not null default '[]', expires_at timestamptz not null default now()+interval '15 minutes',
  created_at timestamptz not null default now(),
  foreign key(site_id,workspace_id) references public.sites(id,workspace_id),
  foreign key(connection_id,workspace_id) references public.webflow_connections(id,workspace_id)
);
create unique index one_confirmed_change_per_site on public.cms_change_requests(site_id) where status='confirmed';
create table public.cms_change_audit (
  id bigint generated always as identity primary key, request_id uuid not null references public.cms_change_requests(id),
  actor_id uuid not null references auth.users(id), action text not null, step integer not null default -1,
  detail jsonb not null default '{}', created_at timestamptz not null default now(),
  unique(request_id,action,step)
);
alter table public.cms_change_requests enable row level security;
alter table public.cms_change_audit enable row level security;
create policy change_requests_read on public.cms_change_requests for select to authenticated using(actor_id=(select auth.uid()) and exists(select 1 from public.workspace_members where workspace_id=cms_change_requests.workspace_id and user_id=(select auth.uid()) and role='owner'));
create policy change_audit_read on public.cms_change_audit for select to authenticated using(exists(select 1 from public.cms_change_requests where id=request_id));
revoke all on public.cms_change_requests,public.cms_change_audit from anon,authenticated;
grant select on public.cms_change_requests,public.cms_change_audit to authenticated;

create function public.require_change_owner(p_id uuid) returns public.cms_change_requests
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  select * into r from public.cms_change_requests where id=p_id for update;
  if not found or auth.uid() is null or r.actor_id<>auth.uid() or not exists(select 1 from public.workspace_members where workspace_id=r.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Change unavailable' using errcode='42501'; end if;
  return r;
end $$;
revoke all on function public.require_change_owner(uuid) from public,anon,authenticated;

create function public.preview_cms_changes(p_id uuid,p_scan_id uuid,p_changes jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; t public.sites%rowtype; r public.cms_change_requests%rowtype; c jsonb; o public.scan_occurrences%rowtype; n integer;
begin
  s:=public.require_scan_owner(p_scan_id);
  if s.status not in ('completed','limited') then raise exception 'Scan incomplete'; end if;
  select * into t from public.sites where id=s.site_id;
  if not exists(select 1 from public.webflow_connections where id=t.connection_id and actor_id=auth.uid() and status='ready') then raise exception 'Connection unavailable'; end if;
  if p_id is null or p_changes is null or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes) not between 1 and 1000 then raise exception 'Invalid changes'; end if;
  for c in select * from jsonb_array_elements(p_changes) loop
    select * into o from public.scan_occurrences where id=(c->>'occurrenceId')::uuid and scan_id=p_scan_id;
    if not found or not public.valid_managed_canonical(c->'after') or c->'after'=o.canonical or c->'after'->>'type' is distinct from o.canonical->>'type' or (o.canonical->>'type'='money' and c->'after'->>'currency' is distinct from o.canonical->>'currency') then raise exception 'Invalid occurrence'; end if;
  end loop;
  if (select count(distinct value->>'occurrenceId') from jsonb_array_elements(p_changes))<>jsonb_array_length(p_changes) then raise exception 'Duplicate occurrence'; end if;
  select count(distinct source_key) into n from public.scan_occurrences where id in (select (value->>'occurrenceId')::uuid from jsonb_array_elements(p_changes));
  insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total) values(p_id,p_scan_id,s.site_id,s.workspace_id,auth.uid(),t.connection_id,p_changes,n) on conflict(id) do nothing;
  r:=public.require_change_owner(p_id);
  if r.scan_id<>p_scan_id or r.changes<>p_changes then raise exception 'Operation key conflict'; end if;
  insert into public.cms_change_audit(request_id,actor_id,action) values(p_id,auth.uid(),'previewed') on conflict do nothing;
  return p_id;
end $$;

create function public.confirm_cms_changes(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  r:=public.require_change_owner(p_id);
  if r.status<>'preview' then return p_id; end if;
  if r.expires_at<=clock_timestamp() or not exists(select 1 from public.sites where id=r.site_id and connection_id=r.connection_id) then raise exception 'Preview expired or connection changed'; end if;
  update public.cms_change_requests set status='confirmed' where id=p_id;
  insert into public.cms_change_audit(request_id,actor_id,action) values(p_id,auth.uid(),'confirmed') on conflict do nothing;
  return p_id;
end $$;

create function public.claim_cms_change(p_id uuid,p_cursor integer,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  r:=public.require_change_owner(p_id);
  if p_lease is null or p_cursor is null or r.status<>'confirmed' or r.cursor<>p_cursor or r.lease_until>clock_timestamp() or r.retry_at>clock_timestamp() then return false; end if;
  update public.cms_change_requests set lease_token=p_lease,lease_until=clock_timestamp()+interval '120 seconds' where id=p_id;
  return true;
end $$;

-- A durable send marker ensures retries never send a second PATCH for this step.
create function public.dispatch_cms_change(p_id uuid,p_cursor integer,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  r:=public.require_change_owner(p_id);
  if p_lease is null or p_cursor is null or r.lease_until is null or r.status<>'confirmed' or r.cursor<>p_cursor or r.lease_token is distinct from p_lease or r.lease_until<=clock_timestamp() or r.dispatched then return false; end if;
  update public.cms_change_requests set dispatched=true where id=p_id;
  insert into public.cms_change_audit(request_id,actor_id,action,step) values(p_id,auth.uid(),'dispatched',p_cursor);
  return true;
end $$;

create function public.finish_cms_change(p_id uuid,p_cursor integer,p_lease uuid,p_result jsonb,p_wait integer default 0) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  r:=public.require_change_owner(p_id);
  if p_lease is null or p_cursor is null then raise exception 'Invalid lease'; end if;
  if r.cursor>p_cursor then return p_id; end if;
  if r.status<>'confirmed' or r.cursor<>p_cursor or r.lease_token is distinct from p_lease then raise exception 'Stale lease'; end if;
  if p_wait is null or p_wait not between 0 and 86400 or p_result is null or jsonb_typeof(p_result)<>'object' or coalesce(p_result->>'status','') not in ('applied','already_applied','conflict','failed','uncertain') then raise exception 'Invalid result'; end if;
  update public.cms_change_requests set results=results||jsonb_build_array(p_result),cursor=cursor+1,dispatched=false,lease_until=null,
    retry_at=case when p_wait>0 then clock_timestamp()+p_wait*interval '1 second' else null end,status=case when cursor+1>=total then 'completed' else 'confirmed' end where id=p_id;
  insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(p_id,auth.uid(),'finished',p_cursor,p_result);
  return p_id;
end $$;

create function public.cancel_cms_changes(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  r:=public.require_change_owner(p_id);
  if r.status in ('completed','cancelled') then return p_id; end if;
  if r.lease_until>clock_timestamp() or r.dispatched then raise exception 'Reconcile active step before cancelling'; end if;
  update public.cms_change_requests set status='cancelled' where id=p_id;
  insert into public.cms_change_audit(request_id,actor_id,action) values(p_id,auth.uid(),'cancelled') on conflict do nothing;
  return p_id;
end $$;

revoke all on function public.preview_cms_changes(uuid,uuid,jsonb),public.confirm_cms_changes(uuid),public.claim_cms_change(uuid,integer,uuid),public.dispatch_cms_change(uuid,integer,uuid),public.finish_cms_change(uuid,integer,uuid,jsonb,integer),public.cancel_cms_changes(uuid) from public,anon;
grant execute on function public.preview_cms_changes(uuid,uuid,jsonb),public.confirm_cms_changes(uuid),public.claim_cms_change(uuid,integer,uuid),public.dispatch_cms_change(uuid,integer,uuid),public.finish_cms_change(uuid,integer,uuid,jsonb,integer),public.cancel_cms_changes(uuid) to authenticated;
commit;
