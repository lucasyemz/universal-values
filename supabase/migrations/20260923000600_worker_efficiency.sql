begin;
-- Shared by claim and the non-reserving Cron gate. Never exclude dispatched work:
-- expired dispatched attempts must be reconciled by the existing executor.
create function app_private.cms_worker_runnable(candidate public.cms_change_requests,at_time timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
 select (candidate).status='confirmed' and not (candidate).background_paused and (candidate).background_next_at<=at_time
 and ((candidate).lease_until is null or (candidate).lease_until<=at_time)
 and ((candidate).retry_at is null or (candidate).retry_at<=at_time)
 and not exists(select 1 from public.cms_change_requests q where q.status='confirmed'
  and (q.actor_id=(candidate).actor_id or q.site_id=(candidate).site_id) and q.queue_order<(candidate).queue_order);
$$;
revoke all on function app_private.cms_worker_runnable(public.cms_change_requests,timestamptz) from public,anon,authenticated,service_role;
create function public.cms_worker_has_runnable() returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.cms_change_requests r where r.status='confirmed' and not r.background_paused and app_private.cms_worker_runnable(r,clock_timestamp()));
$$;
revoke all on function public.cms_worker_has_runnable() from public,anon,authenticated,service_role;
create or replace function public.claim_background_cms(p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype; t public.sites%rowtype; c public.webflow_connections%rowtype; token text; rows jsonb; parent jsonb;
begin
  if p_lease is null then raise exception 'Invalid lease'; end if;
  insert into public.cms_worker_health values(true,clock_timestamp()) on conflict(singleton) do update set last_seen_at=excluded.last_seen_at;
  select * into r from public.cms_change_requests candidate where candidate.status='confirmed' and not candidate.background_paused and app_private.cms_worker_runnable(candidate,clock_timestamp())
    order by queue_order for update skip locked limit 1;
  if not found then return null; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=r.workspace_id and user_id=r.actor_id and role='owner') then
    update public.cms_change_requests set background_paused=true,worker_error='authorization_changed' where id=r.id;
    insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(r.id,r.actor_id,'worker_paused',r.cursor,'{"reason":"authorization_changed"}') on conflict do nothing;
    return null;
  end if;
  select * into t from public.sites where id=r.site_id;
  select * into c from public.webflow_connections where id=r.connection_id;
  if t.connection_id is distinct from r.connection_id or c.status is distinct from 'ready' or c.actor_id is distinct from r.actor_id or c.workspace_id is distinct from r.workspace_id then
    update public.cms_change_requests set background_paused=true,worker_error='connection_changed' where id=r.id;
    insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(r.id,r.actor_id,'worker_paused',r.cursor,'{"reason":"connection_changed"}') on conflict do nothing;
    return null;
  end if;
  perform set_config('request.jwt.claim.sub',r.actor_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.actor_id,'role','authenticated')::text,true);
  if not public.claim_cms_change(r.id,r.cursor,p_lease) then return null; end if;
  token:=public.read_webflow_credential(r.connection_id);
  select coalesce(jsonb_agg(to_jsonb(o)),'[]') into rows from public.scan_occurrences o where scan_id=r.scan_id;
  if r.reverts_request_id is not null then select to_jsonb(p) into parent from public.cms_change_requests p where id=r.reverts_request_id; end if;
  insert into public.cms_change_audit(request_id,actor_id,action,step) values(r.id,r.actor_id,'worker_claimed',r.cursor) on conflict do nothing;
  return jsonb_build_object('request',to_jsonb(r),'occurrences',rows,'parent',parent,'site',to_jsonb(t),'connection',jsonb_build_object('id',c.id,'workspace_id',c.workspace_id,'actor_id',c.actor_id),'credential',token);
end $$;

-- Scoped queue health; an absent heartbeat is not evidence of failure while idle.
create function public.cms_worker_status(p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare n timestamptz:=clock_timestamp(); current_state text; next_at timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_id is not null and not exists(select 1 from public.cms_change_requests r join public.workspace_members m on m.workspace_id=r.workspace_id where r.id=p_id and r.actor_id=auth.uid() and m.user_id=auth.uid() and m.role='owner') then raise exception 'Operation unavailable' using errcode='42501'; end if;
 with owned as (
  select r.* from public.cms_change_requests r where r.actor_id=auth.uid() and r.status='confirmed' and (p_id is null or r.id=p_id)
  and exists(select 1 from public.workspace_members m where m.workspace_id=r.workspace_id and m.user_id=auth.uid() and m.role='owner')
 ), states as (
  select r.*,app_private.cms_worker_runnable(r,n) runnable,
  greatest(r.background_next_at,coalesce(r.retry_at,r.background_next_at),coalesce(r.lease_until,r.background_next_at)) due from owned r
 )
 select case
  when count(*)=0 then 'idle'
  when bool_or(lease_until>n) then 'processing'
  when bool_or(worker_error is not null) then 'worker_error'
  when bool_or(runnable and due<n-interval '3 minutes') then 'stalled'
  when bool_or(runnable) then 'queued'
  when bool_or(retry_at>n) then 'cooldown'
  when bool_or(not background_paused) then 'waiting'
  else 'attention' end,
  min(due) filter(where not background_paused or retry_at>n)
 into current_state,next_at from states;
 return jsonb_build_object('state',current_state,'nextAt',next_at);
end $$;
revoke all on function public.cms_worker_status(uuid) from public,anon;
grant execute on function public.cms_worker_status(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
