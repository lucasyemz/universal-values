begin;
-- Legacy scans have no per-collection accounting. Do not infer from matches.
alter table public.cms_scans add column collection_items_read jsonb;
alter table public.cms_scans alter column collection_items_read set default '{}'::jsonb;

create function public.record_scan_collection_items() returns trigger
language plpgsql set search_path='' as $$
declare collection_id text; delta integer;
begin
  -- Only an accepted batch advances the revision/cursor. Retries do not count twice.
  if new.revision > old.revision and new.items_read >= old.items_read
    and old.collection_items_read is not null then
    collection_id := old.plan->old.collection_index->>'id';
    delta := new.items_read - old.items_read;
    if collection_id is not null and (delta > 0 or new.collection_index > old.collection_index) then
      new.collection_items_read := jsonb_set(old.collection_items_read, array[collection_id],
        to_jsonb(coalesce((old.collection_items_read->>collection_id)::integer,0) + delta), true);
    end if;
  end if;
  return new;
end $$;
create trigger scan_collection_items before update on public.cms_scans
for each row execute function public.record_scan_collection_items();
commit;
