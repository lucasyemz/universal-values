begin;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);
create table public.workspace_previews (
  id uuid primary key,
  actor_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 2 and 80 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  workspace_id uuid unique references public.workspaces(id),
  confirmed_at timestamptz,
  check ((workspace_id is null) = (confirmed_at is null))
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  workspace_id uuid references public.workspaces(id),
  preview_id uuid not null references public.workspace_previews(id),
  action text not null check (action in ('workspace.previewed', 'workspace.created')),
  created_at timestamptz not null default now(),
  unique (preview_id, action)
);
create index workspace_previews_actor_idx on public.workspace_previews(actor_id);
create index audit_events_workspace_idx on public.audit_events(workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_previews enable row level security;
alter table public.audit_events enable row level security;

-- Membership rows expose only the authenticated user's own memberships.
-- This avoids recursive policies and does not expose other tenants' users.
create policy memberships_read on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy workspaces_read on public.workspaces for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = (select auth.uid())));
create policy previews_read on public.workspace_previews for select to authenticated
  using (actor_id = (select auth.uid()));
create policy audit_read on public.audit_events for select to authenticated
  using (
    (workspace_id is null and actor_id = (select auth.uid()))
    or exists (select 1 from public.workspace_members m where m.workspace_id = audit_events.workspace_id and m.user_id = (select auth.uid()))
  );

revoke all on public.workspaces, public.workspace_members, public.workspace_previews, public.audit_events from anon, authenticated;
grant select on public.workspaces, public.workspace_members, public.workspace_previews, public.audit_events to authenticated;

create function public.preview_workspace(p_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := btrim(p_name);
  v_preview public.workspace_previews%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_id is null or v_name is null or char_length(v_name) not between 2 and 80 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Invalid preview input' using errcode = '22023';
  end if;
  -- A repeated request with the same key may only return the same immutable payload.
  insert into public.workspace_previews(id, actor_id, name)
    values (p_id, v_actor, v_name) on conflict (id) do nothing;
  select * into v_preview from public.workspace_previews where id = p_id for update;
  if v_preview.actor_id <> v_actor or v_preview.name <> v_name then
    raise exception 'Preview key conflict' using errcode = '22023';
  end if;
  insert into public.audit_events(actor_id, preview_id, action)
    values (v_actor, p_id, 'workspace.previewed') on conflict (preview_id, action) do nothing;
  return p_id;
end;
$$;

create function public.confirm_workspace(p_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_preview public.workspace_previews%rowtype;
  v_workspace uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_preview from public.workspace_previews where id = p_id for update;
  if not found or v_preview.actor_id <> v_actor then
    raise exception 'Preview unavailable' using errcode = '22023';
  end if;
  -- Locking serializes retries. Return the committed result even after expiry.
  if v_preview.workspace_id is not null then return v_preview.workspace_id; end if;
  if v_preview.expires_at <= clock_timestamp() then
    raise exception 'Preview expired' using errcode = '22023';
  end if;
  insert into public.workspaces(name) values (v_preview.name) returning id into v_workspace;
  insert into public.workspace_members(workspace_id, user_id, role) values (v_workspace, v_actor, 'owner');
  update public.workspace_previews set workspace_id = v_workspace, confirmed_at = now() where id = p_id;
  insert into public.audit_events(actor_id, workspace_id, preview_id, action)
    values (v_actor, v_workspace, p_id, 'workspace.created');
  return v_workspace;
end;
$$;
revoke all on function public.preview_workspace(uuid, text) from public, anon;
revoke all on function public.confirm_workspace(uuid) from public, anon;
grant execute on function public.preview_workspace(uuid, text) to authenticated;
grant execute on function public.confirm_workspace(uuid) to authenticated;

commit;
