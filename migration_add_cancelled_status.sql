-- Adds cancellation, distinct from rejection.
--
-- 'rejected' is a decision made before a request is ever posted --
-- Emily reviewing the queue and declining. 'cancelled' is for a
-- request that was already approved, possibly already claimed and
-- being worked, that has to come down: the family moved, the party was
-- called off, someone submitted twice. Keeping them separate means
-- "how many did we turn down" and "how many fell through" stay
-- different questions.
--
-- Safe to re-run.
--
-- NOTE: run this on its own, not stapled to a script that also writes
-- the new value. Postgres refuses to use an enum value added earlier
-- in the same transaction ("unsafe use of new value"), and the
-- Supabase SQL editor runs a script as one transaction.

alter type request_status add value if not exists 'cancelled';

alter table requests add column if not exists cancellation_reason text;
