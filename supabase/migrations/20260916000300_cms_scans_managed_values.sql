begin;

create function public.valid_managed_canonical(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare n integer; ok boolean;
begin
  if v is null or jsonb_typeof(v) <> 'object' then return false; end if;
  select count(*) into n from jsonb_object_keys(v);
  case v->>'type'
    when 'money' then ok := n=3 and jsonb_typeof(v->'amount')='string' and v->>'amount' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' and v->>'currency' in ('BRL','USD','EUR');
    when 'number' then ok := n=2 and jsonb_typeof(v->'number')='string' and v->>'number' ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$';
    when 'phone' then ok := n=2 and jsonb_typeof(v->'number')='string' and v->>'number' ~ '^\+[1-9][0-9]{6,14}$';
    when 'date' then ok := n=2 and v->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char((v->>'date')::date,'YYYY-MM-DD')=v->>'date';
    when 'text' then ok := n=2 and jsonb_typeof(v->'text')='string' and char_length(btrim(v->>'text')) between 1 and 10000;
    else return false;
  end case;
  return coalesce(ok,false);
exception when others then return false;
end $$;
revoke all on function public.valid_managed_canonical(jsonb) from public, anon, authenticated;

create table public.cms_scans (
  id uuid primary key, site_id uuid not null, workspace_id uuid not null, actor_id uuid not null references auth.users(id),
  connection_id uuid not null,
  plan jsonb not null check(jsonb_typeof(plan)='array' and jsonb_array_length(plan)<=20),
  status text not null default 'preview' check(status in ('preview','running','paused','completed','limited','cancelled')),
  collection_index integer not null default 0 check(collection_index>=0),
  item_offset integer not null default 0 check(item_offset>=0),
  items_read integer not null default 0 check(items_read between 0 and 500),
  occurrences_count integer not null default 0 check(occurrences_count between 0 and 1000),
  skipped_fields integer not null default 0 check(skipped_fields>=0),
  truncated boolean not null default false, plan_truncated boolean not null default false, revision integer not null default 0,
  lease_token uuid, lease_until timestamptz, retry_at timestamptz, error_code text,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '15 minutes',
  foreign key(site_id,workspace_id) references public.sites(id,workspace_id),
  foreign key(connection_id,workspace_id) references public.webflow_connections(id,workspace_id),
  unique(id,site_id,workspace_id)
);
create unique index one_active_cms_scan on public.cms_scans(site_id) where status in ('running','paused');
create table public.scan_occurrences (
  id uuid primary key default gen_random_uuid(), scan_id uuid not null, site_id uuid not null, workspace_id uuid not null,
  collection_id text not null check(collection_id ~ '^[0-9a-fA-F]{24}$'), collection_name text not null,
  item_id text not null check(item_id ~ '^[0-9a-fA-F]{24}$'), item_name text not null,
  locale text not null, field_slug text not null, field_name text not null,
  field_type text not null check(field_type in ('PlainText','Number')),
  source_value text not null check(char_length(source_value)<=2000), raw_match text not null,
  start_pos integer not null check(start_pos>=0), end_pos integer not null,
  canonical jsonb not null check(public.valid_managed_canonical(canonical)),
  source_key text generated always as (collection_id||':'||item_id||':'||locale||':'||field_slug) stored,
  foreign key(scan_id,site_id,workspace_id) references public.cms_scans(id,site_id,workspace_id),
  check(end_pos>start_pos and end_pos<=char_length(source_value)),
  check(substring(source_value from start_pos+1 for end_pos-start_pos)=raw_match),
  check(char_length(locale)<=100 and char_length(field_slug) between 1 and 100 and locale !~ ':' and field_slug !~ ':'),
  unique(scan_id,collection_id,item_id,locale,field_slug,start_pos,end_pos)
);
create table public.managed_values (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, site_id uuid not null,
  name text not null check(char_length(name) between 2 and 80 and name=btrim(name) and name !~ '[[:cntrl:]]'),
  canonical jsonb not null check(public.valid_managed_canonical(canonical)), version integer not null default 1,
  created_at timestamptz not null default now(),
  foreign key(site_id,workspace_id) references public.sites(id,workspace_id),
  unique(id,site_id,workspace_id)
);
create table public.managed_value_previews (
  id uuid primary key, scan_id uuid not null, site_id uuid not null, workspace_id uuid not null,
  actor_id uuid not null references auth.users(id), name text not null,
  canonical jsonb not null check(public.valid_managed_canonical(canonical)),
  occurrence_ids uuid[] not null, managed_value_id uuid,
  expires_at timestamptz not null default now()+interval '15 minutes',
  foreign key(scan_id,site_id,workspace_id) references public.cms_scans(id,site_id,workspace_id),
  foreign key(managed_value_id,site_id,workspace_id) references public.managed_values(id,site_id,workspace_id)
);
create table public.managed_value_bindings (
  id uuid primary key default gen_random_uuid(), managed_value_id uuid not null, site_id uuid not null, workspace_id uuid not null,
  source_key text not null, collection_id text not null, item_id text not null, locale text not null,
  field_slug text not null, field_type text not null, source_value text not null, locations jsonb not null,
  foreign key(managed_value_id,site_id,workspace_id) references public.managed_values(id,site_id,workspace_id),
  unique(site_id,source_key)
);
create table public.scan_audit_events (
  id uuid primary key default gen_random_uuid(), scan_id uuid not null references public.cms_scans(id),
  workspace_id uuid not null references public.workspaces(id), actor_id uuid not null references auth.users(id),
  operation_id uuid not null, action text not null check(action in ('scan.previewed','scan.confirmed','scan.claimed','scan.batch_saved','scan.paused','scan.cancelled','value.previewed','value.created')),
  created_at timestamptz not null default now(), unique(operation_id,action)
);
create index cms_scans_workspace_idx on public.cms_scans(workspace_id,site_id);
create index scan_occurrences_scan_idx on public.scan_occurrences(scan_id);
create index managed_values_site_idx on public.managed_values(site_id);
create index managed_value_previews_scan_idx on public.managed_value_previews(scan_id);
create index managed_value_bindings_value_idx on public.managed_value_bindings(managed_value_id);
create index scan_audit_workspace_idx on public.scan_audit_events(workspace_id);

alter table public.cms_scans enable row level security;
alter table public.scan_occurrences enable row level security;
alter table public.managed_values enable row level security;
alter table public.managed_value_previews enable row level security;
alter table public.managed_value_bindings enable row level security;
alter table public.scan_audit_events enable row level security;
create policy scans_read on public.cms_scans for select to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=cms_scans.workspace_id and m.user_id=(select auth.uid())));
create policy occurrences_read on public.scan_occurrences for select to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=scan_occurrences.workspace_id and m.user_id=(select auth.uid())));
create policy values_read on public.managed_values for select to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=managed_values.workspace_id and m.user_id=(select auth.uid())));
create policy value_previews_read on public.managed_value_previews for select to authenticated using (actor_id=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.workspace_id=managed_value_previews.workspace_id and m.user_id=(select auth.uid()) and m.role='owner'));
create policy bindings_read on public.managed_value_bindings for select to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=managed_value_bindings.workspace_id and m.user_id=(select auth.uid())));
create policy scan_audit_read on public.scan_audit_events for select to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=scan_audit_events.workspace_id and m.user_id=(select auth.uid())));
revoke all on public.cms_scans, public.scan_occurrences, public.managed_values, public.managed_value_previews, public.managed_value_bindings, public.scan_audit_events from anon,authenticated;
grant select on public.cms_scans, public.scan_occurrences, public.managed_values, public.managed_value_previews, public.managed_value_bindings, public.scan_audit_events to authenticated;

