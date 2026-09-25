-- Local workspace metadata only. The allocator and edit confirmation share the
-- existing namespace lock; old slugs remain reserved within the same account.
create table public.workspace_route_aliases (
 account_id uuid not null references public.account_routes(user_id),
 slug text not null,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 primary key(account_id,slug)
);
create table public.workspace_edit_previews (
 id uuid primary key,
 actor_id uuid not null references auth.users(id),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 before_name text not null, before_slug text not null,
 name text not null, slug text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes',
 confirmed_at timestamptz
);
create table public.workspace_edit_audit (
 preview_id uuid not null references public.workspace_edit_previews(id),
 action text not null check(action in ('previewed','confirmed')),
 created_at timestamptz not null default now(),
 primary key(preview_id,action)
);
alter table public.workspace_edit_audit enable row level security;
revoke all on public.workspace_edit_audit from anon,authenticated;
grant select on public.workspace_edit_audit to authenticated;
create policy workspace_edit_audit_read on public.workspace_edit_audit for select to authenticated using(exists(select 1 from public.workspace_edit_previews p where p.id=workspace_edit_audit.preview_id));
alter table public.workspace_route_aliases enable row level security;
alter table public.workspace_edit_previews enable row level security;
revoke all on public.workspace_route_aliases,public.workspace_edit_previews from anon,authenticated;
grant select on public.workspace_route_aliases,public.workspace_edit_previews to authenticated;
create policy workspace_alias_read on public.workspace_route_aliases for select to authenticated using(account_id=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.workspace_id=workspace_route_aliases.workspace_id and m.user_id=(select auth.uid()) and m.role='owner'));
create policy workspace_edit_read on public.workspace_edit_previews for select to authenticated using(actor_id=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.workspace_id=workspace_edit_previews.workspace_id and m.user_id=(select auth.uid()) and m.role='owner'));

create or replace function app_private.assign_workspace_route() returns trigger language plpgsql security definer set search_path='' as $$
declare base text; candidate text; suffix integer:=1;
begin
 if new.role<>'owner' then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(721965422);
 if exists(select 1 from public.workspace_routes where workspace_id=new.workspace_id) then return new; end if;
 perform app_private.ensure_account_route(new.user_id);
 select app_private.url_name(name,'workspace') into base from public.workspaces where id=new.workspace_id;
 candidate:=base;
 while exists(select 1 from public.workspace_routes where account_id=new.user_id and slug=candidate)
 or exists(select 1 from public.workspace_route_aliases where account_id=new.user_id and slug=candidate)
 loop suffix:=suffix+1;candidate:=base||'-'||suffix;end loop;
 insert into public.workspace_routes(workspace_id,account_id,slug,is_primary) values(new.workspace_id,new.user_id,candidate,not exists(select 1 from public.workspace_routes where account_id=new.user_id and is_primary));
 return new;
end $$;

