begin;
-- Only token hashes are stored. No service-role or provider credentials are needed.
create table app_private.mcp_tokens (
 id uuid primary key, actor_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 name text not null check(length(name) between 1 and 80),
 scope text not null default 'copyreplace:read' check(scope='copyreplace:read'),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days', revoked_at timestamptz
);
create table app_private.mcp_budget (
 actor_id uuid primary key references auth.users(id) on delete cascade,
 minute_at timestamptz not null, minute_count integer not null,
 day_at timestamptz not null, day_count integer not null
);
create table app_private.mcp_token_audit (
 token_id uuid not null, actor_id uuid not null references auth.users(id) on delete cascade,
 action text not null check(action in ('issued','revoked')), created_at timestamptz not null default now(), primary key(token_id,action)
);
alter table app_private.mcp_tokens enable row level security;
alter table app_private.mcp_budget enable row level security;
alter table app_private.mcp_token_audit enable row level security;
revoke all on app_private.mcp_tokens,app_private.mcp_budget,app_private.mcp_token_audit from public,anon,authenticated,service_role;

create function public.manage_mcp_token(p_action text,p_id uuid default null,p_workspace uuid default null,p_hash text default null,p_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 -- Serialize issuance to enforce a shared five-token limit.
 perform 1 from auth.users where id=actor for update;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from
   (select t.id,t.name,t.workspace_id,t.scope,t.created_at,t.expires_at,t.revoked_at from app_private.mcp_tokens t where t.actor_id=actor and t.revoked_at is null and t.expires_at>now() order by t.created_at desc,t.id limit 5) x;
  return result;
 elsif p_action='issue' then
  if p_id is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_name is null or length(p_name) not between 1 and 80 then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=actor and role='owner') then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if exists(select 1 from app_private.mcp_tokens where id=p_id and actor_id=actor and token_hash=p_hash and workspace_id=p_workspace) then return jsonb_build_object('id',p_id); end if;
  if (select count(*) from app_private.mcp_tokens where actor_id=actor and revoked_at is null and expires_at>now())>=5 then raise exception 'TOKEN_LIMIT'; end if;
  insert into app_private.mcp_tokens(id,actor_id,workspace_id,token_hash,name) values(p_id,actor,p_workspace,p_hash,p_name);
  insert into app_private.mcp_token_audit(token_id,actor_id,action) values(p_id,actor,'issued');
 elsif p_action='revoke' then
  update app_private.mcp_tokens set revoked_at=coalesce(revoked_at,now()) where id=p_id and actor_id=actor;
  if not found then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  insert into app_private.mcp_token_audit(token_id,actor_id,action) values(p_id,actor,'revoked') on conflict do nothing;
 else raise exception 'INVALID_INPUT'; end if;
 return jsonb_build_object('id',p_id);
