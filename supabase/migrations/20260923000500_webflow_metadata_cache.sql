begin;
alter table public.sites add column metadata_generation uuid not null default gen_random_uuid();
create table public.webflow_metadata_cache (
 site_id uuid not null references public.sites(id) on delete cascade,workspace_id uuid not null,actor_id uuid not null,
 connection_id uuid not null,generation uuid not null,kind text not null check(kind in ('site','collections','schema')),
 collection_id text not null default '',data jsonb,fetched_at timestamptz,error text check(error in ('denied','rate_limit','unavailable')),
 retry_at timestamptz,lease uuid,lease_until timestamptz,
 primary key(site_id,kind,collection_id),
 check((kind='schema' and collection_id ~ '^[a-fA-F0-9]{24}$') or (kind<>'schema' and collection_id=''))
);
alter table public.webflow_metadata_cache enable row level security;
revoke all on public.webflow_metadata_cache from public,anon,authenticated;
create table public.webflow_metadata_audit (
 id bigint generated always as identity primary key,site_id uuid not null,actor_id uuid not null,
 kind text not null,status text not null,created_at timestamptz not null default now()
);
alter table public.webflow_metadata_audit enable row level security;
revoke all on public.webflow_metadata_audit from public,anon,authenticated;
create function public.invalidate_webflow_metadata() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='sites' then
  if (new.connection_id,new.workspace_id,new.webflow_site_id) is distinct from (old.connection_id,old.workspace_id,old.webflow_site_id) then
   new.metadata_generation:=gen_random_uuid(); delete from public.webflow_metadata_cache where site_id=old.id;
  end if; return new;
 elsif tg_table_name='webflow_connections' then
  if (new.status,new.actor_id,new.workspace_id) is distinct from (old.status,old.actor_id,old.workspace_id) then
   update public.sites set metadata_generation=gen_random_uuid() where connection_id=new.id;
   delete from public.webflow_metadata_cache where connection_id=new.id;
  end if; return new;
 else
  update public.sites set metadata_generation=gen_random_uuid() where connection_id=coalesce(new.connection_id,old.connection_id);
  delete from public.webflow_metadata_cache where connection_id=coalesce(new.connection_id,old.connection_id);
  return coalesce(new,old);
 end if;
end $$;
create trigger invalidate_site_metadata before update of connection_id,workspace_id,webflow_site_id on public.sites for each row execute function public.invalidate_webflow_metadata();
create trigger invalidate_connection_metadata after update on public.webflow_connections for each row execute function public.invalidate_webflow_metadata();
create trigger invalidate_credential_metadata after insert or update or delete on public.webflow_credentials for each row execute function public.invalidate_webflow_metadata();
revoke all on function public.invalidate_webflow_metadata() from public,anon,authenticated;

