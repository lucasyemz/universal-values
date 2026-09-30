begin;
-- Owner-confirmed deletion retains a minimal receipt and usage, not customer history.
create table app_private.site_deletions (
 operation_id uuid primary key, actor_id uuid not null, site_id uuid not null,
 workspace_id uuid not null, account_id uuid not null, slug text not null, created_at timestamptz not null default now()
);
alter table app_private.site_deletions enable row level security;
revoke all on app_private.site_deletions from public,anon,authenticated,service_role;
-- Site-owned records are a single deletion unit. Preserve route reservations as
-- tombstones, and retain existing SET NULL relationships.
do $$
declare fk record; definition text;
begin
 for fk in
 with recursive owned(oid) as (
   select 'public.sites'::regclass::oid
   union
   select c.conrelid from pg_constraint c join owned o on c.confrelid=o.oid
   where c.contype='f' and c.connamespace in ('public'::regnamespace,'app_private'::regnamespace)
 )
 select distinct c.oid,c.conrelid::regclass as relation,c.conname,c.confdeltype
 from pg_constraint c join owned o on c.confrelid=o.oid where c.contype='f'
 loop
   if fk.confdeltype not in ('a','r') then continue; end if;
   definition:=pg_get_constraintdef(fk.oid);
   definition:=regexp_replace(definition,' ON DELETE (NO ACTION|RESTRICT)','');
   if fk.relation::text='dashboard_resource_routes' or fk.relation::text='public.dashboard_resource_routes' then
     definition:=definition || ' ON DELETE SET NULL';
   else
     if position(' DEFERRABLE' in definition)>0 then
       definition:=replace(definition,' DEFERRABLE',' ON DELETE CASCADE DEFERRABLE');
     else definition:=definition || ' ON DELETE CASCADE'; end if;
   end if;
   execute format('alter table %s drop constraint %I',fk.relation,fk.conname);
   execute format('alter table %s add constraint %I %s',fk.relation,fk.conname,definition);
 end loop;
end $$;
create function public.delete_site_history(p_id uuid,p_site uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.sites%rowtype; receipt app_private.site_deletions%rowtype;
begin
 if auth.uid() is null or p_id is null or p_site is null then raise exception 'Owner required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_site::text,0));
 select * into receipt from app_private.site_deletions where operation_id=p_id;
 if found then
   if receipt.actor_id<>auth.uid() or receipt.site_id<>p_site then raise exception 'Operation conflict'; end if;
   return;
 end if;
 select * into s from public.sites where id=p_site for update;
 if not found or not exists(select 1 from public.workspace_members where workspace_id=s.workspace_id and user_id=auth.uid() and role='owner') then raise exception 'Owner required' using errcode='42501'; end if;
 if exists(select 1 from public.cms_scans where site_id=p_site and status in ('running','paused'))
 or exists(select 1 from public.cms_change_requests where site_id=p_site and status='confirmed')
 or exists(select 1 from public.designer_sessions where site_id=p_site and revoked_at is null and expires_at>now()) then
   raise exception 'Site operation in progress';
 end if;
 insert into app_private.site_deletions values(p_id,auth.uid(),p_site,s.workspace_id,s.account_id,s.slug,now());
 delete from public.sites where id=p_site;
end $$;
revoke all on function public.delete_site_history(uuid,uuid) from public,anon,service_role;
grant execute on function public.delete_site_history(uuid,uuid) to authenticated;
create or replace function app_private.assign_site_url_slug() returns trigger
language plpgsql security definer set search_path='' as $$
declare base text; candidate text; owner_id uuid; existing record; suffix integer := 1;
begin
  if tg_op='UPDATE' and old.account_id is not null then
    new.account_id := old.account_id; new.slug := old.slug; new.legacy_slug := old.legacy_slug;
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(721965420);
  select s.account_id,s.slug into existing from public.sites s
    where s.workspace_id=new.workspace_id and s.webflow_site_id=new.webflow_site_id and s.account_id is not null;
  if found then new.account_id:=existing.account_id; new.slug:=existing.slug; return new; end if;
  -- account_site_owner runs before this trigger and preserves the original owner.
  owner_id := new.quota_owner_id;
  if owner_id is null then raise exception 'Site account unavailable'; end if;
  perform app_private.ensure_account_route(owner_id);
  new.account_id:=owner_id;
  base:=app_private.url_name(new.display_name,'projeto');
  candidate:=base;
  while exists(select 1 from public.sites where account_id=owner_id and slug=candidate and id<>new.id) or exists(select 1 from app_private.site_deletions where account_id=owner_id and slug=candidate) loop
    suffix:=suffix+1; candidate:=base || '-' || suffix;
  end loop;
  new.slug:=candidate;
  return new;
end $$;
commit;
