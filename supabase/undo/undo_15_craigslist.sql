-- roomfit — undo 15_craigslist.sql
-- One transaction: all of it happens, or none of it.
-- Run only AFTER the website no longer reads rooms.source / claimed_at and no
-- longer calls express_interest, and after the daily import and the email bot
-- are switched off.
-- Permanently deletes every "I'm interested", every queued or sent email record,
-- and the extra post details (post key, reply address, raw post). Imported rooms
-- themselves stay, as ordinary rooms. To keep anything, export it first:
--   Table Editor → room_interests / email_outbox / room_sources → Export to CSV.
begin;

-- 1. claim_room as it was in 12_descriptions.sql (no claimed_at), before the
--    column it would otherwise mention goes away.
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
    active          = true
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

-- 2. Triggers, then the functions they and the app call.
drop trigger if exists welcome_interested_after_claim on public.rooms;
drop trigger if exists protect_room_origin on public.rooms;

drop function if exists public.welcome_interested_after_claim();
drop function if exists public.protect_room_origin();
drop function if exists public.express_interest(bigint, text);
drop function if exists public.known_external_ids(text[]);
drop function if exists public.import_listing(jsonb, jsonb);
drop function if exists public.delete_stale_imports();
drop function if exists public.email_queue(int);
drop function if exists public.report_email(bigint, text, text);
drop function if exists public.mark_email_sent(bigint, text);
drop function if exists public.email_html(text, text[], text, text, text);
drop function if exists public.html_escape(text);
drop function if exists public.app_url();

-- 3. Tables.
drop table if exists public.room_interests;
drop table if exists public.email_outbox;

-- 4. Columns.
drop index if exists public.room_sources_external_id_key;
alter table public.room_sources
  drop column if exists external_id,
  drop column if exists contact_email,
  drop column if exists posted_at,
  drop column if exists raw,
  drop column if exists email_status,
  drop column if exists email_attempts,
  drop column if exists email_checked_at;

alter table public.rooms
  drop column if exists claimed_at,
  drop column if exists source;

commit;
