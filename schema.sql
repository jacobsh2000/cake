-- Columbus Cake Celebrations — MVP schema
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- ============================================================
-- RECIPIENTS  (private — PII, never queried by the volunteer app)
-- ============================================================
create table recipients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  street_address text not null,
  apartment_number text,
  apartment_complex_name text,
  city text not null,
  state text not null,
  zip_code text not null,
  country text not null default 'USA',
  phone_number text not null,
  backup_phone_number text,
  backup_contact_first_name text,
  backup_contact_last_name text,
  preferred_contact_method text not null,          -- e.g. 'phone', 'text', 'email'
  relationship_to_recipient text not null,
  guardian_permission_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REQUESTS  (volunteer-visible once approved — no PII in this table)
-- ============================================================
-- 'rejected' is declined at review, before the request is ever posted.
-- 'cancelled' is an already-approved request taken back down. Keeping
-- them distinct keeps "turned down" and "fell through" separate.
create type request_status as enum (
  'submitted', 'approved', 'rejected', 'posted',
  'claimed', 'contacted', 'confirmed', 'delivered', 'expired',
  'no_response', 'cancelled'
);

-- Short, sequential handle for humans — "request 1042". The UUID stays
-- the primary key; this exists so Emily and volunteers have something
-- speakable. Starts at 1001 so early numbers don't read as a count.
create sequence if not exists requests_request_number_seq as integer start with 1001;

create table requests (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references recipients(id) on delete cascade,

  request_number integer not null unique default nextval('requests_request_number_seq'),

  status request_status not null default 'submitted',

  requested_datetime timestamptz not null,         -- delivery date AND time; must be >= 10 days out at submission
                                                   -- time. Stored as an instant; always rendered in
                                                   -- America/New_York (see lib/datetime.js) so the displayed
                                                   -- time never depends on where the viewer is.
  recipient_age integer not null,
  recipient_first_name text not null,               -- shown publicly, e.g. "Timmy, age 7"

  cake_or_cupcakes text not null,                   -- 'cake' | 'cupcakes'
  servings integer,                                 -- cake servings (max 16)
  cupcake_count integer,                             -- cupcake count (max 24)

  flavor_options text[] not null,                    -- up to 3
  icing_options text[] not null,                      -- up to 3
  interests text,
  favorite_colors text,

  has_allergies boolean not null default false,
  allergy_details text,                               -- admin-visible only until claim; consider hiding entirely if sensitive
  allergy_severity text,                              -- e.g. 'mild', 'severe'

  photo_sharing_ok boolean not null default false,
  heard_about_us text,

  terms_accepted boolean not null default false,

  admin_notes text,                                   -- Emily's private notes, never shown to volunteers
  cancellation_reason text,                            -- required when status = 'cancelled'; shown to the volunteer who held it
  reassignment_deadline timestamptz,                   -- set when claimed; drives the 48hr auto-reassign job

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_status_idx on requests(status);

-- ============================================================
-- VOLUNTEERS  (id = Clerk user id, e.g. "user_2abc..." — Clerk
-- handles auth, so this is just a plain profile table, not tied
-- to any Supabase auth mechanism)
-- ============================================================
create table volunteer_profiles (
  id text primary key,
  first_name text not null default '',
  last_name text not null default '',
  city text,
  state text,
  general_area text,                                   -- coarse location for matching, no street address needed
  volunteer_frequency text,                            -- how often they want to volunteer
  travel_distance text,                                -- '0_5' | '5_10' | '10_20' | '20_plus' miles willing to drive
  created_at timestamptz not null default now()
);

-- ============================================================
-- CLAIMS  (links a volunteer to a request; this is the ONLY place
-- a volunteer's access to recipient PII should be checked against)
-- ============================================================
create table claims (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade unique,
  volunteer_id text not null references volunteer_profiles(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  contacted_recipient_at timestamptz,
  delivery_confirmed_at timestamptz
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Auth is handled by Clerk, not Supabase — so there's no Supabase
-- auth.uid() to write policies against. Instead: RLS is enabled with
-- NO policies for the anon/authenticated roles, which means the
-- browser (using the public anon key) cannot read or write these
-- tables at all, full stop.
--
-- All real access goes through Next.js API routes (app/api/**),
-- which check the signed-in Clerk user server-side via auth(), then
-- use the Supabase service role key to perform the actual query —
-- the service role bypasses RLS entirely. This is how /admin,
-- /api/requests/open, and /api/requests/claim all work.
alter table recipients enable row level security;
alter table requests enable row level security;
alter table volunteer_profiles enable row level security;
alter table claims enable row level security;
