import { NextResponse } from "next/server";
import { runJob } from "../../../../lib/jobs/runner";
import { dailyDigest } from "../../../../lib/jobs/dailyDigest";

// This route sends email and, in future, changes request state. It sits
// on a public URL, so it has to authenticate the caller — an open cron
// endpoint is a free email-sending and state-mutating button for anyone
// who guesses the path.
//
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
// is set in the project's environment variables. If the secret is not
// configured we refuse rather than run, so a misconfiguration fails
// loudly and closed instead of quietly leaving the endpoint open.
function authorize(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 500, error: "CRON_SECRET is not configured" };
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

async function handle(req) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Jobs run in sequence and each records its own outcome. runJob never
  // throws, so one failing job cannot prevent the others from running —
  // a broken digest must not also stop the reminders that will live
  // here later.
  const results = [];
  results.push(await runJob("daily_digest", dailyDigest));

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 500 });
}

export async function GET(req) {
  return handle(req);
}

// Vercel Cron issues GET; POST is here so the job can be triggered
// manually with curl during setup without pretending to be the cron.
export async function POST(req) {
  return handle(req);
}
