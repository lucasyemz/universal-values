begin;

-- Allow empty text only as a replacement; canonical Managed Values stay nonempty.
create or replace function public.preview_cms_changes(p_id uuid,p_scan_id uuid,p_changes jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype; t public.sites%rowtype; r public.cms_change_requests%rowtype; c jsonb; o public.scan_occurrences%rowtype; n integer;
begin
  s:=public.require_scan_owner(p_scan_id);
  if s.status not in ('completed','limited') then raise exception 'Scan incomplete'; end if;
  select * into t from public.sites where id=s.site_id;
  if not exists(select 1 from public.webflow_connections where id=t.connection_id and actor_id=auth.uid() and status='ready') then raise exception 'Connection unavailable'; end if;
  if p_id is null or p_changes is null or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes) not between 1 and 1000 then raise exception 'Invalid changes'; end if;
  for c in select * from jsonb_array_elements(p_changes) loop
    select * into o from public.scan_occurrences where id=(c->>'occurrenceId')::uuid and scan_id=p_scan_id;
    if not found or not (public.valid_managed_canonical(c->'after') or (c->'after' = '{"type":"text","text":""}'::jsonb and o.field_type in ('PlainText','RichText'))) or c->'after'=o.canonical or c->'after'->>'type' is distinct from o.canonical->>'type' or (o.canonical->>'type'='money' and c->'after'->>'currency' is distinct from o.canonical->>'currency') then raise exception 'Invalid occurrence'; end if;
  end loop;
  if (select count(distinct value->>'occurrenceId') from jsonb_array_elements(p_changes))<>jsonb_array_length(p_changes) then raise exception 'Duplicate occurrence'; end if;
  select count(distinct source_key) into n from public.scan_occurrences where id in (select (value->>'occurrenceId')::uuid from jsonb_array_elements(p_changes));
  insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total) values(p_id,p_scan_id,s.site_id,s.workspace_id,auth.uid(),t.connection_id,p_changes,n) on conflict(id) do nothing;
  r:=public.require_change_owner(p_id);
  if r.scan_id<>p_scan_id or r.changes<>p_changes then raise exception 'Operation key conflict'; end if;
  insert into public.cms_change_audit(request_id,actor_id,action) values(p_id,auth.uid(),'previewed') on conflict do nothing;
  return p_id;
end $$;


commit;
