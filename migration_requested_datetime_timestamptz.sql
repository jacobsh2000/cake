-- Gives "needed by" a time, not just a date.
--
-- The important part is the USING clause. A bare
-- requested_datetime::timestamptz reads the existing date at midnight
-- in the SESSION timezone, which on Supabase is UTC -- turning
-- "2026-09-14" into 8pm on the 13th once rendered in Columbus, moving
-- every existing request a day earlier. Casting through a plain
-- timestamp and pinning it AT TIME ZONE 'America/New_York' instead
-- reads each stored date as local midnight, which is what it meant.
--
-- Existing rows land at midnight because a date carries no time; Emily
-- can set a real time on any of them from the admin edit form.
--
-- Not idempotent by nature (a type change), but re-running is harmless:
-- Postgres rejects the ALTER once the column is already timestamptz,
-- and the DO block below skips it.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'requests'
      and column_name = 'requested_datetime'
      and data_type = 'date'
  ) then
    alter table requests
      alter column requested_datetime type timestamptz
      using (requested_datetime::timestamp at time zone 'America/New_York');
  end if;
end $$;
