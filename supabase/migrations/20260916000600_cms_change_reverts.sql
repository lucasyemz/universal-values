begin;
alter table public.cms_change_requests add column reverts_request_id uuid references public.cms_change_requests(id);

create function public.preview_cms_revert(p_id uuid,p_original_id uuid,p_sources jsonb default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare original public.cms_change_requests%rowtype; current_site public.sites%rowtype; preview public.cms_change_requests%rowtype; selected jsonb; count_fields integer;
begin
  original:=public.require_change_owner(p_original_id);
  if p_id is null or p_id=p_original_id or original.reverts_request_id is not null or original.status not in ('completed','cancelled') then raise exception 'Revert unavailable'; end if;
  if p_sources is not null and (jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources)=0) then raise exception 'Invalid sources'; end if;
  if p_sources is not null and exists(select 1 from jsonb_array_elements_text(p_sources) s where not exists(select 1 from jsonb_array_elements(original.results) r where r->>'sourceKey'=s and r->>'status'='applied' and r ? 'actual')) then raise exception 'Invalid source'; end if;
  select jsonb_agg(c.value order by c.ordinality),count(distinct o.source_key) into selected,count_fields
  from jsonb_array_elements(original.changes) with ordinality c(value,ordinality)
  join public.scan_occurrences o on o.id=(c.value->>'occurrenceId')::uuid and o.scan_id=original.scan_id
  where exists(select 1 from jsonb_array_elements(original.results) r where r->>'sourceKey'=o.source_key and r->>'status'='applied' and r ? 'actual')
    and (p_sources is null or p_sources ? o.source_key);
  if selected is null or count_fields=0 then raise exception 'No applied fields'; end if;
  select * into current_site from public.sites where id=original.site_id;
  if not exists(select 1 from public.webflow_connections where id=current_site.connection_id and actor_id=auth.uid() and status='ready') then raise exception 'Connection unavailable'; end if;
  insert into public.cms_change_requests(id,scan_id,site_id,workspace_id,actor_id,connection_id,changes,total,reverts_request_id)
    values(p_id,original.scan_id,original.site_id,original.workspace_id,auth.uid(),current_site.connection_id,selected,count_fields,p_original_id) on conflict(id) do nothing;
  preview:=public.require_change_owner(p_id);
  if preview.reverts_request_id is distinct from p_original_id or preview.changes<>selected then raise exception 'Operation key conflict'; end if;
  insert into public.cms_change_audit(request_id,actor_id,action,detail) values(p_id,auth.uid(),'previewed',jsonb_build_object('reverts_request_id',p_original_id)) on conflict do nothing;
  return p_id;
end $$;
revoke all on function public.preview_cms_revert(uuid,uuid,jsonb) from public,anon;
grant execute on function public.preview_cms_revert(uuid,uuid,jsonb) to authenticated;
commit;
