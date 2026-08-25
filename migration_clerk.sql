-- Run this in the Supabase SQL editor AFTER switching to Clerk.
-- It migrates volunteer_profiles/claims off Supabase's own auth.users
-- and locks direct table access down to the service role only, since
-- all volunteer-facing reads/writes now go through Clerk-authenticated
-- API routes (app/api/requests/*) instead of the browser querying
-- Supabase directly.

-- 1. Drop the old policies that referenced Supabase's auth.uid()
drop policy if exists "recipients_via_own_claim" on recipients;
drop policy if exists "requests_posted_visible" on requests;
drop policy if exists "requests_claim_update" on requests;
drop policy if exists "own_profile_select" on volunteer_profiles;
drop policy if exists "own_profile_update" on volunteer_profiles;
drop policy if exists "own_profile_insert" on volunteer_profiles;
drop policy if exists "own_claims_select" on claims;
drop policy if exists "own_claims_insert" on claims;

-- 2. volunteer_profiles.id switches from a Supabase auth.users FK to
-- a plain text column holding the Clerk user id (e.g. "user_2abc...").
alter table volunteer_profiles drop constraint if exists volunteer_profiles_id_fkey;
alter table volunteer_profiles alter column id type text;

-- 3. claims.volunteer_id follows suit
alter table claims alter column volunteer_id type text;

-- 4. RLS stays enabled, but with no policies for anon/authenticated
-- roles, meaning the browser (using the anon key) can no longer read
-- or write these tables at all. Only the service role (used server-side
-- in the API routes, which bypasses RLS) can touch them. This is
-- intentional now that Clerk — not Supabase — is checking who's signed in.
