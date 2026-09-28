-- Read-only metadata projection; snapshots remain inside PostgreSQL.
create or replace view public.site_change_summaries with (security_invoker=true) as
select id,site_id, 'cms'::text source,
 case when reverts_request_id is not null then 'Reversão' when managed_value_id is not null then 'Sincronização de valor' else 'Edição de conteúdo' end title,
 'CMS'::text target, display_status status,null::text label,verified,total,created_at,problem is not null attention,
 (select jsonb_build_object(
   'types',coalesce(jsonb_agg(distinct f.kind) filter(where f.kind is not null),'[]'::jsonb),
   'collections',coalesce(jsonb_agg(distinct jsonb_build_object('id',f.collection_id,'name',f.collection_name)) filter(where f.collection_id is not null),'[]'::jsonb),
   'plannedItems',nullif(count(distinct (f.collection_id,f.item_id,f.locale)),0),
   'changedItems',case when count(*)=0 then null else count(distinct (f.collection_id,f.item_id,f.locale)) filter(where exists(
     select 1 from jsonb_array_elements(r.results) result where result->>'sourceKey'=f.source_key and result->>'status'='applied')) end)
 from public.cms_change_requests r cross join lateral (
   select o.collection_id,o.collection_name,o.item_id,o.locale,o.source_key,o.canonical->>'type' kind
   from jsonb_array_elements(r.changes) c join public.scan_occurrences o on o.id::text=c->>'occurrenceId' and o.site_id=r.site_id and o.scan_id=r.scan_id
   union all
   select b->>'collection_id',coalesce((select p->>'name' from public.cms_scans s cross join lateral jsonb_array_elements(s.plan) p
     where s.site_id=r.site_id and p->>'id'=b->>'collection_id' order by s.created_at desc limit 1),'Coleção sem nome'),
     b->>'item_id',b->>'locale',b->>'source_key',b->'canonical'->>'type'
   from jsonb_array_elements(coalesce(r.managed_snapshot,'[]'::jsonb)) b where r.managed_value_id is not null
 ) f where r.id=cms_operation_summaries.id) details
from public.cms_operation_summaries
union all
select d.id,d.site_id,'static',
 case when d.plan->'changes'->0->'image' is not null then 'Edição de imagens' when d.plan->'changes'->0->'link' is not null then 'Edição de links' else 'Edição de texto' end,
 coalesce(nullif(d.plan->'context'->>'pageName',''),'Página estática'),
 case when s.uncertain or s.conflict or s.reported then 'uncertain' when s.verified=s.total then 'applied' else 'draft' end,
 case when s.uncertain then 'Resultado pendente de verificação' when s.conflict then 'Conflito de conteúdo' when s.reported then 'Aplicação informada pela extensão · sem leitura registrada' when s.verified=s.total then 'Verificada no Designer' when s.verified>0 then 'Parcialmente verificada'
 when exists(select 1 from jsonb_array_elements(d.events) e where e->'plan'->>'id'=d.plan->>'id' and e->>'status'='confirmed') then 'Confirmada · sem resultado verificado'
 when d.expires_at<=now() then 'Prévia expirada' else 'Aguardando confirmação' end,
 s.verified,s.total,d.created_at, s.uncertain or s.conflict or s.reported, jsonb_build_object('types',(select coalesce(jsonb_agg(distinct case when c->'image' is not null then 'image' when c->'link' is not null then 'link' else 'text' end),'[]'::jsonb) from jsonb_array_elements(d.plan->'changes') c),'collections','[]'::jsonb,'plannedItems',null,'changedItems',null)
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

revoke all on public.site_change_summaries from public,anon;
grant select on public.site_change_summaries to authenticated;
