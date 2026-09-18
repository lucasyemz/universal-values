begin;
alter table public.cms_change_requests add column managed_baseline jsonb;
alter table public.cms_change_requests add column managed_resolution jsonb;
alter table public.cms_change_requests add constraint managed_resolution_shape check (
  (managed_baseline is null and managed_resolution is null) or
  (managed_value_id is not null and managed_baseline is not null and jsonb_typeof(managed_baseline)='array'
    and managed_resolution is not null and jsonb_typeof(managed_resolution)='object')
);

create or replace function public.apply_managed_sync_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare v public.managed_values%rowtype; snapshot jsonb; b jsonb; result jsonb; loc jsonb; source text; previous_end integer:=0; status text;
begin
  if new.managed_value_id is null then return new; end if;
  select * into v from public.managed_values where id=new.managed_value_id for update;
  if new.status='confirmed' and old.status='preview' then
    if v.version<>new.managed_version then raise exception 'Value version conflict' using errcode='40001'; end if;
    select jsonb_agg(to_jsonb(x) order by x.source_key collate "C") into snapshot from public.managed_value_bindings x where managed_value_id=v.id;
    if snapshot is distinct from coalesce(new.managed_baseline,new.managed_snapshot) then raise exception 'Bindings changed'; end if;
    if v.canonical<>new.managed_after then
      update public.managed_values set canonical=new.managed_after,version=version+1 where id=v.id;
    end if;
  end if;
  b:=old.managed_snapshot->old.cursor;
  if new.dispatched and not old.dispatched then
    if (b->>'uncertain')::boolean then raise exception 'Uncertain binding cannot be dispatched'; end if;
    update public.managed_value_bindings set uncertain=true where id=(b->>'id')::uuid and managed_value_id=v.id;
  end if;
  if new.cursor<>old.cursor then
    if new.cursor<>old.cursor+1 or jsonb_array_length(new.results)<>new.cursor then raise exception 'Invalid sync result'; end if;
    result:=new.results->old.cursor; status:=result->>'status';
    if result->>'sourceKey' is distinct from b->>'source_key' then raise exception 'Wrong binding result'; end if;
    if status='applied' and not old.dispatched then raise exception 'Dispatch required'; end if;
    if status in ('applied','already_applied') then
      source:=result->>'bindingSource';
      if jsonb_typeof(result->'bindingSource') is distinct from 'string' or char_length(source)>20000 or jsonb_typeof(result->'bindingLocations') is distinct from 'array' then raise exception 'Invalid binding result'; end if;
      if jsonb_array_length(result->'bindingLocations')<>jsonb_array_length(b->'locations') then raise exception 'Invalid binding locations'; end if;
      if b->>'field_type' in ('Number','Image','ImageRef','MultiImage') then
        if source::jsonb is distinct from result->'actual' then raise exception 'Result differs from binding'; end if;
      elsif to_jsonb(source) is distinct from result->'actual' then raise exception 'Result differs from binding'; end if;
      for loc in select value from jsonb_array_elements(result->'bindingLocations') loop
        if jsonb_typeof(loc->'start') is distinct from 'number' or jsonb_typeof(loc->'end') is distinct from 'number' or jsonb_typeof(loc->'raw') is distinct from 'string'
          or (loc->>'start')::integer<previous_end or (loc->>'end')::integer<=(loc->>'start')::integer
          or (loc->>'end')::integer>char_length(source)
          or substring(source from (loc->>'start')::integer+1 for (loc->>'end')::integer-(loc->>'start')::integer) is distinct from loc->>'raw' then raise exception 'Invalid binding location'; end if;
        previous_end:=(loc->>'end')::integer;
      end loop;
      update public.managed_value_bindings set source_value=source,locations=result->'bindingLocations',canonical=new.managed_after,uncertain=false,last_synced_at=clock_timestamp()
        where id=(b->>'id')::uuid and managed_value_id=v.id;
    else
      update public.managed_value_bindings set uncertain=(status='uncertain' or (b->>'uncertain')::boolean) where id=(b->>'id')::uuid and managed_value_id=v.id;
    end if;
  end if;
  return new;