-- Cache payloads are display/detection hints only. They are NOT proof of provider authorization.
create function public.webflow_metadata(p_site uuid,p_action text default 'read',p_kind text default 'site',p_collection text default '',p_generation uuid default null,p_lease uuid default null,p_data jsonb default null,p_error text default null,p_retry integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites%rowtype;c public.webflow_connections%rowtype;r public.webflow_metadata_cache%rowtype;scope jsonb;
begin
 select * into s from public.sites where id=p_site;
 if not found or auth.uid() is null or not exists(select 1 from public.workspace_members where workspace_id=s.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Site unavailable' using errcode='42501'; end if;
 select * into c from public.webflow_connections where id=s.connection_id;
 if not found or c.actor_id<>auth.uid() or c.workspace_id<>s.workspace_id then raise exception 'Connection unavailable' using errcode='42501'; end if;
 if p_action not in ('read','claim','finish') or p_kind not in ('site','collections','schema') or not ((p_kind='schema' and p_collection ~ '^[a-fA-F0-9]{24}$') or(p_kind<>'schema' and p_collection='')) then raise exception 'Invalid cache scope'; end if;
 scope:=jsonb_build_object('site',jsonb_build_object('id',s.id,'workspace_id',s.workspace_id,'connection_id',s.connection_id,'webflow_site_id',s.webflow_site_id,'display_name',s.display_name),'actorId',auth.uid(),'generation',s.metadata_generation);
 if c.status<>'ready' then return scope||jsonb_build_object('status','denied','entry',null); end if;
 if p_action='read' then
  select * into r from public.webflow_metadata_cache where site_id=s.id and kind=p_kind and collection_id=p_collection and actor_id=auth.uid() and workspace_id=s.workspace_id and connection_id=c.id and generation=s.metadata_generation;
  return scope||jsonb_build_object('status','ready','entry',case when found then jsonb_build_object('data',r.data,'fetchedAt',r.fetched_at,'error',r.error,'retryAt',r.retry_at) else null end);
 end if;
 -- Serialize invalidation against claim/save without holding a lock over provider IO.
 perform 1 from public.sites where id=s.id and metadata_generation=p_generation for update;
 if not found then raise exception 'Metadata scope changed'; end if;
 if p_lease is null then raise exception 'Missing lease'; end if;
 if p_action='claim' then
  insert into public.webflow_metadata_cache(site_id,workspace_id,actor_id,connection_id,generation,kind,collection_id) values(s.id,s.workspace_id,auth.uid(),c.id,s.metadata_generation,p_kind,p_collection) on conflict do nothing;
  select * into r from public.webflow_metadata_cache where site_id=s.id and kind=p_kind and collection_id=p_collection for update;
  if r.retry_at>clock_timestamp() then return scope||jsonb_build_object('status','cooldown','retryAt',r.retry_at); end if;
  if r.lease_until>clock_timestamp() then return scope||jsonb_build_object('status','busy'); end if;
  -- Explicit collection refresh discards schemas and their in-flight leases.
  if p_kind='collections' then delete from public.webflow_metadata_cache where site_id=s.id and kind='schema'; end if;
  update public.webflow_metadata_cache set lease=p_lease,lease_until=clock_timestamp()+interval '90 seconds' where site_id=s.id and kind=p_kind and collection_id=p_collection;
  return scope||jsonb_build_object('status','claimed');
 end if;
 if p_error is not null and p_error not in ('denied','rate_limit','unavailable') then raise exception 'Invalid result'; end if;
 if p_error is null and (p_data is null or octet_length(p_data::text)>1048576) then raise exception 'Invalid metadata'; end if;
 update public.webflow_metadata_cache set data=case when p_error is null then p_data else data end,fetched_at=case when p_error is null then clock_timestamp() else fetched_at end,error=p_error,
 retry_at=case when p_error='rate_limit' then clock_timestamp()+least(86400,greatest(5,coalesce(p_retry,60)))*interval '1 second' end,lease=null,lease_until=null
 where site_id=s.id and kind=p_kind and collection_id=p_collection and generation=p_generation and lease=p_lease and lease_until>clock_timestamp();
 if not found then raise exception 'Refresh lease expired'; end if;
 if p_error is null then
  insert into public.webflow_metadata_cache(site_id,workspace_id,actor_id,connection_id,generation,kind,collection_id,data,fetched_at)
  values(s.id,s.workspace_id,auth.uid(),c.id,s.metadata_generation,'site','',jsonb_build_object('site',p_data->'site'),clock_timestamp())
  on conflict(site_id,kind,collection_id) do update set data=excluded.data,fetched_at=excluded.fetched_at,error=null,retry_at=null;
  if p_kind='schema' then
   insert into public.webflow_metadata_cache(site_id,workspace_id,actor_id,connection_id,generation,kind,collection_id,data,fetched_at)
   values(s.id,s.workspace_id,auth.uid(),c.id,s.metadata_generation,'collections','',p_data-'details',clock_timestamp())
   on conflict(site_id,kind,collection_id) do update set data=excluded.data,fetched_at=excluded.fetched_at,error=null,retry_at=null;
  end if;
 end if;
 if p_error='denied' then update public.webflow_metadata_cache set data=null,fetched_at=null,error='denied' where site_id=s.id; end if;
 insert into public.webflow_metadata_audit(site_id,actor_id,kind,status) values(s.id,auth.uid(),p_kind,coalesce(p_error,'refreshed'));
 return scope||jsonb_build_object('status',coalesce(p_error,'saved'));
end $$;
revoke all on function public.webflow_metadata(uuid,text,text,text,uuid,uuid,jsonb,text,integer) from public,anon;
grant execute on function public.webflow_metadata(uuid,text,text,text,uuid,uuid,jsonb,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
