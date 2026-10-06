-- roomfit — actually send the emails in email_outbox, and tell the team when
-- someone is interested in a room or claims one.
-- Run AFTER 15_craigslist.sql, in the Supabase SQL editor.
-- Undo: undo/undo_16_email_sending.sql
--
-- How a row in email_outbox becomes an email:
--   1. A trigger posts it to the mailer (a Cloud Run function that sends
--      through Gmail as joinroomfitapp@gmail.com) with pg_net. The request is
--      only made if the transaction commits, so a failed claim sends nothing.
--   2. Every 5 minutes, sync_email_status() reads the mailer's answer: the row
--      gets sent_at, or last_error and another try (three tries in all).
-- The mailer sends plain text, so text_body is what people receive.
--
-- Two things are set OUTSIDE this file, because the repo is public:
--   * the mailer's key, in Vault:
--       select vault.create_secret('<key>', 'roomfit_mailer_api_key',
--                                  'X-Api-Key for the RoomFit mailer');
--   * who gets team alerts:
--       insert into public.team_recipients (email) values ('…'), ('…');
-- Without the key nothing is sent, and each row says so in last_error.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;


-- 1. Who gets team alerts (admins only; filled in by hand, see above) -----------
create table if not exists public.team_recipients (
  email      text primary key check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now()
);

alter table public.team_recipients enable row level security;

drop policy if exists "admins read team recipients" on public.team_recipients;
create policy "admins read team recipients"
  on public.team_recipients for select to authenticated
  using ((select public.is_admin()));


-- 2. The outbox learns two team kinds, and remembers its mailer request ----------
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox
  add constraint email_outbox_kind_check
  check (kind in ('host_interest', 'host_online', 'team_interest', 'team_claim'));

alter table public.email_outbox add column if not exists request_id bigint;


-- 3. Sending -------------------------------------------------------------------------
create or replace function public.mailer_url()
returns text
language sql
immutable
set search_path = ''
as $$ select 'https://roomfitemailer-1006948760009.us-west2.run.app' $$;

