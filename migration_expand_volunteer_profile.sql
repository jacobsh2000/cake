-- Rounds out the volunteer profile toward what SignUp Genius held.
--
-- can_bake / can_buy / can_deliver are what a volunteer is willing to
-- do in general — set once on their profile. That is a different
-- question from what they signed up for on a specific request, which
-- lives on claims.volunteer_role. Someone can be willing to do all
-- three and still take one particular request as delivery-only.
--
-- Defaults are true for baking and delivering because that is what
-- the role has meant up to now; nobody's existing profile should
-- quietly become "does nothing" the moment this deploys.
--
-- Safe to re-run.

alter table volunteer_profiles add column if not exists interests text;
alter table volunteer_profiles add column if not exists can_bake boolean not null default true;
alter table volunteer_profiles add column if not exists can_buy boolean not null default true;
alter table volunteer_profiles add column if not exists can_deliver boolean not null default true;
