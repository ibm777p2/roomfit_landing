-- roomfit — undo 17_listing_expiry.sql
-- One transaction: all of it happens, or none of it.
-- Run only AFTER the website no longer reads rooms.expires_at.
-- Listings stop expiring. Rooms the job already paused stay paused; their
-- owners can show them again as before. "Listing paused" email records are
-- deleted so the kind check can go back to its old list.
begin;

select cron.unschedule('roomfit-expire-listings')
 where exists (select 1 from cron.job where jobname = 'roomfit-expire-listings');

drop trigger if exists set_listing_expiry on public.rooms;
drop function if exists public.set_listing_expiry();
drop function if exists public.expire_listings();

delete from public.email_outbox where kind = 'listing_expired';
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox
  add constraint email_outbox_kind_check
  check (kind in ('host_interest', 'host_online', 'team_interest', 'team_claim'));

alter table public.rooms drop column if exists expires_at;

commit;
