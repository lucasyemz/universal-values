begin;

-- Immutable, server-derived evidence. Clients cannot authorize a range exception.
create table app_private.managed_text_edits (
  request_id uuid not null references public.cms_change_requests(id) deferrable initially deferred,
  source_key text not null, binding_id uuid not null,
  baseline jsonb not null, after_source text not null, after_locations jsonb not null,
  primary key(request_id,source_key)
);
revoke all on app_private.managed_text_edits from public,anon,authenticated,service_role;

create function app_private.prepare_managed_text_edit(r public.cms_change_requests,b public.managed_value_bindings)
returns void language plpgsql security definer set search_path='' as $$
declare e record; loc jsonb; edits jsonb:='[]'; locations jsonb:='[]'; replacement text; output text:=b.source_value;
  boundary integer:=length(b.source_value); previous_end integer:=0; shift integer; start_at integer; end_at integer;
  original app_private.managed_text_edits%rowtype;
begin
  if b.uncertain or b.field_type not in ('PlainText','RichText') then raise exception 'Source managed: edit through its Managed Value'; end if;
  if r.reverts_request_id is not null then
    select * into original from app_private.managed_text_edits where request_id=r.reverts_request_id and source_key=b.source_key;
    if not found or original.binding_id<>b.id or
      (to_jsonb(b)-'last_synced_at') is distinct from ((original.baseline-'last_synced_at') || jsonb_build_object('source_value',original.after_source,'locations',original.after_locations)) then
      raise exception 'Managed binding changed since original edit';
    end if;
    output:=original.baseline->>'source_value'; locations:=original.baseline->'locations';
  else
    if jsonb_array_length(b.locations)=0 then raise exception 'Invalid managed locations'; end if;
    for loc in select value from jsonb_array_elements(b.locations) loop
      start_at:=(loc->>'start')::integer; end_at:=(loc->>'end')::integer;
      if start_at<previous_end or end_at<=start_at or end_at>length(b.source_value) or
        substring(b.source_value from start_at+1 for end_at-start_at) is distinct from loc->>'raw' then raise exception 'Invalid managed locations'; end if;
      previous_end:=end_at;
    end loop;
    for e in select o.*, c.value->'after' as replacement from jsonb_array_elements(r.changes) c(value)
      join public.scan_occurrences o on o.id=(c.value->>'occurrenceId')::uuid and o.scan_id=r.scan_id
      where o.site_id=r.site_id and o.source_key=b.source_key order by o.start_pos desc loop
      if e.field_type<>b.field_type or e.source_value<>b.source_value or e.canonical->>'type'<>'text' or e.replacement->>'type'<>'text' or
        e.start_pos<0 or e.end_pos<=e.start_pos or e.end_pos>boundary or
        substring(b.source_value from e.start_pos+1 for e.end_pos-e.start_pos)<>e.raw_match or
        exists(select 1 from jsonb_array_elements(b.locations) l where e.start_pos<(l->>'end')::integer and (l->>'start')::integer<e.end_pos) then
        raise exception 'Source managed: overlapping or stale text range';
      end if;
      -- Rich Text replacements cannot remove markup or edit attributes.
      -- The executor additionally validates text-node/entity boundaries before writing.
      if b.field_type='RichText' and (e.raw_match ~ '[<>]' or left(b.source_value,e.start_pos) ~ '<[^>]*$') then
        raise exception 'Source managed: invalid HTML text range';
      end if;
      replacement:=e.replacement->>'text';
      if replacement is null then raise exception 'Invalid text replacement'; end if;
      if b.field_type='RichText' then
        replacement:=replace(replace(replace(replace(replacement,'&','&amp;'),'"','&quot;'),'<','&lt;'),'>','&gt;');
      end if;
      output:=overlay(output placing replacement from e.start_pos+1 for e.end_pos-e.start_pos);
      edits:=edits||jsonb_build_array(jsonb_build_object('end',e.end_pos,'delta',length(replacement)-(e.end_pos-e.start_pos)));
      boundary:=e.start_pos;
    end loop;
    if jsonb_array_length(edits)=0 or length(output)>20000 then raise exception 'Invalid independent text edit'; end if;
    for loc in select value from jsonb_array_elements(b.locations) loop
      select coalesce(sum((value->>'delta')::integer),0) into shift from jsonb_array_elements(edits) where (value->>'end')::integer<=(loc->>'start')::integer;
      locations:=locations||jsonb_build_array(loc||jsonb_build_object('start',(loc->>'start')::integer+shift,'end',(loc->>'end')::integer+shift));
    end loop;
  end if;
  insert into app_private.managed_text_edits values(r.id,b.source_key,b.id,to_jsonb(b),output,locations);