-- Internal helper; never exposed as an executable RPC to clients.
create function public.require_scan_owner(p_id uuid) returns public.cms_scans
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
  select * into s from public.cms_scans where id=p_id for update;
  if not found or auth.uid() is null or s.actor_id<>auth.uid() or not exists(select 1 from public.workspace_members where workspace_id=s.workspace_id and user_id=auth.uid() and role='owner') then
    raise exception 'Scan unavailable' using errcode='42501';
  end if;
  return s;
end $$;
revoke all on function public.require_scan_owner(uuid) from public,anon,authenticated;

create function public.preview_cms_scan(p_id uuid,p_site_id uuid,p_plan jsonb,p_truncated boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.sites%rowtype; s public.cms_scans%rowtype; c jsonb;
begin
  select * into t from public.sites where id=p_site_id;
  if not found or auth.uid() is null or not exists(select 1 from public.workspace_members where workspace_id=t.workspace_id and user_id=auth.uid() and role='owner') or not exists(select 1 from public.webflow_connections where id=t.connection_id and actor_id=auth.uid() and status='ready') then
    raise exception 'Site unavailable' using errcode='42501';
  end if;
  if p_id is null or p_plan is null or jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan)>20 or p_truncated is null then raise exception 'Invalid plan' using errcode='22023'; end if;
  for c in select * from jsonb_array_elements(p_plan) loop
    if coalesce(c->>'id','') !~ '^[0-9a-fA-F]{24}$' or jsonb_typeof(c->'name') is distinct from 'string' or char_length(c->>'name')>255 then raise exception 'Invalid collection' using errcode='22023'; end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_plan))<>jsonb_array_length(p_plan) then raise exception 'Duplicate collection' using errcode='22023'; end if;
  insert into public.cms_scans(id,site_id,workspace_id,actor_id,connection_id,plan,truncated,plan_truncated)
    values(p_id,t.id,t.workspace_id,auth.uid(),t.connection_id,p_plan,p_truncated,p_truncated) on conflict(id) do nothing;
  s:=public.require_scan_owner(p_id);
  if s.site_id<>t.id or s.plan<>p_plan or s.plan_truncated<>p_truncated then raise exception 'Operation key conflict' using errcode='22023'; end if;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action)
    values(s.id,s.workspace_id,auth.uid(),s.id,'scan.previewed') on conflict(operation_id,action) do nothing;
  return s.id;
