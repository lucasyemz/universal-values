begin;
create table app_private.plan_selection (
  user_id uuid primary key references auth.users(id),
  plan text not null check(plan in ('free','admin')),
  updated_at timestamptz not null default now()
);
create table app_private.plan_changes (
  id uuid primary key, user_id uuid not null references auth.users(id),
  previous_plan text not null, plan text not null,
  created_at timestamptz not null default now()
);
revoke all on app_private.plan_selection, app_private.plan_changes from public,anon,authenticated,service_role;
-- Eligibility remains in admins; choosing Free never revokes the right to return.
create or replace function app_private.is_admin(actor uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app_private.admins where user_id=actor)
    and coalesce((select plan from app_private.plan_selection where user_id=actor),'admin')='admin'
$$;
create function public.select_account_plan(p_id uuid,p_plan text,p_expected text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_plan text; previous app_private.plan_changes%rowtype;
begin
  if actor is null or not exists(select 1 from app_private.admins where user_id=actor) then raise exception 'plan_forbidden'; end if;
  if p_id is null or p_plan is null or p_expected is null or p_plan not in ('free','admin') or p_expected not in ('free','admin') then raise exception 'plan_invalid'; end if;
  perform pg_advisory_xact_lock(7319020016);
  select * into previous from app_private.plan_changes where id=p_id;
  if found then
    if previous.user_id<>actor or previous.plan<>p_plan or previous.previous_plan<>p_expected then raise exception 'plan_invalid'; end if;
    return;
  end if;
  current_plan:=case when app_private.is_admin(actor) then 'admin' else 'free' end;
  if current_plan<>p_expected then raise exception 'plan_stale'; end if;
  if p_plan='free' and current_plan<>'free' and (
    exists(select 1 from public.cms_scans where actor_id=actor and status in ('running','paused')) or
    exists(select 1 from public.cms_change_requests where actor_id=actor and status='confirmed')
  ) then raise exception 'plan_active'; end if;
  insert into app_private.plan_selection(user_id,plan) values(actor,p_plan)
    on conflict(user_id) do update set plan=excluded.plan,updated_at=now();
  insert into app_private.plan_changes(id,user_id,previous_plan,plan) values(p_id,actor,current_plan,p_plan);
end $$;
revoke all on function public.select_account_plan(uuid,text,text) from public,anon,service_role;
grant execute on function public.select_account_plan(uuid,text,text) to authenticated;
alter function public.account_plan_usage() rename to account_plan_usage_base;
revoke all on function public.account_plan_usage_base() from public,anon,authenticated,service_role;
create function public.account_plan_usage() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); usage app_private.account_usage%rowtype; result jsonb;
begin
  result:=public.account_plan_usage_base();
  select * into usage from app_private.account_usage where user_id=actor and month=date_trunc('month',now() at time zone 'UTC')::date;
  return result || jsonb_build_object(
    'canSwitch',exists(select 1 from app_private.admins where user_id=actor),
    'previews',coalesce(usage.previews,0),'reads',coalesce(usage.reads,0),
    'requests',case when usage.minute=date_trunc('minute',now()) then usage.requests else 0 end,
    'active',(select count(*) from public.cms_scans where actor_id=actor and status in ('running','paused'))+
             (select count(*) from public.cms_change_requests where actor_id=actor and status='confirmed'));
end $$;
revoke all on function public.account_plan_usage() from public,anon,service_role;
grant execute on function public.account_plan_usage() to authenticated;
commit;
