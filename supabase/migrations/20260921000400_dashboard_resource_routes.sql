begin;
create schema if not exists app_private;
create table app_private.dashboard_route_counters (
  kind text not null, scope_id uuid not null, last_number bigint not null,
  primary key(kind,scope_id)
);
create table public.dashboard_resource_routes (
  kind text not null check(kind in ('scans','operations','managed-values','managed-value-previews','static-changes','fact-previews','site-previews','workspace-previews')),
  resource_id uuid not null, scope_id uuid not null, account_id uuid not null references auth.users(id),
  site_id uuid references public.sites(id), number bigint not null check(number>0),
  primary key(kind,resource_id), unique(kind,scope_id,number)
);
alter table public.dashboard_resource_routes enable row level security;
create policy dashboard_routes_read on public.dashboard_resource_routes for select to authenticated using(
  account_id=(select auth.uid()) or exists(
    select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id
    where s.id=dashboard_resource_routes.site_id and m.user_id=(select auth.uid()) and m.role='owner'
  )
);
revoke all on public.dashboard_resource_routes from public,anon,authenticated;
grant select on public.dashboard_resource_routes to authenticated;
revoke all on app_private.dashboard_route_counters from public,anon,authenticated;

create function app_private.register_dashboard_route(p_kind text,p_row jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_site uuid; v_actor uuid; v_scope uuid; v_number bigint; v_id uuid;
begin
  v_id:=(p_row->>'id')::uuid;
  if exists(select 1 from public.dashboard_resource_routes where kind=p_kind and resource_id=v_id) then return; end if;
  if p_kind not in ('site-previews','workspace-previews') then
    v_site:=(p_row->>'site_id')::uuid;
    select account_id into v_actor from public.sites where id=v_site;
  else
    v_actor:=(p_row->>'actor_id')::uuid;
  end if;
  v_scope:=coalesce(v_site,v_actor);
  insert into app_private.dashboard_route_counters(kind,scope_id,last_number) values(p_kind,v_scope,1)
    on conflict(kind,scope_id) do update set last_number=dashboard_route_counters.last_number+1
    returning last_number into v_number;
  insert into public.dashboard_resource_routes(kind,resource_id,scope_id,account_id,site_id,number)
    values(p_kind,v_id,v_scope,v_actor,v_site,v_number);
end $$;
revoke all on function app_private.register_dashboard_route(text,jsonb) from public,anon,authenticated;
create function app_private.register_dashboard_route_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform app_private.register_dashboard_route(tg_argv[0],to_jsonb(new)); return new; end $$;
revoke all on function app_private.register_dashboard_route_trigger() from public,anon,authenticated;

-- Lock inserts during backfill so existing records receive stable chronological numbers.
lock table public.cms_scans,public.cms_change_requests,public.managed_values,public.managed_value_previews,public.designer_changes,public.global_fact_previews,public.site_connection_previews,public.workspace_previews in share row exclusive mode;
do $$
declare mapping record; item record;
begin
 for mapping in select * from (values
 ('cms_scans','scans'),('cms_change_requests','operations'),('managed_values','managed-values'),
 ('managed_value_previews','managed-value-previews'),('designer_changes','static-changes'),
 ('global_fact_previews','fact-previews'),('site_connection_previews','site-previews'),('workspace_previews','workspace-previews')
 ) as m(table_name,kind) loop
   for item in execute format('select to_jsonb(t) as row from public.%I t order by coalesce(to_jsonb(t)->>''created_at'',to_jsonb(t)->>''expires_at''),id',mapping.table_name) loop
     perform app_private.register_dashboard_route(mapping.kind,item.row);
   end loop;
   execute format('create trigger dashboard_resource_number after insert on public.%I for each row execute function app_private.register_dashboard_route_trigger(%L)',mapping.table_name,mapping.kind);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