end $$;

create function public.confirm_cms_scan(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
  s:=public.require_scan_owner(p_id);
  if s.status in ('running','paused','completed','limited') then return p_id; end if;
  if s.status<>'preview' or s.expires_at<=clock_timestamp() or not exists(select 1 from public.sites where id=s.site_id and connection_id=s.connection_id) then raise exception 'Preview expired or source changed' using errcode='22023'; end if;
  update public.cms_scans set status=case when jsonb_array_length(plan)=0 then 'completed' else 'running' end where id=p_id;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_id,s.workspace_id,auth.uid(),p_id,'scan.confirmed');
  return p_id;
end $$;

create function public.claim_cms_scan_batch(p_id uuid,p_revision integer,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
  s:=public.require_scan_owner(p_id);
  if p_lease is null or p_revision is null then raise exception 'Invalid claim' using errcode='22023'; end if;
  if s.status not in ('running','paused') or s.revision<>p_revision or s.lease_until>clock_timestamp() or s.retry_at>clock_timestamp() then return false; end if;
  if not exists(select 1 from public.sites where id=s.site_id and connection_id=s.connection_id) then raise exception 'Source changed' using errcode='22023'; end if;
  update public.cms_scans set status='running',lease_token=p_lease,lease_until=clock_timestamp()+interval '90 seconds',error_code=null,retry_at=null where id=p_id;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_id,s.workspace_id,auth.uid(),p_lease,'scan.claimed');
  return true;
end $$;

