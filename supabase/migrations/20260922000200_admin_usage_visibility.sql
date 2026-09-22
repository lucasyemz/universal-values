begin;
-- Separate metering: never consumes Free reservations or changes admin permissions.
create table app_private.admin_usage (
 user_id uuid references auth.users(id),
 month date not null default date_trunc('month',now() at time zone 'UTC')::date,
 scans bigint not null default 0, fields bigint not null default 0,
 previews bigint not null default 0, reads bigint not null default 0,
 minute timestamptz not null default date_trunc('minute',now()), requests bigint not null default 0,
 primary key(user_id,month)
);
create table app_private.admin_usage_events (
 operation_id uuid, kind text check(kind in ('scan','fields')), primary key(operation_id,kind)
);
create table app_private.usage_tracking (singleton boolean primary key default true check(singleton), started_at timestamptz not null default now());
insert into app_private.usage_tracking default values;
revoke all on app_private.admin_usage,app_private.admin_usage_events,app_private.usage_tracking from public,anon,authenticated,service_role;
create function app_private.record_admin_usage(actor uuid, metric text, amount integer default 1) returns void language plpgsql security definer set search_path='' as $$
begin
 if metric not in ('scan','fields','previews','reads','requests') or amount<1 then raise exception 'Invalid metric'; end if;
 insert into app_private.admin_usage(user_id) values(actor) on conflict do nothing;
 update app_private.admin_usage set
 scans=scans+case when metric='scan' then amount else 0 end,
 fields=fields+case when metric='fields' then amount else 0 end,
 previews=previews+case when metric='previews' then amount else 0 end,
 reads=reads+case when metric='reads' then amount else 0 end,
 requests=case when minute=date_trunc('minute',now()) then requests else 0 end+case when metric='requests' then amount else 0 end,
 minute=date_trunc('minute',now())
 where user_id=actor and month=date_trunc('month',now() at time zone 'UTC')::date;
end $$;
create or replace function app_private.reserve_quota(actor uuid,operation uuid,kind text,amount integer) returns void language plpgsql security definer set search_path='' as $$
declare usage app_private.account_usage%rowtype; policy app_private.plan_policy%rowtype; global_used bigint;
begin
  if app_private.is_admin(actor) then
    insert into app_private.admin_usage_events(operation_id,kind) values(operation,kind) on conflict do nothing;
    if found then perform app_private.record_admin_usage(actor,kind,amount); end if;
    return;
  end if;
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
create or replace function app_private.consume_request(actor uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if app_private.is_admin(actor) then perform app_private.record_admin_usage(actor,'requests'); return; end if;
  perform app_private.lock_account(actor);
  update app_private.account_usage set minute=date_trunc('minute',now()),requests=0 where user_id=actor and minute<>date_trunc('minute',now());
  if (select requests from app_private.account_usage where user_id=actor)>=60 then raise exception 'quota_requests_minute'; end if;
  update app_private.account_usage set requests=requests+1 where user_id=actor;
end $$;
create or replace function app_private.guard_preview() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if app_private.is_admin(new.actor_id) then perform app_private.consume_request(new.actor_id); perform app_private.record_admin_usage(new.actor_id,'previews'); return new; end if;
  perform app_private.consume_request(new.actor_id);
  if (select previews from app_private.account_usage where user_id=new.actor_id)>=200 then raise exception 'quota_previews_month'; end if;
  update app_private.account_usage set previews=previews+1 where user_id=new.actor_id;
  return new;
end $$;
create or replace function public.read_webflow_credential(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare credential text;
begin
  credential:=public.read_webflow_credential_unmetered(p_id);
  perform app_private.consume_request(auth.uid());
  if not app_private.is_admin(auth.uid()) then
    if (select reads from app_private.account_usage where user_id=auth.uid())>=1000 then raise exception 'quota_requests_month'; end if;
    if (select coalesce(sum(reads),0) from app_private.account_usage where month=date_trunc('month',now() at time zone 'UTC')::date and not app_private.is_admin(user_id))>=20000 then raise exception 'quota_global_capacity'; end if;
    update app_private.account_usage set reads=reads+1 where user_id=auth.uid();
  end if;
  if app_private.is_admin(auth.uid()) then perform app_private.record_admin_usage(auth.uid(),'reads'); end if;
  return credential;
end $$;

-- Existing Free counters remain unchanged. Only administrators receive global metrics.
alter function public.account_plan_usage() rename to account_plan_usage_commercial;
revoke all on function public.account_plan_usage_commercial() from public,anon,authenticated,service_role;
create function public.account_plan_usage() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; usage app_private.admin_usage%rowtype; policy app_private.plan_policy%rowtype; actor uuid:=auth.uid();
begin
 result:=public.account_plan_usage_commercial();
 if not app_private.is_admin(actor) then return result; end if;
 select * into usage from app_private.admin_usage where user_id=actor and month=date_trunc('month',now() at time zone 'UTC')::date;
 select * into policy from app_private.plan_policy where singleton;
 return result || jsonb_build_object(
 'scans',(result->>'scans')::bigint+coalesce(usage.scans,0),
 'fields',(result->>'fields')::bigint+coalesce(usage.fields,0),
 'previews',(result->>'previews')::bigint+coalesce(usage.previews,0),
 'reads',(result->>'reads')::bigint+coalesce(usage.reads,0),
 'requests',coalesce((result->>'requests')::bigint,0)+case when usage.minute=date_trunc('minute',now()) then usage.requests else 0 end,
 'trackingSince',(select started_at from app_private.usage_tracking),
 'capacity',jsonb_build_array(
 jsonb_build_object('metric','accounts','used',(select count(*) from app_private.account_usage where not app_private.is_admin(user_id)),'limit',policy.max_accounts),
 jsonb_build_object('metric','scans','used',(select coalesce(sum(amount),0) from app_private.quota_events where kind='scan' and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),'limit',policy.monthly_scans),
 jsonb_build_object('metric','fields','used',(select coalesce(sum(amount),0) from app_private.quota_events where kind='fields' and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),'limit',policy.monthly_fields),
 jsonb_build_object('metric','reads','used',(select coalesce(sum(reads),0) from app_private.account_usage where month=date_trunc('month',now() at time zone 'UTC')::date and not app_private.is_admin(user_id)),'limit',20000),
 jsonb_build_object('metric','storage','used',(select coalesce(sum(pg_total_relation_size(c.oid)),0) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind in ('r','m')),'limit',policy.storage_bytes)
 ));
end $$;
revoke all on function public.account_plan_usage() from public,anon,service_role;
grant execute on function public.account_plan_usage() to authenticated;
revoke all on function app_private.record_admin_usage(uuid,text,integer) from public,anon,authenticated,service_role;
commit;
