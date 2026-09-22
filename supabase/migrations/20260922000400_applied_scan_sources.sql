begin;
-- Immutable evidence for sequential edits inside one field. No Webflow reads.
alter table public.cms_change_requests add column source_history jsonb not null default '[]'::jsonb;
create function app_private.pin_change_source_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.source_history is distinct from old.source_history then raise exception 'Immutable source history'; end if;
    return new;
  end if;
  new.source_history:='[]'::jsonb;
  if new.scan_id is not null and new.managed_value_id is null then
    if new.reverts_request_id is not null then
      select r.source_history into new.source_history from public.cms_change_requests r
      where r.id=new.reverts_request_id and r.actor_id=new.actor_id and r.site_id=new.site_id and r.scan_id=new.scan_id;
      new.source_history:=coalesce(new.source_history,'[]'::jsonb);
    else
      select coalesce(jsonb_agg(jsonb_build_object('changes',r.changes,'results',r.results) order by r.created_at,r.id),'[]'::jsonb)
      into new.source_history from public.cms_change_requests r
      where r.scan_id=new.scan_id and r.site_id=new.site_id and r.actor_id=new.actor_id
        and r.status in ('completed','cancelled') and r.reverts_request_id is null and jsonb_array_length(r.results)>0;
    end if;
  end if;
  return new;
end $$;
create trigger pin_change_source_history before insert or update on public.cms_change_requests
for each row execute function app_private.pin_change_source_history();
revoke all on function app_private.pin_change_source_history() from public,anon,authenticated,service_role;
commit;
