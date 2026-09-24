begin;
-- Hosted projects may grant ALL on new public tables by default. RLS limits
-- rows, but is not a replacement for restricting table-level privileges.
revoke all on table public.scan_variable_previews from public, anon, authenticated;
grant select on table public.scan_variable_previews to authenticated;
commit;
