# Columbus Cake Celebrations — MVP

Custom submission form + manual admin approval + volunteer portal,
replacing SignUp Genius and the Google Sheet hand-off. Jotform stays
in place for now (Phase 2 will replace it).

## Stack
- **Next.js** (App Router) — hosted on Vercel
- **Clerk** — auth (volunteer + admin sign-in)
- **Supabase** — Postgres DB only (no longer used for auth)

## Local setup
1. `npm install`
2. Create a Clerk app (clerk.com) — free tier is plenty. Grab the
   publishable + secret key from the dashboard.
3. Create a Supabase project (supabase.com) if you haven't already.
4. In the Supabase SQL editor:
   - Run `schema.sql` (fresh project), **or**
   - If you already had the earlier Supabase-auth version running,
     run `migration_clerk.sql` instead to convert it over.
5. Copy `.env.local.example` to `.env.local` and fill in Clerk's two
   keys + Supabase's URL and service role key.
6. `npm run dev` → http://localhost:3000

## How data flows (updated for Clerk)
- **`/request`** — public form, unchanged. Posts to `/api/submit-request`.
- **`/admin`** — Emily's approval queue. `middleware.js` now requires
  sign-in to reach it (previously wide open — this was on the
  "before go-live" list and is now handled). **Still needed:** an
  actual admin-role check, since right now *any* signed-in Clerk user
  (including a volunteer) could reach `/admin` — see below.
- **`/volunteer`** — requires Clerk sign-in (enforced by
  `middleware.js`). The page itself no longer talks to Supabase
  directly; it calls `/api/requests/open` (list) and
  `/api/requests/claim` (claim), which check `auth()` from Clerk
  server-side, then use the Supabase service role to do the actual
  query/write. No PII is ever sent to `/api/requests/open`.

## Before go-live — still needed
- **Admin role check.** `/admin` is now sign-in-gated, but not
  role-gated — any Clerk user who signs in can reach it. Add a role
  claim in Clerk (e.g. tag Emily's account as `admin`) and check it
  in `middleware.js` or at the top of `app/admin/page.js`.
- **Revealing recipient PII to the claiming volunteer.** Not yet
  built — same as before, just now it'd be a new
  `/api/requests/[id]/recipient` route checking the volunteer owns
  the claim, rather than a Supabase RLS policy.
- **48-hour reassignment timer.** Not built.
- **Notifications** (new request posted, claim confirmed, reassignment
  warning). Not built — Clerk doesn't send these; still needs an email
  provider wired into a scheduled job or webhook.
- **Volunteer profile form.** A bare-bones profile row is now created
  automatically on first claim (see `/api/requests/claim`), but
  there's no form yet for area/frequency preferences.

## Deploying
1. Push to GitHub, import in Vercel.
2. Add all four env vars from `.env.local` in Vercel's project settings.
3. In Clerk's dashboard, add your Vercel domain under allowed origins.
4. Point a subdomain (e.g. `app.columbuscakecelebrations.com`) at the
   Vercel deployment; WordPress keeps the root domain.
