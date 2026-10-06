-- roomfit — listings last 30 days, then pause until their owner renews them.
-- Run AFTER 16_email_sending.sql, in the Supabase SQL editor.
-- Undo: undo/undo_17_listing_expiry.sql
--
-- Keeps search to rooms that are still available: a listing nobody has touched
-- for a month is probably taken. Nothing is deleted.
--   * A room gets 30 days when it's posted, and again when a host claims it.
--   * Every day a job pauses the ones whose time is up and emails the owner.
--   * "Show again" on an expired listing renews it for another 30 days — the
--     existing pause switch, so it works in the app as it is today.
-- Not affected: the 12 sample rooms (no owner) and Craigslist rooms nobody has
-- claimed yet, which the daily import removes 30 days after their post date.


-- 1. When a listing's time is up ------------------------------------------------
-- null = never expires (sample rooms, unclaimed Craigslist imports).
alter table public.rooms add column if not exists expires_at timestamptz;

-- Every listing live or paused today gets 30 days from now, so nothing
-- disappears the moment this runs.
update public.rooms
   set expires_at = now() + interval '30 days'
 where expires_at is null
   and owner_id is not null
   and not (source = 'craigslist' and claimed_at is null);


-- 2. Set by the database, never by the app ----------------------------------------
create or replace function public.set_listing_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lasts boolean := new.owner_id is not null
                     and not (new.source = 'craigslist' and new.claimed_at is null);
begin
  if tg_op = 'INSERT' then
    new.expires_at := case when v_lasts then now() + interval '30 days' end;
    return new;
  end if;

  if not v_lasts then
    new.expires_at := null;
  elsif old.claimed_at is null and new.claimed_at is not null then
    new.expires_at := now() + interval '30 days';           -- just claimed
  elsif new.active and not old.active
        and (old.expires_at is null or old.expires_at <= now()) then
    new.expires_at := now() + interval '30 days';           -- renewed
  elsif current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.expires_at := old.expires_at;                       -- not editable
  end if;
  return new;
end;
$$;

drop trigger if exists set_listing_expiry on public.rooms;
create trigger set_listing_expiry
  before insert or update on public.rooms
  for each row execute function public.set_listing_expiry();


-- 3. The daily job: pause and tell the owner ----------------------------------------
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox
  add constraint email_outbox_kind_check
  check (kind in ('host_interest', 'host_online', 'team_interest', 'team_claim',
                  'listing_expired'));

create or replace function public.expire_listings()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  v_link text := public.app_url() || '/?view=listings';
  v_n    int  := 0;
begin
  for r in
    select rm.id, rm.title, rm.rent, rm.location, rm.owner_id, u.email,
           coalesce(nullif(btrim(p.first_name), ''), 'there') as first_name
      from public.rooms rm
      join auth.users u on u.id = rm.owner_id
      left join public.profiles p on p.id = rm.owner_id
     where rm.active
       and rm.expires_at is not null
       and rm.expires_at <= now()
       for update of rm skip locked
  loop
    update public.rooms set active = false where id = r.id;
    v_n := v_n + 1;

    if r.email is not null then
      insert into public.email_outbox
        (kind, room_id, user_id, to_email, subject, text_body, html_body)
      values (
        'listing_expired', r.id, r.owner_id, r.email,
        format('Your RoomFit listing "%s" is paused', r.title),
        format(
          E'Hi %1$s,\n\n'
          'Your listing "%2$s" (%3$s) has been up for 30 days, so we''ve paused '
          'it to keep the rooms on RoomFit current. It isn''t in search right now.\n\n'
          'Still available? Renew it for another 30 days:\n%4$s\n'
          'Tap "Renew for 30 days" on the listing.\n\n'
          'If the room''s been taken, there''s nothing to do. Your chats stay as they are.\n\n'
          'The RoomFit team',
          r.first_name, r.title,
          format('$%s/mo · %s', to_char(r.rent, 'FM999,999'), r.location),
          v_link
        ),
        public.email_html(
          'Your listing is paused',
          array[
            format('Hi %s,', r.first_name),
            format('Your listing "%s" has been up for 30 days, so we''ve paused it '
                   'to keep the rooms on RoomFit current. It isn''t in search right now.', r.title),
            'Still available? Renew it for another 30 days. If the room''s been '
            'taken, there''s nothing to do. Your chats stay as they are.'
          ],
          'Renew for 30 days',
          v_link,
          'You''re getting this because you have a listing on RoomFit.'
        )
      );
    end if;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.set_listing_expiry() from public, anon, authenticated;
revoke execute on function public.expire_listings() from public, anon, authenticated;

-- 17:00 UTC is 10:00 in summer and 9:00 in winter, Pacific.
select cron.schedule('roomfit-expire-listings', '0 17 * * *', 'select public.expire_listings()');
