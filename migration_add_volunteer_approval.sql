-- Volunteers must be approved by an admin before they can claim.
--
-- IMPORTANT: the column defaults to false for NEW signups, but every
-- profile that already exists is set to true. Anyone already
-- volunteering has effectively been vetted already, and defaulting
-- them to false would lock out the whole existing roster -- including
-- Emily and Jacob -- the moment this deploys.
--
-- email is stored here too. Clerk owns the authoritative copy, but the
-- admin approval list needs to show something more distinguishing than
-- a first and last name, and looking up hundreds of volunteers through
-- Clerk's API to render one page is not worth it.
--
-- Safe to re-run: the backfill only touches rows added before the
-- column existed, since it is guarded on the column being new.

do $$
declare
  column_is_new boolean;
begin
  column_is_new := not exists (
    select 1 from information_schema.columns
    where table_name = 'volunteer_profiles' and column_name = 'approved'
  );

  if column_is_new then
    alter table volunteer_profiles
      add column approved boolean not null default false;

    -- Grandfather the existing roster.
    update volunteer_profiles set approved = true;
  end if;
end $$;

alter table volunteer_profiles add column if not exists email text;

create index if not exists volunteer_profiles_approved_idx
  on volunteer_profiles(approved);
