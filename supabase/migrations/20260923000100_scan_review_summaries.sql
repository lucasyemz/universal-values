begin;
-- Match Zod/ECMAScript trim for saved text only; URLs and all other canonical values remain exact.
-- Existing scan index supplies the <=1,000 rows; transfer summaries, not snapshots.
create function public.scan_review_summaries(p_ids uuid[]) returns table(scan_id uuid,pending bigint,reviewed bigint,total bigint,numeric_singletons jsonb)
language plpgsql security definer set search_path='' as $$
declare sid uuid; s public.cms_scans%rowtype;
begin
 if auth.uid() is null or cardinality(p_ids)>5 then raise exception 'Invalid summary scope' using errcode='42501'; end if;
 foreach sid in array p_ids loop
  select * into s from public.cms_scans where id=sid;
  if not found or s.actor_id<>auth.uid() or not exists(select 1 from public.workspace_members where workspace_id=s.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Scan unavailable' using errcode='42501'; end if;
  if s.status not in ('completed','limited') then continue; end if;
  return query
  with rows as materialized (select o.id,case when o.canonical->>'type'='text' then jsonb_build_object('type','text','text',btrim(o.canonical->>'text',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) else o.canonical end canonical,o.collection_id,o.source_key from public.scan_occurrences o where o.scan_id=sid order by o.id limit 1000),
  reviewed_ids as materialized (
   select occurrence_id id from public.scan_reviewed_occurrences(sid)
   union
   select o.id from public.cms_change_requests r
   cross join lateral jsonb_array_elements(r.changes) c
   join rows o on o.id::text=c->>'occurrenceId'
   where r.scan_id=sid and r.actor_id=auth.uid() and exists(
    select 1 from (select result from jsonb_array_elements(r.results) with ordinality e(result,position) where result->>'sourceKey'=o.source_key
      and result->>'status' in ('applied','already_applied') order by position limit 1) first_success where result ? 'actual' or result->>'reviewedSource' is not null)
  ), classified as (
   select o.*,count(*) over(partition by canonical) n,exists(select 1 from reviewed_ids r where r.id=o.id) done from rows o
  ), eligible as (
   select * from classified where n>=2 or canonical->>'type'='text' and exists(select 1 from jsonb_array_elements(s.plan) e where length(btrim(coalesce(e->>'searchText',''),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))>0 or e->>'placeholders'='true')
  )
  select sid, count(*) filter(where not done),count(*) filter(where done),count(*),
   coalesce((select jsonb_agg(jsonb_build_object('collection_id',collection_id,'number',canonical->>'number','reviewed',done)) from classified where n=1 and canonical->>'type'='number'),'[]'::jsonb)
   from eligible;
 end loop;
end $$;
revoke all on function public.scan_review_summaries(uuid[]) from public,anon,service_role;
grant execute on function public.scan_review_summaries(uuid[]) to authenticated;
commit;

notify pgrst,'reload schema';
