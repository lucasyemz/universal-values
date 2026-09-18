begin;

alter table public.managed_value_bindings add column canonical jsonb;
alter table public.managed_value_bindings add column uncertain boolean not null default false;
alter table public.managed_value_bindings add column last_synced_at timestamptz;
update public.managed_value_bindings b set canonical=v.canonical from public.managed_values v where v.id=b.managed_value_id;
alter table public.managed_value_bindings alter column canonical set not null;
alter table public.managed_value_bindings add constraint binding_canonical_valid check(public.valid_managed_canonical(canonical));
create function public.initialize_binding_canonical() returns trigger language plpgsql security definer set search_path='' as $$
begin
  select canonical into new.canonical from public.managed_values where id=new.managed_value_id;
  return new;
end $$;
create trigger initialize_binding_canonical before insert on public.managed_value_bindings for each row execute function public.initialize_binding_canonical();
revoke all on function public.initialize_binding_canonical() from public,anon,authenticated;

alter table public.cms_change_requests alter column scan_id drop not null;
alter table public.cms_change_requests add column managed_value_id uuid;
alter table public.cms_change_requests add column managed_version integer;
alter table public.cms_change_requests add column managed_after jsonb;
alter table public.cms_change_requests add column managed_before jsonb;
alter table public.cms_change_requests add column managed_snapshot jsonb;
alter table public.cms_change_requests add foreign key(managed_value_id,site_id,workspace_id) references public.managed_values(id,site_id,workspace_id);
alter table public.cms_change_requests add constraint managed_change_shape check (
  (managed_value_id is null and scan_id is not null and managed_version is null and managed_after is null and managed_before is null and managed_snapshot is null)
  or (managed_value_id is not null and scan_id is null and reverts_request_id is null and managed_version is not null and managed_version>0
    and managed_before is not null and public.valid_managed_canonical(managed_before)
    and managed_after is not null and public.valid_managed_canonical(managed_after)
    and managed_snapshot is not null and jsonb_typeof(managed_snapshot)='array' and jsonb_array_length(managed_snapshot)=total)
);
create index cms_changes_managed_value on public.cms_change_requests(managed_value_id,created_at desc) where managed_value_id is not null;

