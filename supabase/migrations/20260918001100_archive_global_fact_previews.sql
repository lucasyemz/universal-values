begin;

alter table public.global_fact_previews add column archived_at timestamptz;
alter table public.global_fact_previews add constraint global_fact_preview_archive_state
  check (archived_at is null or confirmed_version is null);
alter table public.global_fact_audit drop constraint global_fact_audit_action_check;
alter table public.global_fact_audit add constraint global_fact_audit_action_check
  check (action in ('previewed','confirmed','archived'));

create function public.archive_global_fact_preview(p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.global_fact_previews%rowtype;
begin
  select * into v_row from public.global_fact_previews where id=p_id;
  if not found or auth.uid() is null or v_row.actor_id<>auth.uid() then raise exception 'Preview unavailable' using errcode='42501'; end if;
  -- Same lock order as confirmation: only one of the operations can win.
  perform 1 from public.sites where id=v_row.site_id for update;
  select * into v_row from public.global_fact_previews where id=p_id for update;
  if not exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=v_row.site_id and m.user_id=auth.uid() and m.role='owner') then
    raise exception 'Owner required' using errcode='42501';
  end if;
  if v_row.confirmed_version is not null then raise exception 'Preview already confirmed' using errcode='22023'; end if;
  if v_row.archived_at is not null then return p_id; end if;
  update public.global_fact_previews set archived_at=clock_timestamp() where id=p_id;
  insert into public.global_fact_audit(preview_id,site_id,actor_id,action) values(p_id,v_row.site_id,auth.uid(),'archived');
  return p_id;
end $$;

create or replace function public.confirm_global_facts(p_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_row public.global_fact_previews%rowtype; v_current integer;
begin
  select * into v_row from public.global_fact_previews where id=p_id;
  if not found or auth.uid() is null or v_row.actor_id<>auth.uid() then raise exception 'Preview unavailable' using errcode='42501'; end if;
  perform 1 from public.sites where id=v_row.site_id for update;
  select * into v_row from public.global_fact_previews where id=p_id for update;
  if not exists(select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id where s.id=v_row.site_id and m.user_id=auth.uid() and m.role='owner') then
    raise exception 'Owner required' using errcode='42501';
  end if;
  if v_row.confirmed_version is not null then return v_row.confirmed_version; end if;
  if v_row.archived_at is not null then raise exception 'Preview archived' using errcode='22023'; end if;
  if v_row.expires_at<=clock_timestamp() then raise exception 'Preview expired' using errcode='22023'; end if;
  select coalesce(max(version),0) into v_current from public.global_fact_versions where site_id=v_row.site_id;
  if v_current<>v_row.base_version then raise exception 'Version conflict' using errcode='40001'; end if;
  insert into public.global_fact_versions(site_id,version,facts,actor_id,preview_id)
    values(v_row.site_id,v_current+1,v_row.facts,auth.uid(),p_id);
  update public.global_fact_previews set confirmed_version=v_current+1 where id=p_id;
  insert into public.global_fact_audit(preview_id,site_id,actor_id,action) values(p_id,v_row.site_id,auth.uid(),'confirmed');
  return v_current+1;
end $$;
revoke all on function public.archive_global_fact_preview(uuid) from public,anon;
grant execute on function public.archive_global_fact_preview(uuid) to authenticated;
commit;
