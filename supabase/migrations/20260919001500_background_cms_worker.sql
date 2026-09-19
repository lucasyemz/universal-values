begin;
alter table public.cms_change_requests add column background_paused boolean not null default false;
alter table public.cms_change_requests add column background_next_at timestamptz not null default now();
alter table public.cms_change_requests add column worker_error text;
update public.cms_change_requests set background_paused=true where status='confirmed' and jsonb_array_length(results)>0 and results->-1->>'status' not in ('applied','already_applied');
create index cms_worker_queue on public.cms_change_requests(background_next_at,created_at) where status='confirmed' and not background_paused;

create function public.schedule_cms_background() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='preview' and new.status='confirmed' then new.background_paused:=false; new.worker_error:=null; new.background_next_at:=clock_timestamp(); end if;
  if new.cursor>old.cursor then
    new.background_paused:=new.status='confirmed' and new.results->-1->>'status' not in ('applied','already_applied');
    new.background_next_at:=clock_timestamp()+interval '5 seconds'; new.worker_error:=null;
  end if;
  return new;
end $$;
create trigger schedule_cms_background before update on public.cms_change_requests for each row execute function public.schedule_cms_background();
revoke all on function public.schedule_cms_background() from public,anon,authenticated;

create table public.cms_worker_health(singleton boolean primary key default true check(singleton),last_seen_at timestamptz not null);
alter table public.cms_worker_health enable row level security;
revoke all on public.cms_worker_health from public,anon,authenticated;
create function public.cms_worker_last_seen() returns timestamptz language sql security definer set search_path='' as $$ select last_seen_at from public.cms_worker_health where singleton and auth.uid() is not null $$;
revoke all on function public.cms_worker_last_seen() from public,anon;
grant execute on function public.cms_worker_last_seen() to authenticated;

-- No browser session or user token is stored. The worker can only pick confirmed
-- work and derives the actor from that immutable request, never from its caller.
create function public.claim_background_cms(p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype; t public.sites%rowtype; c public.webflow_connections%rowtype; token text; rows jsonb; parent jsonb;
begin
  if p_lease is null then raise exception 'Invalid lease'; end if;
  insert into public.cms_worker_health values(true,clock_timestamp()) on conflict(singleton) do update set last_seen_at=excluded.last_seen_at;
  select * into r from public.cms_change_requests where status='confirmed' and not background_paused and background_next_at<=clock_timestamp()
    and (lease_until is null or lease_until<=clock_timestamp()) and (retry_at is null or retry_at<=clock_timestamp())
    order by background_next_at,created_at for update skip locked limit 1;
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

create function public.background_cms_step(p_id uuid,p_cursor integer,p_lease uuid,p_action text,p_result jsonb default null,p_wait integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  select * into r from public.cms_change_requests where id=p_id for update;
  if not found or p_lease is null or p_cursor is null or r.lease_token is distinct from p_lease then raise exception 'Stale worker lease'; end if;
  perform set_config('request.jwt.claim.sub',r.actor_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.actor_id,'role','authenticated')::text,true);
  if p_action='finish' then return to_jsonb(public.finish_cms_change(p_id,p_cursor,p_lease,p_result,p_wait)); end if;
  if r.status<>'confirmed' or r.cursor<>p_cursor then raise exception 'Stale worker step'; end if;
  if p_action='dispatch' then
    if r.background_paused or not exists(select 1 from public.sites t join public.webflow_connections c on c.id=t.connection_id where t.id=r.site_id and c.id=r.connection_id and c.status='ready' and c.actor_id=r.actor_id) then raise exception 'Connection changed'; end if;
    return to_jsonb(public.dispatch_cms_change(p_id,p_cursor,p_lease));
  elsif p_action='pause' then
    update public.cms_change_requests set background_paused=true,worker_error='processing_error',lease_until=null where id=p_id;
    insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(p_id,r.actor_id,'worker_paused',p_cursor,'{"reason":"processing_error"}') on conflict do nothing;
    return to_jsonb(p_id);
  end if;
  raise exception 'Invalid worker action';
end $$;

create function public.resume_background_cms(p_id uuid,p_cursor integer) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  r:=public.require_change_owner(p_id);
  if r.status<>'confirmed' or p_cursor is null or r.cursor<>p_cursor then raise exception 'Stale resume'; end if;
  if not r.background_paused then return p_id; end if;
  if r.lease_until>clock_timestamp() then raise exception 'Active worker'; end if;
  update public.cms_change_requests set background_paused=false,worker_error=null,background_next_at=clock_timestamp() where id=p_id;
  insert into public.cms_change_audit(request_id,actor_id,action,step) values(p_id,r.actor_id,'worker_resumed',r.cursor) on conflict do nothing;
  return p_id;
end $$;
-- The web application only observes/resumes/cancels; the executor owns steps.
revoke execute on function public.claim_cms_change(uuid,integer,uuid),public.dispatch_cms_change(uuid,integer,uuid),public.finish_cms_change(uuid,integer,uuid,jsonb,integer) from authenticated;
revoke all on function public.claim_background_cms(uuid),public.background_cms_step(uuid,integer,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_background_cms(uuid),public.background_cms_step(uuid,integer,uuid,text,jsonb,integer) to service_role;
revoke all on function public.resume_background_cms(uuid,integer) from public,anon;
grant execute on function public.resume_background_cms(uuid,integer) to authenticated;
commit;
