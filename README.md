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
5. Copy `.env.local.example` to `.env.local` and fill it in.
6. `npm run dev` → http://localhost:3000

To reach `/admin` locally, tag your own Clerk user with
`publicMetadata: { "role": "admin" }` in the Clerk dashboard.

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
