begin;
-- Runs in the same transaction as the durable worker result, independent of an open tab.
create function app_private.record_applied_review(r public.cms_change_requests,result jsonb,step integer) returns void language plpgsql security definer set search_path='' as $$
declare o public.scan_occurrences%rowtype; target jsonb; source text; ids uuid[]:='{}';
begin
  if r.reverts_request_id is not null then return; end if;
  if coalesce(result->>'status','') not in ('applied','already_applied') then return; end if;
  source:=result->>'reviewedSource';
  -- Historical verified scalar results use the same representation as scan detection.
  if source is null and jsonb_typeof(result->'actual') in ('string','number') then source:=result->>'actual'; end if;
  -- The recorded future source must match the verified provider value.
  if source is not null then
    if jsonb_typeof(result->'actual')='string' then
      if source is distinct from result->>'actual' then raise exception 'Invalid reviewed content'; end if;
    elsif source::jsonb is distinct from result->'actual' then raise exception 'Invalid reviewed content'; end if;
  end if;
  for o in select * from public.scan_occurrences s where s.site_id=r.site_id and s.source_key=result->>'sourceKey'
    and ((r.managed_value_id is null and s.scan_id=r.scan_id and s.id in (select (c->>'occurrenceId')::uuid from jsonb_array_elements(r.changes) c))
      or (r.managed_value_id is not null and exists(select 1 from jsonb_array_elements(r.managed_snapshot) b where b->>'source_key'=s.source_key and b->>'source_value'=s.source_value and b->'canonical'=s.canonical)))
    order by s.id
  loop
    -- Preserve explicit manual decisions for an already recorded fingerprint.
    insert into public.reviewed_scan_content(site_id,workspace_id,occurrence_id,source_key,canonical,source_value,reviewed)
      values(o.site_id,o.workspace_id,o.id,o.source_key,o.canonical,o.source_value,true)
      on conflict(site_id,source_key,fingerprint) do nothing;
    if r.managed_value_id is not null then target:=r.managed_after;
    else select c->'after' into target from jsonb_array_elements(r.changes) c where c->>'occurrenceId'=o.id::text; end if;
    if source is not null and target is not null and public.valid_managed_canonical(target) then
      insert into public.reviewed_scan_content(site_id,workspace_id,occurrence_id,source_key,canonical,source_value,reviewed)
        values(o.site_id,o.workspace_id,o.id,o.source_key,target,source,true)
        on conflict(site_id,source_key,fingerprint) do nothing;
    end if;
    ids:=array_append(ids,o.id);
  end loop;
  if cardinality(ids)>0 then
    insert into public.cms_change_audit(request_id,actor_id,action,step,detail)
      values(r.id,r.actor_id,'content_auto_reviewed',step,jsonb_build_object('occurrenceIds',ids,'futureContent',source is not null)) on conflict do nothing;
  end if;
end $$;
create function app_private.review_applied_content() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.cursor=old.cursor+1 and jsonb_array_length(new.results)=jsonb_array_length(old.results)+1 then
    perform app_private.record_applied_review(new,new.results->(jsonb_array_length(new.results)-1),old.cursor);
  end if;
  return new;
end $$;
create trigger review_applied_content after update on public.cms_change_requests for each row execute function app_private.review_applied_content();
revoke all on function app_private.record_applied_review(public.cms_change_requests,jsonb,integer),app_private.review_applied_content() from public,anon,authenticated,service_role;
-- Reconcile previous successes without changing CMS data or overriding explicit pending flags.
do $$
declare r public.cms_change_requests%rowtype; entry record;
begin
  for r in select * from public.cms_change_requests where reverts_request_id is null and jsonb_array_length(results)>0 loop
    for entry in select value,ordinality from jsonb_array_elements(r.results) with ordinality loop
      perform app_private.record_applied_review(r,entry.value,(entry.ordinality-1)::integer);
    end loop;
  end loop;
end $$;
commit;
