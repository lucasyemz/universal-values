-- Stable public-facing names; UUIDs remain the relational identifiers.
alter table public.sites add column slug text;

create function app_private.assign_site_url_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text; candidate text; existing text; suffix integer := 1;
begin
  if tg_op = 'UPDATE' and old.slug is not null then
    new.slug := old.slug;
    return new;
  end if;
  -- Serialize allocation, including collisions such as "project-2" vs "project".
  perform pg_catalog.pg_advisory_xact_lock(721965420);
  select s.slug into existing from public.sites s
    where s.workspace_id = new.workspace_id and s.webflow_site_id = new.webflow_site_id and s.slug is not null;
  if existing is not null then new.slug := existing; return new; end if;
  base := pg_catalog.lower(pg_catalog.translate(new.display_name,
    'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'));
  base := pg_catalog.btrim(pg_catalog.regexp_replace(base, '[^a-z0-9]+', '-', 'g'), '-');
  base := pg_catalog.rtrim(pg_catalog.left(base, 80), '-');
  if base = '' then base := 'projeto'; end if;
  if base = 'preview' or base ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    base := 'projeto-' || base;
  end if;
  candidate := base;
  while exists(select 1 from public.sites s where s.slug = candidate and s.id <> new.id) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;
revoke all on function app_private.assign_site_url_slug() from public, anon, authenticated;
create trigger assign_site_url_slug before insert or update on public.sites
  for each row execute function app_private.assign_site_url_slug();
-- Allocate deterministically for existing sites, without changing their content.
do $$ declare site record; begin
  for site in select id from public.sites order by created_at, id loop
    update public.sites set slug = null where id = site.id;
  end loop;
end $$;
alter table public.sites alter column slug set not null;
alter table public.sites add constraint sites_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 110);
create unique index sites_slug_unique on public.sites(slug);
