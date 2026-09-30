-- roomfit — undo 13_waitlist.sql
-- Run only AFTER the landing page no longer calls join_waitlist().
-- Every waitlist sign-up is deleted permanently. To keep them, export first:
--   Table Editor → waitlist → Export to CSV.
begin;

drop function if exists public.join_waitlist(text, text, text, text);
drop table if exists public.waitlist;

commit;
