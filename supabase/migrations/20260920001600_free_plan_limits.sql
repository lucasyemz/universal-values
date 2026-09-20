begin;
create schema if not exists app_private;
revoke all on schema app_private from public,anon,authenticated,service_role;
create table app_private.admins (
  user_id uuid primary key references auth.users(id),
  reason text not null check(length(reason)>0), granted_at timestamptz not null default now()
);
create table app_private.admin_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null, action text not null, reason text not null,
  database_actor text not null default session_user, created_at timestamptz not null default now()
);
create function app_private.audit_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then insert into app_private.admin_audit(user_id,action,reason) values(old.user_id,'revoked',old.reason); return old; end if;
  insert into app_private.admin_audit(user_id,action,reason) values(new.user_id,lower(tg_op),new.reason); return new;
end $$;
create trigger admin_audit after insert or update or delete on app_private.admins for each row execute function app_private.audit_admin();
create table app_private.plan_policy (
  singleton boolean primary key default true check(singleton),
  paused boolean not null default false,
  max_accounts integer not null default 100 check(max_accounts>0),
  monthly_scans integer not null default 200 check(monthly_scans>0),
  monthly_fields integer not null default 2000 check(monthly_fields>0),
  storage_bytes bigint not null default 209715200 check(storage_bytes>0)
);
insert into app_private.plan_policy(singleton) values(true);
create table app_private.account_usage (
  user_id uuid primary key references auth.users(id),
  month date not null default date_trunc('month',now() at time zone 'UTC')::date,
  scans integer not null default 0, fields integer not null default 0,
  previews integer not null default 0, reads integer not null default 0,
  minute timestamptz not null default date_trunc('minute',now()),
  requests integer not null default 0
);
create table app_private.quota_events (
  operation_id uuid not null, kind text not null check(kind in ('scan','fields')),
  actor_id uuid not null references auth.users(id), amount integer not null check(amount>0),
  created_at timestamptz not null default now(), primary key(operation_id,kind)
);
create index quota_events_month_idx on app_private.quota_events(created_at,kind);
revoke all on all tables in schema app_private from public,anon,authenticated,service_role;

create function app_private.is_admin(actor uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app_private.admins where user_id=actor)
$$;

