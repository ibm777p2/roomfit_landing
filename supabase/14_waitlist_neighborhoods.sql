-- roomfit — waitlist: up to three neighbourhoods per sign-up
-- Run AFTER 13_waitlist.sql, in the Supabase SQL editor.
-- Additive: existing rows are copied across, and the landing page keeps
-- working before and after its next deploy. Undo: undo/undo_14_waitlist_neighborhoods.sql
--
-- `neighborhoods` holds every pick, in the order chosen (1 to 3). The old
-- `neighborhood` column stays and now holds the first pick, so anything that
-- already reads it keeps working.

-- 1. The column, filled from the one neighbourhood each existing row has.
alter table public.waitlist add column if not exists neighborhoods text[];

update public.waitlist
   set neighborhoods = array[neighborhood]
 where neighborhoods is null;

alter table public.waitlist
  alter column neighborhoods set not null;

alter table public.waitlist
  drop constraint if exists waitlist_neighborhoods_count;
alter table public.waitlist
  add constraint waitlist_neighborhoods_count
  check (cardinality(neighborhoods) between 1 and 3
         and array_position(neighborhoods, null) is null);

-- 2. The old function, kept so the page that's live right now can still sign
--    people up until it's redeployed. It now fills the new column too.
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
  insert into public.waitlist (name, email, role, neighborhood, neighborhoods)
  values (trim(p_name), lower(trim(p_email)), p_role, trim(p_neighborhood),
          array[trim(p_neighborhood)])
  on conflict (email) do update
    set name          = excluded.name,
        role          = excluded.role,
        neighborhood  = excluded.neighborhood,
        neighborhoods = excluded.neighborhoods,
        updated_at    = now();
end;
$$;

-- 3. The new one: up to three picks. Blanks are trimmed and repeats dropped,
--    keeping the order they were chosen in; the first becomes `neighborhood`.
--    Anything else out of range raises an error, which the page shows as
--    "Something went wrong".
create or replace function public.join_waitlist(
  p_name text,
  p_email text,
  p_role text,
  p_neighborhoods text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoods text[];
begin
  v_hoods := array(
    select h
      from (select trim(x) as h, min(ord) as first_seen
              from unnest(p_neighborhoods) with ordinality as u(x, ord)
             where x is not null
             group by trim(x)) picks
     order by first_seen
  );

  if coalesce(cardinality(v_hoods), 0) not between 1 and 3
     or exists (select 1 from unnest(v_hoods) h where char_length(h) not between 1 and 60)
  then
    raise exception 'Pick between 1 and 3 neighborhoods.';
  end if;

  insert into public.waitlist (name, email, role, neighborhood, neighborhoods)
  values (trim(p_name), lower(trim(p_email)), p_role, v_hoods[1], v_hoods)
  on conflict (email) do update
    set name          = excluded.name,
        role          = excluded.role,
        neighborhood  = excluded.neighborhood,
        neighborhoods = excluded.neighborhoods,
        updated_at    = now();
end;
$$;

revoke execute on function public.join_waitlist(text, text, text, text[]) from public;
grant execute on function public.join_waitlist(text, text, text, text[]) to anon, authenticated;

-- The old function's grants are unchanged by create or replace; restated so
-- this file is correct on its own.
revoke execute on function public.join_waitlist(text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text) to anon, authenticated;
