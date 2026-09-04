import { createAdminClient } from "../supabaseAdmin";
import { sendEmail } from "../sendEmail";
import { formatDateTime, ORG_TIME_ZONE } from "../datetime";
import { statusLabel } from "../labels";

// Deliveries this close that nobody has confirmed are the ones worth
// waking up to. Matches the threshold the volunteer reminder will use.
const ATTENTION_WINDOW_DAYS = 5;

const IN_PROGRESS = ["claimed", "contacted", "confirmed", "no_response"];

function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

// One email a day to the admin, summarising everything that needs a
// human. Deliberately the first job built on this infrastructure: one
// recipient who can say "this looks wrong", rather than every
// volunteer receiving whatever a date-math bug produces.
export async function dailyDigest() {
  const to = process.env.ADMIN_DIGEST_EMAIL;
  if (!to) {
    // Not an error — the job is simply not configured yet. Recorded in
    // job_runs as a successful no-op so a missing env var is visible
    // rather than looking like a dead cron.
    return { skipped: "ADMIN_DIGEST_EMAIL not set" };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const [pending, unclaimed, approaching, overdue, volunteers] = await Promise.all([
    supabase.from("requests").select("request_number, requested_datetime, recipient_first_name, created_at")
      .eq("status", "submitted").order("created_at", { ascending: true }),

    supabase.from("requests").select("request_number, requested_datetime, recipient_first_name")
      .eq("status", "posted").order("requested_datetime", { ascending: true }),

    // Claimed, happening soon, and the volunteer hasn't confirmed a
    // day/time with the family yet.
    supabase.from("requests").select("request_number, requested_datetime, recipient_first_name, status")
      .in("status", ["claimed", "contacted"])
      .gte("requested_datetime", now)
      .lte("requested_datetime", daysFromNow(ATTENTION_WINDOW_DAYS))
      .order("requested_datetime", { ascending: true }),

    // Delivery date has passed and it was never marked delivered.
    supabase.from("requests").select("request_number, requested_datetime, recipient_first_name, status")
      .in("status", IN_PROGRESS)
      .lt("requested_datetime", now)
      .order("requested_datetime", { ascending: true }),

    supabase.from("volunteer_profiles").select("first_name, last_name, email, created_at")
      .eq("approved", false).order("created_at", { ascending: true }),
  ]);

  const sections = [
    section("Waiting for your review", rows(pending, "pending review"), (r) =>
      `Request ${r.request_number} — ${r.recipient_first_name}, needed ${formatDateTime(r.requested_datetime)}`),

    section("Approved, still no volunteer", rows(unclaimed, "unclaimed"), (r) =>
      `Request ${r.request_number} — ${r.recipient_first_name}, needed ${formatDateTime(r.requested_datetime)}`),

    section(`Happening within ${ATTENTION_WINDOW_DAYS} days, not yet confirmed`, rows(approaching, "approaching"), (r) =>
      `Request ${r.request_number} — ${r.recipient_first_name}, ${formatDateTime(r.requested_datetime)} (${statusLabel(r.status)})`),

    section("Past their delivery date, not marked delivered", rows(overdue, "overdue"), (r) =>
      `Request ${r.request_number} — ${r.recipient_first_name}, was due ${formatDateTime(r.requested_datetime)} (${statusLabel(r.status)})`),

    section("Volunteers waiting for approval", rows(volunteers, "unapproved volunteers"), (v) =>
      `${`${v.first_name} ${v.last_name}`.trim() || "(no name set)"}${v.email ? ` — ${v.email}` : ""}`),
  ];

  const counts = Object.fromEntries(sections.map((s) => [s.key, s.items.length]));
  const needsAttention = sections.some((s) => s.items.length > 0);

  // Send even on a quiet day. A digest that only arrives when there's
  // news is indistinguishable from a digest that has stopped working.
  const send = await sendEmail({
    to,
    subject: needsAttention
      ? `Cake Celebrations — ${sections.reduce((n, s) => n + s.items.length, 0)} things need attention`
      : "Cake Celebrations — all clear today",
    html: digestHtml(sections, needsAttention),
  });

  // A skipped send (no RESEND_API_KEY) is reported rather than hidden,
  // so "the job ran fine" can't quietly mean "and sent nothing".
  if (send?.ok === false) throw new Error("digest email failed to send");
  return { to, counts, sent: send?.skipped ? "skipped — RESEND_API_KEY not set" : true };
}

// Unwraps a Supabase result, turning a failed query into a thrown
// error instead of an empty list.
//
// This is not defensive padding. supabase-js resolves rather than
// rejects on failure, returning { data: null, error }, so treating a
// null `data` as "no rows" makes a total database outage look
// identical to a quiet day — and the digest would cheerfully email
// "all clear" while nothing was reachable. Caught exactly that way in
// testing. The job must fail loudly so runJob records it and the
// dashboard banner turns red.
function rows(result, label) {
  if (result.error) {
    throw new Error(`digest query "${label}" failed: ${result.error.message}`);
  }
  return result.data || [];
}

function section(title, list, render) {
  return { key: title, title, items: list.map(render) };
}

function digestHtml(sections, needsAttention) {
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIME_ZONE, weekday: "long", month: "long", day: "numeric",
  }).format(new Date());

  const body = needsAttention
    ? sections
        .filter((s) => s.items.length > 0)
        .map((s) => `
          <h3 style="margin:20px 0 6px;font-size:15px;">${s.title} (${s.items.length})</h3>
          <ul style="margin:0;padding-left:20px;">
            ${s.items.map((i) => `<li style="margin:3px 0;">${i}</li>`).join("")}
          </ul>`)
        .join("")
    : `<p>Nothing needs attention today — no requests waiting for review,
        everything approved has a volunteer, and nothing is overdue.</p>`;

  return `
    <div style="font-family:system-ui,sans-serif;color:#332821;max-width:640px;">
      <p style="color:#6B5E54;margin:0 0 4px;">${today}</p>
      <h2 style="margin:0 0 8px;color:#5E2135;">Columbus Cake Celebrations — daily summary</h2>
      ${body}
      <p style="margin-top:24px;">
        <a href="${process.env.APP_URL || ""}/admin" style="color:#7A2E45;">Open the admin dashboard</a>
      </p>
      <p style="color:#6B5E54;font-size:12px;margin-top:20px;">
        This runs once a day. If it stops arriving, the scheduled job has
        stopped — the admin dashboard shows when it last ran.
      </p>
    </div>
  `;
}
