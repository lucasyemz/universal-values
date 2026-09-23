-- Narrow polling contract. No plans, provider credentials or execution functions.
create function public.operation_progress(p_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare r public.cms_operation_summaries%rowtype;
begin
 select * into r from public.cms_operation_summaries where id=p_id;
 if not found or auth.uid() is null or r.actor_id<>auth.uid() then raise exception 'Operation unavailable'; end if;
 if r.scan_id is not null and not exists(select 1 from public.cms_scans s where s.id=r.scan_id and s.site_id=r.site_id and s.workspace_id=r.workspace_id and s.actor_id=auth.uid()) then raise exception 'Scan unavailable'; end if;
 return jsonb_build_object('status',r.status,'cursor',r.cursor,'total',r.total,'retryAt',r.retry_at,
 -- This schema records transition timestamps in its audit, not an updated_at column.
 'updatedAt',coalesce((select max(created_at) from public.cms_change_audit where request_id=r.id),r.created_at),
 'verified',r.verified,'issues',r.issues,'paused',r.background_paused,'error',r.worker_error,
 'queuePosition',case when r.status='confirmed' and r.queue_order is not null then (select count(*)+1 from public.cms_change_requests q where q.actor_id=r.actor_id and q.status='confirmed' and q.queue_order<r.queue_order) end);
end $$;
revoke all on function public.operation_progress(uuid) from public,anon;
grant execute on function public.operation_progress(uuid) to authenticated;

notify pgrst,'reload schema';
