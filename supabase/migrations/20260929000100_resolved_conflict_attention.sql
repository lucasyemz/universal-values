begin;
-- Only confirmed reference reviews or later verified writes settle historical
-- managed-value conflicts. Immutable operation results and verified counts stay intact.
create or replace view public.cms_operation_summaries with (security_invoker=true) as
select r.id,r.actor_id,r.workspace_id,r.site_id,r.scan_id,r.managed_value_id,r.reverts_request_id,
 r.status,r.cursor,r.total,r.created_at,r.expires_at,r.retry_at,r.background_paused,r.worker_error,r.queue_order,
 s.verified,s.issues,s.problem,
 coalesce(s.problem,case when r.status='preview' and r.expires_at<=now() then 'expired' else r.status end) as display_status
from public.cms_change_requests r cross join lateral (
 select count(*) filter(where status in ('applied','already_applied'))::int verified,
 count(*) filter(where status not in ('applied','already_applied') and not resolved)::int issues,
 case when bool_or(status='uncertain') then 'uncertain'
 when bool_or(status='conflict' and not resolved) then 'conflict'
 when bool_or(status='failed') then 'failed' end problem
 from (
  select e->>'status' status,
   coalesce(e->>'status'='conflict' and r.managed_value_id is not null and exists(
    select 1 from jsonb_array_elements(r.managed_snapshot) b
    where b->>'source_key'=e->>'sourceKey' and (
     exists(select 1 from public.cms_change_audit a
      where a.request_id=r.id and a.actor_id=r.actor_id and a.action='reference_updated'
      and a.detail->>'bindingId'=b->>'id')
     or exists(select 1 from public.cms_change_requests newer
      cross join lateral jsonb_array_elements(newer.results) result
      where newer.site_id=r.site_id and newer.actor_id=r.actor_id
      and newer.managed_value_id=r.managed_value_id and newer.created_at>r.created_at
      and result->>'sourceKey'=e->>'sourceKey'
      and result->>'status' in ('applied','already_applied')
      and result->'actual' is not null and result->'actual'<>'null'::jsonb
      and exists(select 1 from jsonb_array_elements(newer.managed_snapshot) nb
       where nb->>'id'=b->>'id' and nb->>'source_key'=b->>'source_key'))
    )
   ),false) resolved
  from jsonb_array_elements(r.results) e
 ) outcomes
) s;
notify pgrst,'reload schema';
commit;