end $$;
revoke all on function public.manage_mcp_token(text,uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.manage_mcp_token(text,uuid,uuid,text,text) to authenticated;

-- Read gateway. The token never becomes a general Supabase/SQL credential.
create function public.mcp_read(p_token text,p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t app_private.mcp_tokens%rowtype; budget_row app_private.mcp_budget%rowtype;
 s public.sites%rowtype; scan public.cms_scans%rowtype; resource uuid; result jsonb; data jsonb; page_cursor jsonb;
 pg integer; acc text; oldsub text; oldclaims text; stamp timestamptz:=clock_timestamp();
begin
 if p_token is null or p_token !~ '^cr_mcp_[0-9a-f]{64}$' then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 select * into t from app_private.mcp_tokens where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>stamp;
 if not found or not exists(select 1 from public.workspace_members where workspace_id=t.workspace_id and user_id=t.actor_id and role='owner') then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 if exists(select 1 from app_private.plan_policy where singleton and paused) then return jsonb_build_object('error','ACCESS_PAUSED'); end if;
 insert into app_private.mcp_budget values(t.actor_id,date_trunc('minute',stamp),0,date_trunc('day',stamp),0) on conflict do nothing;
 select * into budget_row from app_private.mcp_budget where actor_id=t.actor_id for update;
 if budget_row.minute_at<>date_trunc('minute',stamp) then budget_row.minute_at:=date_trunc('minute',stamp); budget_row.minute_count:=0; end if;
 if budget_row.day_at<>date_trunc('day',stamp) then budget_row.day_at:=date_trunc('day',stamp); budget_row.day_count:=0; end if;
 if budget_row.minute_count>=60 or budget_row.day_count>=1000 then return jsonb_build_object('error','RATE_LIMITED','retryAfter',case when budget_row.day_count>=1000 then ceil(extract(epoch from budget_row.day_at+interval '1 day'-stamp)) else ceil(extract(epoch from budget_row.minute_at+interval '1 minute'-stamp)) end); end if;
 update app_private.mcp_budget set minute_at=budget_row.minute_at,minute_count=budget_row.minute_count+1,day_at=budget_row.day_at,day_count=budget_row.day_count+1 where actor_id=t.actor_id;
 if p_action='authenticate' then return jsonb_build_object('actor',t.actor_id,'workspace',t.workspace_id,'scope',t.scope); end if;
 if p_action not in ('list_sites','get_site_summary','search_candidates','get_scan_results','list_managed_values','get_managed_value','list_recent_changes') or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>16000 then return jsonb_build_object('error','INVALID_INPUT'); end if;
 if coalesce(p_args->>'page','1') !~ '^[1-9][0-9]{0,3}$' then return jsonb_build_object('error','INVALID_INPUT'); end if;
 pg:=coalesce((p_args->>'page')::integer,1);
 select slug into acc from public.account_routes where user_id=t.actor_id;
 if p_action='list_sites' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into data from (select listed.slug as site,acc as account,left(listed.display_name,255) as name from public.sites listed where listed.workspace_id=t.workspace_id and listed.account_id=t.actor_id and (p_args->>'after' is null or listed.slug>p_args->>'after') order by listed.slug limit 6) x;
  return jsonb_build_object('rows',data);
 end if;
 select * into s from public.sites where workspace_id=t.workspace_id and account_id=t.actor_id and slug=p_args->>'site' and acc=p_args->>'account';
 if not found then return jsonb_build_object('error','SITE_NOT_FOUND'); end if;
 -- Existing projections authorize through auth.uid(); set a transaction-local identity
 -- only after checking the scoped token. Restore both settings before returning.
 oldsub:=current_setting('request.jwt.claim.sub',true); oldclaims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claim.sub',t.actor_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor_id,'role','authenticated')::text,true);
 if p_action='get_site_summary' then
  data:=public.site_overview_summary(s.id);
  result:=jsonb_build_object('name',left(s.display_name,255),'activeValues',data->'activeValues','scanCount',data->'scanCount','latestScanAt',data->'latestScanAt','uncertainSources',data->'uncertainCount','recentNeedsAttention',exists(select 1 from jsonb_array_elements(data->'recent') x where x->>'attention'='true'),
   'recentScans',coalesce((select jsonb_agg(jsonb_build_object('number',r.number,'status',x->>'status','recordedOccurrences',(x->>'occurrences_count')::integer,'startedAt',x->>'created_at') order by x->>'created_at' desc,r.number desc) from jsonb_array_elements(data->'scans') x join public.dashboard_resource_routes r on r.kind='scans' and r.resource_id::text=x->>'id' and r.site_id=s.id and r.account_id=t.actor_id),'[]'));
 elsif p_action='search_candidates' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select id,site_id,actor_id,status,plan,created_at,truncated,skipped_fields from public.cms_scans where site_id=s.id and actor_id=t.actor_id and status in ('completed','limited') order by created_at desc,id limit 20) x;
 elsif p_action='get_scan_results' then
  -- Resource UUID permitted internally only after scoped candidate selection; public tool uses number.
  if p_args ? 'scanId' then select id into resource from public.cms_scans where id::text=p_args->>'scanId' and site_id=s.id and actor_id=t.actor_id;
  else select resource_id into resource from public.dashboard_resource_routes where kind='scans' and site_id=s.id and account_id=t.actor_id and number::text=p_args->>'scan'; end if;
  select * into scan from public.cms_scans where id=resource and site_id=s.id and actor_id=t.actor_id;
  if not found then result:=jsonb_build_object('error','SCAN_NOT_FOUND');
  elsif scan.status not in ('completed','limited') then result:=jsonb_build_object('error','SCAN_NOT_READY');
  else
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into data from (select o.id,o.scan_id,o.site_id,o.source_key,o.collection_id,o.collection_name,o.item_id,o.item_name,o.locale,o.field_slug,o.field_name,o.field_type,o.raw_match,o.start_pos,o.end_pos,o.canonical,''::text as source_value,
    exists(select 1 from public.managed_value_bindings b where b.site_id=s.id and b.source_key=o.source_key) as managed_field
    from public.scan_occurrences o where o.scan_id=scan.id and o.site_id=s.id order by o.id limit 1000) x;
   result:=jsonb_build_object('scan',jsonb_build_object('id',scan.id,'site_id',scan.site_id,'actor_id',scan.actor_id,'status',scan.status,'plan',scan.plan,'created_at',scan.created_at,'truncated',scan.truncated,'skipped_fields',scan.skipped_fields),
    'number',(select number from public.dashboard_resource_routes where kind='scans' and resource_id=scan.id and site_id=s.id and account_id=t.actor_id),'rows',data,
    'reviews',(select to_jsonb(x) from public.scan_review_summaries(array[scan.id]) x));
  end if;
 elsif p_action in ('list_managed_values','get_managed_value') then
  if p_action='get_managed_value' then select resource_id into resource from public.dashboard_resource_routes where kind='managed-values' and site_id=s.id and account_id=t.actor_id and number::text=p_args->>'value'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select r.number,left(v.name,80) as name,v.canonical,v.version,v.archived_at,
    (select count(*) from public.managed_value_bindings b where b.managed_value_id=v.id and b.site_id=s.id) as sources,
    exists(select 1 from public.managed_value_bindings b where b.managed_value_id=v.id and b.site_id=s.id and b.uncertain) as uncertain
   from public.managed_values v join public.dashboard_resource_routes r on r.resource_id=v.id and r.kind='managed-values' and r.site_id=s.id and r.account_id=t.actor_id
   where v.site_id=s.id and v.workspace_id=t.workspace_id and (p_action='list_managed_values' or v.id=resource) and (p_action<>'list_managed_values' or p_args->>'before' is null or r.number < (p_args->>'before')::bigint)
   order by r.number desc limit 6
  ) x;
  if p_action='get_managed_value' and jsonb_array_length(result)=0 then result:=jsonb_build_object('error','VALUE_NOT_FOUND'); end if;
 elsif p_action='list_recent_changes' then
  if p_args ? 'cursor' then
   select jsonb_build_object('at',p_args->'cursor'->>'at','id',r.resource_id,'source',p_args->'cursor'->>'source') into page_cursor from public.dashboard_resource_routes r
   where r.site_id=s.id and r.account_id=t.actor_id and r.number::text=p_args->'cursor'->>'number' and r.kind=case when p_args->'cursor'->>'source'='cms' then 'operations' else 'static-changes' end;
  end if;
  if p_args ? 'cursor' and page_cursor is null then result:=jsonb_build_object('error','INVALID_INPUT');
  else
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
    select r.number,c.source,left(c.title,120) title,left(c.target,160) target,c.status,c.verified,c.total,c.created_at,c.attention
    from public.site_activity_page(s.id,'all',0,page_cursor) c join public.dashboard_resource_routes r on r.resource_id=c.id and r.site_id=s.id and r.account_id=t.actor_id and r.kind=case when c.source='cms' then 'operations' else 'static-changes' end
    order by c.created_at desc,c.id,c.source limit 6
   ) x;
  end if;
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(oldsub,''),true);
 perform set_config('request.jwt.claims',coalesce(oldclaims,''),true);
 return jsonb_build_object('data',result,'workspace',t.workspace_id,'site',s.id);
end $$;
revoke all on function public.mcp_read(text,text,jsonb) from public,service_role;
grant execute on function public.mcp_read(text,text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
