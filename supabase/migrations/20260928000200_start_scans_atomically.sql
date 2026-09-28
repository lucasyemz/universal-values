-- Setup is ephemeral UI state. Only a confirmed scan may be committed.
create function public.start_cms_scan(p_id uuid,p_site_id uuid,p_plan jsonb,p_truncated boolean)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform public.preview_cms_scan(p_id,p_site_id,p_plan,p_truncated);
 perform public.confirm_cms_scan(p_id);
 return p_id;
end $$;
revoke all on function public.start_cms_scan(uuid,uuid,jsonb,boolean) from public,anon;
grant execute on function public.start_cms_scan(uuid,uuid,jsonb,boolean) to authenticated;
-- Internal validation/idempotency/quota helpers are reused in the same transaction.
revoke execute on function public.preview_cms_scan(uuid,uuid,jsonb,boolean) from authenticated;

-- Remove never-started historical previews, retaining audit and stable URL numbers.
alter table public.scan_audit_events alter column scan_id drop not null;
alter table public.scan_audit_events drop constraint scan_audit_events_scan_id_fkey;
alter table public.scan_audit_events add constraint scan_audit_events_scan_id_fkey
 foreign key(scan_id) references public.cms_scans(id) on delete set null;
delete from public.cms_scans s where s.status='preview' and s.items_read=0 and s.occurrences_count=0
 and not exists(select 1 from public.scan_audit_events a where a.operation_id=s.id and a.action='scan.confirmed')
 and not exists(select 1 from public.scan_occurrences o where o.scan_id=s.id)
 and not exists(select 1 from public.cms_change_requests r where r.scan_id=s.id)
 and not exists(select 1 from public.managed_value_previews p where p.scan_id=s.id)
 and not exists(select 1 from public.scan_review_operations p where p.scan_id=s.id);
