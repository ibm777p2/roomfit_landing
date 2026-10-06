-- roomfit — undo 16_email_sending.sql
-- One transaction: all of it happens, or none of it.
-- Stops all email sending and team alerts. email_outbox keeps its rows (it
-- belongs to 15_craigslist.sql); team alert rows are deleted so the kind
-- check can go back to its old list. The team list is deleted too.
-- The mailer key stays in Vault; remove it separately if wanted:
--   delete from vault.secrets where name = 'roomfit_mailer_api_key';
-- pg_net and pg_cron stay installed (other things may use them).
begin;

select cron.unschedule('roomfit-email-sync')
 where exists (select 1 from cron.job where jobname = 'roomfit-email-sync');

drop trigger if exists team_alert_claim on public.rooms;
drop trigger if exists team_alert_interest on public.room_interests;
drop trigger if exists send_new_outbox_email on public.email_outbox;

drop function if exists public.team_alert_claim();
drop function if exists public.team_alert_interest();
drop function if exists public.friendly_interval(interval);
drop function if exists public.queue_team_email(text, bigint, uuid, text, text);
drop function if exists public.sync_email_status();
drop function if exists public.send_new_outbox_email();
drop function if exists public.send_outbox_email(bigint);
drop function if exists public.mailer_url();

delete from public.email_outbox where kind in ('team_interest', 'team_claim');
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox
  add constraint email_outbox_kind_check check (kind in ('host_interest', 'host_online'));
alter table public.email_outbox drop column if exists request_id;

drop table if exists public.team_recipients;

commit;