create function public.preview_workspace_edit(p_id uuid,p_workspace uuid,p_name text,p_slug text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_name text:=btrim(p_name); v_old_name text; v_old_slug text; v_preview public.workspace_edit_previews%rowtype;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_id is null or v_name is null or char_length(v_name) not between 2 and 80 or v_name~'[[:cntrl:]]'
 or p_slug is null or char_length(p_slug) not between 1 and 80 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 or p_slug in ('sites','settings','workspaces','plan','api') then raise exception 'INVALID_WORKSPACE'; end if;
 select w.name,r.slug into v_old_name,v_old_slug from public.workspaces w join public.workspace_routes r on r.workspace_id=w.id
 join public.workspace_members m on m.workspace_id=w.id and m.user_id=v_actor and m.role='owner'
 where w.id=p_workspace and r.account_id=v_actor;
 if not found then raise exception 'WORKSPACE_UNAVAILABLE'; end if;
 if exists(select 1 from public.workspace_routes where account_id=v_actor and slug=p_slug and workspace_id<>p_workspace)
 or exists(select 1 from public.workspace_route_aliases where account_id=v_actor and slug=p_slug and workspace_id<>p_workspace)
 then raise exception 'WORKSPACE_SLUG_TAKEN'; end if;
 insert into public.workspace_edit_previews(id,actor_id,workspace_id,before_name,before_slug,name,slug)
 values(p_id,v_actor,p_workspace,v_old_name,v_old_slug,v_name,p_slug) on conflict(id) do nothing;
 select * into v_preview from public.workspace_edit_previews where id=p_id;
 if v_preview.actor_id<>v_actor or v_preview.workspace_id<>p_workspace or v_preview.name<>v_name or v_preview.slug<>p_slug then raise exception 'PREVIEW_CONFLICT'; end if;
 insert into public.workspace_edit_audit(preview_id,action) values(p_id,'previewed') on conflict do nothing;
 return jsonb_build_object('id',v_preview.id,'beforeName',v_preview.before_name,'beforeSlug',v_preview.before_slug,'name',v_preview.name,'slug',v_preview.slug);
end $$;

create function public.confirm_workspace_edit(p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); p public.workspace_edit_previews%rowtype; v_name text; v_slug text;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(721965422);
 select * into p from public.workspace_edit_previews where id=p_id for update;
 if not found or p.actor_id<>v_actor then raise exception 'WORKSPACE_UNAVAILABLE'; end if;
 -- Lock membership through commit so a concurrent revocation cannot slip through.
 perform 1 from public.workspace_members where workspace_id=p.workspace_id and user_id=v_actor and role='owner' for share;
 if not found then raise exception 'WORKSPACE_UNAVAILABLE'; end if;
 select w.name,r.slug into v_name,v_slug from public.workspaces w join public.workspace_routes r on r.workspace_id=w.id
 where w.id=p.workspace_id and r.account_id=v_actor for update of w,r;
 if not found then raise exception 'WORKSPACE_UNAVAILABLE'; end if;
 if p.confirmed_at is not null then return p.workspace_id; end if;
 if p.expires_at<=clock_timestamp() or v_name<>p.before_name or v_slug<>p.before_slug then raise exception 'WORKSPACE_EDIT_STALE'; end if;
 if exists(select 1 from public.workspace_routes where account_id=v_actor and slug=p.slug and workspace_id<>p.workspace_id)
 or exists(select 1 from public.workspace_route_aliases where account_id=v_actor and slug=p.slug and workspace_id<>p.workspace_id)
 then raise exception 'WORKSPACE_SLUG_TAKEN'; end if;
 if p.slug<>v_slug then
 insert into public.workspace_route_aliases(account_id,slug,workspace_id) values(v_actor,v_slug,p.workspace_id) on conflict(account_id,slug) do nothing;
 end if;
 update public.workspaces set name=p.name where id=p.workspace_id;
 update public.workspace_routes set slug=p.slug where workspace_id=p.workspace_id;
 update public.workspace_edit_previews set confirmed_at=now() where id=p.id;
 insert into public.workspace_edit_audit(preview_id,action) values(p.id,'confirmed');
 return p.workspace_id;
end $$;

-- Narrow counts use current site membership (including transferred sites), never
-- occurrence snapshots, plans or bindings. Invoker RLS remains authoritative.
create function public.workspace_overview_counts() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',w.workspace_id,
 'sites',(select count(*) from public.sites s where s.workspace_id=w.workspace_id and s.account_id=auth.uid()),
 'scans',(select count(*) from public.cms_scans c join public.sites s on s.id=c.site_id where s.workspace_id=w.workspace_id and s.account_id=auth.uid()),
 'variables',(select count(*) from public.managed_values v join public.sites s on s.id=v.site_id where s.workspace_id=w.workspace_id and s.account_id=auth.uid() and v.archived_at is null))), '[]'::jsonb)
 from public.workspace_routes w where w.account_id=auth.uid();
$$;
revoke all on function public.preview_workspace_edit(uuid,uuid,text,text),public.confirm_workspace_edit(uuid),public.workspace_overview_counts() from public,anon;
grant execute on function public.preview_workspace_edit(uuid,uuid,text,text),public.confirm_workspace_edit(uuid),public.workspace_overview_counts() to authenticated;
