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

## Hard — not started

Automated reminder emails, the 48-hour reassignment timer, new-request
notification emails with per-volunteer opt-out, accept/decline on
admin-assigned claims, true multi-volunteer requests, travel-radius map
visualization, address-within-30-miles validation at submission, and
the daily digest email to Emily. Several of these share one piece of
missing infrastructure: a scheduled job (Vercel Cron or a Supabase
Edge Function). Worth building that once, deliberately, rather than
per-feature.

## Go-live checklist

Custom subdomain pointed at Vercel · Vercel Pro · Clerk Production keys
(separate user pool — admin roles must be re-tagged for Jacob and
Emily) · Resend domain verification · WordPress links to `/request` and
`/volunteer` · clear test data from Supabase · confirm the rotated
Supabase service-role key is what's live in Vercel · revert the GitHub
repo to private.