end $$;
revoke all on function app_private.prepare_managed_text_edit(public.cms_change_requests,public.managed_value_bindings) from public,anon,authenticated,service_role;

create or replace function public.protect_managed_sources() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.managed_value_bindings%rowtype; t app_private.managed_text_edits%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.site_id::text,0));
  if tg_table_name='managed_value_bindings' then
    if exists(select 1 from public.managed_values where id=new.managed_value_id and archived_at is not null) then raise exception 'Managed value archived'; end if;
    if exists(select 1 from public.cms_change_requests where site_id=new.site_id and status='confirmed') then raise exception 'Site operation in progress'; end if;
    return new;
  end if;
  if tg_op='INSERT' then
    -- ON CONFLICT retries must not recompute evidence from a later binding state.
    if exists(select 1 from public.cms_change_requests where id=new.id) then return new; end if;
  elsif not ((old.status='preview' and new.status='confirmed') or (not old.dispatched and new.dispatched)) then return new;
  end if;
  if new.managed_value_id is not null then
    if exists(select 1 from public.managed_values where id=new.managed_value_id and archived_at is not null) then raise exception 'Managed value archived'; end if;
    return new;
  end if;
  for b in select distinct binding.* from public.managed_value_bindings binding join public.scan_occurrences o on o.site_id=binding.site_id and o.source_key=binding.source_key
    where o.scan_id=new.scan_id and o.id in (select (e->>'occurrenceId')::uuid from jsonb_array_elements(new.changes) e) loop
    if tg_op='INSERT' then
      perform app_private.prepare_managed_text_edit(new,b);
    elsif not exists(select 1 from jsonb_array_elements(new.results) result where result->>'sourceKey'=b.source_key) then
      select * into t from app_private.managed_text_edits where request_id=new.id and source_key=b.source_key;
      if not found or to_jsonb(b) is distinct from t.baseline then raise exception 'Managed binding changed; create a fresh preview'; end if;
    end if;
  end loop;
  if tg_op='UPDATE' and exists(select 1 from app_private.managed_text_edits evidence where evidence.request_id=new.id and
    not exists(select 1 from public.managed_value_bindings current_binding where current_binding.id=evidence.binding_id)) then raise exception 'Managed binding removed; create a fresh preview'; end if;
  return new;
end $$;

create function app_private.finish_managed_text_edit() returns trigger language plpgsql security definer set search_path='' as $$
declare result jsonb; t app_private.managed_text_edits%rowtype; b public.managed_value_bindings%rowtype;
begin
  if new.managed_value_id is not null or new.cursor=old.cursor then return new; end if;
  if new.cursor<>old.cursor+1 or jsonb_array_length(new.results)<>jsonb_array_length(old.results)+1 or
    (new.results-(jsonb_array_length(new.results)-1))<>old.results then raise exception 'Invalid change progress'; end if;
  result:=new.results->old.cursor;
  select * into t from app_private.managed_text_edits where request_id=new.id and source_key=result->>'sourceKey';
  if not found then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.site_id::text,0));
  select * into b from public.managed_value_bindings where id=t.binding_id for update;
  if not found or to_jsonb(b) is distinct from t.baseline then raise exception 'Managed binding changed during edit'; end if;
  if result->>'status' in ('applied','already_applied') then
    if result->'actual' is distinct from to_jsonb(t.after_source) then raise exception 'Managed text edit verification mismatch'; end if;
    update public.managed_value_bindings set source_value=t.after_source,locations=t.after_locations,last_synced_at=clock_timestamp() where id=t.binding_id;
    insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(new.id,new.actor_id,'managed_range_preserved',old.cursor,jsonb_build_object('bindingId',t.binding_id,'sourceKey',t.source_key,'beforeLocations',t.baseline->'locations','afterLocations',t.after_locations));
  elsif result->>'status'='uncertain' then
    update public.managed_value_bindings set uncertain=true where id=t.binding_id;
  end if;
  return new;
end $$;
create trigger finish_managed_text_edit after update on public.cms_change_requests for each row execute function app_private.finish_managed_text_edit();
revoke all on function app_private.finish_managed_text_edit() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
