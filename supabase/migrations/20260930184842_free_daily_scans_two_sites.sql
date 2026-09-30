begin;
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
    if (select coalesce(sum(quota_events.amount),0) from app_private.quota_events where actor_id=actor and quota_events.kind='scan' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')+amount>5 then raise exception 'quota_scans_day'; end if;
    if global_used+amount>policy.monthly_scans then raise exception 'quota_global_capacity'; end if;
    update app_private.account_usage set scans=scans+amount where user_id=actor;
  elsif kind='fields' then
    if global_used+amount>policy.monthly_fields then raise exception 'quota_global_capacity'; end if;
    update app_private.account_usage set fields=fields+amount where user_id=actor;
  else raise exception 'Invalid quota kind'; end if;
  insert into app_private.quota_events(operation_id,kind,actor_id,amount) values(operation,kind,actor,amount);
end $$;
create or replace function app_private.guard_site() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if app_private.is_admin(new.quota_owner_id) then return new; end if;
  perform app_private.lock_account(new.quota_owner_id);
  if (select count(*) from public.sites where quota_owner_id=new.quota_owner_id)>2 then raise exception 'quota_sites'; end if;
  return new;
end $$;

-- Preserve monthly totals/contracts; expose a separate daily counter for Free.
alter function public.account_plan_usage() rename to account_plan_usage_monthly;
revoke all on function public.account_plan_usage_monthly() from public,anon,authenticated,service_role;
create function public.account_plan_usage() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; actor uuid:=auth.uid();
begin
 result:=public.account_plan_usage_monthly();
 return result || jsonb_build_object('scansToday',(select coalesce(sum(amount),0) from app_private.quota_events where actor_id=actor and kind='scan' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'scansResetAt',(date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC');
end $$;
revoke all on function public.account_plan_usage() from public,anon,service_role;
grant execute on function public.account_plan_usage() to authenticated;
commit;
