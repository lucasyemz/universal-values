create function public.managed_binding_summaries(p_ids uuid[])
returns table(managed_value_id uuid,count bigint,uncertain boolean)
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or coalesce(cardinality(p_ids),0)>5 then raise exception 'Invalid summary scope'; end if;
 if exists(select 1 from unnest(p_ids) requested(value_id) where not exists(select 1 from public.managed_values v join public.workspace_members m on m.workspace_id=v.workspace_id where v.id=requested.value_id and m.user_id=auth.uid() and m.role='owner')) then raise exception 'Value unavailable'; end if;
 return query select v.id,count(b.id),coalesce(bool_or(b.uncertain),false) from public.managed_values v left join public.managed_value_bindings b on b.managed_value_id=v.id where v.id=any(p_ids) group by v.id;
end $$;
create function public.managed_context_page(p_id uuid,p_site uuid,p_page integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v public.managed_values%rowtype; sources jsonb; snapshot jsonb; n bigint; active boolean;
begin
 if p_page is null or p_page<1 or p_page>100 then raise exception 'Invalid page'; end if;
 select * into v from public.managed_values where id=p_id and site_id=p_site;
 if not found or auth.uid() is null or not exists(select 1 from public.workspace_members where workspace_id=v.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Value unavailable'; end if;
 select exists(select 1 from (select status from public.cms_change_requests where managed_value_id=v.id order by created_at desc limit 20) h where status='confirmed') into active;
 if v.archived_at is not null then
 select a.snapshot into snapshot from public.managed_value_archives a where a.managed_value_id=v.id and a.confirmed_at is not null limit 1;
 snapshot:=coalesce(snapshot,'[]'); n:=jsonb_array_length(snapshot);
 select coalesce(jsonb_agg(jsonb_build_object('id',b->>'id','field',b->>'field_slug','collection',b->>'collection_id','item',b->>'item_id','locale',b->>'locale','value',b->>'source_value','uncertain',(b->>'uncertain')::boolean,'verifiedAt',b->>'last_synced_at') order by position),'[]') into sources
 from (select b,position from jsonb_array_elements(snapshot) with ordinality a(b,position) order by position limit 10 offset (p_page-1)*10) x;
 else
 select count(*) into n from public.managed_value_bindings where managed_value_id=v.id;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into sources from (select id,field_slug as field,collection_id as collection,item_id as item,locale,source_value as value,uncertain,last_synced_at as "verifiedAt" from public.managed_value_bindings where managed_value_id=v.id order by id limit 10 offset (p_page-1)*10) x;
 end if;
 return jsonb_build_object('value',jsonb_build_object('id',v.id,'site_id',v.site_id,'name',v.name,'canonical',v.canonical,'version',v.version,'created_at',v.created_at,'archived_at',v.archived_at),
 'disabled',v.archived_at is not null or n=0 or active,'total',n,'page',p_page,'hasMore',p_page*10<n,'sources',sources);
end $$;
revoke all on function public.managed_binding_summaries(uuid[]),public.managed_context_page(uuid,uuid,integer) from public,anon;
grant execute on function public.managed_binding_summaries(uuid[]),public.managed_context_page(uuid,uuid,integer) to authenticated;

notify pgrst,'reload schema';
