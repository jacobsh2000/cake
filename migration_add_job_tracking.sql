-- Infrastructure for scheduled jobs.
--
-- Two tables, each solving a specific failure mode.
--
-- job_runs answers "is the cron still alive?". A scheduled job that
-- has silently stopped running looks exactly like one with nothing to
-- do -- no error, no email, no signal -- and nobody notices until a
-- volunteer misses a delivery. Every attempt is recorded here whether
-- it succeeds or throws, and /admin surfaces the latest one, so a dead
-- job is visible to Emily without anyone reading logs.
--
-- notifications_sent stops duplicate sends. Vercel Cron is
-- at-least-once: a run can fire twice, and a retry after a partial
-- failure would otherwise re-send to everyone already emailed. The
-- UNIQUE constraint is the actual guard -- the job inserts the row
-- FIRST and only sends if the insert succeeded, so two concurrent runs
-- cannot both win, and a crash mid-run leaves a truthful record.
--
-- Safe to re-run.

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  detail jsonb,                    -- what it actually did: counts, ids
  error text,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_name_started_idx
  on job_runs(job_name, started_at desc);

create table if not exists notifications_sent (
  id uuid primary key default gen_random_uuid(),
  kind text not null,              -- 'delivery_soon', 'delivery_followup', ...
  request_id uuid references requests(id) on delete cascade,
  recipient_key text not null,     -- Clerk user id, or an email address
  sent_at timestamptz not null default now(),
  unique (kind, request_id, recipient_key)
);

create index if not exists notifications_sent_kind_idx
  on notifications_sent(kind, sent_at desc);

alter table job_runs enable row level security;
alter table notifications_sent enable row level security;
