begin;
alter table public.cms_scans add column series_id uuid;
alter table public.cms_scans add column scan_version integer not null default 1 check(scan_version>0);
alter table public.cms_scans add column is_latest boolean not null default true;
alter table public.cms_scans add column repeated_from uuid references public.cms_scans(id);
update public.cms_scans set series_id=id;
alter table public.cms_scans alter column series_id set not null;
create unique index scan_series_version on public.cms_scans(series_id,scan_version);
create unique index scan_series_latest on public.cms_scans(series_id) where is_latest;
create index scan_latest_site on public.cms_scans(site_id,created_at desc,id) where is_latest;
create function app_private.initialize_scan_series() returns trigger language plpgsql set search_path='' as $$
begin new.series_id:=new.id; return new; end $$;
create trigger initialize_scan_series before insert on public.cms_scans for each row execute function app_private.initialize_scan_series();

-- Serialize version admission and all new edits/confirmations in the same series.
create function app_private.require_latest_scan(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
 select * into s from public.cms_scans where id=p_id;
 if not found then raise exception 'Scan unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.series_id::text,280004));
 if not exists(select 1 from public.cms_scans where id=p_id and is_latest) then
  raise exception 'Historical scan is read-only' using errcode='22023';
 end if;
end $$;
revoke all on function app_private.require_latest_scan(uuid) from public,anon,authenticated;

create function public.repeat_cms_scan(p_id uuid,p_scan_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; existing public.cms_scans%rowtype;
begin
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
revoke all on function public.repeat_cms_scan(uuid,uuid) from public,anon;
grant execute on function public.repeat_cms_scan(uuid,uuid) to authenticated;

create function app_private.guard_scan_version_changes() returns trigger language plpgsql security definer set search_path='' as $$
declare scan_id uuid;
begin
 if tg_table_name='cms_change_requests' then
  if tg_op='UPDATE' then
   if not (old.status='preview' and new.status='confirmed') then return new; end if;
  end if;
  scan_id:=coalesce(new.scan_id,(new.managed_resolution->>'scanId')::uuid);
 elsif tg_table_name='scan_variable_previews' then
  select p.scan_id into scan_id from public.managed_value_previews p where p.id=new.id;
 else
  scan_id:=new.scan_id;
 end if;
 if scan_id is not null then perform app_private.require_latest_scan(scan_id); end if;
 return new;
end $$;
create trigger guard_scan_version_changes before insert or update on public.cms_change_requests for each row execute function app_private.guard_scan_version_changes();
create trigger guard_scan_version_values before insert or update on public.managed_value_previews for each row execute function app_private.guard_scan_version_changes();
create trigger guard_scan_version_review before insert on public.scan_review_operations for each row execute function app_private.guard_scan_version_changes();
create trigger guard_scan_version_variable_apply before insert or update on public.scan_variable_previews for each row execute function app_private.guard_scan_version_changes();
commit;
