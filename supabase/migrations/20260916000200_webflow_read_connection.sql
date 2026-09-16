begin;

create table public.webflow_connections (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  actor_id uuid not null references auth.users(id),
  state_hash text not null check (state_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'exchanging', 'ready')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  unique (id, workspace_id)
);
create table public.webflow_credentials (
  connection_id uuid primary key references public.webflow_connections(id),
  ciphertext text not null check (char_length(ciphertext) between 64 and 20000)
);
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  connection_id uuid not null,
  webflow_site_id text not null check (webflow_site_id ~ '^[0-9a-fA-F]{24}$'),
  display_name text not null check (char_length(display_name) between 1 and 255),
  created_at timestamptz not null default now(),
  foreign key (connection_id, workspace_id) references public.webflow_connections(id, workspace_id),
  unique (workspace_id, webflow_site_id),
  unique (id, workspace_id)
);
create table public.site_connection_previews (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  connection_id uuid not null,
  actor_id uuid not null references auth.users(id),
  webflow_site_id text not null check (webflow_site_id ~ '^[0-9a-fA-F]{24}$'),
  display_name text not null check (char_length(display_name) between 1 and 255),
  expires_at timestamptz not null default now() + interval '15 minutes',
  site_id uuid,
  expected_connection_id uuid,
  foreign key (connection_id, workspace_id) references public.webflow_connections(id, workspace_id),
  foreign key (site_id, workspace_id) references public.sites(id, workspace_id)
);
create table public.integration_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  actor_id uuid not null references auth.users(id),
  operation_id uuid not null,
  action text not null check (action in ('webflow.authorization_started', 'webflow.callback_claimed', 'webflow.authorized', 'site.previewed', 'site.connected')),
  created_at timestamptz not null default now(),
  unique (operation_id, action)
);
create index webflow_connections_workspace_idx on public.webflow_connections(workspace_id);
create index site_previews_actor_idx on public.site_connection_previews(actor_id);
create index integration_audit_workspace_idx on public.integration_audit_events(workspace_id);

alter table public.webflow_connections enable row level security;
alter table public.webflow_credentials enable row level security;
alter table public.sites enable row level security;
alter table public.site_connection_previews enable row level security;
alter table public.integration_audit_events enable row level security;

create policy connections_read on public.webflow_connections for select to authenticated
  using (actor_id = (select auth.uid()) and exists (
    select 1 from public.workspace_members m where m.workspace_id = webflow_connections.workspace_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));
create policy sites_read on public.sites for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = sites.workspace_id and m.user_id = (select auth.uid())));
create policy site_previews_read on public.site_connection_previews for select to authenticated
  using (actor_id = (select auth.uid()) and exists (
    select 1 from public.workspace_members m where m.workspace_id = site_connection_previews.workspace_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));
create policy integration_audit_read on public.integration_audit_events for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = integration_audit_events.workspace_id and m.user_id = (select auth.uid())));

revoke all on public.webflow_connections, public.webflow_credentials, public.sites, public.site_connection_previews, public.integration_audit_events from anon, authenticated;
grant select on public.webflow_connections, public.sites, public.site_connection_previews, public.integration_audit_events to authenticated;
-- Credentials have no SELECT policy/grant. Only the owner-scoped RPC can return ciphertext.

create function public.start_webflow_oauth(p_id uuid, p_workspace_id uuid, p_state_hash text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_row public.webflow_connections%rowtype;
begin
  if v_actor is null or not exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = v_actor and role = 'owner') then
    raise exception 'Workspace owner required' using errcode = '42501';
  end if;
  if p_id is null or p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid OAuth request' using errcode = '22023';
  end if;
  insert into public.webflow_connections(id, workspace_id, actor_id, state_hash)
    values (p_id, p_workspace_id, v_actor, p_state_hash) on conflict (id) do nothing;
  select * into v_row from public.webflow_connections where id = p_id for update;
  if v_row.workspace_id <> p_workspace_id or v_row.actor_id <> v_actor or v_row.state_hash <> p_state_hash then
    raise exception 'Operation key conflict' using errcode = '22023';
  end if;
  if v_row.status <> 'pending' or v_row.expires_at <= clock_timestamp() then
    raise exception 'Authorization already used or expired' using errcode = '22023';
  end if;
  insert into public.integration_audit_events(workspace_id, actor_id, operation_id, action)
    values (p_workspace_id, v_actor, p_id, 'webflow.authorization_started') on conflict (operation_id, action) do nothing;
  return p_id;
