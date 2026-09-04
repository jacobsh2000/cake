# Columbus Cake Celebrations

Custom request form, admin approval queue, and volunteer portal —
replacing the Jotform → Google Sheet → SignUp Genius hand-off that
required an admin to manually re-key every request. Jotform is
retired; `/request` replaces it. WordPress keeps the root domain for
static marketing pages and links out to this app.

## Stack
- **Next.js 14** (App Router) — hosted on Vercel
- **Clerk** — auth (volunteer + admin sign-in)
- **Supabase** — Postgres only (not used for auth)
- **Resend** — transactional email, via REST (no SDK dependency)

## Local setup
1. `npm install`
2. Create a Clerk app (clerk.com) — free tier is plenty. Grab the
   publishable + secret key from the dashboard.
3. Create a Supabase project (supabase.com) if you haven't already.
4. In the Supabase SQL editor, run in order:
   - `schema.sql` (fresh project), **or** `migration_clerk.sql` if you
     already had the earlier Supabase-auth version running
   - `migration_add_no_response_status.sql`
   - `migration_add_travel_distance.sql`
   - `migration_add_request_number.sql`
   - `migration_requested_datetime_timestamptz.sql`
   - `migration_add_cancelled_status.sql` — **run this one on its own.**
     Postgres refuses to use an enum value added earlier in the same
     transaction, and the SQL editor runs a pasted script as one.
   - `migration_add_volunteer_approval.sql`
   - `migration_expand_volunteer_profile.sql`
   - `migration_add_claim_role.sql`
   - `migration_add_job_tracking.sql`
5. Copy `.env.local.example` to `.env.local` and fill it in.
6. `npm run dev` → http://localhost:3000

## Admin roles

Tagged on the Clerk user as `publicMetadata.role`:

- `admin` — the full dashboard: review, approve, reject, send back,
  cancel, assign, and approve volunteers.
- `coordinator` — matchmaking only. Can assign and reassign volunteers
  to already-approved requests; cannot see the review queue and cannot
  approve, cancel or revert anything, or approve volunteers.

Set one in the Clerk dashboard to reach `/admin` locally. Hiding a tab
decides what's convenient to reach; `lib/roles.js` is re-checked inside
every server action, which is what decides what a crafted POST can do.

## Volunteer approval

New signups land unapproved and cannot claim until an admin approves
them on the Volunteers tab — approval is what grants access to
recipient PII. A profile row is created the first time a volunteer
loads `/volunteer`, so they appear in the queue without having to do
anything first. The migration grandfathers everyone who already
existed; it does not re-approve anyone on a re-run, so a deliberate
revocation sticks.

## Scheduled job

One cron, once a day, defined in `vercel.json` and hitting
`/api/cron/daily`. Daily granularity is enough for everything this app
needs — "within 5 days", "day after", "48 hours stale" — which means it
also works on Vercel's Hobby plan, where one run per day is the limit.

Set `CRON_SECRET` in Vercel's environment variables. Vercel then sends
it as a bearer token automatically; the route refuses to run without
it, so a misconfiguration fails closed rather than leaving a public
email-sending endpoint open to anyone who guesses the path.

The schedule is `0 13 * * *` — UTC, so 9am Eastern in summer and 8am in
winter. Cron schedules don't shift with DST; that hour of drift is not
worth engineering around for a morning digest.

Two design points that matter more than they look:

- **`job_runs` records every attempt**, and `/admin` shows the latest.
  A cron that has silently stopped running is indistinguishable from
  one with nothing to do, so "when did this last work" has to be a
  fact someone can see, not an inference from an absence of email.
  The banner turns red past 26 hours.
- **`notifications_sent` has a UNIQUE constraint**, and jobs insert
  the row *before* sending. Vercel Cron is at-least-once, so a run can
  fire twice; claiming first means a duplicate run sends nothing and a
  mid-run crash costs at most one missed email rather than re-sending
  to everyone on the retry.

To run it by hand:

```
curl -X POST https://your-app.vercel.app/api/cron/daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Dates and times

`requests.requested_datetime` is a `timestamptz` — a real instant, not
a wall-clock string. Everything the org does happens in Columbus, so
`lib/datetime.js` pins every render to `America/New_York` rather than
letting the viewer's browser decide. Read and write it through that
module (`formatDateTime`, `orgLocalToUtcIso`, `utcToOrgLocalInput`);
formatting a delivery time with a bare `toLocaleString()` will show a
travelling volunteer the wrong hour.

## Security model
Recipient PII lives in its own `recipients` table, separate from the
volunteer-visible `requests` table. The open-requests board exposes
only a deliberately narrow `city + zip_code` "general area" — name,
address, phone, and email are reachable only through
`/api/requests/mine`, filtered to the calling volunteer's own claims.

Because Clerk (not Supabase) owns identity, **RLS is enabled on every
table with no policies for the anon/authenticated Postgres roles** —
the browser cannot read or write these tables at all. Every real
access goes through a Next.js API route that checks `auth()` from
Clerk server-side, then uses the Supabase service role key
(server-only, bypasses RLS) to run the query. Ownership checks in the
route code — "does this volunteer actually own this claim?" — **are**
the security boundary, not a database policy. Keep them there.

## Routes
| Route | Purpose |
|---|---|
| `/` | Homepage — links to Request / Volunteer |
| `/request` | Public cake request form → `POST /api/submit-request` |
| `/sign-in` | Clerk-hosted sign-in |
| `/volunteer` | Open requests (area only, no PII) · My claimed requests (full PII, status updates, release) · My profile |
| `/admin` | Pending review (all fields editable before approve/reject) · Approved, no volunteer (assign) · In progress (reassign) |

API routes: `submit-request`, `requests/open`, `requests/mine`,
`requests/claim`, `requests/unclaim`, `requests/status`,
`volunteer/profile`.

`middleware.js` gates `/volunteer` on any signed-in Clerk user and
`/admin` on `publicMetadata.role === "admin"` — checked in middleware
and again inside the server actions (defense in depth).

## Not yet built
- 48-hour auto-reassignment of an unacted-on claim
- Reminder emails (delivery approaching, delivery-day follow-up) and
  the daily admin digest — all need a scheduled job (Vercel Cron)
- New-request notification emails to volunteers whose area matches
- Accept/decline on admin-assigned claims
- Google Sheets sync of approved requests

Claim confirmation and admin-assignment emails **are** built
(`lib/sendEmail.js`, `lib/emailTemplates.js`).

## Deploying
1. Push to GitHub, import in Vercel.
2. Add every var from `.env.local.example` in Vercel's project settings.
3. In Clerk's dashboard, add your Vercel domain under allowed origins.
4. Point a subdomain (e.g. `app.columbuscakecelebrations.com`) at the
   Vercel deployment; WordPress keeps the root domain.

Before go-live, see the checklist in the project handoff: custom
domain, Vercel Pro, Clerk Production keys (separate user pool — admin
roles must be re-tagged), Resend domain verification, and clearing
test data out of Supabase.
