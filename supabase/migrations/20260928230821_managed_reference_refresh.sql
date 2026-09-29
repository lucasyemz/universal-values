begin;
-- Deliberately private: only validated RPCs may change protected binding evidence.
create table app_private.managed_reference_previews (
 id uuid primary key, request_id uuid not null references public.cms_change_requests(id),
 actor_id uuid not null references auth.users(id), binding_id uuid not null,
 baseline jsonb not null, source text not null, locations jsonb not null,
 value_version integer not null, connection_id uuid not null,
 expires_at timestamptz not null default now()+interval '10 minutes',
 confirmed_at timestamptz
);
revoke all on app_private.managed_reference_previews from public,anon,authenticated,service_role;

create function app_private.reference_locations(b public.managed_value_bindings, source text)
returns jsonb language plpgsql set search_path='' as $$
declare loc jsonb; result jsonb:='[]'; pos integer; previous_end integer:=0; raw text;
begin
 if b.uncertain or b.canonical->>'type' is distinct from 'text' or b.field_type not in ('PlainText','RichText')
   or source is null or length(source)>20000 or jsonb_array_length(b.locations)=0 then raise exception 'Reference requires manual review'; end if;
 for loc in select value from jsonb_array_elements(b.locations) loop
   raw:=loc->>'raw'; pos:=strpos(source,raw);
   if raw is null or raw='' or pos=0 or strpos(substring(source from pos+1),raw)>0
     or strpos(substring(b.source_value from strpos(b.source_value,raw)+1),raw)>0
     or substring(b.source_value from (loc->>'start')::integer+1 for (loc->>'end')::integer-(loc->>'start')::integer) is distinct from raw
     or pos-1<previous_end then raise exception 'Managed text missing or ambiguous'; end if;
   previous_end:=pos-1+length(raw);
   if b.field_type='RichText' and (raw ~ '[<>]' or left(source,pos-1) ~ '<[^>]*$' or left(b.source_value,(loc->>'start')::integer) ~ '<[^>]*$') then raise exception 'Invalid HTML text range'; end if;
   result:=result||jsonb_build_array(jsonb_build_object('start',pos-1,'end',previous_end,'raw',raw));
 end loop;
 return result;
end $$;
revoke all on function app_private.reference_locations(public.managed_value_bindings,text) from public,anon,authenticated,service_role;

create function public.preview_managed_reference(p_id uuid,p_request uuid,p_binding uuid,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype; b public.managed_value_bindings%rowtype;
 v public.managed_values%rowtype; s public.sites%rowtype; p app_private.managed_reference_previews%rowtype; locations jsonb;
begin
 select * into r from public.cms_change_requests where id=p_request;
 select * into s from public.sites where id=r.site_id;
 if auth.uid() is null or r.actor_id is distinct from auth.uid() or s.account_id is distinct from auth.uid()
 or not exists(select 1 from public.workspace_members where workspace_id=s.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.id::text,0));
 select * into v from public.managed_values where id=r.managed_value_id and site_id=s.id and workspace_id=s.workspace_id for update;
 if not found or v.archived_at is not null then raise exception 'Value unavailable'; end if;
 select * into b from public.managed_value_bindings where id=p_binding and managed_value_id=v.id and site_id=s.id and workspace_id=s.workspace_id for update;
 if not found or b.uncertain then raise exception 'Binding unavailable'; end if;
 select * into p from app_private.managed_reference_previews where id=p_id;
 if found then
   if p.actor_id<>auth.uid() or p.request_id<>p_request or p.binding_id<>p_binding or p.source is distinct from p_source then raise exception 'Operation key conflict'; end if;
   return to_jsonb(p);
 end if;
 if r.status not in ('completed','cancelled') or not exists(select 1 from jsonb_array_elements(r.results) e where e->>'sourceKey'=b.source_key and e->>'status'='conflict')
   or not exists(select 1 from jsonb_array_elements(r.managed_snapshot) e where e=to_jsonb(b)) then raise exception 'Conflict no longer current'; end if;
 if exists(select 1 from public.cms_change_requests where site_id=s.id and status='confirmed') then raise exception 'Site operation in progress'; end if;
 locations:=app_private.reference_locations(b,p_source);
 insert into app_private.managed_reference_previews(id,request_id,actor_id,binding_id,baseline,source,locations,value_version,connection_id)
 values(p_id,p_request,auth.uid(),b.id,to_jsonb(b),p_source,locations,v.version,s.connection_id) returning * into p;
 insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(r.id,auth.uid(),'reference_previewed',(select coalesce(max(step)+1,0) from public.cms_change_audit where request_id=r.id and action='reference_previewed'),jsonb_build_object('previewId',p.id,'bindingId',b.id));
 return to_jsonb(p);
end $$;

create function public.read_managed_reference(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p app_private.managed_reference_previews%rowtype;
begin
 select * into p from app_private.managed_reference_previews where id=p_id and actor_id=auth.uid();
 if not found or not exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id
 where s.id=(p.baseline->>'site_id')::uuid and s.account_id=auth.uid() and m.user_id=auth.uid() and m.role='owner'
 and s.workspace_id=(p.baseline->>'workspace_id')::uuid) then raise exception 'Unavailable' using errcode='42501'; end if;
 return to_jsonb(p);
end $$;

create function public.confirm_managed_reference(p_id uuid,p_source text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p app_private.managed_reference_previews%rowtype; b public.managed_value_bindings%rowtype; v public.managed_values%rowtype; s public.sites%rowtype;
begin
 perform public.read_managed_reference(p_id);
 select * into p from app_private.managed_reference_previews where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended(p.baseline->>'site_id',0));
 select * into p from app_private.managed_reference_previews where id=p_id for update;
 select * into s from public.sites where id=(p.baseline->>'site_id')::uuid;
 select * into v from public.managed_values where id=(p.baseline->>'managed_value_id')::uuid for update;
 if p.confirmed_at is not null then return v.id; end if;
 select * into b from public.managed_value_bindings where id=p.binding_id for update;
 if not found or to_jsonb(b) is distinct from p.baseline or b.uncertain or v.archived_at is not null or v.version<>p.value_version
 or v.workspace_id<>s.workspace_id or s.connection_id<>p.connection_id or p.expires_at<=now() or p.source is distinct from p_source then raise exception 'Reference changed; review again'; end if;
 if exists(select 1 from public.cms_change_requests where site_id=s.id and status='confirmed') then raise exception 'Site operation in progress'; end if;
 if app_private.reference_locations(b,p_source) is distinct from p.locations then raise exception 'Invalid reference'; end if;
 update public.managed_value_bindings set source_value=p.source,locations=p.locations,last_synced_at=clock_timestamp() where id=b.id;
 update app_private.managed_reference_previews set confirmed_at=clock_timestamp() where id=p.id;
 insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(p.request_id,auth.uid(),'reference_updated',(select coalesce(max(step)+1,0) from public.cms_change_audit where request_id=p.request_id and action='reference_updated'),jsonb_build_object('previewId',p.id,'bindingId',b.id));
 return v.id;
end $$;
revoke all on function public.preview_managed_reference(uuid,uuid,uuid,text), public.read_managed_reference(uuid),public.confirm_managed_reference(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.preview_managed_reference(uuid,uuid,uuid,text),public.read_managed_reference(uuid),public.confirm_managed_reference(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
