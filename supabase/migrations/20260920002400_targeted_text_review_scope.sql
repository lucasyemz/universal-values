begin;
-- An explicit text search is a fresh review task. Decisions from other scans
-- must not hide its matches. Keep manual decisions and verified edits in THIS scan.
create or replace function public.scan_reviewed_occurrences(p_scan_id uuid) returns table(occurrence_id uuid)
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
  s:=public.require_scan_owner(p_scan_id);
  return query select o.id from public.scan_occurrences o
  where o.scan_id=p_scan_id and case
    when o.canonical->>'type'='text' and exists(select 1 from jsonb_array_elements(s.plan) entry where entry->>'id'=o.collection_id and length(btrim(coalesce(entry->>'searchText','')))>0)
    then coalesce(
      (select operation.reviewed from public.scan_review_operations operation
       where operation.scan_id=p_scan_id and exists(
         select 1 from public.scan_occurrences reviewed where reviewed.id=any(operation.occurrence_ids)
           and reviewed.scan_id=p_scan_id and reviewed.source_key=o.source_key
           and reviewed.canonical=o.canonical and reviewed.source_value=o.source_value)
       order by operation.created_at desc,operation.id desc limit 1),
      exists(select 1 from public.cms_change_requests request join public.cms_change_audit audit on audit.request_id=request.id
        where request.scan_id=p_scan_id and audit.action='content_auto_reviewed'
          and audit.detail->'occurrenceIds' @> jsonb_build_array(o.id::text)))
    else exists(select 1 from public.reviewed_scan_content r where r.site_id=o.site_id
      and r.source_key=o.source_key and r.canonical=o.canonical and r.source_value=o.source_value
      and r.fingerprint=md5(o.canonical::text||':'||o.source_value) and r.reviewed)
    end;
end $$;
notify pgrst,'reload schema';
commit;