-- Posts one outbox row to the mailer. Counts the try; the answer is read later
-- by sync_email_status().
create or replace function public.send_outbox_email(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e     public.email_outbox;
  v_key text;
  v_req bigint;
begin
  select * into e from public.email_outbox where id = p_id;
  if not found or e.sent_at is not null then
    return;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets
   where name = 'roomfit_mailer_api_key';
  if v_key is null then
    update public.email_outbox
       set last_error = 'No mailer key in Vault (roomfit_mailer_api_key).'
     where id = p_id;
    return;
  end if;

  v_req := net.http_post(
    url     := public.mailer_url(),
    body    := jsonb_build_object('messages', jsonb_build_array(jsonb_build_object(
                 'id',      'outbox-' || e.id,
                 'to',      e.to_email,
                 -- the mailer refuses line breaks and anything over 200
                 'subject', left(regexp_replace(e.subject, '[[:space:]]+', ' ', 'g'), 200),
                 'body',    left(e.text_body, 10000)))),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Api-Key', v_key),
    timeout_milliseconds := 60000 -- a cold start plus Gmail can take a while
  );

  update public.email_outbox
     set request_id = v_req, attempts = attempts + 1, last_error = null
   where id = p_id;
end;
$$;

create or replace function public.send_new_outbox_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.send_outbox_email(new.id);
  return null;
end;
$$;

drop trigger if exists send_new_outbox_email on public.email_outbox;
create trigger send_new_outbox_email
  after insert on public.email_outbox
  for each row execute function public.send_new_outbox_email();

-- Reads the mailer's answers, and retries what failed. pg_net keeps answers for
-- six hours, and this runs every five minutes, so none are missed.
create or replace function public.sync_email_status()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o    record;
  ok   boolean;
begin
  for o in
    select e.id, r.status_code, r.content, r.error_msg, r.timed_out
      from public.email_outbox e
      join net._http_response r on r.id = e.request_id
     where e.sent_at is null
  loop
    begin
      ok := o.status_code = 200 and coalesce((o.content::jsonb->>'sent')::int, 0) >= 1;
    exception when others then
      ok := false;
    end;

    if ok then
      update public.email_outbox
         set sent_at = now(), last_error = null, request_id = null
       where id = o.id;
    else
      update public.email_outbox
         set last_error = left(coalesce(
               o.error_msg,
               case when o.timed_out then 'timed out' end,
               o.status_code::text || ' ' || coalesce(o.content, '')), 300),
             request_id = null
       where id = o.id;
    end if;
  end loop;

  -- Try again: failed (or never sent for want of a key), fewer than three
  -- tries, and not more than a day old.
  for o in
    select id from public.email_outbox
     where sent_at is null
       and request_id is null
       and attempts < 3
       and created_at > now() - interval '1 day'
     order by id
     limit 20
  loop
    perform public.send_outbox_email(o.id);
  end loop;
end;
$$;

revoke execute on function public.mailer_url() from public, anon, authenticated;
revoke execute on function public.send_outbox_email(bigint) from public, anon, authenticated;
revoke execute on function public.send_new_outbox_email() from public, anon, authenticated;
revoke execute on function public.sync_email_status() from public, anon, authenticated;

select cron.schedule('roomfit-email-sync', '*/5 * * * *', 'select public.sync_email_status()');


-- 4. Team alerts ------------------------------------------------------------------------
-- One email per team member, so each address is its own outbox row.
create or replace function public.queue_team_email(
  p_kind text, p_room_id bigint, p_user_id uuid, p_subject text, p_body text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.email_outbox (kind, room_id, user_id, to_email, subject, text_body, html_body)
  select p_kind, p_room_id, p_user_id, t.email, p_subject, p_body, ''
    from public.team_recipients t
$$;

revoke execute on function public.queue_team_email(text, bigint, uuid, text, text) from public, anon, authenticated;

-- "Alex is interested in …". Runs at the end of the transaction (a deferred
-- trigger), so it can say whether express_interest just emailed the host.
create or replace function public.team_alert_interest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        public.rooms;
  v_who    text;
  v_email  text;
  v_url    text;
  v_names  text;
  v_count  int;
  v_host   public.email_outbox;
  v_expiry timestamptz;
  v_hostline text;
begin
  select * into r from public.rooms where id = new.room_id;
  if not found then
    return null;
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone'), u.email
    into v_who, v_email
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = new.user_id;

  select source_url into v_url from public.room_sources where room_id = r.id;

  select count(*), string_agg(coalesce(nullif(btrim(p.first_name), ''), 'someone'), ', ' order by ri.created_at)
    into v_count, v_names
    from public.room_interests ri left join public.profiles p on p.id = ri.user_id
   where ri.room_id = r.id;

  select * into v_host from public.email_outbox
   where room_id = r.id and kind = 'host_interest';
  select max(expires_at) into v_expiry from public.claim_links
   where room_id = r.id and used_at is null;

  v_hostline := case
    when v_host.id is null then
      'not sent: no reply address on file.'
    when v_host.user_id = new.user_id then
      format('sent now, with a claim link that works until %s.',
             to_char(v_expiry at time zone 'America/Los_Angeles', 'Mon FMDD'))
    else
      format('already sent on %s, when the first person was interested. Not sent again.',
             to_char(v_host.created_at at time zone 'America/Los_Angeles', 'Mon FMDD'))
  end;

  perform public.queue_team_email(
    'team_interest', r.id, new.user_id,
    format('[RoomFit] %s is interested in "%s"', v_who, r.title),
    format(
      E'%1$s (%2$s) tapped "I''m interested".\n\n'
      'Room:   %3$s\n'
      '        $%4$s/mo · %5$s · room #%6$s\n'
      'Post:   %7$s\n'
      'Note:   "%8$s"\n\n'
      'Interested so far: %9$s (%10$s)\n'
      'Host email: %11$s\n\n'
      '%12$s',
      v_who, coalesce(v_email, 'no email'),
      r.title, to_char(r.rent, 'FM999,999'), r.location, r.id,
      coalesce(v_url, 'none on file'),
      coalesce(new.note, 'Hi! Is the room still available?'),
      v_count, v_names, v_hostline,
      public.app_url()
    )
  );
  return null;
end;
$$;

drop trigger if exists team_alert_interest on public.room_interests;
create constraint trigger team_alert_interest
  after insert on public.room_interests
  deferrable initially deferred
  for each row execute function public.team_alert_interest();

-- "Hana claimed …". Any claim, from Craigslist or from an admin's claim link.
create or replace function public.team_alert_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_who    text;
  v_email  text;
  v_url    text;
  v_count  int;
  v_names  text;
  v_host   timestamptz;
  v_since  text;
begin
  select coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone'), u.email
    into v_who, v_email
    from auth.users u left join public.profiles p on p.id = u.id
   where u.id = new.owner_id;

  select source_url into v_url from public.room_sources where room_id = new.id;

  select count(*), string_agg(coalesce(nullif(btrim(p.first_name), ''), 'someone'), ', ' order by ri.created_at)
    into v_count, v_names
    from public.room_interests ri left join public.profiles p on p.id = ri.user_id
   where ri.room_id = new.id and ri.user_id <> new.owner_id;

  select created_at into v_host from public.email_outbox
   where room_id = new.id and kind = 'host_interest';
  v_since := case when v_host is null then ''
    else format(' (%s after we emailed them)', public.friendly_interval(now() - v_host)) end;

  perform public.queue_team_email(
    'team_claim', new.id, new.owner_id,
    format('[RoomFit] %s claimed "%s"', v_who, new.title),
    format(
      E'%1$s (%2$s) claimed a room%3$s. It''s live now.\n\n'
      'Room:   %4$s\n'
      '        $%5$s/mo · %6$s · room #%7$s\n'
      'From:   %8$s\n'
      'Their answers: tidiness %9$s/5 · social %10$s/5 · sleep %11$s\n\n'
      '%12$s\n\n'
      '%13$s',
      v_who, coalesce(v_email, 'no email'), v_since,
      new.title, to_char(new.rent, 'FM999,999'), new.location, new.id,
      case when new.source = 'craigslist' then 'Craigslist · ' || coalesce(v_url, 'no link on file')
           else coalesce(v_url, 'an admin claim link') end,
      new.cleanliness, new.social_level, new.sleep_schedule,
      case when coalesce(v_count, 0) = 0 then 'Nobody was waiting on it.'
           else format('Waiting for them: %s (%s). Each now has a chat with %s and an email saying the host is here.',
                       v_count, v_names, split_part(v_who, ' ', 1)) end,
      public.app_url()
    )
  );
  return null;
end;
$$;

-- "2 days", "5 hours", "12 minutes".
create or replace function public.friendly_interval(p interval)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p >= interval '2 days'  then extract(day from p)::int || ' days'
    when p >= interval '1 day'   then '1 day'
    when p >= interval '2 hours' then (extract(epoch from p) / 3600)::int || ' hours'
    when p >= interval '1 hour'  then '1 hour'
    when p >= interval '2 minutes' then (extract(epoch from p) / 60)::int || ' minutes'
    else '1 minute'
  end
$$;

drop trigger if exists team_alert_claim on public.rooms;
create trigger team_alert_claim
  after update of claimed_at on public.rooms
  for each row
  when (old.claimed_at is null and new.claimed_at is not null)
  execute function public.team_alert_claim();

revoke execute on function public.team_alert_interest() from public, anon, authenticated;
revoke execute on function public.team_alert_claim() from public, anon, authenticated;
revoke execute on function public.friendly_interval(interval) from public, anon, authenticated;
