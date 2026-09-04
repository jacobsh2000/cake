# Outstanding work

Tracks what's left from the project handoff, and — importantly — what
is blocked and on whom. Items move out of "Blocked" only when the
missing input actually arrives.

## Blocked on someone else

These are code-ready. Nothing is left to design or decide; they need a
file or a sentence that doesn't exist in the repo yet.

- **Logo asset for `/request`.** The plumbing shipped: `Logo` in
  `app/request/page.js` renders `/logo.png` and falls back to the drawn
  cake icon on load error, so the page is never broken. Dropping the
  file at `public/logo.png` completes it with no code change. The image
  has been shared in conversation but never as a file, and this
  environment's network policy blocks fetching it from the live site,
  so it has to be committed by hand or attached as a file.
  See `public/README.md`.
- **Helper text for "interests" and "favorite colors" on `/request`.**
  Needs Emily's exact wording. The current text is placeholder copy
  written during the build, not hers.

## Medium — not started

- **Sync approved requests to a Google Sheet.** Confirmed a real
  requirement. Blocked in practice on Google service-account
  credentials and a test sheet to point at.
- **Migrate ~500 SignUp Genius volunteers into Clerk.** One-time
  script against Clerk's Backend API, triggering the invitation flow
  rather than creating password accounts. Blocked on the SignUp Genius
  export and a Clerk secret key.

## Hard — in progress

The scheduled-job infrastructure now exists: one daily Vercel Cron at
`/api/cron/daily`, with `job_runs` for observability and
`notifications_sent` for at-least-once-safe dedup. The daily digest to
Emily runs on it. Adding a job is now writing one function in
`lib/jobs/` and one line in the route.

Still to build on it, in rough order of value:

- **Volunteer reminders.** Delivery under 5 days away and not marked
  confirmed; and the day after the delivery date, not marked
  delivered. Both use `claimNotification` for dedup. Worth waiting a
  week of clean digest runs first — a date-math bug here reaches every
  volunteer rather than one admin.
- **48-hour reassignment timer.** Auto-revert a claim with no activity
  back to posted. Needs a decision on whether it emails the volunteer
  first as a warning, or just acts.
- **New-request notification emails** to volunteers whose area and
  preferences match a newly-approved request. Event-driven rather than
  scheduled — belongs on approval, not in the cron. Needs a
  per-volunteer opt-out toggle.
- **Accept/decline on admin-assigned claims** — declining kicks the
  request back to unclaimed and notifies Emily.

Not dependent on the scheduler: true multi-volunteer requests,
travel-radius map visualization, and address-within-30-miles
validation at submission (needs a geocoding API).

## Go-live checklist

Custom subdomain pointed at Vercel · Vercel Pro · Clerk Production keys
(separate user pool — admin roles must be re-tagged for Jacob and
Emily) · Resend domain verification · WordPress links to `/request` and
`/volunteer` · clear test data from Supabase · confirm the rotated
Supabase service-role key is what's live in Vercel · revert the GitHub
repo to private.
