-- Read projections: keep large snapshots/results inside PostgreSQL. Existing RLS applies.
create view public.cms_operation_summaries with (security_invoker=true) as
select r.id,r.actor_id,r.workspace_id,r.site_id,r.scan_id,r.managed_value_id,r.reverts_request_id,
 r.status,r.cursor,r.total,r.created_at,r.expires_at,r.retry_at,r.background_paused,r.worker_error,r.queue_order,
 s.verified,s.issues,s.problem,
 coalesce(s.problem,case when r.status='preview' and r.expires_at<=now() then 'expired' else r.status end) as display_status
from public.cms_change_requests r cross join lateral (
 select count(*) filter(where e->>'status' in ('applied','already_applied'))::int verified,
 count(*) filter(where e->>'status' not in ('applied','already_applied'))::int issues,
 case when bool_or(e->>'status'='uncertain') then 'uncertain' when bool_or(e->>'status'='conflict') then 'conflict' when bool_or(e->>'status'='failed') then 'failed' end problem
 from jsonb_array_elements(r.results) e
) s;
create view public.site_change_summaries with (security_invoker=true) as
select id,site_id, 'cms'::text source,
 case when reverts_request_id is not null then 'Reversão' when managed_value_id is not null then 'Sincronização de valor' else 'Edição de conteúdo' end title,
 'CMS'::text target, display_status status,null::text label,verified,total,created_at,problem is not null attention
from public.cms_operation_summaries
union all
select d.id,d.site_id,'static',
 case when d.plan->'changes'->0->'image' is not null then 'Edição de imagens' when d.plan->'changes'->0->'link' is not null then 'Edição de links' else 'Edição de texto' end,
 coalesce(nullif(d.plan->'context'->>'pageName',''),'Página estática'),
 case when s.uncertain or s.conflict or s.reported then 'uncertain' when s.verified=s.total then 'applied' else 'draft' end,
 case when s.uncertain then 'Resultado pendente de verificação' when s.conflict then 'Conflito de conteúdo' when s.reported then 'Aplicação informada pela extensão · sem leitura registrada' when s.verified=s.total then 'Verificada no Designer' when s.verified>0 then 'Parcialmente verificada'
 when exists(select 1 from jsonb_array_elements(d.events) e where e->'plan'->>'id'=d.plan->>'id' and e->>'status'='confirmed') then 'Confirmada · sem resultado verificado'
 when d.expires_at<=now() then 'Prévia expirada' else 'Aguardando confirmação' end,
 s.verified,s.total,d.created_at, s.uncertain or s.conflict or s.reported
from public.designer_changes d cross join lateral (
 select count(*)::int total,count(*) filter(where status in ('applied','already_applied'))::int verified,
 coalesce(bool_or(status in ('uncertain','dispatching')),false) uncertain,
 coalesce(bool_or(status='conflict'),false) conflict,coalesce(bool_or(status='reported'),false) reported
 from (select case when e.event->>'status' in ('applied','already_applied') and (e.event->>'observed') is distinct from (c->>'after') then 'reported' else e.event->>'status' end status
 from jsonb_array_elements(d.plan->'changes') c left join lateral (
 select event from jsonb_array_elements(d.events) with ordinality a(event,position)
 where event->'plan'->>'id'=d.plan->>'id' and event->>'nodeId'=c->>'id' order by position desc limit 1
 ) e on true) statuses
) s;
revoke all on public.cms_operation_summaries,public.site_change_summaries from public,anon;
grant select on public.cms_operation_summaries,public.site_change_summaries to authenticated;

create function public.site_activity_page(p_site uuid,p_filter text default 'all',p_offset integer default 0,p_cursor jsonb default null,p_previous boolean default false)
returns setof public.site_change_summaries language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=p_site and m.user_id=auth.uid() and m.role='owner') then raise exception 'forbidden'; end if;
 if p_filter not in ('all','cms','static','attention') or p_offset<0 or p_offset>1000 then raise exception 'invalid page'; end if;
 return query select x.* from public.site_change_summaries x where x.site_id=p_site
 and (p_filter='all' or p_filter=x.source or (p_filter='attention' and x.attention and (
 (x.source='cms' and x.id in (select id from public.cms_change_requests where site_id=p_site order by created_at desc,id limit 1000)) or
 (x.source='static' and x.id in (select id from public.designer_changes where site_id=p_site order by created_at desc,id limit 1000)))))
 and (p_cursor is null or case when p_previous then
 (x.created_at>(p_cursor->>'at')::timestamptz or (x.created_at=(p_cursor->>'at')::timestamptz and (x.id,x.source)<((p_cursor->>'id')::uuid,p_cursor->>'source')))
 else (x.created_at<(p_cursor->>'at')::timestamptz or (x.created_at=(p_cursor->>'at')::timestamptz and (x.id,x.source)>((p_cursor->>'id')::uuid,p_cursor->>'source'))) end)
 order by case when p_previous then x.created_at end asc,case when not p_previous then x.created_at end desc,
 case when p_previous then x.id end desc,case when not p_previous then x.id end asc,
 case when p_previous then x.source end desc,case when not p_previous then x.source end asc
 limit 6 offset case when p_cursor is null then p_offset else 0 end;
end $$;
revoke all on function public.site_activity_page(uuid,text,integer,jsonb,boolean) from public,anon;
grant execute on function public.site_activity_page(uuid,text,integer,jsonb,boolean) to authenticated;

create function public.site_overview_summary(p_site uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare recent jsonb; scans jsonb; activity jsonb;
begin
 -- The activity function enforces the same current-owner check as the page service.
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into recent from (select * from public.site_activity_page(p_site) limit 5) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into scans from (select id,status,occurrences_count,created_at from public.cms_scans where site_id=p_site order by created_at desc,id limit 5) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into activity from (
 select id,source from (
 select id,'scan'::text source,created_at from public.cms_scans where site_id=p_site
 union all select id,'cms'::text,created_at from public.cms_change_requests where site_id=p_site
 union all select id,'static'::text,created_at from public.designer_changes where site_id=p_site
 ) all_events order by created_at desc,id,source limit 5) x;
 return jsonb_build_object('recent',recent,'scans',scans,'activity',activity,
 'activeValues',(select count(*) from public.managed_values where site_id=p_site and archived_at is null),
 'scanCount',(select count(*) from public.cms_scans where site_id=p_site),
 'latestScanAt',(select max(created_at) from public.cms_scans where site_id=p_site),
 'running',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status)) from public.cms_scans where site_id=p_site and status in ('running','paused')),'[]'),
 'uncertainCount',(select count(*) from public.managed_value_bindings where site_id=p_site and uncertain),
 'uncertain',coalesce((select jsonb_agg(jsonb_build_object('managed_value_id',managed_value_id)) from (select managed_value_id from public.managed_value_bindings where site_id=p_site and uncertain limit 5) x),'[]'));
end $$;
revoke all on function public.site_overview_summary(uuid) from public,anon;
grant execute on function public.site_overview_summary(uuid) to authenticated;

notify pgrst,'reload schema';
