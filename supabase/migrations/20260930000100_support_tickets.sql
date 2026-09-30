-- Account support, independent of site resources. No provider/worker actions.
create table public.support_tickets (
 id bigint generated always as identity primary key,
 request_id uuid not null unique,
 owner_id uuid not null references auth.users(id),
 category text not null check(category in ('question','problem','suggestion')),
 subject text not null check(char_length(subject) between 3 and 160),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.support_messages (
 id bigint generated always as identity primary key,
 request_id uuid not null unique,
 ticket_id bigint not null references public.support_tickets(id),
 author_id uuid not null references auth.users(id),
 is_staff boolean not null,
 body text not null check(char_length(body) between 1 and 5000),
 status text not null check(status in ('open','in_progress','resolved')),
 created_at timestamptz not null default now()
);
create index support_owner_list on public.support_tickets(owner_id,id desc);
create index support_thread on public.support_messages(ticket_id,id);
create index support_author_rate on public.support_messages(author_id,created_at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets,public.support_messages from public,anon,authenticated;
grant select on public.support_tickets,public.support_messages to authenticated;
-- Narrow session-only wrapper: private admin helpers are not executable by clients.
create function public.support_is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(app_private.is_admin(auth.uid()),false)
$$;
revoke all on function public.support_is_staff() from public,anon;
grant execute on function public.support_is_staff() to authenticated;
create policy support_ticket_read on public.support_tickets for select to authenticated
 using(owner_id=(select auth.uid()) or (select public.support_is_staff()));
create policy support_message_read on public.support_messages for select to authenticated
 using(exists(select 1 from public.support_tickets t where t.id=ticket_id));

create function public.create_support_ticket(p_request uuid,p_category text,p_subject text,p_body text)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.support_tickets; ticket bigint;
begin
 if actor is null then raise exception 'SUPPORT_DENIED'; end if;
 if p_request is null or p_category is null or p_category not in ('question','problem','suggestion') or p_subject is null or char_length(trim(p_subject)) not between 3 and 160 or p_body is null or char_length(trim(p_body)) not between 1 and 5000 then raise exception 'SUPPORT_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('support:'||actor::text,0));
 select * into existing from public.support_tickets where request_id=p_request;
 if found then
  if existing.owner_id<>actor or existing.category<>p_category or existing.subject<>trim(p_subject) or not exists(select 1 from public.support_messages where ticket_id=existing.id and request_id=p_request and body=trim(p_body)) then raise exception 'SUPPORT_CONFLICT'; end if;
  return existing.id;
 end if;
 if (select count(*) from public.support_tickets where owner_id=actor and created_at>now()-interval '1 day')>=5 then raise exception 'SUPPORT_RATE'; end if;
 insert into public.support_tickets(request_id,owner_id,category,subject) values(p_request,actor,p_category,trim(p_subject)) returning id into ticket;
 insert into public.support_messages(request_id,ticket_id,author_id,is_staff,body,status) values(p_request,ticket,actor,false,trim(p_body),'open');
 return ticket;
end $$;
create function public.reply_support_ticket(p_request uuid,p_ticket bigint,p_body text,p_status text)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ticket public.support_tickets; previous public.support_messages; staff boolean; next_status text;
begin
 if actor is null then raise exception 'SUPPORT_DENIED'; end if;
 if p_request is null or p_body is null or char_length(trim(p_body)) not between 1 and 5000 or p_status is null or p_status not in ('open','in_progress','resolved') then raise exception 'SUPPORT_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('support:'||actor::text,0));
 select * into ticket from public.support_tickets where id=p_ticket for update;
 staff:=app_private.is_admin(actor);
 if ticket.id is null or (ticket.owner_id<>actor and not staff) then raise exception 'SUPPORT_DENIED'; end if;
 if not staff and p_status<>'open' then raise exception 'SUPPORT_DENIED'; end if;
 select * into previous from public.support_messages where request_id=p_request;
 if found then
  if previous.author_id<>actor or previous.ticket_id<>p_ticket or previous.body<>trim(p_body) or previous.status<>p_status then raise exception 'SUPPORT_CONFLICT'; end if;
  return ticket.id;
 end if;
 if (select count(*) from public.support_messages where author_id=actor and created_at>now()-interval '1 hour')>=30 then raise exception 'SUPPORT_RATE'; end if;
 next_status:=p_status;
 insert into public.support_messages(request_id,ticket_id,author_id,is_staff,body,status) values(p_request,p_ticket,actor,staff,trim(p_body),next_status);
 update public.support_tickets set status=next_status,updated_at=now() where id=p_ticket;
 return ticket.id;
end $$;
revoke all on function public.create_support_ticket(uuid,text,text,text),public.reply_support_ticket(uuid,bigint,text,text) from public,anon;
grant execute on function public.create_support_ticket(uuid,text,text,text),public.reply_support_ticket(uuid,bigint,text,text) to authenticated;
