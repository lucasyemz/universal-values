begin;
alter table public.cms_scans drop constraint cms_scans_status_check;
alter table public.cms_scans add constraint cms_scans_status_check check(status in ('preview','queued','running','paused','completed','limited','cancelled'));
create sequence app_private.scan_queue_sequence;
revoke all on sequence app_private.scan_queue_sequence from public,anon,authenticated,service_role;
alter table public.cms_scans add column queue_order bigint;
update public.cms_scans set queue_order=nextval('app_private.scan_queue_sequence') where status in ('running','paused');
create unique index scan_queue_order on public.cms_scans(queue_order) where queue_order is not null;

create or replace function app_private.guard_scan() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.item_limit:=case when app_private.is_admin(new.actor_id) then 500 else 100 end;
 else
  new.item_limit:=old.item_limit;
  if old.status='preview' and new.status not in ('preview','cancelled') then
   perform pg_advisory_xact_lock(hashtextextended(new.actor_id::text,280003));
   perform app_private.lock_account(new.actor_id);
   if (select count(*) from public.cms_scans where actor_id=new.actor_id and status in ('queued','running','paused'))>=20 then raise exception 'quota_scan_queue'; end if;
   new.item_limit:=case when app_private.is_admin(new.actor_id) then 500 else 100 end;
   perform app_private.reserve_quota(new.actor_id,new.id,'scan',1);
   new.queue_order:=nextval('app_private.scan_queue_sequence');
  else new.queue_order:=old.queue_order;
  end if;
  if new.items_read>old.items_read and new.items_read>new.item_limit then raise exception 'quota_scan_items'; end if;
  if new.items_read>=new.item_limit and new.status='running' then new.status:='limited';new.truncated:=true;new.lease_until:=null;new.retry_at:=null;end if;
 end if;
 return new;
end $$;

create function app_private.scan_runnable(s public.cms_scans) returns boolean
language sql stable security definer set search_path='' as $$
 select s.status in ('queued','running','paused') and s.queue_order is not null
 and not exists(select 1 from public.cms_scans q where q.status in ('queued','running','paused')
  and (q.actor_id=s.actor_id or q.site_id=s.site_id) and q.queue_order<s.queue_order)
 and (app_private.is_admin(s.actor_id) or not exists(select 1 from public.cms_change_requests c where c.actor_id=s.actor_id and c.status='confirmed'));
$$;
revoke all on function app_private.scan_runnable(public.cms_scans) from public,anon,authenticated,service_role;

create or replace function public.confirm_cms_scan(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,280003));
 s:=public.require_scan_owner(p_id);
 if s.status in ('queued','running','paused','completed','limited') then return p_id;end if;
 if s.status<>'preview' or s.expires_at<=clock_timestamp() or not exists(select 1 from public.sites where id=s.site_id and connection_id=s.connection_id and workspace_id=s.workspace_id) then raise exception 'Preview expired or source changed' using errcode='22023';end if;
 update public.cms_scans set status='queued' where id=p_id returning * into s;
 if app_private.scan_runnable(s) then update public.cms_scans set status=case when jsonb_array_length(plan)=0 then 'completed' else 'running' end where id=p_id;end if;
 insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_id,s.workspace_id,auth.uid(),p_id,'scan.confirmed');
 return p_id;
end $$;

create or replace function public.claim_cms_scan_batch(p_id uuid,p_revision integer,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare s public.cms_scans%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,280003));
 s:=public.require_scan_owner(p_id);
 if p_lease is null or p_revision is null then raise exception 'Invalid claim' using errcode='22023';end if;
 if not app_private.scan_runnable(s) or s.revision<>p_revision or s.lease_until>clock_timestamp() or s.retry_at>clock_timestamp() then return false;end if;
 if not exists(select 1 from public.sites where id=s.site_id and connection_id=s.connection_id and workspace_id=s.workspace_id) then raise exception 'Source changed' using errcode='22023';end if;
 update public.cms_scans set status='running',lease_token=p_lease,lease_until=clock_timestamp()+interval '90 seconds',error_code=null,retry_at=null where id=p_id;
 insert into public.scan_audit_events(scan_id,workspace_id,actor_id,operation_id,action) values(p_id,s.workspace_id,auth.uid(),p_lease,'scan.claimed');
 return true;
end $$;

-- Narrow selector, no provider access and no automatic resumption of paused work.
create function public.next_cms_scan() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'revision',s.revision) from public.cms_scans s
 where s.actor_id=auth.uid() and s.status in ('queued','running') and app_private.scan_runnable(s)
 and (s.lease_until is null or s.lease_until<=clock_timestamp()) and (s.retry_at is null or s.retry_at<=clock_timestamp())
 and exists(select 1 from public.sites t join public.workspace_members m on m.workspace_id=t.workspace_id
 where t.id=s.site_id and t.workspace_id=s.workspace_id and t.connection_id=s.connection_id and m.user_id=auth.uid() and m.role='owner')
 order by s.queue_order limit 1;
$$;
revoke all on function public.next_cms_scan() from public,anon;
grant execute on function public.next_cms_scan() to authenticated;
commit;
