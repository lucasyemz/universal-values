begin;
-- Only scope FKs are deferrable; normal statements retain immediate checks.
-- A transfer updates this closed graph in one transaction, without deleting history.
do $$ declare r record; begin
 for r in select c.conrelid::regclass tbl,c.conname from pg_constraint c
 where c.contype='f' and c.connamespace='public'::regnamespace
 and c.conrelid in ('public.sites'::regclass,'public.site_connection_previews'::regclass,'public.cms_scans'::regclass,'public.scan_occurrences'::regclass,'public.managed_values'::regclass,'public.managed_value_previews'::regclass,'public.managed_value_bindings'::regclass,'public.reviewed_scan_content'::regclass,'public.cms_change_requests'::regclass)
 and array_length(c.conkey,1)>1
 loop execute format('alter table %s alter constraint %I deferrable initially immediate',r.tbl,r.conname); end loop;
end $$;
create table public.site_transfers (
 id uuid primary key, actor_id uuid not null references auth.users(id), site_id uuid not null references public.sites(id),
 source_workspace uuid not null references public.workspaces(id), target_workspace uuid not null references public.workspaces(id),
 source_connection uuid not null references public.webflow_connections(id), target_connection uuid not null references public.webflow_connections(id),
 site_name text not null, source_name text not null,target_name text not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',confirmed_at timestamptz,
 check(source_workspace<>target_workspace)
);
alter table public.site_transfers enable row level security;
revoke all on public.site_transfers from public,anon,authenticated;
grant select on public.site_transfers to authenticated;
create policy transfer_owner_read on public.site_transfers for select to authenticated using(actor_id=auth.uid() and exists(select 1 from public.workspace_members where workspace_id=source_workspace and user_id=auth.uid() and role='owner') and exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner'));
create function public.preview_site_transfer(p_id uuid,p_site uuid,p_target uuid,p_connection uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.sites%rowtype; old public.site_transfers%rowtype;
begin
 select * into s from public.sites where id=p_site;
 if auth.uid() is null or s.account_id is distinct from auth.uid() or s.workspace_id=p_target or
 not exists(select 1 from public.workspace_members where workspace_id=s.workspace_id and user_id=auth.uid() and role='owner') or
 not exists(select 1 from public.workspace_members where workspace_id=p_target and user_id=auth.uid() and role='owner') or
 not exists(select 1 from public.webflow_connections where id=p_connection and workspace_id=p_target and actor_id=auth.uid() and status='ready')
 then raise exception 'Transfer unavailable'; end if;
 select * into old from public.site_transfers where id=p_id;
 if found then
  if old.actor_id<>auth.uid() or old.site_id<>p_site or old.target_workspace<>p_target or old.target_connection<>p_connection then raise exception 'Transfer conflict'; end if;
  return p_id;
 end if;
 insert into public.site_transfers(id,actor_id,site_id,source_workspace,target_workspace,source_connection,target_connection,site_name,source_name,target_name)
 select p_id,auth.uid(),s.id,s.workspace_id,p_target,s.connection_id,p_connection,s.display_name,a.name,b.name from public.workspaces a,public.workspaces b where a.id=s.workspace_id and b.id=p_target;
 return p_id;
end $$;
create function public.confirm_site_transfer(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.site_transfers%rowtype; s public.sites%rowtype; tbl text;
begin
 select * into p from public.site_transfers where id=p_id for update;
 if auth.uid() is null or p.actor_id is distinct from auth.uid() or
 not exists(select 1 from public.workspace_members where workspace_id=p.source_workspace and user_id=auth.uid() and role='owner') or
 not exists(select 1 from public.workspace_members where workspace_id=p.target_workspace and user_id=auth.uid() and role='owner') then raise exception 'Transfer unavailable'; end if;
 -- Serialize against membership removal during confirmation.
 perform 1 from public.workspace_members where workspace_id in(p.source_workspace,p.target_workspace) and user_id=auth.uid() and role='owner' order by workspace_id for share;
 if (select count(*) from public.workspace_members where workspace_id in(p.source_workspace,p.target_workspace) and user_id=auth.uid() and role='owner')<>2 then raise exception 'Transfer unavailable'; end if;
 if p.confirmed_at is not null then return p.site_id; end if;
 perform pg_advisory_xact_lock(hashtextextended(p.site_id::text,0));
 select * into s from public.sites where id=p.site_id for update;
 if p.expires_at<=clock_timestamp() or p.source_name is distinct from (select name from public.workspaces where id=p.source_workspace) or p.target_name is distinct from (select name from public.workspaces where id=p.target_workspace) or (s.workspace_id,s.connection_id,s.display_name) is distinct from (p.source_workspace,p.source_connection,p.site_name) or s.account_id<>auth.uid() then raise exception 'Transfer changed'; end if;
 perform 1 from public.webflow_connections where id=p.target_connection and workspace_id=p.target_workspace and actor_id=auth.uid() and status='ready' for update;
 if not found then raise exception 'Connection unavailable'; end if;
 -- Hold operation rows as well as the existing site advisory lock.
 perform 1 from public.cms_scans where site_id=s.id for update;
 perform 1 from public.cms_change_requests where site_id=s.id for update;
 if exists(select 1 from public.cms_scans where site_id=s.id and status in ('running','paused')) or
 exists(select 1 from public.cms_change_requests where site_id=s.id and (status='confirmed' or dispatched)) or
 exists(select 1 from public.managed_value_bindings where site_id=s.id and uncertain) then raise exception 'Finish active work before transferring'; end if;
 if exists(select 1 from public.sites where workspace_id=p.target_workspace and webflow_site_id=s.webflow_site_id and id<>s.id) then raise exception 'Site already connected'; end if;
 set constraints all deferred;
 update public.sites set workspace_id=p.target_workspace,connection_id=p.target_connection where id=s.id;
 update public.cms_scans set workspace_id=p.target_workspace,connection_id=p.target_connection,expires_at=least(expires_at,clock_timestamp()) where site_id=s.id;
 update public.cms_change_requests set workspace_id=p.target_workspace,connection_id=p.target_connection,expires_at=least(expires_at,clock_timestamp()) where site_id=s.id;
 foreach tbl in array array['scan_occurrences','managed_values','managed_value_previews','managed_value_bindings','reviewed_scan_content'] loop
  execute format('update public.%I set workspace_id=$1 where site_id=$2',tbl) using p.target_workspace,s.id;
 end loop;
 update public.site_connection_previews set workspace_id=p.target_workspace,connection_id=p.target_connection,expires_at=least(expires_at,clock_timestamp()) where site_id=s.id;
 update public.managed_value_previews set expires_at=least(expires_at,clock_timestamp()) where site_id=s.id;
 update public.scan_review_operations set workspace_id=p.target_workspace where scan_id in (select id from public.cms_scans where site_id=s.id);
 update public.scan_audit_events set workspace_id=p.target_workspace where scan_id in (select id from public.cms_scans where site_id=s.id);
 update public.managed_value_archives set workspace_id=p.target_workspace,expires_at=least(expires_at,clock_timestamp()) where managed_value_id in(select id from public.managed_values where site_id=s.id);
 update public.global_fact_previews set expires_at=least(expires_at,clock_timestamp()) where site_id=s.id;
 update public.designer_changes set expires_at=least(expires_at,clock_timestamp()) where site_id=s.id;
 insert into public.designer_session_audit(session_id,action,actor_id) select id,'revoked',auth.uid() from public.designer_sessions where site_id=s.id and revoked_at is null on conflict do nothing;
 update public.designer_sessions set revoked_at=coalesce(revoked_at,clock_timestamp()) where site_id=s.id;
 update public.site_transfers set confirmed_at=clock_timestamp() where id=p.id;
 set constraints all immediate;
 return s.id;
end $$;
revoke all on function public.preview_site_transfer(uuid,uuid,uuid,uuid),public.confirm_site_transfer(uuid) from public,anon;
grant execute on function public.preview_site_transfer(uuid,uuid,uuid,uuid),public.confirm_site_transfer(uuid) to authenticated;
commit;
