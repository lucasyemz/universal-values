begin;
-- Exact search identity; display names and array order are not search options.
create function app_private.media_scan_signature(p_plan jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare e jsonb; result jsonb:='[]'; types jsonb;
begin
 if p_plan is null or jsonb_typeof(p_plan)<>'array' then return null; end if;
 if jsonb_array_length(p_plan)=0 then return null; end if;
 for e in select value from jsonb_array_elements(p_plan) order by value->>'id' loop
  if jsonb_typeof(e->'types') is distinct from 'array' then return null; end if;
  if jsonb_array_length(e->'types')=0 or coalesce(btrim(e->>'searchText'),'')<>'' then return null; end if;
  if exists(select 1 from jsonb_array_elements_text(e->'types') t where t not in ('link','image')) then return null; end if;
  select jsonb_agg(t order by t) into types from (select distinct jsonb_array_elements_text(e->'types') t) q;
  result:=result || jsonb_build_array((e-'name'-'types'-'searchText'-'searchOptions'-'placeholders') || jsonb_build_object(
   'types',types,'placeholders',coalesce(e->'placeholders','false'::jsonb),
   'searchOptions',jsonb_build_object('ignoreCase',false,'ignoreAccents',false,'wholeWord',false) || coalesce(e->'searchOptions','{}'::jsonb)));
 end loop;
 return result;
end $$;
revoke all on function app_private.media_scan_signature(jsonb) from public,anon,authenticated;
create index scan_media_search_latest on public.cms_scans(site_id,connection_id,md5(app_private.media_scan_signature(plan)::text)) where is_latest;

create or replace function public.repeat_cms_scan(p_id uuid,p_scan_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; existing public.cms_scans%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || (select site_id::text from public.cms_scans where id=p_scan_id),280005));
 s:=public.require_scan_owner(p_scan_id);
 perform pg_advisory_xact_lock(hashtextextended(s.series_id::text,280004));
 select * into existing from public.cms_scans where id=p_id;
 if found then
  if existing.actor_id is distinct from auth.uid() or existing.repeated_from is distinct from p_scan_id then raise exception 'Operation key conflict'; end if;
  return p_id;
 end if;
 perform app_private.require_latest_scan(p_scan_id);
 if not exists(select 1 from public.sites where id=s.site_id and connection_id=s.connection_id) then raise exception 'Connection changed'; end if;
 if s.status not in ('completed','limited','cancelled') then raise exception 'Scan unavailable for repeat'; end if;
 if exists(select 1 from public.cms_change_requests r join public.cms_scans c on c.id=coalesce(r.scan_id,(r.managed_resolution->>'scanId')::uuid)
  where c.series_id=s.series_id and r.status='confirmed') then raise exception 'Wait for scan changes to finish'; end if;
 perform public.start_cms_scan(p_id,s.site_id,s.plan,false);
 update public.cms_scans set is_latest=false where id=p_scan_id;
 update public.cms_scans set series_id=s.series_id,scan_version=s.scan_version+1,repeated_from=p_scan_id where id=p_id;
 return p_id;
end $$;

create function public.start_matching_cms_scan(p_id uuid,p_site_id uuid,p_plan jsonb,p_truncated boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.sites%rowtype; signature jsonb; parent public.cms_scans%rowtype;
begin
 select * into t from public.sites where id=p_site_id;
 if not found or auth.uid() is null or t.account_id is distinct from auth.uid()
  or not exists(select 1 from public.workspace_members where workspace_id=t.workspace_id and user_id=auth.uid() and role='owner') then
  raise exception 'Site unavailable' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_site_id::text,280005));
 -- Replay validates the exact originally submitted payload and never increments again.
 if exists(select 1 from public.cms_scans where id=p_id) then
  return public.start_cms_scan(p_id,p_site_id,p_plan,p_truncated);
 end if;
 signature:=app_private.media_scan_signature(p_plan);
 if signature is not null then
  select * into parent from public.cms_scans s where s.site_id=p_site_id and s.actor_id=auth.uid()
   and s.connection_id=t.connection_id and s.is_latest and s.status<>'preview' and s.plan_truncated=p_truncated
   and md5(app_private.media_scan_signature(s.plan)::text)=md5(signature::text)
   and app_private.media_scan_signature(s.plan)=signature
   order by s.created_at desc,s.id desc limit 1;
  if found then
   parent:=public.require_scan_owner(parent.id);
   perform app_private.require_latest_scan(parent.id);
   if exists(select 1 from public.cms_change_requests r join public.cms_scans c on c.id=coalesce(r.scan_id,(r.managed_resolution->>'scanId')::uuid)
    where c.series_id=parent.series_id and r.status='confirmed') then raise exception 'Wait for scan changes to finish'; end if;
  end if;
 end if;
 perform public.start_cms_scan(p_id,p_site_id,p_plan,p_truncated);
 if parent.id is not null then
  update public.cms_scans set is_latest=false where id=parent.id;
  update public.cms_scans set series_id=parent.series_id,scan_version=parent.scan_version+1,repeated_from=parent.id where id=p_id;
 end if;
 return p_id;
end $$;
revoke all on function public.start_matching_cms_scan(uuid,uuid,jsonb,boolean) from public,anon;
grant execute on function public.start_matching_cms_scan(uuid,uuid,jsonb,boolean) to authenticated;
commit;