create function public.save_cms_scan_batch(p_id uuid,p_revision integer,p_lease uuid,p_rows jsonb,p_items integer,p_next_collection integer,p_next_offset integer,p_truncated boolean,p_skipped integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; r jsonb; total integer; finished boolean;
begin
  s:=public.require_scan_owner(p_id);
  if s.revision=p_revision+1 and s.lease_token=p_lease then return p_id; end if;
  if s.status<>'running' or s.revision is distinct from p_revision or s.lease_token is distinct from p_lease or s.lease_until is null or s.lease_until<=clock_timestamp() then raise exception 'Stale lease' using errcode='22023'; end if;
  if not exists(select 1 from public.sites where id=s.site_id and connection_id=s.connection_id) then raise exception 'Source changed' using errcode='22023'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>200 or p_items is null or p_items not between 0 and 25 or s.items_read+p_items>500
     or p_next_collection is null or p_next_collection not in (s.collection_index,s.collection_index+1) or p_next_collection>jsonb_array_length(s.plan)
     or p_next_offset is null or p_next_offset<0 or p_truncated is null or p_skipped is null or p_skipped not between 0 and 2500
     or (p_next_collection=s.collection_index and (p_items=0 or p_next_offset<>s.item_offset+p_items))
     or (p_next_collection>s.collection_index and p_next_offset<>0) then raise exception 'Invalid batch cursor' using errcode='22023'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if r->>'collection_id' is distinct from s.plan->s.collection_index->>'id' or not public.valid_managed_canonical(r->'canonical')
      or char_length(coalesce(r->>'collection_name',''))>255 or char_length(coalesce(r->>'item_name',''))>255 or char_length(coalesce(r->>'field_name',''))>255 then raise exception 'Invalid occurrence' using errcode='22023'; end if;
    insert into public.scan_occurrences(scan_id,site_id,workspace_id,collection_id,collection_name,item_id,item_name,locale,field_slug,field_name,field_type,source_value,raw_match,start_pos,end_pos,canonical)
    values(p_id,s.site_id,s.workspace_id,r->>'collection_id',r->>'collection_name',r->>'item_id',r->>'item_name',r->>'locale',r->>'field_slug',r->>'field_name',r->>'field_type',r->>'source_value',r->>'raw_match',(r->>'start_pos')::integer,(r->>'end_pos')::integer,r->'canonical')
    on conflict(scan_id,collection_id,item_id,locale,field_slug,start_pos,end_pos) do nothing;
  end loop;
  select count(*) into total from public.scan_occurrences where scan_id=p_id;
  if total>1000 then raise exception 'Occurrence limit exceeded' using errcode='22023'; end if;
  finished:=p_next_collection>=jsonb_array_length(s.plan) or total>=1000 or s.items_read+p_items>=500;
  update public.cms_scans set collection_index=p_next_collection,item_offset=p_next_offset,items_read=items_read+p_items,occurrences_count=total,
    skipped_fields=skipped_fields+p_skipped,truncated=truncated or p_truncated or (finished and p_next_collection<jsonb_array_length(plan)),
    status=case when not finished then 'running' when truncated or p_truncated or p_next_collection<jsonb_array_length(plan) then 'limited' else 'completed' end,
    revision=revision+1,lease_until=null,retry_at=case when finished then null else clock_timestamp()+interval '5 seconds' end where id=p_id;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_id,s.workspace_id,auth.uid(),p_lease,'scan.batch_saved');
  return p_id;
end $$;

create function public.pause_cms_scan(p_id uuid,p_revision integer,p_lease uuid,p_error text,p_wait integer) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
  s:=public.require_scan_owner(p_id);
  if s.revision=p_revision+1 and s.lease_token=p_lease then return p_id; end if;
  if s.status<>'running' or s.revision is distinct from p_revision or s.lease_token is distinct from p_lease then raise exception 'Stale lease' using errcode='22023'; end if;
  if p_error is null or p_error not in ('rate_limit','provider','source_changed','storage') or p_wait is null or p_wait not between 5 and 86400 then raise exception 'Invalid pause' using errcode='22023'; end if;
  update public.cms_scans set status='paused',revision=revision+1,lease_until=null,error_code=p_error,retry_at=clock_timestamp()+p_wait*interval '1 second' where id=p_id;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_id,s.workspace_id,auth.uid(),p_lease,'scan.paused');
  return p_id;
end $$;

create function public.cancel_cms_scan(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
  s:=public.require_scan_owner(p_id);
  if s.status in ('completed','limited','cancelled') then return p_id; end if;
  update public.cms_scans set status='cancelled',revision=revision+1,lease_until=null where id=p_id;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_id,s.workspace_id,auth.uid(),p_id,'scan.cancelled');
  return p_id;
end $$;

