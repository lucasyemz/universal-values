-- One-off, explicitly scoped maintenance. Substitute the three placeholders after previewing.
-- This does not start scans, alter source content or change public resource numbers.
do $merge$ begin
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.cms_scans,public.cms_change_requests,public.managed_value_previews,
 public.scan_review_operations,public.scan_variable_previews in access exclusive mode;
create table if not exists app_private.scan_series_merge_audit (
 operation text not null, site_id uuid not null, scan_id uuid not null,
 account_id uuid not null, before_state jsonb not null, after_state jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(operation,site_id,scan_id)
);
revoke all on app_private.scan_series_merge_audit from public,anon,authenticated;
create temp table merge_scope on commit drop as
 select id,account_id from public.sites where id='__SITE_ID__'::uuid and account_id='__ACCOUNT_ID__'::uuid;
begin
 if (select count(*) from merge_scope)<>1 then raise exception 'Merge scope unavailable'; end if;
end;
create temp table merge_before on commit drop as
 select s.* from public.cms_scans s join merge_scope t on t.id=s.site_id;
create temp table merge_mapping on commit drop as
 with candidates as (
  select s.*,app_private.media_scan_signature(s.plan) signature from merge_before s
  where not exists(select 1 from app_private.scan_series_merge_audit a where a.site_id=s.site_id and a.operation='media-history-20260928')
 ), grouped as (
  select site_id,actor_id,connection_id,plan_truncated,signature
  from candidates where signature is not null
  group by site_id,actor_id,connection_id,plan_truncated,signature having count(distinct series_id)>1
 )
 select c.id,c.series_id old_series,
  first_value(c.id) over w as new_series,
  row_number() over w as new_version,
  row_number() over (partition by c.site_id,c.actor_id,c.connection_id,c.plan_truncated,c.signature order by c.created_at desc,c.id desc)=1 as new_latest
 from candidates c join grouped g on g.site_id=c.site_id and g.actor_id=c.actor_id and g.connection_id=c.connection_id
  and g.plan_truncated=c.plan_truncated and g.signature=c.signature
 window w as (partition by c.site_id,c.actor_id,c.connection_id,c.plan_truncated,c.signature order by c.created_at,c.id);
begin
 if exists(select 1 from app_private.scan_series_merge_audit a join merge_scope t on t.id=a.site_id where a.operation='media-history-20260928') then return; end if;
 if (select count(*) from merge_mapping)<>__EXPECTED_SCANS__ then raise exception 'Merge preview changed'; end if;
 if exists(select 1 from merge_before s join merge_mapping m on m.id=s.id where s.status not in ('completed','limited','cancelled') or s.lease_until>clock_timestamp()) then raise exception 'Scan still active'; end if;
 if exists(select 1 from public.cms_change_requests r join merge_scope t on t.id=r.site_id where r.status='confirmed') then raise exception 'Changes still active'; end if;
 if exists(select 1 from public.cms_scans s join merge_mapping m on m.old_series=s.series_id where not exists(select 1 from merge_mapping x where x.id=s.id and x.new_series=m.new_series)) then raise exception 'Cannot split an existing series'; end if;
end;
insert into app_private.scan_series_merge_audit(operation,site_id,scan_id,account_id,before_state,after_state)
 select 'media-history-20260928',s.site_id,s.id,t.account_id,
  jsonb_build_object('series_id',s.series_id,'scan_version',s.scan_version,'is_latest',s.is_latest),
  jsonb_build_object('series_id',m.new_series,'scan_version',m.new_version,'is_latest',m.new_latest)
 from merge_before s join merge_mapping m on m.id=s.id join merge_scope t on t.id=s.site_id;
-- Temporary isolated series avoid uniqueness collisions when existing versions interleave.
update public.cms_scans s set series_id=gen_random_uuid(),scan_version=1,is_latest=false from merge_mapping m where m.id=s.id;
update public.cms_scans s set series_id=m.new_series,scan_version=m.new_version::integer,is_latest=m.new_latest from merge_mapping m where m.id=s.id;
-- repeated_from is immutable submission provenance, not the visual ordering: preserve it.
begin
 if exists(select 1 from merge_before b join public.cms_scans s on s.id=b.id
  where (to_jsonb(b)-'series_id'-'scan_version'-'is_latest') is distinct from (to_jsonb(s)-'series_id'-'scan_version'-'is_latest')) then raise exception 'Unexpected scan mutation'; end if;
end;
end $merge$;
