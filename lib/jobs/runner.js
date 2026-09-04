import { createAdminClient } from "../supabaseAdmin";

// Runs one job and records the attempt, succeed or fail.
//
// The recording is the point. A scheduled job that has quietly stopped
// running produces exactly the same visible evidence as one with
// nothing to do — silence — so "when did this last run, and did it
// work" has to be a fact in the database, not something inferred from
// an absence of complaints.
//
// A job returning a detail object gets it stored; a job throwing gets
// its message stored and does NOT take down the rest of the run.
export async function runJob(jobName, fn) {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();

  const { data: runRow } = await supabase
    .from("job_runs")
    .insert({ job_name: jobName, started_at: startedAt })
    .select("id")
    .single();

  try {
    const detail = (await fn()) || {};
    await supabase
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: true, detail })
      .eq("id", runRow?.id);
    return { job: jobName, ok: true, detail };
  } catch (e) {
    const message = e?.message || String(e);
    console.error(`job ${jobName} failed:`, e);
    await supabase
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: false, error: message })
      .eq("id", runRow?.id);
    return { job: jobName, ok: false, error: message };
  }
}

// Claims the right to send one notification, exactly once.
//
// Insert first, send second. The UNIQUE constraint on
// (kind, request_id, recipient_key) is what actually enforces this:
// if the insert conflicts, someone already claimed it and we return
// false without sending. Doing it in this order means a crash between
// claiming and sending costs at most one missed email, whereas sending
// first and recording second would re-send to everyone on every retry.
//
// Vercel Cron is at-least-once, so this is load-bearing, not defensive
// decoration.
export async function claimNotification({ kind, requestId, recipientKey }) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("notifications_sent")
    .insert({ kind, request_id: requestId, recipient_key: recipientKey });

  if (!error) return true;

  // 23505 = unique_violation: already sent, which is the expected path
  // on any re-run, not an error worth logging.
  if (error.code === "23505") return false;

  throw new Error(`claimNotification(${kind}) failed: ${error.message}`);
}

// Releases a claim after a send genuinely failed, so the next run can
// retry it rather than the volunteer silently never hearing.
export async function releaseNotification({ kind, requestId, recipientKey }) {
  const supabase = createAdminClient();
  await supabase
    .from("notifications_sent")
    .delete()
    .eq("kind", kind)
    .eq("request_id", requestId)
    .eq("recipient_key", recipientKey);
}
