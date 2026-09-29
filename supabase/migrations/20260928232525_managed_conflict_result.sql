begin;
alter table app_private.managed_reference_previews add column system_request_id uuid references public.cms_change_requests(id);
alter table public.cms_change_requests add column managed_reference_id uuid references app_private.managed_reference_previews(id);
alter table public.cms_change_requests drop constraint managed_resolution_shape;
alter table public.cms_change_requests add constraint managed_resolution_shape check (
 (managed_baseline is null and managed_resolution is null and managed_reference_id is null) or
 (managed_value_id is not null and jsonb_typeof(managed_baseline)='array' and managed_baseline is not null and
 ((managed_reference_id is null and managed_resolution is not null and jsonb_typeof(managed_resolution)='object') or (managed_reference_id is not null and managed_resolution is null)))
);
create function public.managed_reference_results(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
 select * into r from public.cms_change_requests where id=p_request;
 if auth.uid() is null or r.actor_id is distinct from auth.uid() or not exists(
   select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id
   where s.id=r.site_id and s.account_id=auth.uid() and m.user_id=auth.uid() and m.role='owner'
 ) then raise exception 'Unavailable' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(latest)) from (
   select distinct on (p.baseline->>'source_key') p.baseline->>'source_key' as "sourceKey",
     case when p.confirmed_at is not null then p.source else e.value->>'actual' end as source,
     case when p.confirmed_at is not null then 'reference' when c.status='confirmed' then 'pending' else 'applied' end as status,
     coalesce(p.confirmed_at,c.created_at) as "confirmedAt",case when p.confirmed_at is null then c.id else null end as "operationId"
   from app_private.managed_reference_previews p
   left join public.cms_change_requests c on c.id=p.system_request_id and c.actor_id=auth.uid() and c.site_id=r.site_id
   left join lateral (select value from jsonb_array_elements(c.results) where value->>'sourceKey'=p.baseline->>'source_key' and value->>'status' in ('applied','already_applied')) e on true
   where p.request_id=r.id and p.actor_id=auth.uid() and (p.confirmed_at is not null or c.status='confirmed' or e.value is not null)
   order by p.baseline->>'source_key',coalesce(p.confirmed_at,c.created_at) desc,p.id desc
 ) latest),'[]'::jsonb);
end $$;
revoke all on function public.managed_reference_results(uuid) from public,anon,authenticated,service_role;
grant execute on function public.managed_reference_results(uuid) to authenticated;
create function public.preview_managed_reference_system(p_id uuid,p_reference uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare p app_private.managed_reference_previews%rowtype; b public.managed_value_bindings%rowtype;
 v public.managed_values%rowtype; s public.sites%rowtype; snapshot jsonb;
begin
 perform public.read_managed_reference(p_reference);
 select * into p from app_private.managed_reference_previews where id=p_reference;
 perform pg_advisory_xact_lock(hashtextextended(p.baseline->>'site_id',0));
 select * into p from app_private.managed_reference_previews where id=p_reference for update;
 if p.system_request_id is not null then
   if p.system_request_id<>p_id then raise exception 'Operation key conflict'; end if;
   return p_id;
 end if;
 select * into s from public.sites where id=(p.baseline->>'site_id')::uuid;
 select * into v from public.managed_values where id=(p.baseline->>'managed_value_id')::uuid for update;
 select * into b from public.managed_value_bindings where id=p.binding_id for update;
 if not found or to_jsonb(b) is distinct from p.baseline or b.uncertain or p.confirmed_at is not null or p.expires_at<=now()
   or v.archived_at is not null or v.version<>p.value_version or s.connection_id<>p.connection_id or v.workspace_id<>s.workspace_id then raise exception 'Reference changed'; end if;
 if exists(select 1 from public.cms_change_requests where id=p_id) then raise exception 'Operation key conflict'; end if;
 -- Reuse the existing managed-sync admission and execution pipeline. Only the
 -- selected field enters this plan; the complete baseline still guards confirmation.
 perform public.preview_managed_value_sync(p_id,v.id,v.version,v.canonical);
 select managed_snapshot into snapshot from public.cms_change_requests where id=p_id;
 update public.cms_change_requests set managed_baseline=snapshot,managed_reference_id=p.id,total=1,
   expires_at=least(expires_at,p.expires_at),
   managed_snapshot=jsonb_build_array(p.baseline||jsonb_build_object('source_value',p.source,'locations',p.locations)) where id=p_id;
 update app_private.managed_reference_previews set system_request_id=p_id where id=p.id;
 insert into public.cms_change_audit(request_id,actor_id,action,detail) values(p_id,auth.uid(),'reference_system_previewed',jsonb_build_object('referenceId',p.id,'originalRequest',p.request_id,'bindingId',b.id));
 return p_id;
end $$;
revoke all on function public.preview_managed_reference_system(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.preview_managed_reference_system(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
