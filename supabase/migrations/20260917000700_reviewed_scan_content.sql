begin;
create table public.reviewed_scan_content (
  id uuid primary key default gen_random_uuid(), site_id uuid not null, workspace_id uuid not null,
  occurrence_id uuid not null references public.scan_occurrences(id), source_key text not null,
  canonical jsonb not null, source_value text not null,
  fingerprint text generated always as (md5(canonical::text||':'||source_value)) stored,
  reviewed boolean not null, updated_at timestamptz not null default now(),
  foreign key(site_id,workspace_id) references public.sites(id,workspace_id),
  unique(site_id,source_key,fingerprint)
);
create table public.scan_review_operations (
  id uuid primary key, scan_id uuid not null references public.cms_scans(id),
  workspace_id uuid not null references public.workspaces(id), actor_id uuid not null references auth.users(id),
  occurrence_ids uuid[] not null, reviewed boolean not null, created_at timestamptz not null default now()
);
alter table public.reviewed_scan_content enable row level security;
alter table public.scan_review_operations enable row level security;
create policy reviewed_content_read on public.reviewed_scan_content for select to authenticated using(exists(select 1 from public.workspace_members where workspace_id=reviewed_scan_content.workspace_id and user_id=(select auth.uid()) and role='owner'));
create policy review_operations_read on public.scan_review_operations for select to authenticated using(exists(select 1 from public.workspace_members where workspace_id=scan_review_operations.workspace_id and user_id=(select auth.uid()) and role='owner'));
revoke all on public.reviewed_scan_content,public.scan_review_operations from anon,authenticated;
grant select on public.reviewed_scan_content,public.scan_review_operations to authenticated;

create function public.set_scan_content_reviewed(p_id uuid,p_scan_id uuid,p_occurrence_ids uuid[],p_reviewed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; op public.scan_review_operations%rowtype; o public.scan_occurrences%rowtype; ids uuid[]; inserted integer;
begin
  s:=public.require_scan_owner(p_scan_id);
  if s.status not in ('completed','limited') or p_id is null or p_reviewed is null or p_occurrence_ids is null or cardinality(p_occurrence_ids) not between 1 and 1000 then raise exception 'Invalid review'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_occurrence_ids) x;
  if array_position(ids,null) is not null or cardinality(ids)<>(select count(*) from public.scan_occurrences where scan_id=p_scan_id and id=any(ids)) then raise exception 'Invalid occurrences'; end if;
  insert into public.scan_review_operations(id,scan_id,workspace_id,actor_id,occurrence_ids,reviewed) values(p_id,p_scan_id,s.workspace_id,auth.uid(),ids,p_reviewed) on conflict(id) do nothing;
  get diagnostics inserted=row_count;
  select * into op from public.scan_review_operations where id=p_id;
  if op.actor_id<>auth.uid() or op.scan_id<>p_scan_id or op.occurrence_ids<>ids or op.reviewed<>p_reviewed then raise exception 'Operation key conflict'; end if;
  if inserted=0 then return p_id; end if;
  for o in select * from public.scan_occurrences where id=any(ids) order by source_key,id loop
    if exists(select 1 from public.reviewed_scan_content where site_id=s.site_id and source_key=o.source_key and fingerprint=md5(o.canonical::text||':'||o.source_value) and (canonical<>o.canonical or source_value<>o.source_value)) then raise exception 'Fingerprint collision'; end if;
    insert into public.reviewed_scan_content(site_id,workspace_id,occurrence_id,source_key,canonical,source_value,reviewed)
      values(s.site_id,s.workspace_id,o.id,o.source_key,o.canonical,o.source_value,p_reviewed)
      on conflict(site_id,source_key,fingerprint) do update set reviewed=excluded.reviewed,updated_at=now();
  end loop;
  return p_id;
end $$;

create function public.scan_reviewed_occurrences(p_scan_id uuid) returns table(occurrence_id uuid)
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
  s:=public.require_scan_owner(p_scan_id);
  return query select o.id from public.scan_occurrences o join public.reviewed_scan_content r
    on r.site_id=o.site_id and r.source_key=o.source_key and r.canonical=o.canonical and r.source_value=o.source_value
    and r.fingerprint=md5(o.canonical::text||':'||o.source_value) and r.reviewed
    where o.scan_id=p_scan_id;
end $$;
revoke all on function public.set_scan_content_reviewed(uuid,uuid,uuid[],boolean),public.scan_reviewed_occurrences(uuid) from public,anon;
grant execute on function public.set_scan_content_reviewed(uuid,uuid,uuid[],boolean),public.scan_reviewed_occurrences(uuid) to authenticated;
commit;
