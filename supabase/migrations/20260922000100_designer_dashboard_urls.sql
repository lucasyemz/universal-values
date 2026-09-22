begin;
-- Return scoped public routes only after existing capability and owner validation.
create or replace function public.designer_gateway(p_token_hash text, p_webflow_site_id text, p_action text, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_session public.designer_sessions%rowtype; v_site public.sites%rowtype;
  v_change public.designer_changes%rowtype; v_plan jsonb; v_event jsonb;
  v_status text; v_node text; v_last text; v_id uuid; v_history jsonb; v_base text;
begin
  select * into v_session from public.designer_sessions where token_hash=p_token_hash and revoked_at is null and expires_at>clock_timestamp() for share;
  if not found then raise exception 'Session unavailable' using errcode='42501'; end if;
  select * into v_site from public.sites where id=v_session.site_id;
  if v_site.webflow_site_id is distinct from p_webflow_site_id or not exists (select 1 from public.workspace_members where workspace_id=v_site.workspace_id and user_id=v_session.actor_id and role='owner') then raise exception 'Site unavailable' using errcode='42501'; end if;
  if p_action='home' then
    select '/dashboard/' || a.slug || '/sites/' || v_site.slug into v_base
      from public.account_routes a where a.user_id=v_site.account_id;
    if v_base is null then raise exception 'Dashboard routes unavailable'; end if;
    select coalesce(jsonb_agg(x),'[]') into v_history from (
      select c.id,c.plan->'context'->>'pageName' as page_name,c.created_at,jsonb_array_length(c.plan->'changes') as total,
      (select count(distinct e->>'nodeId') from jsonb_array_elements(c.events) e where e->>'status' in ('applied','already_applied')) as applied,
      v_base || '/changes/' || r.number::text as href
      from public.designer_changes c join public.dashboard_resource_routes r
        on r.kind='static-changes' and r.resource_id=c.id and r.site_id=v_site.id and r.account_id=v_site.account_id
      where c.site_id=v_site.id order by c.created_at desc limit 3) x;
    return jsonb_build_object('siteId',v_site.id,'siteName',v_site.display_name,'workspaceId',v_site.workspace_id,'webflowSiteId',v_site.webflow_site_id,'expiresAt',v_session.expires_at,'recent',v_history,
      'dashboardPath',v_base || '/overview','changesPath',v_base || '/changes?filter=static');
  elsif p_action='preview' then
    v_plan := p_payload->'plan'; v_id := (v_plan->>'id')::uuid;
    if v_id is null or jsonb_typeof(v_plan->'context') is distinct from 'object'
      or jsonb_typeof(v_plan->'context'->'pageId') is distinct from 'string' or coalesce(v_plan->'context'->>'pageId','')=''
      or jsonb_typeof(v_plan->'context'->'rootId') is distinct from 'string' or coalesce(v_plan->'context'->>'rootId','')=''
      or jsonb_typeof(v_plan->'context'->'pageName') is distinct from 'string'
      or jsonb_typeof(v_plan->'expiresAt') is distinct from 'number' then raise exception 'Invalid context'; end if;
    if v_plan->'context'->>'siteId' is distinct from v_site.webflow_site_id or jsonb_typeof(v_plan->'changes') is distinct from 'array' or jsonb_array_length(v_plan->'changes') not between 1 and 100 or octet_length(v_plan::text)>2200000 then raise exception 'Invalid plan'; end if;
    if exists(select 1 from jsonb_array_elements(v_plan->'changes') c where jsonb_typeof(c->'id') is distinct from 'string' or jsonb_typeof(c->'before') is distinct from 'string' or jsonb_typeof(c->'after') is distinct from 'string' or char_length(c->>'before')>10000 or char_length(c->>'after')>10000) then raise exception 'Invalid change'; end if;
    if (select count(distinct c->>'id') from jsonb_array_elements(v_plan->'changes') c)<>jsonb_array_length(v_plan->'changes') then raise exception 'Duplicate node'; end if;
    insert into public.designer_changes(id,site_id,actor_id,session_id,plan,search_text) values(v_id,v_site.id,v_session.actor_id,v_session.id,v_plan,p_payload->>'searchText') on conflict(id) do nothing;
    select * into v_change from public.designer_changes where id=v_id;
    if v_change.session_id<>v_session.id or v_change.plan<>v_plan or v_change.search_text is distinct from p_payload->>'searchText' then raise exception 'Operation conflict'; end if;
    return v_change.plan;
  elsif p_action in ('events','event') then
    v_id := (p_payload->>'id')::uuid;
    select * into v_change from public.designer_changes where id=v_id and site_id=v_site.id and session_id=v_session.id for update;
    if not found then raise exception 'Plan unavailable' using errcode='42501'; end if;
    if p_action='events' then return v_change.events; end if;
    v_event:=p_payload->'event'; v_status:=v_event->>'status'; v_node:=v_event->>'nodeId';
    if jsonb_typeof(v_event->'confirmedAt') is distinct from 'string' or jsonb_typeof(v_event->'at') is distinct from 'string' then raise exception 'Invalid event timestamps'; end if;
    if v_event->'plan' is distinct from v_change.plan or v_status is null or v_status not in ('confirmed','dispatching','applied','already_applied','conflict','uncertain') then raise exception 'Invalid event'; end if;
    if v_status='confirmed' then
      if v_node is not null then raise exception 'Invalid confirmation'; end if;
      if exists(select 1 from jsonb_array_elements(v_change.events) e where e->>'status'='confirmed') then return 'true'; end if;
    else
      if v_node is null or not exists(select 1 from jsonb_array_elements(v_change.plan->'changes') c where c->>'id'=v_node) then raise exception 'Unknown node'; end if;
      if v_status<>'conflict' and not exists(select 1 from jsonb_array_elements(v_change.events) e where e->>'status'='confirmed') then raise exception 'Confirmation required'; end if;
      select e->>'status' into v_last from jsonb_array_elements(v_change.events) with ordinality as t(e,n) where e->>'nodeId'=v_node order by n desc limit 1;
      -- A duplicate dispatch cannot authorize another provider write.
      if v_status='dispatching' and v_last is not null then raise exception 'Dispatch already used'; end if;
      if v_status in ('applied','uncertain') and v_last is distinct from 'dispatching' then
        if v_last=v_status then return 'true'; end if;
        raise exception 'Dispatch required';
      end if;
      if v_status='already_applied' and v_last in ('applied','already_applied') then return 'true'; end if;
      if v_status='conflict' and v_last='conflict' then return 'true'; end if;
    end if;
    if v_status in ('confirmed','dispatching') and v_change.expires_at<=clock_timestamp() then raise exception 'Preview expired'; end if;
    if jsonb_array_length(v_change.events)>500 then raise exception 'Event limit'; end if;
    -- Server receipt time is authoritative; the Designer's result is client-reported.
    v_event:=v_event || jsonb_build_object('at',clock_timestamp());
    update public.designer_changes set events=events || jsonb_build_array(v_event) where id=v_id;
    return 'true';
  end if;
  raise exception 'Invalid action';
end $$;

commit;
