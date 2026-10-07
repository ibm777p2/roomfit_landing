-- roomfit — undo 18_import_cleanup_fixes.sql
-- One transaction: all of it happens, or none of it.
-- Puts the three import functions back as 15_craigslist.sql wrote them, and
-- deletes the list of rejected post keys. After this, the daily import brings
-- back posts it had turned down, and the 30-day cleanup no longer waits for an
-- open claim link. To keep the list, export it first:
--   Table Editor → rejected_imports → Export to CSV.
begin;

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

drop table if exists public.rejected_imports;

commit;
