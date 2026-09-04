-- What the claiming volunteer signed up to do on this request.
--
-- 'both' is the default because that is what every existing claim
-- meant: before this column, claiming a request meant handling it end
-- to end. Backfilling anything else would misreport history.
--
-- This is the single-volunteer version. True split requests -- one
-- person bakes, a different person delivers -- need the UNIQUE
-- constraint on claims.request_id dropped and the status logic
-- reworked, which is the separate, larger piece of work.
--
-- Safe to re-run.

alter table claims add column if not exists volunteer_role text not null default 'both';