create function public.preview_managed_value_sync(p_id uuid,p_value_id uuid,p_version integer,p_after jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.managed_values%rowtype; t public.sites%rowtype; r public.cms_change_requests%rowtype; snapshot jsonb; n integer;
begin
  select * into v from public.managed_values where id=p_value_id for update;
  if not found or auth.uid() is null or not exists(select 1 from public.workspace_members where workspace_id=v.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Value unavailable' using errcode='42501'; end if;
  if p_id is null or p_version is null or p_after is null or not public.valid_managed_canonical(p_after) or p_after->>'type' is distinct from v.canonical->>'type'
    or (v.canonical->>'type'='money' and p_after->>'currency' is distinct from v.canonical->>'currency') then raise exception 'Invalid target'; end if;
  select * into r from public.cms_change_requests where id=p_id;
  if found then
    if r.actor_id<>auth.uid() or r.managed_value_id is distinct from p_value_id or r.managed_version is distinct from p_version or r.managed_after is distinct from p_after then raise exception 'Operation key conflict'; end if;
    return p_id;
  end if;
  if v.version<>p_version then raise exception 'Value version conflict' using errcode='40001'; end if;
  if exists(select 1 from public.cms_change_requests where site_id=v.site_id and status='confirmed') then raise exception 'Site sync in progress'; end if;
  if exists(select 1 from public.cms_change_requests where managed_value_id=v.id and retry_at>clock_timestamp()) then raise exception 'Provider cooldown'; end if;
  select * into t from public.sites where id=v.site_id;
  if not exists(select 1 from public.webflow_connections where id=t.connection_id and actor_id=auth.uid() and status='ready') then raise exception 'Connection unavailable'; end if;
  select jsonb_agg(to_jsonb(b) order by b.source_key collate "C"),count(*) into snapshot,n from public.managed_value_bindings b where managed_value_id=v.id;
  if n not between 1 and 1000 or (select sum(jsonb_array_length(e->'locations')) from jsonb_array_elements(snapshot) e)>1000 then raise exception 'Binding limit'; end if;
  insert into public.cms_change_requests(id,site_id,workspace_id,actor_id,connection_id,changes,total,managed_value_id,managed_version,managed_after,managed_before,managed_snapshot)
    values(p_id,v.site_id,v.workspace_id,auth.uid(),t.connection_id,'[]',n,v.id,v.version,p_after,v.canonical,snapshot);
  insert into public.cms_change_audit(request_id,actor_id,action,detail) values(p_id,auth.uid(),'previewed',jsonb_build_object('managed_value_id',v.id,'before',v.canonical,'after',p_after,'version',v.version));
  return p_id;
end $$;

-- Hook into the existing confirmed/lease/dispatch/result pipeline. The update of
-- each binding and the step audit commit together; all DML is RPC-only.
create function public.apply_managed_sync_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare v public.managed_values%rowtype; snapshot jsonb; b jsonb; result jsonb; loc jsonb; source text; previous_end integer:=0; status text;
begin
  if new.managed_value_id is null then return new; end if;
  select * into v from public.managed_values where id=new.managed_value_id for update;
  if new.status='confirmed' and old.status='preview' then
    if v.version<>new.managed_version then raise exception 'Value version conflict' using errcode='40001'; end if;
    select jsonb_agg(to_jsonb(x) order by x.source_key collate "C") into snapshot from public.managed_value_bindings x where managed_value_id=v.id;
    if snapshot is distinct from new.managed_snapshot then raise exception 'Bindings changed'; end if;
    if v.canonical<>new.managed_after then
      update public.managed_values set canonical=new.managed_after,version=version+1 where id=v.id;
    end if;
  end if;
  b:=old.managed_snapshot->old.cursor;
  if new.dispatched and not old.dispatched then
    if (b->>'uncertain')::boolean then raise exception 'Uncertain binding cannot be dispatched'; end if;
    update public.managed_value_bindings set uncertain=true where id=(b->>'id')::uuid and managed_value_id=v.id;
  end if;
  if new.cursor<>old.cursor then
    if new.cursor<>old.cursor+1 or jsonb_array_length(new.results)<>new.cursor then raise exception 'Invalid sync result'; end if;
    result:=new.results->old.cursor; status:=result->>'status';
    if result->>'sourceKey' is distinct from b->>'source_key' then raise exception 'Wrong binding result'; end if;
    if status='applied' and not old.dispatched then raise exception 'Dispatch required'; end if;
    if status in ('applied','already_applied') then
      source:=result->>'bindingSource';
      if jsonb_typeof(result->'bindingSource') is distinct from 'string' or char_length(source)>20000 or jsonb_typeof(result->'bindingLocations') is distinct from 'array' then raise exception 'Invalid binding result'; end if;
      if jsonb_array_length(result->'bindingLocations')<>jsonb_array_length(b->'locations') then raise exception 'Invalid binding locations'; end if;
      if b->>'field_type' in ('Number','Image','ImageRef','MultiImage') then
        if source::jsonb is distinct from result->'actual' then raise exception 'Result differs from binding'; end if;
      elsif to_jsonb(source) is distinct from result->'actual' then raise exception 'Result differs from binding'; end if;
      for loc in select value from jsonb_array_elements(result->'bindingLocations') loop
        if jsonb_typeof(loc->'start') is distinct from 'number' or jsonb_typeof(loc->'end') is distinct from 'number' or jsonb_typeof(loc->'raw') is distinct from 'string'
          or (loc->>'start')::integer<previous_end or (loc->>'end')::integer<=(loc->>'start')::integer
          or (loc->>'end')::integer>char_length(source)
          or substring(source from (loc->>'start')::integer+1 for (loc->>'end')::integer-(loc->>'start')::integer) is distinct from loc->>'raw' then raise exception 'Invalid binding location'; end if;
        previous_end:=(loc->>'end')::integer;
      end loop;
      update public.managed_value_bindings set source_value=source,locations=result->'bindingLocations',canonical=new.managed_after,uncertain=false,last_synced_at=clock_timestamp()
        where id=(b->>'id')::uuid and managed_value_id=v.id;
    else
      update public.managed_value_bindings set uncertain=(status='uncertain' or (b->>'uncertain')::boolean) where id=(b->>'id')::uuid and managed_value_id=v.id;
    end if;
  end if;
  return new;
end $$;
create trigger managed_sync_state before update on public.cms_change_requests for each row execute function public.apply_managed_sync_state();
revoke all on function public.apply_managed_sync_state() from public,anon,authenticated;
revoke all on function public.preview_managed_value_sync(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.preview_managed_value_sync(uuid,uuid,integer,jsonb) to authenticated;
commit;
