begin;
-- Durable one-attempt budget per confirmed operation. No credential/secret is exposed.
create table app_private.cms_worker_kicks (
 request_id uuid primary key references public.cms_change_requests(id) on delete cascade,
 created_at timestamptz not null default now(),status text not null check(status in ('attempted','enqueued','idle','failed'))
);
alter table app_private.cms_worker_kicks enable row level security;
revoke all on app_private.cms_worker_kicks from public,anon,authenticated,service_role;
create function public.request_cms_worker_kick(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.cms_change_requests%rowtype; request_number bigint; kick_status text;
begin
 select * into r from public.cms_change_requests where id=p_id;
 if not found or auth.uid() is null or r.actor_id<>auth.uid() or not exists(select 1 from public.workspace_members m where m.workspace_id=r.workspace_id and m.user_id=auth.uid() and m.role='owner') then raise exception 'Operation unavailable' using errcode='42501'; end if;
 if not app_private.cms_worker_runnable(r,clock_timestamp()) then return false; end if;
 insert into app_private.cms_worker_kicks(request_id,status) values(p_id,'attempted') on conflict do nothing;
 if not found then return false; end if;
 -- Confirmation has already committed. Subtransaction catches infrastructure errors;
 -- record the attempt even on failure, so replaying confirmation cannot flood Edge.
 begin
  if to_regprocedure('public.invoke_cms_edge_worker(text)') is null then raise exception 'Worker scheduler unavailable'; end if;
  execute 'select public.invoke_cms_edge_worker($1)' into request_number using 'run';
  kick_status:=case when request_number is null then 'idle' else 'enqueued' end;
 exception when others then kick_status:='failed'; end;
 update app_private.cms_worker_kicks set status=kick_status where request_id=p_id;
 insert into public.cms_change_audit(request_id,actor_id,action,step,detail) values(p_id,r.actor_id,'worker_kick',r.cursor,jsonb_build_object('status',kick_status)) on conflict do nothing;
 return kick_status='enqueued';
end $$;
revoke all on function public.request_cms_worker_kick(uuid) from public,anon,service_role;
grant execute on function public.request_cms_worker_kick(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
