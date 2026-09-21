begin;
-- OAuth handshake expiry remains 15 minutes. Ready OAuth credentials have no local TTL.
-- New Designer capabilities persist for 30 days; old/expired/revoked ones are not extended.
alter table public.designer_sessions alter column expires_at set default (now()+interval '30 days');
alter table public.webflow_connections drop constraint webflow_connections_status_check;
alter table public.webflow_connections add constraint webflow_connections_status_check check(status in ('pending','exchanging','ready','revoked'));
alter table public.integration_audit_events drop constraint integration_audit_events_action_check;
alter table public.integration_audit_events add constraint integration_audit_events_action_check check(action in ('webflow.authorization_started','webflow.callback_claimed','webflow.authorized','site.previewed','site.connected','webflow.access_revoked'));

create table app_private.webflow_revocations (
 id uuid primary key, workspace_id uuid not null, actor_id uuid not null, connections uuid[] not null
);
revoke all on app_private.webflow_revocations from public,anon,authenticated,service_role;

-- Explicitly confirmed snapshot: a retry never revokes a subsequently added grant.
create function public.revoke_webflow_access(p_id uuid,p_workspace_id uuid,p_connections uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare s record; snapshot app_private.webflow_revocations%rowtype; canonical uuid[];
begin
 if auth.uid() is null or not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Owner required' using errcode='42501'; end if;
 if p_id is null or p_connections is null or cardinality(p_connections)=0 or cardinality(p_connections)>1000 then raise exception 'Invalid snapshot'; end if;
 if exists(select 1 from unnest(p_connections) requested(id) left join public.webflow_connections c on c.id=requested.id where c.id is null or c.workspace_id<>p_workspace_id or c.actor_id<>auth.uid()) then raise exception 'Connection unavailable' using errcode='42501'; end if;
 select array_agg(distinct id order by id) into canonical from unnest(p_connections) listed(id);
 insert into app_private.webflow_revocations values(p_id,p_workspace_id,auth.uid(),canonical) on conflict(id) do nothing;
 select * into snapshot from app_private.webflow_revocations where id=p_id for update;
 if snapshot.workspace_id<>p_workspace_id or snapshot.actor_id<>auth.uid() or snapshot.connections is distinct from canonical then raise exception 'Operation conflict'; end if;
 if exists(select 1 from public.integration_audit_events where operation_id=p_id and action='webflow.access_revoked') then return; end if;
 -- Same lock as CMS confirmation/dispatch; do not strand an in-flight operation.
 for s in select id from public.sites where workspace_id=p_workspace_id order by id loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(s.id::text,0));
 end loop;
 if exists(select 1 from public.cms_change_requests where connection_id=any(p_connections) and status='confirmed') then raise exception 'Site operation in progress'; end if;
 update public.webflow_connections set status='revoked' where id=any(p_connections);
 delete from public.webflow_credentials where connection_id=any(p_connections);
 insert into public.integration_audit_events(workspace_id,actor_id,operation_id,action) values(p_workspace_id,auth.uid(),p_id,'webflow.access_revoked') on conflict(operation_id,action) do nothing;
end $$;
revoke all on function public.revoke_webflow_access(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.revoke_webflow_access(uuid,uuid,uuid[]) to authenticated;

-- Serialize confirmation with revocation and reject saved previews after disconnect.
create function app_private.require_cms_connection() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='preview' and new.status='confirmed' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.site_id::text,0));
  if not exists(select 1 from public.webflow_connections where id=new.connection_id and status='ready') then raise exception 'Connection unavailable'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.require_cms_connection() from public,anon,authenticated,service_role;
create trigger cms_connection_required before update on public.cms_change_requests for each row execute function app_private.require_cms_connection();

create function public.revoke_designer_access(p_site_id uuid,p_sessions uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare item uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=p_site_id and m.user_id=auth.uid() and m.role='owner') then raise exception 'Owner required' using errcode='42501'; end if;
 if p_sessions is null or cardinality(p_sessions)=0 or cardinality(p_sessions)>1000 or exists(select 1 from unnest(p_sessions) requested(id) left join public.designer_sessions s on s.id=requested.id where s.id is null or s.site_id<>p_site_id) then raise exception 'Invalid snapshot'; end if;
 foreach item in array p_sessions loop perform public.revoke_designer_session(item); end loop;
end $$;
revoke all on function public.revoke_designer_access(uuid,uuid[]) from public,anon;
grant execute on function public.revoke_designer_access(uuid,uuid[]) to authenticated;

commit;