end $$;
-- Rebase only an explicitly selected source onto immutable scan evidence.
-- All other bindings retain their original snapshots and conflict protection.
create function public.preview_managed_value_resolution(p_id uuid,p_binding_id uuid,p_scan_id uuid,p_occurrence_ids uuid[],p_mode text,p_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.managed_value_bindings%rowtype; v public.managed_values%rowtype; s public.cms_scans%rowtype;
  r public.cms_change_requests%rowtype; o public.scan_occurrences%rowtype; ids uuid[]; meta jsonb; locations jsonb; replacement jsonb; target jsonb; n integer;
begin
  select * into b from public.managed_value_bindings where id=p_binding_id;
  if not found then raise exception 'Binding unavailable'; end if;
  select * into v from public.managed_values where id=b.managed_value_id for update;
  if auth.uid() is null or not exists(select 1 from public.workspace_members where workspace_id=v.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Value unavailable' using errcode='42501'; end if;
  if p_mode is null or p_mode not in ('keep','adopt') or p_version is null or p_id is null or coalesce(cardinality(p_occurrence_ids),0) not between 1 and 1000 then raise exception 'Invalid resolution'; end if;
  select array_agg(x order by x) into ids from (select distinct unnest(p_occurrence_ids) x) q;
  if cardinality(ids)<>cardinality(p_occurrence_ids) then raise exception 'Duplicate occurrence'; end if;
  meta:=jsonb_build_object('bindingId',b.id,'scanId',p_scan_id,'occurrenceIds',ids,'mode',p_mode);
  select * into r from public.cms_change_requests where id=p_id;
  if found then
    if r.actor_id<>auth.uid() or r.managed_value_id<>v.id or r.managed_version<>p_version or r.managed_resolution is distinct from meta then raise exception 'Operation key conflict'; end if;
    return p_id;
  end if;
  -- Refresh the binding after reserving its value, to include any completed step.
  select * into b from public.managed_value_bindings where id=p_binding_id;
  if not found or v.archived_at is not null or b.uncertain then raise exception 'Binding requires reconciliation'; end if;
  s:=public.require_scan_owner(p_scan_id);
  if s.site_id<>v.site_id or s.status not in ('completed','limited') or (b.last_synced_at is not null and s.created_at<b.last_synced_at) then raise exception 'Use a fresh completed scan'; end if;
  select count(*) into n from public.scan_occurrences where id=any(ids) and scan_id=s.id and source_key=b.source_key and field_type=b.field_type;
  if n<>cardinality(ids) then raise exception 'Invalid source selection'; end if;
  select * into o from public.scan_occurrences where id=ids[1];
  if o.canonical->>'type' is distinct from v.canonical->>'type' or (v.canonical->>'type'='money' and o.canonical->>'currency' is distinct from v.canonical->>'currency') then raise exception 'Incompatible value'; end if;
  if exists(select 1 from public.scan_occurrences where id=any(ids) and (source_value<>o.source_value or canonical<>o.canonical)) then raise exception 'Select occurrences of one value'; end if;
  if exists(select 1 from (select start_pos,lag(end_pos) over(order by start_pos,end_pos) previous_end from public.scan_occurrences where id=any(ids)) q where start_pos<previous_end) then raise exception 'Overlapping locations'; end if;
  select jsonb_agg(jsonb_build_object('start',start_pos,'end',end_pos,'raw',raw_match) order by start_pos,end_pos) into locations from public.scan_occurrences where id=any(ids);
  replacement:=to_jsonb(b)||jsonb_build_object('source_value',o.source_value,'canonical',o.canonical,'locations',locations);
  target:=case when p_mode='keep' then v.canonical else o.canonical end;
  perform public.preview_managed_value_sync(p_id,v.id,p_version,target);
  update public.cms_change_requests set managed_baseline=managed_snapshot,managed_resolution=meta,
    managed_snapshot=(select jsonb_agg(case when e->>'id'=b.id::text then replacement else e end order by ord) from jsonb_array_elements(managed_snapshot) with ordinality q(e,ord)) where id=p_id;
  if (select sum(jsonb_array_length(e->'locations')) from public.cms_change_requests req cross join lateral jsonb_array_elements(req.managed_snapshot) e where req.id=p_id)>1000 then raise exception 'Binding limit'; end if;
  update public.cms_change_audit set detail=detail||jsonb_build_object('resolution',meta,'observed',o.canonical) where request_id=p_id and action='previewed';
  return p_id;
end $$;
revoke all on function public.preview_managed_value_resolution(uuid,uuid,uuid,uuid[],text,integer) from public,anon;
grant execute on function public.preview_managed_value_resolution(uuid,uuid,uuid,uuid[],text,integer) to authenticated;
commit;
