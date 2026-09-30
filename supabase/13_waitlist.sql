-- roomfit — waitlist for the landing page (joinroomfit.com)
-- Run AFTER 12_descriptions.sql, in the Supabase SQL editor.
-- Additive: the app never touches this table. Undo: undo/undo_13_waitlist.sql
--
-- One row per email. Signing up again with the same email updates the row
-- (new name, role or neighbourhood) instead of adding a second one, and the
-- visitor sees the same success either way, so the form can't be used to find
-- out who has already signed up.
--
-- Nobody reads or writes the table through the API: RLS is on with no
-- policies. The only way in is join_waitlist(), which the landing page calls
-- from the server. Sign-ups are read in the Supabase dashboard.

create table if not exists public.waitlist (
  id           bigint generated always as identity primary key,
  name         text not null check (char_length(name) between 1 and 80),
  email        text not null unique
                 check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         text not null check (role in ('looking', 'listing', 'both')),
  neighborhood text not null check (char_length(neighborhood) between 1 and 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- Emails are stored lower-cased and trimmed, so "Ana@X.com " and "ana@x.com"
-- are the same person. Bad input fails the table's checks and raises an error,
-- which the page shows as "Something went wrong".
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

revoke execute on function public.join_waitlist(text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text) to anon, authenticated;
