-- Adds a travel-distance preference to volunteer profiles.
--
-- How far a volunteer is willing to drive to deliver. Stored as the
-- bucket key ('0_5', '5_10', '10_20', '20_plus') rather than a number,
-- since that is exactly what the profile form offers. Null means the
-- volunteer hasn't answered yet.
--
-- Safe to re-run.

alter table volunteer_profiles add column if not exists travel_distance text;