end;
$$;

create function public.claim_webflow_callback(p_id uuid, p_state_hash text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_row public.webflow_connections%rowtype;
begin
  select * into v_row from public.webflow_connections where id = p_id for update;
  if not found or v_actor is null or v_row.actor_id <> v_actor or p_state_hash is distinct from v_row.state_hash
     or not exists (select 1 from public.workspace_members where workspace_id = v_row.workspace_id and user_id = v_actor and role = 'owner') then
    raise exception 'Authorization unavailable' using errcode = '42501';
  end if;
  if v_row.status = 'ready' then return 'ready'; end if;
  if v_row.expires_at <= clock_timestamp() then raise exception 'Authorization expired' using errcode = '22023'; end if;
  if v_row.status = 'exchanging' then return 'busy'; end if;
  update public.webflow_connections set status = 'exchanging' where id = p_id;
  insert into public.integration_audit_events(workspace_id, actor_id, operation_id, action)
    values (v_row.workspace_id, v_actor, p_id, 'webflow.callback_claimed');
  return 'claimed';
end;
$$;

create function public.complete_webflow_oauth(p_id uuid, p_ciphertext text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_row public.webflow_connections%rowtype;
begin
  select * into v_row from public.webflow_connections where id = p_id for update;
  if not found or v_actor is null or v_row.actor_id <> v_actor
     or not exists (select 1 from public.workspace_members where workspace_id = v_row.workspace_id and user_id = v_actor and role = 'owner') then
    raise exception 'Authorization unavailable' using errcode = '42501';
  end if;
  if v_row.status = 'ready' then return p_id; end if;
  if v_row.status <> 'exchanging' or v_row.expires_at <= clock_timestamp() then
    raise exception 'Authorization unavailable' using errcode = '22023';
  end if;
  if p_ciphertext is null or p_ciphertext !~ '^v1\.[0-9a-f]{24}\.[0-9a-f]{32}\.[0-9a-f]+$' then
    raise exception 'Invalid credential envelope' using errcode = '22023';
  end if;
  insert into public.webflow_credentials(connection_id, ciphertext) values (p_id, p_ciphertext);
  update public.webflow_connections set status = 'ready' where id = p_id;
  insert into public.integration_audit_events(workspace_id, actor_id, operation_id, action)
    values (v_row.workspace_id, v_actor, p_id, 'webflow.authorized');
  return p_id;
end;
$$;

create function public.read_webflow_credential(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_row public.webflow_connections%rowtype; v_ciphertext text;
begin
  select * into v_row from public.webflow_connections where id = p_id;
  if not found or auth.uid() is null or v_row.actor_id <> auth.uid() or v_row.status <> 'ready'
     or not exists (select 1 from public.workspace_members where workspace_id = v_row.workspace_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'Authorization unavailable' using errcode = '42501';
  end if;
  select ciphertext into v_ciphertext from public.webflow_credentials where connection_id = p_id;
  return v_ciphertext;
end;
$$;

create function public.preview_webflow_site(p_id uuid, p_connection_id uuid, p_site_id text, p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_connection public.webflow_connections%rowtype; v_row public.site_connection_previews%rowtype; v_expected uuid;
begin
  select * into v_connection from public.webflow_connections where id = p_connection_id;
  if not found or auth.uid() is null or v_connection.actor_id <> auth.uid() or v_connection.status <> 'ready'
     or not exists (select 1 from public.workspace_members where workspace_id = v_connection.workspace_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'Authorization unavailable' using errcode = '42501';
  end if;
  if p_id is null or p_site_id is null or p_site_id !~ '^[0-9a-fA-F]{24}$' or p_name is null or char_length(p_name) not between 1 and 255 then
    raise exception 'Invalid site input' using errcode = '22023';
  end if;
  select connection_id into v_expected from public.sites where workspace_id = v_connection.workspace_id and webflow_site_id = p_site_id;
  insert into public.site_connection_previews(id, workspace_id, connection_id, actor_id, webflow_site_id, display_name, expected_connection_id)
    values (p_id, v_connection.workspace_id, p_connection_id, auth.uid(), p_site_id, p_name, v_expected) on conflict (id) do nothing;
  select * into v_row from public.site_connection_previews where id = p_id for update;
  if v_row.actor_id <> auth.uid() or v_row.connection_id <> p_connection_id or v_row.webflow_site_id <> p_site_id or v_row.display_name <> p_name then
    raise exception 'Operation key conflict' using errcode = '22023';
  end if;
  insert into public.integration_audit_events(workspace_id, actor_id, operation_id, action)
    values (v_connection.workspace_id, auth.uid(), p_id, 'site.previewed') on conflict (operation_id, action) do nothing;
  return p_id;
end;
$$;

create function public.confirm_webflow_site(p_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_row public.site_connection_previews%rowtype; v_site uuid; v_current uuid;
begin
  select * into v_row from public.site_connection_previews where id = p_id for update;
  if not found or auth.uid() is null or v_row.actor_id <> auth.uid()
     or not exists (select 1 from public.workspace_members where workspace_id = v_row.workspace_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'Preview unavailable' using errcode = '42501';
  end if;
  if v_row.site_id is not null then return v_row.site_id; end if;
  if v_row.expires_at <= clock_timestamp() then raise exception 'Preview expired' using errcode = '22023'; end if;
  if not exists (select 1 from public.webflow_connections where id = v_row.connection_id and status = 'ready' and actor_id = auth.uid()) then
    raise exception 'Authorization unavailable' using errcode = '42501';
  end if;
  -- Serialize creation/reconnection of a site, including when no site row exists yet.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_row.workspace_id::text || ':' || v_row.webflow_site_id, 0));
  select connection_id into v_current from public.sites where workspace_id = v_row.workspace_id and webflow_site_id = v_row.webflow_site_id for update;
  if v_current is distinct from v_row.expected_connection_id then
    raise exception 'Site connection changed; review again' using errcode = '22023';
  end if;
  insert into public.sites(workspace_id, connection_id, webflow_site_id, display_name)
    values (v_row.workspace_id, v_row.connection_id, v_row.webflow_site_id, v_row.display_name)
    on conflict (workspace_id, webflow_site_id) do update set connection_id = excluded.connection_id, display_name = excluded.display_name
    returning id into v_site;
  update public.site_connection_previews set site_id = v_site where id = p_id;
  insert into public.integration_audit_events(workspace_id, actor_id, operation_id, action)
    values (v_row.workspace_id, auth.uid(), p_id, 'site.connected');
  return v_site;
end;
$$;

revoke all on function public.start_webflow_oauth(uuid, uuid, text), public.claim_webflow_callback(uuid, text),
  public.complete_webflow_oauth(uuid, text), public.read_webflow_credential(uuid),
  public.preview_webflow_site(uuid, uuid, text, text), public.confirm_webflow_site(uuid) from public, anon;
grant execute on function public.start_webflow_oauth(uuid, uuid, text), public.claim_webflow_callback(uuid, text),
  public.complete_webflow_oauth(uuid, text), public.read_webflow_credential(uuid),
  public.preview_webflow_site(uuid, uuid, text, text), public.confirm_webflow_site(uuid) to authenticated;

commit;
