begin;
-- Read-only account-scoped usage; never returns credentials or consumes a claim.
create function public.gemini_usage_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u app_private.gemini_usage%rowtype; used integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into u from app_private.gemini_usage where actor_id=auth.uid();
 used := case when u.usage_date=current_date then u.calls else 0 end;
 return jsonb_build_object(
  'used',used,'limit',20,'remaining',greatest(0,20-used),
  'resetsAt',(current_date+1)::timestamptz,
  'intervalSeconds',10,'availableAt',greatest(now(),u.last_call+interval '10 seconds'),
  'connected',exists(select 1 from app_private.gemini_connections where actor_id=auth.uid() and expires_at>now())
 );
end $$;
revoke all on function public.gemini_usage_status() from public,anon;
grant execute on function public.gemini_usage_status() to authenticated;
commit;
