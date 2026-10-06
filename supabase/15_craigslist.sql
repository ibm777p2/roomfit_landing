-- roomfit — rooms imported from Craigslist, "I'm interested", and the emails
-- that bring their hosts (and the people interested in them) back to RoomFit.
-- Run AFTER 14_waitlist_neighborhoods.sql, in the Supabase SQL editor.
-- Additive: every existing room stays as it is (source 'roomfit').
-- Undo: undo/undo_15_craigslist.sql
--
-- The flow:
--   1. Once a day a script (scripts/craigslist-import/) signs in as an admin and
--      adds new Craigslist rooms through import_listing(): inactive, owned by
--      that admin, with the post link and post key in room_sources.
--   2. The email bot finds each post's reply address and hands it to
--      report_email(), which saves it and makes the room live.
--   3. On a live, unclaimed Craigslist room the app shows "I'm interested"
--      instead of "Message". express_interest() records it; the FIRST interest
--      in a room also writes the one email to its host, with a claim link.
--   4. When the host claims the room (claim_room sets claimed_at), each
--      interested person's note becomes their first message to the host, and
--      each gets an email saying the host is on RoomFit now.
-- Emails are rows in email_outbox; 16_email_sending.sql sends them.


-- 1. Where a room came from, and whether its real owner has claimed it ----------
-- source is public (the app picks the button from it); the post link, post key
-- and reply address are not, so they live in room_sources, which only admins
-- can read. claimed_at is kept separately from source so a claimed Craigslist
-- room is still countable as one.
alter table public.rooms
  add column if not exists source text not null default 'roomfit'
  check (source in ('roomfit', 'craigslist', 'facebook'));

alter table public.rooms
  add column if not exists claimed_at timestamptz;

-- Rooms claimed before this column existed: their link records when.
update public.rooms r
   set claimed_at = l.used_at
  from (select room_id, max(used_at) as used_at
          from public.claim_links
         where used_at is not null
         group by room_id) l
 where r.id = l.room_id
   and r.claimed_at is null;

-- Only admins (and the functions below) may set either. Same pattern as
-- protect_profile_role: requests from the app run as 'authenticated'.
create or replace function public.protect_room_origin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.source     := 'roomfit';
      new.claimed_at := null;
    else
      new.source     := old.source;
      new.claimed_at := old.claimed_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_room_origin on public.rooms;
create trigger protect_room_origin
  before insert or update on public.rooms
  for each row execute function public.protect_room_origin();


-- 2. More about the original post (admins only) ---------------------------------
-- external_id is Craigslist's post key, the last part of the post link
-- (…/vFk9WYuZwZHGFbnazzzFDZ). Unique, so the daily import can never add the
-- same post twice. raw keeps the whole scraped record for re-reading later.
alter table public.room_sources
  add column if not exists external_id      text,
  add column if not exists contact_email    text
    check (contact_email is null or contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  add column if not exists posted_at        timestamptz,
  add column if not exists raw              jsonb,
  add column if not exists email_status     text
    check (email_status in ('found', 'gone', 'mismatch', 'no_email', 'error')),
  add column if not exists email_attempts   smallint not null default 0,
  add column if not exists email_checked_at timestamptz;

create unique index if not exists room_sources_external_id_key
  on public.room_sources (external_id)
  where external_id is not null;


-- 3. Emails waiting to be sent ----------------------------------------------------
-- Closed table: written only by the functions below, read by admins. The sending
-- function marks each row with mark_email_sent().
create table if not exists public.email_outbox (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('host_interest', 'host_online')),
  room_id    bigint references public.rooms(id) on delete set null,
  user_id    uuid references auth.users(id) on delete set null,
  to_email   text not null,
  subject    text not null,
  text_body  text not null,
  html_body  text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  attempts   smallint not null default 0,
  last_error text
);

-- One email to a host per room, ever — the database guarantees it.
create unique index if not exists email_outbox_one_host_email
  on public.email_outbox (room_id)
  where kind = 'host_interest';

create index if not exists email_outbox_unsent_idx
  on public.email_outbox (created_at)
  where sent_at is null;

alter table public.email_outbox enable row level security;

drop policy if exists "admins read the outbox" on public.email_outbox;
create policy "admins read the outbox"
  on public.email_outbox for select to authenticated
  using ((select public.is_admin()));


