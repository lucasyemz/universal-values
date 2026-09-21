begin;
create table app_private.gemini_connections (
 actor_id uuid primary key references auth.users(id) on delete cascade,
 id uuid not null unique, ciphertext text not null,
 expires_at timestamptz not null default (now()+interval '30 days')
);
create table app_private.gemini_usage (
 actor_id uuid primary key references auth.users(id) on delete cascade,
 usage_date date not null default current_date, calls integer not null default 0, last_call timestamptz
);
create table app_private.gemini_audit (
 operation_id uuid primary key, actor_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null, action text not null, created_at timestamptz not null default now()
);
revoke all on app_private.gemini_connections,app_private.gemini_audit,app_private.gemini_usage from public,anon,authenticated,service_role;

create function public.gemini_connection(p_action text,p_id uuid default null,p_ciphertext text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c app_private.gemini_connections%rowtype; a app_private.gemini_audit%rowtype; u app_private.gemini_usage%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gemini:'||auth.uid()::text,0));
 select * into c from app_private.gemini_connections where actor_id=auth.uid() for update;
 if p_action='connect' then
  if p_id is null or p_ciphertext is null or length(p_ciphertext)>18000 or p_ciphertext !~ '^v1\.[0-9a-f]{24}\.[0-9a-f]{32}\.[0-9a-f]+$' then raise exception 'Invalid credential'; end if;
  select * into a from app_private.gemini_audit where operation_id=p_id;
  if found then
   if a.actor_id<>auth.uid() or a.action<>'connected' then raise exception 'Operation conflict'; end if;
   -- Replaying an old connection never restores a revoked credential.
  else
   if c.id is not null and c.expires_at>now() then raise exception 'Revoke current connection first'; end if;
   insert into app_private.gemini_connections(actor_id,id,ciphertext) values(auth.uid(),p_id,p_ciphertext)
    on conflict(actor_id) do update set id=excluded.id,ciphertext=excluded.ciphertext,expires_at=excluded.expires_at;
   insert into app_private.gemini_audit values(p_id,auth.uid(),p_id,'connected',now());
  end if;
 elsif p_action='revoke' then
  if p_id is null then raise exception 'Connection required'; end if;
  if c.id=p_id then
   delete from app_private.gemini_connections where actor_id=auth.uid() and id=p_id;
   insert into app_private.gemini_audit values(gen_random_uuid(),auth.uid(),p_id,'revoked',now());
  end if;
 elsif p_action='claim' then
  if c.id is null or c.expires_at<=now() then raise exception 'Connection expired'; end if;
  insert into app_private.gemini_usage(actor_id) values(auth.uid()) on conflict do nothing;
  select * into u from app_private.gemini_usage where actor_id=auth.uid() for update;
  if u.last_call>now()-interval '10 seconds' or (u.usage_date=current_date and u.calls>=20) then raise exception 'Generation limit'; end if;
  update app_private.gemini_usage set calls=case when usage_date=current_date then calls+1 else 1 end,usage_date=current_date,last_call=now() where actor_id=auth.uid();
  return jsonb_build_object('id',c.id,'ciphertext',c.ciphertext);
 elsif p_action<>'status' then raise exception 'Invalid action';
 end if;
 select * into c from app_private.gemini_connections where actor_id=auth.uid();
 if c.id is null or c.expires_at<=now() then return 'null'::jsonb; end if;
 return jsonb_build_object('id',c.id,'expiresAt',c.expires_at);
end $$;
revoke all on function public.gemini_connection(text,uuid,text) from public,anon;
grant execute on function public.gemini_connection(text,uuid,text) to authenticated;
commit;
