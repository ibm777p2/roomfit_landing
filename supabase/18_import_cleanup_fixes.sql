-- roomfit — two fixes to the daily Craigslist import's cleanup (15_craigslist.sql)
-- Run AFTER 17_listing_expiry.sql, in the Supabase SQL editor.
-- Undo: undo/undo_18_import_cleanup_fixes.sql
--
-- 1. A deleted import came back the next day. Deleting a room also deletes its
--    room_sources row, which held the post key the import uses to skip posts it
--    has already seen. So a post the bot turned down (gone, mismatch, no email,
--    three errors) was imported again the next morning, photos and all, for as
--    long as it stayed inside the import's 3-week window. Now every deleted
--    import leaves its post key in rejected_imports, and the import skips it.
-- 2. The 30-day cleanup could delete a room whose host had just been emailed a
--    claim link that "works for 14 days". Rooms with an unused claim link that
--    hasn't expired are now kept until it has.
-- No change to scripts/craigslist-import/import.mjs: it already skips the keys
-- known_external_ids() returns, and a null from import_listing().


-- 1. Post keys that must not be imported again ------------------------------------
-- Closed table: written by delete_stale_imports(), read by admins.
create table if not exists public.rejected_imports (
  external_id text primary key,
  reason      text not null,
  rejected_at timestamptz not null default now()
);

alter table public.rejected_imports enable row level security;

-- delete_stale_imports() and known_external_ids() run as the signed-in admin,
-- so admins need to read and add rows. Nobody else sees the table.
drop policy if exists "admins read rejected imports" on public.rejected_imports;
create policy "admins read rejected imports"
  on public.rejected_imports for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "admins add rejected imports" on public.rejected_imports;
create policy "admins add rejected imports"
  on public.rejected_imports for insert to authenticated
  with check ((select public.is_admin()));

revoke all on public.rejected_imports from anon;
revoke update, delete, truncate on public.rejected_imports from authenticated;


-- 2. The cleanup: remember what it deletes, and spare rooms awaiting a claim ------
create or replace function public.delete_stale_imports()
returns table (room_id bigint, photos text[])
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can clean up imports.';
  end if;

  -- One statement: pick the rooms, record their post keys, delete them.
  return query
    with stale as (
      select r.id, s.external_id,
             case
               when s.email_status in ('gone', 'mismatch', 'no_email') then s.email_status
               when s.email_attempts >= 3 then 'error'
               else 'expired'
             end as reason
        from public.rooms r
        join public.room_sources s on s.room_id = r.id
       where r.owner_id = auth.uid()
         and r.source = 'craigslist'
         and r.claimed_at is null
         and (   s.posted_at < now() - interval '30 days'
              or s.email_status in ('gone', 'mismatch', 'no_email')
              or s.email_attempts >= 3)
         -- the host was emailed a claim link that still works: wait for it
         and not exists (select 1 from public.claim_links l
                          where l.room_id = r.id
                            and l.used_at is null
                            and l.expires_at > now())
    ), remembered as (
      insert into public.rejected_imports (external_id, reason)
      select st.external_id, st.reason from stale st where st.external_id is not null
      on conflict (external_id) do nothing
    )
    delete from public.rooms r
     using stale st
     where r.id = st.id
    returning r.id, r.photos;
end;
$$;


-- 3. The import skips rejected post keys ----------------------------------------------
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
    select external_id from public.room_sources where external_id = any(p_ids)
    union
    select external_id from public.rejected_imports where external_id = any(p_ids);
end;
$$;

-- And import_listing() itself refuses one, in case anything calls it directly.
-- Same as 15_craigslist.sql apart from the rejected_imports check.
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
  if exists (select 1 from public.rejected_imports
              where external_id = p_source->>'external_id') then
    return null; -- turned down before; treated like a post already imported
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

-- create or replace keeps each function's grants; restated so this file is
-- correct on its own.
revoke execute on function public.known_external_ids(text[]) from public, anon;
revoke execute on function public.import_listing(jsonb, jsonb) from public, anon;
revoke execute on function public.delete_stale_imports() from public, anon;
grant execute on function public.known_external_ids(text[]) to authenticated;
grant execute on function public.import_listing(jsonb, jsonb) to authenticated;
grant execute on function public.delete_stale_imports() to authenticated;
