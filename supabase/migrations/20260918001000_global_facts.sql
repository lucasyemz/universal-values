begin;

-- Validate direct RPC calls as well as application payloads. This function does
-- not fetch URLs or infer whether a reference is factually correct.
create function public.valid_global_facts(p_facts jsonb)
returns boolean language plpgsql immutable set search_path='' as $function$
declare v_key text; v_item jsonb; v_text text;
begin
  if p_facts is null or jsonb_typeof(p_facts) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_facts)) <> 9
    or not (p_facts ?& array['schemaVersion','businessName','sourceNotes','phones','emails','ctaUrls','forbiddenTerms','forbiddenDomains','notes'])
    or p_facts->'schemaVersion' is distinct from '1'::jsonb then return false; end if;
  foreach v_key in array array['businessName','sourceNotes','notes'] loop
    if jsonb_typeof(p_facts->v_key) is distinct from 'string' then return false; end if;
    v_text := p_facts->>v_key;
    if v_text <> btrim(v_text) then return false; end if;
    if v_key='businessName' and (char_length(v_text) not between 1 and 160 or v_text ~ '[[:cntrl:]]') then return false; end if;
    if v_key='sourceNotes' and char_length(v_text) not between 3 and 2000 then return false; end if;
    if v_key='notes' and char_length(v_text)>5000 then return false; end if;
  end loop;
  foreach v_key in array array['phones','emails','ctaUrls','forbiddenTerms','forbiddenDomains'] loop
    if jsonb_typeof(p_facts->v_key) is distinct from 'array' then return false; end if;
    if jsonb_array_length(p_facts->v_key)>20 then return false; end if;
    if (select count(distinct e) from jsonb_array_elements(p_facts->v_key) e) <> jsonb_array_length(p_facts->v_key) then return false; end if;
    for v_item in select value from jsonb_array_elements(p_facts->v_key) loop
      if jsonb_typeof(v_item) is distinct from 'string' then return false; end if;
      v_text := v_item #>> '{}';
      if v_text <> btrim(v_text) or v_text ~ '[[:cntrl:]]' then return false; end if;
      if v_key='phones' and v_text !~ '^\+[1-9][0-9]{7,14}$' then return false; end if;
      if v_key='emails' and (char_length(v_text)>254 or v_text !~ $re$^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$$re$) then return false; end if;
      if v_key='ctaUrls' and (char_length(v_text)>2048 or v_text !~ '^https?://[^/@[:space:]?#\\]+([/?#][^[:space:]\\]*)?$') then return false; end if;
      if v_key='forbiddenTerms' and char_length(v_text) not between 2 and 160 then return false; end if;
      if v_key='forbiddenDomains' and (char_length(v_text)>253 or v_text !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$') then return false; end if;
    end loop;
  end loop;
  return true;
end $function$;

create table public.global_fact_previews (
  id uuid primary key,
  site_id uuid not null references public.sites(id),
  actor_id uuid not null references auth.users(id),
  base_version integer not null check (base_version>=0),
  facts jsonb not null check (public.valid_global_facts(facts)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 minutes',
  confirmed_version integer check (confirmed_version=base_version+1),
  unique(id,site_id)
);
create table public.global_fact_versions (
  site_id uuid not null references public.sites(id),
  version integer not null check (version>0),
  facts jsonb not null check (public.valid_global_facts(facts)),
  actor_id uuid not null references auth.users(id),
  preview_id uuid not null unique,
  created_at timestamptz not null default now(),
  primary key(site_id,version),
  foreign key(preview_id,site_id) references public.global_fact_previews(id,site_id)
);
create table public.global_fact_audit (
  preview_id uuid not null,
  site_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('previewed','confirmed')),
  created_at timestamptz not null default now(),
  primary key(preview_id,action),
  foreign key(preview_id,site_id) references public.global_fact_previews(id,site_id)
);
create index global_fact_previews_site on public.global_fact_previews(site_id,created_at desc);
create index global_fact_audit_site on public.global_fact_audit(site_id,created_at desc);
alter table public.global_fact_previews enable row level security;
alter table public.global_fact_versions enable row level security;
alter table public.global_fact_audit enable row level security;
revoke all on public.global_fact_previews,public.global_fact_versions,public.global_fact_audit from anon,authenticated;
grant select on public.global_fact_previews,public.global_fact_versions,public.global_fact_audit to authenticated;
create policy global_fact_previews_owner on public.global_fact_previews for select to authenticated using (
  actor_id=auth.uid() and exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=auth.uid() and m.role='owner'));
