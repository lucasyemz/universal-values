create table public.workspace_routes (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 account_id uuid not null references public.account_routes(user_id),
 slug text not null,
 is_primary boolean not null,
 unique(account_id,slug)
);
create unique index workspace_primary_route on public.workspace_routes(account_id) where is_primary;
alter table public.workspace_routes enable row level security;
revoke all on public.workspace_routes from anon,authenticated;
grant select on public.workspace_routes to authenticated;
create policy workspace_routes_read on public.workspace_routes for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=workspace_routes.workspace_id and m.user_id=(select auth.uid()) and m.role='owner'));
create function app_private.assign_workspace_route() returns trigger language plpgsql security definer set search_path='' as $$
declare base text; candidate text; suffix integer:=1;
begin
 if new.role<>'owner' then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(721965422);
 if exists(select 1 from public.workspace_routes where workspace_id=new.workspace_id) then return new; end if;
 perform app_private.ensure_account_route(new.user_id);
 select app_private.url_name(name,'workspace') into base from public.workspaces where id=new.workspace_id;
 candidate:=base;
 while exists(select 1 from public.workspace_routes where account_id=new.user_id and slug=candidate) loop suffix:=suffix+1;candidate:=base||'-'||suffix;end loop;
 insert into public.workspace_routes(workspace_id,account_id,slug,is_primary) values(new.workspace_id,new.user_id,candidate,not exists(select 1 from public.workspace_routes where account_id=new.user_id and is_primary));
 return new;
end $$;
revoke all on function app_private.assign_workspace_route() from public,anon,authenticated;
create trigger assign_workspace_route after insert or update of role on public.workspace_members for each row execute function app_private.assign_workspace_route();
do $$ declare member record; begin
 for member in select m.workspace_id,m.user_id from public.workspace_members m join public.workspaces w on w.id=m.workspace_id where m.role='owner' order by w.created_at,w.id,m.created_at,m.user_id loop
 update public.workspace_members set role=role where workspace_id=member.workspace_id and user_id=member.user_id;
 end loop;
end $$;
create policy workspace_account_routes_read on public.account_routes for select to authenticated using(exists(select 1 from public.workspace_routes r where r.account_id=account_routes.user_id));