create function public.preview_managed_value(p_id uuid,p_scan_id uuid,p_name text,p_occurrence_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; v public.managed_value_previews%rowtype; ids uuid[]; cv jsonb; n integer;
begin
  s:=public.require_scan_owner(p_scan_id);
  if s.status not in ('completed','limited') or p_id is null or p_name is null or p_name<>btrim(p_name) or char_length(p_name) not between 2 and 80 or p_name ~ '[[:cntrl:]]' then raise exception 'Invalid value preview' using errcode='22023'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_occurrence_ids) x;
  if coalesce(cardinality(ids),0) not between 2 and 100 or cardinality(ids)<>cardinality(p_occurrence_ids) then raise exception 'Select unique occurrences' using errcode='22023'; end if;
  select * into v from public.managed_value_previews where id=p_id for update;
  if found then
    if v.actor_id<>auth.uid() or v.scan_id<>p_scan_id or v.name<>p_name or v.occurrence_ids<>ids then raise exception 'Operation key conflict' using errcode='22023'; end if;
    return p_id;
  end if;
  select count(*) into n from public.scan_occurrences where scan_id=p_scan_id and id=any(ids);
  if n<>cardinality(ids) then raise exception 'Occurrences unavailable' using errcode='42501'; end if;
  select canonical into cv from public.scan_occurrences where id=ids[1];
  if exists(select 1 from public.scan_occurrences where id=any(ids) and canonical<>cv)
     or (select count(distinct source_key) from public.scan_occurrences where id=any(ids))<2 then raise exception 'Select matching values from at least two sources' using errcode='22023'; end if;
  if exists(select 1 from public.scan_occurrences where id=any(ids) group by source_key having count(distinct source_value)>1) then raise exception 'Source changed during scan' using errcode='22023'; end if;
  if exists(select 1 from public.managed_value_bindings b join public.scan_occurrences o on b.site_id=o.site_id and b.source_key=o.source_key where o.id=any(ids)) then raise exception 'Source already managed' using errcode='22023'; end if;
  insert into public.managed_value_previews(id,scan_id,site_id,workspace_id,actor_id,name,canonical,occurrence_ids)
    values(p_id,p_scan_id,s.site_id,s.workspace_id,auth.uid(),p_name,cv,ids) on conflict(id) do nothing;
  select * into v from public.managed_value_previews where id=p_id for update;
  if v.actor_id<>auth.uid() or v.scan_id<>p_scan_id or v.name<>p_name or v.occurrence_ids<>ids then raise exception 'Operation key conflict' using errcode='22023'; end if;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_scan_id,s.workspace_id,auth.uid(),p_id,'value.previewed') on conflict(operation_id,action) do nothing;
  return p_id;
end $$;

create function public.confirm_managed_value(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.managed_value_previews%rowtype; s public.cms_scans%rowtype; value_id uuid;
begin
  select * into v from public.managed_value_previews where id=p_id for update;
  if not found or auth.uid() is null or v.actor_id<>auth.uid() then raise exception 'Preview unavailable' using errcode='42501'; end if;
  s:=public.require_scan_owner(v.scan_id);
  if v.managed_value_id is not null then return v.managed_value_id; end if;
  if v.expires_at<=clock_timestamp() then raise exception 'Preview expired' using errcode='22023'; end if;
  -- Serialize binding allocation across scans of the same site.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v.site_id::text,1));
  if exists(select 1 from public.managed_value_bindings b join public.scan_occurrences o on b.site_id=o.site_id and b.source_key=o.source_key where o.id=any(v.occurrence_ids)) then raise exception 'Source already managed' using errcode='22023'; end if;
  insert into public.managed_values(site_id,workspace_id,name,canonical) values(v.site_id,v.workspace_id,v.name,v.canonical) returning id into value_id;
  insert into public.managed_value_bindings(managed_value_id,site_id,workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,locations)
    select value_id,v.site_id,v.workspace_id,source_key,collection_id,item_id,locale,field_slug,field_type,source_value,
      jsonb_agg(jsonb_build_object('start',start_pos,'end',end_pos,'raw',raw_match) order by start_pos)
    from public.scan_occurrences where id=any(v.occurrence_ids)
    group by source_key,collection_id,item_id,locale,field_slug,field_type,source_value;
  update public.managed_value_previews set managed_value_id=value_id where id=p_id;
  insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(v.scan_id,v.workspace_id,auth.uid(),p_id,'value.created');
  return value_id;
end $$;

revoke all on function public.preview_cms_scan(uuid,uuid,jsonb,boolean), public.confirm_cms_scan(uuid), public.claim_cms_scan_batch(uuid,integer,uuid),
 public.save_cms_scan_batch(uuid,integer,uuid,jsonb,integer,integer,integer,boolean,integer), public.pause_cms_scan(uuid,integer,uuid,text,integer),
 public.cancel_cms_scan(uuid),public.preview_managed_value(uuid,uuid,text,uuid[]),public.confirm_managed_value(uuid) from public,anon;
grant execute on function public.preview_cms_scan(uuid,uuid,jsonb,boolean), public.confirm_cms_scan(uuid), public.claim_cms_scan_batch(uuid,integer,uuid),
 public.save_cms_scan_batch(uuid,integer,uuid,jsonb,integer,integer,integer,boolean,integer), public.pause_cms_scan(uuid,integer,uuid,text,integer),
 public.cancel_cms_scan(uuid),public.preview_managed_value(uuid,uuid,text,uuid[]),public.confirm_managed_value(uuid) to authenticated;
commit;
