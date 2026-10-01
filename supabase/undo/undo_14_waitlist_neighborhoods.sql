-- roomfit — undo 14_waitlist_neighborhoods.sql
-- Run only AFTER the landing page is back to sending one neighbourhood.
-- Each sign-up keeps its first pick in `neighborhood`; its second and third
-- picks are deleted permanently. To keep them, export first:
--   Table Editor → waitlist → Export to CSV.
begin;

drop function if exists public.join_waitlist(text, text, text, text[]);

-- Put the old function back as 13_waitlist.sql wrote it.
create or replace function public.join_waitlist(
  p_name text,
  p_email text,
  p_role text,
  p_neighborhood text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.waitlist (name, email, role, neighborhood)
  values (trim(p_name), lower(trim(p_email)), p_role, trim(p_neighborhood))
  on conflict (email) do update
    set name         = excluded.name,
        role         = excluded.role,
        neighborhood = excluded.neighborhood,
        updated_at   = now();
end;
$$;

alter table public.waitlist drop constraint if exists waitlist_neighborhoods_count;
alter table public.waitlist drop column if exists neighborhoods;

commit;