create policy global_fact_versions_owner on public.global_fact_versions for select to authenticated using (
  exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=auth.uid() and m.role='owner'));
create policy global_fact_audit_owner on public.global_fact_audit for select to authenticated using (
  exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=site_id and m.user_id=auth.uid() and m.role='owner'));

create function public.preview_global_facts(p_id uuid,p_site_id uuid,p_base_version integer,p_facts jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.global_fact_previews%rowtype; v_current public.global_fact_versions%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=p_site_id and m.user_id=auth.uid() and m.role='owner') then
    raise exception 'Owner required' using errcode='42501';
  end if;
  if p_id is null or p_base_version is null or p_base_version<0 or not public.valid_global_facts(p_facts) then
    raise exception 'Invalid facts' using errcode='22023';
  end if;
  -- Both RPCs lock site first, then preview, to serialize version changes.
  perform 1 from public.sites where id=p_site_id for update;
  select * into v_row from public.global_fact_previews where id=p_id;
  if found then
    if v_row.actor_id<>auth.uid() or v_row.site_id<>p_site_id or v_row.base_version<>p_base_version or v_row.facts<>p_facts then
      raise exception 'Operation conflict' using errcode='22023';
    end if;
    return p_id;
  end if;
  select * into v_current from public.global_fact_versions where site_id=p_site_id order by version desc limit 1;
  if coalesce(v_current.version,0)<>p_base_version then raise exception 'Version conflict' using errcode='40001'; end if;
  if v_current.facts=p_facts then raise exception 'Facts unchanged' using errcode='22023'; end if;
  insert into public.global_fact_previews(id,site_id,actor_id,base_version,facts) values(p_id,p_site_id,auth.uid(),p_base_version,p_facts);
  insert into public.global_fact_audit(preview_id,site_id,actor_id,action) values(p_id,p_site_id,auth.uid(),'previewed');
  return p_id;
end $$;

create function public.confirm_global_facts(p_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_row public.global_fact_previews%rowtype; v_current integer;
begin
  select * into v_row from public.global_fact_previews where id=p_id;
  if not found or auth.uid() is null or v_row.actor_id<>auth.uid() then raise exception 'Preview unavailable' using errcode='42501'; end if;
  perform 1 from public.sites where id=v_row.site_id for update;
  select * into v_row from public.global_fact_previews where id=p_id for update;
  if not exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=v_row.site_id and m.user_id=auth.uid() and m.role='owner') then
    raise exception 'Owner required' using errcode='42501';
  end if;
  if v_row.confirmed_version is not null then return v_row.confirmed_version; end if;
  if v_row.expires_at<=clock_timestamp() then raise exception 'Preview expired' using errcode='22023'; end if;
  select coalesce(max(version),0) into v_current from public.global_fact_versions where site_id=v_row.site_id;
  if v_current<>v_row.base_version then raise exception 'Version conflict' using errcode='40001'; end if;
  insert into public.global_fact_versions(site_id,version,facts,actor_id,preview_id)
    values(v_row.site_id,v_current+1,v_row.facts,auth.uid(),p_id);
  update public.global_fact_previews set confirmed_version=v_current+1 where id=p_id;
  insert into public.global_fact_audit(preview_id,site_id,actor_id,action) values(p_id,v_row.site_id,auth.uid(),'confirmed');
  return v_current+1;
end $$;
revoke all on function public.valid_global_facts(jsonb) from public,anon;
grant execute on function public.valid_global_facts(jsonb) to authenticated;
revoke all on function public.preview_global_facts(uuid,uuid,integer,jsonb),public.confirm_global_facts(uuid) from public,anon;
grant execute on function public.preview_global_facts(uuid,uuid,integer,jsonb),public.confirm_global_facts(uuid) to authenticated;
commit;