-- All free-account admission/reservation transactions serialize on the same lock.
-- Quota counters and the operation itself commit or roll back together.
create function app_private.lock_account(actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare policy app_private.plan_policy%rowtype; month_start date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if app_private.is_admin(actor) then return; end if;
  perform pg_advisory_xact_lock(7319020016);
  select * into policy from app_private.plan_policy where singleton;
  if policy.paused then raise exception 'quota_global_paused'; end if;
  if not exists(select 1 from app_private.account_usage where user_id=actor) and
    (select count(*) from app_private.account_usage where not app_private.is_admin(user_id))>=policy.max_accounts then raise exception 'quota_global_capacity'; end if;
  if (select coalesce(sum(pg_total_relation_size(c.oid)),0) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind in ('r','m')) >= policy.storage_bytes then raise exception 'quota_global_storage'; end if;
  insert into app_private.account_usage(user_id) values(actor) on conflict do nothing;
  update app_private.account_usage set month=month_start,scans=0,fields=0,previews=0,reads=0 where user_id=actor and month<>month_start;
end $$;

create function app_private.reserve_quota(actor uuid,operation uuid,kind text,amount integer) returns void language plpgsql security definer set search_path='' as $$
declare usage app_private.account_usage%rowtype; policy app_private.plan_policy%rowtype; global_used bigint;
begin
  if app_private.is_admin(actor) then return; end if;
  perform app_private.lock_account(actor);
  if exists(select 1 from app_private.quota_events where operation_id=operation and quota_events.kind=reserve_quota.kind) then return; end if;
  select * into usage from app_private.account_usage where user_id=actor;
  select * into policy from app_private.plan_policy where singleton;
  select coalesce(sum(e.amount),0) into global_used from app_private.quota_events e where e.kind=reserve_quota.kind and e.created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  if kind='scan' then
    if usage.scans+amount>5 then raise exception 'quota_scans_month'; end if;
    if global_used+amount>policy.monthly_scans then raise exception 'quota_global_capacity'; end if;
    update app_private.account_usage set scans=scans+amount where user_id=actor;
  elsif kind='fields' then
    if usage.fields+amount>50 then raise exception 'quota_fields_month'; end if;
    if global_used+amount>policy.monthly_fields then raise exception 'quota_global_capacity'; end if;
    update app_private.account_usage set fields=fields+amount where user_id=actor;
  else raise exception 'Invalid quota kind'; end if;
  insert into app_private.quota_events(operation_id,kind,actor_id,amount) values(operation,kind,actor,amount);
end $$;

create function app_private.check_active(actor uuid,operation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if app_private.is_admin(actor) then return; end if;
  perform app_private.lock_account(actor);
  if exists(select 1 from public.cms_scans where actor_id=actor and id<>operation and status in ('running','paused')) or
     exists(select 1 from public.cms_change_requests where actor_id=actor and id<>operation and status='confirmed') then raise exception 'quota_active_operation'; end if;
end $$;

create index scans_active_actor_idx on public.cms_scans(actor_id) where status in ('running','paused');
create index changes_active_actor_idx on public.cms_change_requests(actor_id) where status='confirmed';
alter table public.cms_scans add column item_limit integer not null default 500 check(item_limit in (100,500));
-- Existing scans keep their original snapshot. New previews receive the account limit.
create function app_private.guard_scan() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.item_limit:=case when app_private.is_admin(new.actor_id) then 500 else 100 end;
  else
    new.item_limit:=old.item_limit;
    if old.status='preview' and new.status<>'preview' and new.status<>'cancelled' then
      new.item_limit:=case when app_private.is_admin(new.actor_id) then 500 else 100 end;
      perform app_private.check_active(new.actor_id,new.id);
      perform app_private.reserve_quota(new.actor_id,new.id,'scan',1);
    end if;
    if new.items_read>old.items_read and new.items_read>new.item_limit then raise exception 'quota_scan_items'; end if;
    if new.items_read>=new.item_limit and new.status='running' then new.status:='limited'; new.truncated:=true; new.lease_until:=null; new.retry_at:=null; end if;
  end if;
  return new;
end $$;
create trigger account_scan_limits before insert or update on public.cms_scans for each row execute function app_private.guard_scan();

create function app_private.guard_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='preview' and new.status='confirmed' then
    perform app_private.check_active(new.actor_id,new.id);
    perform app_private.reserve_quota(new.actor_id,new.id,'fields',new.total);
  end if;
  return new;
end $$;
create trigger account_change_limits before update on public.cms_change_requests for each row execute function app_private.guard_change();

alter table public.sites add column quota_owner_id uuid references auth.users(id);
update public.sites s set quota_owner_id=c.actor_id from public.webflow_connections c where c.id=s.connection_id;
alter table public.sites alter column quota_owner_id set not null;
create index sites_quota_owner_idx on public.sites(quota_owner_id);
create function app_private.assign_site_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then new.quota_owner_id:=old.quota_owner_id;
  else select actor_id into new.quota_owner_id from public.webflow_connections where id=new.connection_id; end if;
  return new;
end $$;
create trigger account_site_owner before insert or update on public.sites for each row execute function app_private.assign_site_owner();
-- AFTER INSERT does not charge a reconnection handled by ON CONFLICT UPDATE.
create function app_private.guard_site() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if app_private.is_admin(new.quota_owner_id) then return new; end if;
  perform app_private.lock_account(new.quota_owner_id);
  if (select count(*) from public.sites where quota_owner_id=new.quota_owner_id)>1 then raise exception 'quota_sites'; end if;
  return new;
end $$;
create trigger account_site_limit after insert on public.sites for each row execute function app_private.guard_site();

create function app_private.consume_request(actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if app_private.is_admin(actor) then return; end if;
  perform app_private.lock_account(actor);
  update app_private.account_usage set minute=date_trunc('minute',now()),requests=0 where user_id=actor and minute<>date_trunc('minute',now());
  if (select requests from app_private.account_usage where user_id=actor)>=60 then raise exception 'quota_requests_minute'; end if;
  update app_private.account_usage set requests=requests+1 where user_id=actor;
end $$;
-- Limits draft creation too, preventing repeated previews from filling storage.
create function app_private.guard_preview() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if app_private.is_admin(new.actor_id) then return new; end if;
  perform app_private.consume_request(new.actor_id);
  if (select previews from app_private.account_usage where user_id=new.actor_id)>=200 then raise exception 'quota_previews_month'; end if;
  update app_private.account_usage set previews=previews+1 where user_id=new.actor_id;
  return new;
end $$;
create trigger account_preview_limit after insert on public.cms_scans for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.cms_change_requests for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.workspace_previews for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.site_connection_previews for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.managed_value_previews for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.webflow_connections for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.global_fact_previews for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.designer_sessions for each row execute function app_private.guard_preview();
create trigger account_preview_limit after insert on public.designer_changes for each row execute function app_private.guard_preview();

-- The existing ownership and token checks remain in the original function.
alter function public.read_webflow_credential(uuid) rename to read_webflow_credential_unmetered;
revoke all on function public.read_webflow_credential_unmetered(uuid) from public,anon,authenticated,service_role;
create function public.read_webflow_credential(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare credential text;
begin
  credential:=public.read_webflow_credential_unmetered(p_id);
  perform app_private.consume_request(auth.uid());
  if not app_private.is_admin(auth.uid()) then
    if (select reads from app_private.account_usage where user_id=auth.uid())>=1000 then raise exception 'quota_requests_month'; end if;
    if (select coalesce(sum(reads),0) from app_private.account_usage where month=date_trunc('month',now() at time zone 'UTC')::date and not app_private.is_admin(user_id))>=20000 then raise exception 'quota_global_capacity'; end if;
    update app_private.account_usage set reads=reads+1 where user_id=auth.uid();
  end if;
  return credential;
end $$;
revoke all on function public.read_webflow_credential(uuid) from public,anon;
grant execute on function public.read_webflow_credential(uuid) to authenticated;

create function public.account_plan_usage() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); usage app_private.account_usage%rowtype; admin boolean; current_month date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  admin:=app_private.is_admin(actor);
  select * into usage from app_private.account_usage where user_id=actor and month=current_month;
  return jsonb_build_object('plan',case when admin then 'admin' else 'free' end,
    'sites',(select count(*) from public.sites where quota_owner_id=actor),
    'scans',coalesce(usage.scans,0),'fields',coalesce(usage.fields,0),
    'resetsAt',(current_month+interval '1 month') at time zone 'UTC',
    'paused',(select paused from app_private.plan_policy where singleton));
end $$;
revoke all on function public.account_plan_usage() from public,anon;
grant execute on function public.account_plan_usage() to authenticated;
revoke all on all functions in schema app_private from public,anon,authenticated,service_role;
commit;