-- 4. "I'm interested" -------------------------------------------------------------
-- One row per person per room. People see their own (so the card can say
-- "Interest sent"); admins see all; nobody writes here except express_interest.
create table if not exists public.room_interests (
  room_id    bigint not null references public.rooms(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  note       text check (note is null or char_length(note) between 1 and 500),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_interests_user_idx on public.room_interests (user_id);

alter table public.room_interests enable row level security;

drop policy if exists "users read their own interests" on public.room_interests;
create policy "users read their own interests"
  on public.room_interests for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "admins read all interests" on public.room_interests;
create policy "admins read all interests"
  on public.room_interests for select to authenticated
  using ((select public.is_admin()));


-- 5. Small helpers for the emails --------------------------------------------------
create or replace function public.app_url()
returns text
language sql
immutable
set search_path = ''
as $$ select 'https://app.joinroomfit.com' $$;

create or replace function public.html_escape(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

-- The shared email frame: a heading, paragraphs, one button, a small footer.
-- Every argument is escaped here, so callers pass plain text.
create or replace function public.email_html(
  p_heading text,
  p_paragraphs text[],
  p_button_label text,
  p_button_url text,
  p_footer text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select
    '<div style="background:#f4f1e5;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Helvetica,Arial,sans-serif;color:#191c1a">'
    || '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px 24px">'
    || '<p style="margin:0 0 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#2f6f4e;font-weight:700">roomfit</p>'
    || '<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">' || public.html_escape(p_heading) || '</h1>'
    || (select string_agg('<p style="margin:0 0 14px;font-size:16px;line-height:1.55">'
                          || public.html_escape(p) || '</p>', '' order by n)
          from unnest(p_paragraphs) with ordinality as x(p, n))
    || '<p style="margin:22px 0"><a href="' || public.html_escape(p_button_url)
    || '" style="display:inline-block;background:#2f6f4e;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px">'
    || public.html_escape(p_button_label) || '</a></p>'
    || '<p style="margin:0;font-size:13px;line-height:1.5;color:#646d66">' || public.html_escape(p_footer) || '</p>'
    || '</div></div>'
$$;

revoke execute on function public.app_url() from public, anon, authenticated;
revoke execute on function public.html_escape(text) from public, anon, authenticated;
revoke execute on function public.email_html(text, text[], text, text, text) from public, anon, authenticated;


-- 6. express_interest ------------------------------------------------------------
-- Returns 'sent', or 'already' when this person has already said so. The room
-- row is locked first, so two people tapping at the same moment queue up: the
-- first one writes the host email, the second sees it's already there.
create or replace function public.express_interest(p_room_id bigint, p_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  r       public.rooms;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
  v_email text;
  v_token uuid;
  v_name  text;
  v_claim text;
  v_where text;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Keep your note under 500 characters.';
  end if;

  select * into r from public.rooms where id = p_room_id for update;
  if not found or not r.active or r.source <> 'craigslist' or r.claimed_at is not null then
    raise exception 'This room isn''t taking interest here. Try Message instead.';
  end if;
  if r.owner_id = v_uid then
    raise exception 'This is your own listing.';
  end if;

  insert into public.room_interests (room_id, user_id, note)
  values (r.id, v_uid, v_note)
  on conflict (room_id, user_id) do nothing;
  if not found then
    return 'already';
  end if;

  -- Only the first interest in a room emails its host. Everyone after that is
  -- waiting for them when they claim it.
  if exists (select 1 from public.email_outbox
              where room_id = r.id and kind = 'host_interest') then
    return 'sent';
  end if;

  select contact_email into v_email from public.room_sources where room_id = r.id;
  if v_email is null then
    return 'sent'; -- live rooms always have one; nothing to send if not
  end if;

  -- A fresh 14-day link; any older one for this room stops working.
  update public.claim_links
     set expires_at = now()
   where room_id = r.id and used_at is null and expires_at > now();
  insert into public.claim_links (room_id, created_by)
  values (r.id, r.owner_id)
  returning token into v_token;

  select coalesce(nullif(btrim(first_name), ''), 'Someone')
    into v_name
    from public.profiles where id = v_uid;
  v_name  := coalesce(v_name, 'Someone');
  v_claim := public.app_url() || '/?claim=' || v_token;
  v_where := format('$%s/mo · %s', to_char(r.rent, 'FM999,999'), r.location);

  insert into public.email_outbox
    (kind, room_id, user_id, to_email, subject, text_body, html_body)
  values (
    'host_interest', r.id, v_uid, v_email,
    r.title,
    format(
      E'Hi,\n\n'
      '%1$s found your room "%2$s" (%3$s) on RoomFit and wants to know more:\n\n'
      '  "%4$s"\n\n'
      'RoomFit is a new San Francisco app that matches people to rooms by how '
      'they''ll actually live together: budget, neighbourhood, tidiness, social '
      'life and sleep schedule. So the people who reach out have already been '
      'scored against your place.\n\n'
      'We''ve set up your listing from your Craigslist post. Claim it to read '
      '%1$s''s message and reply. It''s free and takes about a minute:\n\n'
      '%5$s\n\n'
      'The link works for 14 days.\n\n'
      'The RoomFit team\n\n'
      '--\nYou''re getting this because someone asked about your Craigslist post. '
      'It''s the only email we''ll send about it.',
      v_name, r.title, v_where,
      coalesce(v_note, 'Hi! Is the room still available?'),
      v_claim
    ),
    public.email_html(
      format('%s wants to rent your room', v_name),
      array[
        format('%s found "%s" (%s) on RoomFit and wants to know more:', v_name, r.title, v_where),
        format('"%s"', coalesce(v_note, 'Hi! Is the room still available?')),
        'RoomFit is a new San Francisco app that matches people to rooms by how '
        'they''ll actually live together: budget, neighbourhood, tidiness, social '
        'life and sleep schedule. So the people who reach out have already been '
        'scored against your place.',
        format('We''ve set up your listing from your Craigslist post. Claim it to '
               'read %s''s message and reply. It''s free and takes about a minute.', v_name)
      ],
      format('See %s''s message', v_name),
      v_claim,
      'The link works for 14 days. You''re getting this because someone asked '
      'about your Craigslist post. It''s the only email we''ll send about it.'
    )
  );

  return 'sent';
end;
$$;

revoke execute on function public.express_interest(bigint, text) from public, anon;
grant execute on function public.express_interest(bigint, text) to authenticated;


-- 7. claim_room, now stamping claimed_at ------------------------------------------
-- Same as 12_descriptions.sql, plus claimed_at = now().
create or replace function public.claim_room(p_token text, p_room jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_token  uuid;
  link     public.claim_links;
  v_owner  uuid;
  v_photos text[];
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;

  begin
    v_token := p_token::uuid;
  exception when others then
    raise exception 'This link isn''t valid.';
  end;

  select * into link from public.claim_links where token = v_token for update;
  if not found then
    raise exception 'This link isn''t valid.';
  end if;
  if link.used_at is not null then
    raise exception 'This link has already been used.';
  end if;
  if link.expires_at <= now() then
    raise exception 'This link has expired. Ask us for a new one.';
  end if;

  select owner_id into v_owner from public.rooms where id = link.room_id for update;
  if not found then
    raise exception 'That room no longer exists.';
  end if;
  if v_owner = v_uid then
    raise exception 'This listing is already yours.';
  end if;

  if coalesce(trim(p_room->>'title'), '') = ''
     or coalesce(trim(p_room->>'location'), '') = '' then
    raise exception 'The listing needs a title and a location.';
  end if;

  v_photos := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_room->'photos', '[]'::jsonb))),
    '{}'
  );
  if cardinality(v_photos) > 5 then
    raise exception 'A listing can have at most 5 photos.';
  end if;

  update public.rooms set
    title           = trim(p_room->>'title'),
    rent            = (p_room->>'rent')::int,
    location        = trim(p_room->>'location'),
    description     = case
                        when p_room ? 'description'
                          then nullif(trim(p_room->>'description'), '')
                        else description
                      end,
    cleanliness     = (p_room->>'cleanliness')::smallint,
    social_level    = (p_room->>'social_level')::smallint,
    sleep_schedule  = p_room->>'sleep_schedule',
    pets_allowed    = coalesce((p_room->>'pets_allowed')::boolean, false),
    smoking_allowed = coalesce((p_room->>'smoking_allowed')::boolean, false),
    photos          = v_photos,
    photo_url       = v_photos[1],
    owner_id        = v_uid,
    active          = true,
    claimed_at      = now()
  where id = link.room_id;

  update public.claim_links
     set used_at = now(), used_by = v_uid
   where token = v_token;

  -- belt and braces: no other link for this room keeps working
  update public.claim_links
     set expires_at = now()
   where room_id = link.room_id and used_at is null and expires_at > now();

  return link.room_id;
end;
$$;

revoke execute on function public.claim_room(text, jsonb) from public, anon;
grant execute on function public.claim_room(text, jsonb) to authenticated;


-- 8. After a claim: bring everyone who was interested back --------------------------
-- Each interested person gets their own conversation with the new owner,
-- opened by their note (or "Is the room still available?"), and an email.
-- Nobody sees anyone else's: these are ordinary one-to-one threads.
create or replace function public.welcome_interested_after_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  i      record;
  v_link text := public.app_url() || '/?view=messages';
  v_where text := format('$%s/mo · %s', to_char(new.rent, 'FM999,999'), new.location);
begin
  for i in
    select ri.user_id, ri.note, u.email,
           coalesce(nullif(btrim(p.first_name), ''), 'there') as first_name
      from public.room_interests ri
      join auth.users u on u.id = ri.user_id
      left join public.profiles p on p.id = ri.user_id
     where ri.room_id = new.id
       and ri.user_id <> new.owner_id
     order by ri.created_at
  loop
    insert into public.messages (room_id, sender_id, recipient_id, body)
    values (new.id, i.user_id, new.owner_id,
            coalesce(i.note, 'Hi! Is the room still available?'));

    if i.email is not null then
      insert into public.email_outbox
        (kind, room_id, user_id, to_email, subject, text_body, html_body)
      values (
        'host_online', new.id, i.user_id, i.email,
        format('The host of "%s" is on RoomFit now', new.title),
        format(
          E'Hi %1$s,\n\n'
          'Good news: the host of "%2$s" (%3$s) just joined RoomFit, and your '
          'message is waiting for them.\n\n'
          'Open your inbox to keep the conversation going:\n%4$s\n\n'
          'Rooms in San Francisco go fast, so it''s worth checking in today.\n\n'
          'The RoomFit team',
          i.first_name, new.title, v_where, v_link
        ),
        public.email_html(
          'Your host is on RoomFit',
          array[
            format('Hi %s,', i.first_name),
            format('Good news: the host of "%s" (%s) just joined RoomFit, and '
                   'your message is waiting for them.', new.title, v_where),
            'Rooms in San Francisco go fast, so it''s worth checking in today.'
          ],
          'Open your inbox',
          v_link,
          'You''re getting this because you tapped "I''m interested" on this room in RoomFit.'
        )
      );
    end if;
  end loop;

  return null;
end;
$$;

revoke execute on function public.welcome_interested_after_claim() from public, anon, authenticated;

drop trigger if exists welcome_interested_after_claim on public.rooms;
create trigger welcome_interested_after_claim
  after update of claimed_at on public.rooms
  for each row
  when (old.claimed_at is null and new.claimed_at is not null)
  execute function public.welcome_interested_after_claim();


-- 9. The daily import (called by the script, signed in as an admin) -------------------
-- Security invoker on purpose: the admin's own row-level rules still apply, so
-- rooms land in their own name and photos in their own folder.

-- Which of these post keys are already in RoomFit.
create or replace function public.known_external_ids(p_ids text[])
returns setof text
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can import rooms.';
  end if;
  return query
    select external_id from public.room_sources where external_id = any(p_ids);
end;
$$;

-- Adds one room and its source together. Returns the new room id, or null when
-- the post is already in RoomFit (the unique post key decides).
create or replace function public.import_listing(p_room jsonb, p_source jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id     bigint;
  v_photos text[];
begin
  if not public.is_admin() then
    raise exception 'Only an admin can import rooms.';
  end if;
  if p_source->>'source' is distinct from 'craigslist' then
    raise exception 'Only Craigslist imports are supported.';
  end if;
  if coalesce(p_source->>'external_id', '') = '' then
    raise exception 'An import needs the post key.';
  end if;

  v_photos := array(select jsonb_array_elements_text(coalesce(p_room->'photos', '[]'::jsonb)));
  if cardinality(v_photos) not between 1 and 5 then
    raise exception 'An imported room needs 1 to 5 photos.';
  end if;

  begin
    insert into public.rooms
      (title, rent, location, description, cleanliness, social_level,
       sleep_schedule, pets_allowed, smoking_allowed, photos, photo_url,
       owner_id, active, source)
    values (
      trim(p_room->>'title'),
      (p_room->>'rent')::int,
      trim(p_room->>'location'),
      nullif(trim(p_room->>'description'), ''),
      3, 3, 'flexible', -- placeholders: the host answers these when claiming
      coalesce((p_room->>'pets_allowed')::boolean, false),
      coalesce((p_room->>'smoking_allowed')::boolean, false),
      v_photos, v_photos[1],
      auth.uid(), false, 'craigslist'
    )
    returning id into v_id;

    insert into public.room_sources (room_id, source_url, external_id, posted_at, raw)
    values (v_id, p_source->>'source_url', p_source->>'external_id',
            (p_source->>'posted_at')::timestamptz, p_source->'raw');
  exception when unique_violation then
    return null; -- already imported; the room insert above is undone too
  end;

  return v_id;
end;
$$;

-- Removes the caller's unclaimed Craigslist rooms that can't go anywhere: the
-- post is over 30 days old (Craigslist has taken it down), or the bot found it
-- gone, wrong or without an email, or failed on it three times. Returns their
-- photo links so the script can delete the files too.
create or replace function public.delete_stale_imports()
returns table (room_id bigint, photos text[])
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can clean up imports.';
  end if;
  return query
    delete from public.rooms r
     using public.room_sources s
     where s.room_id = r.id
       and r.owner_id = auth.uid()
       and r.source = 'craigslist'
       and r.claimed_at is null
       and (   s.posted_at < now() - interval '30 days'
            or s.email_status in ('gone', 'mismatch', 'no_email')
            or s.email_attempts >= 3)
    returning r.id, r.photos;
end;
$$;

revoke execute on function public.known_external_ids(text[]) from public, anon;
revoke execute on function public.import_listing(jsonb, jsonb) from public, anon;
revoke execute on function public.delete_stale_imports() from public, anon;
grant execute on function public.known_external_ids(text[]) to authenticated;
grant execute on function public.import_listing(jsonb, jsonb) to authenticated;
grant execute on function public.delete_stale_imports() to authenticated;


-- 10. The email bot --------------------------------------------------------------------
-- The bot runs these two through its own database connection; the app's roles
-- can't call them. Instructions: scripts/craigslist-import/EMAIL_BOT.md

-- Craigslist rooms waiting for a reply address, newest posts first.
create or replace function public.email_queue(p_limit int default 50)
returns table (room_id bigint, title text, rent int, source_url text,
               external_id text, attempts smallint)
language sql
stable
set search_path = ''
as $$
  select r.id, r.title, r.rent, s.source_url, s.external_id, s.email_attempts
    from public.rooms r
    join public.room_sources s on s.room_id = r.id
   where r.source = 'craigslist'
     and not r.active
     and r.claimed_at is null
     and s.contact_email is null
     and (s.email_status is null or s.email_status = 'error')
     and s.email_attempts < 3
   order by s.posted_at desc nulls last, r.id desc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
$$;

-- Records what the bot found. 'found' saves the address and makes the room live
-- in one step; 'gone', 'mismatch' and 'no_email' take it out of the queue;
-- 'error' counts a try (three and it's out).
create or replace function public.report_email(p_room_id bigint, p_status text, p_email text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not exists (
    select 1
      from public.rooms r
      join public.room_sources s on s.room_id = r.id
     where r.id = p_room_id
       and r.source = 'craigslist'
       and not r.active
       and r.claimed_at is null
       and s.contact_email is null
       and (s.email_status is null or s.email_status = 'error')
       and s.email_attempts < 3
  ) then
    raise exception 'Room % isn''t waiting for an email.', p_room_id;
  end if;

  if p_status = 'found' then
    if v_email !~ '^[0-9a-f]{32}@hous\.craigslist\.org$' then
      raise exception 'That isn''t a Craigslist housing reply address: %', v_email;
    end if;
    update public.room_sources
       set contact_email = v_email, email_status = 'found',
           email_checked_at = now(), updated_at = now()
     where room_id = p_room_id;
    update public.rooms set active = true where id = p_room_id;
    return 'live';

  elsif p_status in ('gone', 'mismatch', 'no_email') then
    update public.room_sources
       set email_status = p_status, email_checked_at = now(), updated_at = now()
     where room_id = p_room_id;
    return 'removed from the queue';

  elsif p_status = 'error' then
    update public.room_sources
       set email_status = 'error', email_attempts = email_attempts + 1,
           email_checked_at = now(), updated_at = now()
     where room_id = p_room_id;
    return 'will retry';
  end if;

  raise exception 'Unknown status "%". Use found, gone, mismatch, no_email or error.', p_status;
end;
$$;

revoke execute on function public.email_queue(int) from public, anon, authenticated;
revoke execute on function public.report_email(bigint, text, text) from public, anon, authenticated;
grant execute on function public.email_queue(int) to service_role;
grant execute on function public.report_email(bigint, text, text) to service_role;


-- 11. For whatever sends the emails -------------------------------------------------------
-- Call with no error once it's sent, or with the error to count a failed try.
create or replace function public.mark_email_sent(p_id bigint, p_error text default null)
returns void
language sql
set search_path = ''
as $$
  update public.email_outbox
     set sent_at    = case when p_error is null then now() end,
         attempts   = attempts + 1,
         last_error = p_error
   where id = p_id and sent_at is null
$$;

revoke execute on function public.mark_email_sent(bigint, text) from public, anon, authenticated;
grant execute on function public.mark_email_sent(bigint, text) to service_role;
