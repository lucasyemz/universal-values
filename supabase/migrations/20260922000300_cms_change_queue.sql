begin;
-- Confirmation persists the reviewed payload; execution remains serialized.
alter table public.cms_change_requests add column queue_order bigint;
create sequence app_private.cms_change_queue_sequence;
revoke all on sequence app_private.cms_change_queue_sequence from public,anon,authenticated,service_role;
update public.cms_change_requests set queue_order=nextval('app_private.cms_change_queue_sequence') where status='confirmed';
drop index public.one_confirmed_change_per_site;
create unique index cms_change_queue_order on public.cms_change_requests(queue_order) where queue_order is not null;
create index cms_change_actor_queue on public.cms_change_requests(actor_id,queue_order) where status='confirmed';

create or replace function app_private.guard_change() returns trigger language plpgsql security definer set search_path='' as $$
declare extra integer;
begin
  if old.status='preview' and new.status='confirmed' then
    -- Serialize admissions even for administrators. Free quota reservation is
    -- still performed once, at explicit confirmation, never by the executor.
    perform pg_advisory_xact_lock(hashtextextended(new.actor_id::text,220003));
    perform app_private.lock_account(new.actor_id);
    if not app_private.is_admin(new.actor_id) and exists(select 1 from public.cms_scans where actor_id=new.actor_id and status in ('running','paused')) then raise exception 'quota_active_operation'; end if;
    if (select count(*) from public.cms_change_requests where actor_id=new.actor_id and status='confirmed')>=20 then raise exception 'quota_change_queue'; end if;
    if new.managed_value_id is not null and exists(select 1 from public.cms_change_requests where managed_value_id=new.managed_value_id and status='confirmed') then raise exception 'Managed value already queued'; end if;
    select count(*) into extra from jsonb_each(coalesce(new.slug_updates,'{}')) where value->>'before'<>value->>'after';
    perform app_private.reserve_quota(new.actor_id,new.id,'fields',new.total+extra);
    new.queue_order:=nextval('app_private.cms_change_queue_sequence');
  else
    new.queue_order:=old.queue_order;
  end if;
  return new;
end $$;
create or replace function public.claim_cms_change(p_id uuid,p_cursor integer,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype;
begin
  r:=public.require_change_owner(p_id);
  if p_lease is null or p_cursor is null or r.status<>'confirmed' or r.cursor<>p_cursor or r.lease_until>clock_timestamp() or r.retry_at>clock_timestamp() then return false; end if;
  -- Never bypass an older paused, retrying or leased operation. Other accounts
  -- can still run; queue order is immutable and allocated at confirmation.
  if exists(select 1 from public.cms_change_requests q where q.status='confirmed'
    and (q.actor_id=r.actor_id or q.site_id=r.site_id) and q.queue_order<r.queue_order) then return false; end if;
  update public.cms_change_requests set lease_token=p_lease,lease_until=clock_timestamp()+interval '120 seconds' where id=p_id;
  return true;
end $$;

create or replace function public.claim_background_cms(p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype; t public.sites%rowtype; c public.webflow_connections%rowtype; token text; rows jsonb; parent jsonb;
begin
  if p_lease is null then raise exception 'Invalid lease'; end if;
  insert into public.cms_worker_health values(true,clock_timestamp()) on conflict(singleton) do update set last_seen_at=excluded.last_seen_at;
  select * into r from public.cms_change_requests candidate where status='confirmed' and not background_paused and background_next_at<=clock_timestamp()
    and (lease_until is null or lease_until<=clock_timestamp()) and (retry_at is null or retry_at<=clock_timestamp())
    and not exists(select 1 from public.cms_change_requests q where q.status='confirmed' and (q.actor_id=candidate.actor_id or q.site_id=candidate.site_id) and q.queue_order<candidate.queue_order)
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

-- Existing grants remain unchanged: only service_role may claim or dispatch.
commit;
