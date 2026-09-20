-- One stable URL namespace per account, with project names scoped to it.
create table public.account_routes (
  user_id uuid primary key references auth.users(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 110),
  unique(user_id, slug)
);
alter table public.account_routes enable row level security;
revoke all on public.account_routes from anon, authenticated;
grant select on public.account_routes to authenticated;
create policy account_routes_read on public.account_routes for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.sites s join public.workspace_members m on m.workspace_id=s.workspace_id
  where s.quota_owner_id=account_routes.user_id and m.user_id=(select auth.uid()) and m.role='owner'
));

create function app_private.url_name(value text, fallback text) returns text
language sql immutable set search_path='' as $$
  select coalesce(nullif(pg_catalog.rtrim(pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.translate(coalesce(value,''),
    'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy')),
    '[^a-z0-9]+','-','g'),'-'),80),'-'),''),fallback)
$$;
create function app_private.ensure_account_route(account_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare base text; candidate text; suffix integer := 1;
begin
  perform pg_catalog.pg_advisory_xact_lock(721965421);
  select slug into candidate from public.account_routes where user_id=account_id;
  if found then return candidate; end if;
  select app_private.url_name(pg_catalog.split_part(pg_catalog.to_jsonb(u)->>'email','@',1),'conta') into base from auth.users u where id=account_id;
  if not found then raise exception 'Account unavailable'; end if;
  candidate := base;
  while exists(select 1 from public.account_routes where slug=candidate) loop
    suffix := suffix+1; candidate := base || '-' || suffix;
  end loop;
  insert into public.account_routes(user_id,slug) values(account_id,candidate);
  return candidate;
end $$;
create function app_private.create_account_route() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform app_private.ensure_account_route(new.id); return new; end $$;
create trigger create_account_route after insert on auth.users for each row execute function app_private.create_account_route();
do $$ declare account record; begin
  for account in select id from auth.users order by id loop perform app_private.ensure_account_route(account.id); end loop;
end $$;

alter table public.sites add column account_id uuid references public.account_routes(user_id);
alter table public.sites add column legacy_slug text;
update public.sites set legacy_slug=slug;
create unique index sites_legacy_slug_unique on public.sites(legacy_slug);
drop index public.sites_slug_unique;

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
  while exists(select 1 from public.sites where account_id=owner_id and slug=candidate and id<>new.id) loop
    suffix:=suffix+1; candidate:=base || '-' || suffix;
  end loop;
  new.slug:=candidate;
  return new;
end $$;
do $$ declare site record; begin
  for site in select id from public.sites order by created_at,id loop update public.sites set slug=slug where id=site.id; end loop;
end $$;
alter table public.sites alter column account_id set not null;
create unique index sites_account_slug_unique on public.sites(account_id,slug);
revoke all on function app_private.url_name(text,text), app_private.ensure_account_route(uuid), app_private.create_account_route() from public,anon,authenticated;
