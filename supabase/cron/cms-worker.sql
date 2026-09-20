-- Run as postgres in the Supabase SQL editor after migration 015.
-- Creates the schedule DISABLED on first installation. Re-running preserves its state.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_cms_edge_worker(p_mode text default 'run')
returns bigint language plpgsql security definer set search_path = '' as $$
declare project_url text; cron_secret text;
begin
  if p_mode is null or p_mode not in ('check', 'run') then raise exception 'Invalid worker mode'; end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'cms_worker_project_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'cms_worker_cron_secret';
  if project_url is null or project_url !~ '^https://[a-z0-9]+\.supabase\.co$'
    or cron_secret is null or cron_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Configure cms_worker_project_url and cms_worker_cron_secret in Vault';
  end if;
  return net.http_post(
    url := project_url || '/functions/v1/cms-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', cron_secret),
    body := jsonb_build_object('mode', p_mode),
    timeout_milliseconds := 110000
  );
end $$;
revoke all on function public.invoke_cms_edge_worker(text) from public, anon, authenticated, service_role;

do $$
declare new_job bigint;
begin
  if not exists (select 1 from cron.job where jobname = 'cms-worker-every-minute') then
    new_job := cron.schedule('cms-worker-every-minute', '* * * * *', 'select public.invoke_cms_edge_worker();');
    perform cron.alter_job(new_job, active := false);
  end if;
end $$;
commit;
