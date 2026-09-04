import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../lib/supabaseAdmin";
import { sendEmail } from "../../lib/sendEmail";
import { claimEmailHtml, cancellationEmailHtml } from "../../lib/emailTemplates";
import { revalidatePath } from "next/cache";
import { COLORS, pageWrap, heading, card, inputStyle, labelStyle, primaryBtn, outlineBtn, dangerBtn, tabBtn, fontFamily, requestNumberStyle } from "../../lib/theme";
import { statusLabel, cakeFormatLabel, travelDistanceLabel } from "../../lib/labels";
import { formatDateTime, orgLocalToUtcIso, utcToOrgLocalInput } from "../../lib/datetime";
import { SORT_OPTIONS, matchesQuery, sortRequests } from "../../lib/filters";
import { roleOf, canReachAdmin, canManageRequests, canAssignVolunteers } from "../../lib/roles";

// Returns the caller's role after confirming they may reach /admin at
// all. Every server action below then asserts the specific power it
// needs on top of this — a coordinator can load the page but must not
// be able to approve or cancel anything by POSTing at it directly.
async function requireAdminRole() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");
  const user = await clerkClient().users.getUser(userId);
  const role = roleOf(user);
  if (!canReachAdmin(role)) redirect("/volunteer");
  return role;
}

// Full-admin actions call this. A coordinator reaching one is a
// redirect, not a silent no-op, so the failure is visible.
async function requireFullAdmin() {
  const role = await requireAdminRole();
  if (!canManageRequests(role)) redirect("/admin?tab=unclaimed");
  return role;
}

async function requireAssigner() {
  const role = await requireAdminRole();
  if (!canAssignVolunteers(role)) redirect("/volunteer");
  return role;
}

const IN_PROGRESS_STATUSES = ["claimed", "contacted", "confirmed", "no_response", "delivered"];

const CAKE_FORMAT_OPTIONS = [["cake", "Cake"], ["cupcakes", "Cupcakes"], ["no_preference", "No preference"]];

function num(v) { return v === "" || v === null || v === undefined ? null : Number(v); }
function splitList(v) { return (v || "").split(",").map((s) => s.trim()).filter(Boolean); }

// "Submitted Mar 4, 2026 · 3 days ago" for the review queue, so Emily
// can see at a glance what's been waiting longest.
function submittedLabel(createdAt) {
  const date = new Date(createdAt);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  const ago = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  return `Submitted ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${ago}`;
}

// ==================== data loaders ====================

async function getPendingRequests(supabase) {
  const { data } = await supabase.from("requests").select("*, recipients(*)").eq("status", "submitted").order("created_at", { ascending: true });
  return data || [];
}

async function getUnclaimedRequests(supabase) {
  const { data } = await supabase.from("requests").select("*, recipients(*)").eq("status", "posted").order("requested_datetime", { ascending: true });
  return data || [];
}

async function getInProgressRequests(supabase) {
  const { data } = await supabase
    .from("requests")
    .select("*, recipients(*), claims(id, volunteer_id, claimed_at)")
    .in("status", IN_PROGRESS_STATUSES)
    .order("requested_datetime", { ascending: true });
  return data || [];
}

// Only approved volunteers are offered in the assign dropdowns — there
// is no point assigning a request to someone who cannot act on it.
async function getVolunteerOptions(supabase) {
  const { data } = await supabase
    .from("volunteer_profiles")
    .select("id, first_name, last_name, city, state, travel_distance")
    .eq("approved", true)
    .order("first_name");
  return data || [];
}

async function getAllVolunteers(supabase) {
  const { data } = await supabase
    .from("volunteer_profiles")
    .select("*")
    .order("approved", { ascending: true })
    .order("created_at", { ascending: true });
  return data || [];
}

// ==================== server actions ====================

async function approveRequest(formData) {
  "use server";
  await requireFullAdmin();
  const supabase = createAdminClient();
  const id = formData.get("id");
  const recipientId = formData.get("recipient_id");

  await supabase.from("recipients").update({
    first_name: formData.get("parent_first_name"),
    last_name: formData.get("parent_last_name"),
    email: formData.get("parent_email"),
    street_address: formData.get("street_address"),
    apartment_number: formData.get("apartment_number") || null,
    apartment_complex_name: formData.get("apartment_complex_name") || null,
    city: formData.get("city"),
    state: formData.get("state"),
    zip_code: formData.get("zip_code"),
    phone_number: formData.get("phone_number"),
    backup_phone_number: formData.get("backup_phone_number") || null,
    backup_contact_first_name: formData.get("backup_contact_first_name") || null,
    backup_contact_last_name: formData.get("backup_contact_last_name") || null,
    preferred_contact_method: formData.get("preferred_contact_method"),
    relationship_to_recipient: formData.get("relationship_to_recipient"),
  }).eq("id", recipientId);

  await supabase.from("requests").update({
    status: "posted",
    requested_datetime: orgLocalToUtcIso(formData.get("requested_datetime")),
    recipient_age: num(formData.get("child_age")),
    recipient_first_name: formData.get("child_first_name"),
    cake_or_cupcakes: formData.get("cake_or_cupcakes"),
    servings: num(formData.get("servings")),
    cupcake_count: num(formData.get("cupcake_count")),
    flavor_options: splitList(formData.get("flavor_options")),
    icing_options: splitList(formData.get("icing_options")),
    interests: formData.get("interests") || null,
    favorite_colors: formData.get("favorite_colors") || null,
    has_allergies: formData.get("has_allergies") === "on",
    allergy_details: formData.get("allergy_details") || null,
    allergy_severity: formData.get("allergy_severity") || null,
    photo_sharing_ok: formData.get("photo_sharing_ok") === "on",
    heard_about_us: formData.get("heard_about_us") || null,
  }).eq("id", id);

  revalidatePath("/admin");
}

async function rejectRequest(formData) {
  "use server";
  await requireFullAdmin();
  const id = formData.get("id");
  const notes = formData.get("notes");
  const supabase = createAdminClient();
  await supabase.from("requests").update({ status: "rejected", admin_notes: notes || null }).eq("id", id);
  revalidatePath("/admin");
}

// Pulls an approved-but-unclaimed request back into the review queue so
// it can be edited and re-approved. Deliberately not offered once a
// volunteer holds it — silently yanking a request out from under
// someone who is already baking is not an edit, it's a cancellation,
// and it goes through cancelRequest so the volunteer actually hears
// about it. The status guard re-checks that server-side.
async function revertToSubmitted(formData) {
  "use server";
  await requireFullAdmin();
  const supabase = createAdminClient();
  const id = formData.get("id");

  await supabase
    .from("requests")
    .update({ status: "submitted" })
    .eq("id", id)
    .eq("status", "posted");

  revalidatePath("/admin");
}

// Takes down an already-approved request, claimed or not. Distinct from
// rejectRequest, which declines one before it is ever posted.
async function cancelRequest(formData) {
  "use server";
  await requireFullAdmin();
  const id = formData.get("id");
  const reason = (formData.get("reason") || "").trim();

  // The reason is the point of this action — it's what the volunteer
  // gets told. Refuse rather than cancel silently.
  if (!reason) { revalidatePath("/admin"); return; }

  const supabase = createAdminClient();

  const { data: reqRow } = await supabase
    .from("requests")
    .select("*, recipients(*), claims(volunteer_id)")
    .eq("id", id)
    .single();
  if (!reqRow) return;

  await supabase
    .from("requests")
    .update({ status: "cancelled", cancellation_reason: reason })
    .eq("id", id);

  // The claim row stays. The volunteer keeps seeing the request in
  // their list, marked cancelled and carrying the reason, rather than
  // it vanishing overnight with no explanation.
  const volunteerId = reqRow.claims?.[0]?.volunteer_id;
  if (volunteerId) {
    try {
      const volunteerUser = await clerkClient().users.getUser(volunteerId);
      const volunteerEmail = volunteerUser?.emailAddresses?.[0]?.emailAddress;
      if (volunteerEmail) {
        await sendEmail({
          to: volunteerEmail,
          subject: `Cake request ${reqRow.request_number} has been cancelled`,
          html: cancellationEmailHtml(reqRow, reason),
        });
      }
    } catch (e) {
      console.error("cancellation email failed:", e);
    }
  }

  revalidatePath("/admin");
}

// Approving a volunteer is a full-admin power, not a coordinator one —
// it decides who gets access to recipient PII.
async function setVolunteerApproval(formData) {
  "use server";
  await requireFullAdmin();
  const supabase = createAdminClient();
  const volunteerId = formData.get("volunteer_id");
  const approved = formData.get("approved") === "true";

  await supabase
    .from("volunteer_profiles")
    .update({ approved })
    .eq("id", volunteerId);

  revalidatePath("/admin");
}

// Handles BOTH first assignment (unclaimed -> claimed) and reassignment
// (swap the volunteer on an already-in-progress request) — same action
// either way: replace whatever claim exists, reset to 'claimed', email
// the newly assigned volunteer their details.
async function assignVolunteer(formData) {
  "use server";
  await requireAssigner();
  const requestId = formData.get("request_id");
  const volunteerId = formData.get("volunteer_id");
  if (!volunteerId) { revalidatePath("/admin"); return; }

  const supabase = createAdminClient();

  const { data: reqRow } = await supabase.from("requests").select("*, recipients(*)").eq("id", requestId).single();
  if (!reqRow) return;

  await supabase.from("claims").delete().eq("request_id", requestId);
  await supabase.from("claims").insert({ request_id: requestId, volunteer_id: volunteerId });
  await supabase.from("requests").update({ status: "claimed" }).eq("id", requestId);

  try {
    const volunteerUser = await clerkClient().users.getUser(volunteerId);
    const volunteerEmail = volunteerUser?.emailAddresses?.[0]?.emailAddress;
    if (volunteerEmail) {
      await sendEmail({
        to: volunteerEmail,
        subject: `You've been assigned a cake request — ${reqRow.recipient_first_name}, age ${reqRow.recipient_age}`,
        html: `<p>Emily has assigned you a cake request!</p>${claimEmailHtml(reqRow)}`,
      });
    }
  } catch (e) {
    console.error("assign email failed:", e);
  }

  revalidatePath("/admin");
}

// ==================== page ====================

// Filtering lives in the URL rather than in component state, matching
// how the tabs already work: /admin?tab=progress&q=43215&sort=oldest is
// a link Emily can bookmark or paste to someone else, and it survives
// the page re-rendering after every approve or assign.
function applyFilters(requests, { q, sort, status }) {
  return sortRequests(
    requests.filter((r) => {
      if (status && r.status !== status) return false;
      const p = r.recipients || {};
      return matchesQuery(
        [`request ${r.request_number}`, r.recipient_first_name, p.city, p.zip_code,
         p.state, p.first_name, p.last_name, r.interests, r.favorite_colors],
        q,
      );
    }),
    sort,
  );
}

export default async function AdminPage({ searchParams }) {
  const role = await requireAdminRole();
  const fullAdmin = canManageRequests(role);
  // A coordinator has no review queue, so their landing tab is the
  // first one they can actually act on.
  const tab = searchParams?.tab || (fullAdmin ? "pending" : "unclaimed");
  const q = searchParams?.q || "";
  const sort = searchParams?.sort || "soonest";
  const status = searchParams?.status || "";
  const supabase = createAdminClient();

  const [pending, unclaimed, inProgress, volunteers, allVolunteers] = await Promise.all([
    fullAdmin ? getPendingRequests(supabase) : [],
    getUnclaimedRequests(supabase),
    getInProgressRequests(supabase),
    getVolunteerOptions(supabase),
    fullAdmin ? getAllVolunteers(supabase) : [],
  ]);

  // Pending review is a queue worked oldest-first, so it keeps its own
  // ordering and only takes the text filter.
  const shownPending = applyFilters(pending, { q, sort: "oldest" });
  const shownUnclaimed = applyFilters(unclaimed, { q, sort });
  const shownProgress = applyFilters(inProgress, { q, sort, status });
  const awaitingApproval = allVolunteers.filter((v) => !v.approved).length;

  // A coordinator has no access to these tabs; falling through to
  // unclaimed keeps a stale bookmark from rendering an empty shell.
  const effectiveTab = !fullAdmin && (tab === "pending" || tab === "volunteers") ? "unclaimed" : tab;

  const counts = {
    pending: pending.length,
    unclaimed: unclaimed.length,
    progress: inProgress.length,
    volunteers: allVolunteers.length,
  };
  const shownCount = {
    pending: shownPending.length,
    unclaimed: shownUnclaimed.length,
    progress: shownProgress.length,
    volunteers: allVolunteers.length,
  }[effectiveTab];

  return (
    <div style={pageWrap}>
      <div style={{ maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <h1 style={{ ...heading, fontSize: 28 }}>Admin dashboard</h1>
          {!fullAdmin && (
            <span style={{ ...requestNumberStyle, borderColor: COLORS.gold, color: COLORS.gold }}>
              Coordinator — assign only
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          {fullAdmin && <a href="/admin?tab=pending" style={{ textDecoration: "none" }}><span style={tabBtn(effectiveTab === "pending")}>Pending review ({counts.pending})</span></a>}
          <a href="/admin?tab=unclaimed" style={{ textDecoration: "none" }}><span style={tabBtn(effectiveTab === "unclaimed")}>Approved — no volunteer ({counts.unclaimed})</span></a>
          <a href="/admin?tab=progress" style={{ textDecoration: "none" }}><span style={tabBtn(effectiveTab === "progress")}>In progress ({counts.progress})</span></a>
          {fullAdmin && (
            <a href="/admin?tab=volunteers" style={{ textDecoration: "none" }}>
              <span style={tabBtn(effectiveTab === "volunteers")}>
                Volunteers ({counts.volunteers}){awaitingApproval > 0 ? ` · ${awaitingApproval} waiting` : ""}
              </span>
            </a>
          )}
        </div>

        {effectiveTab !== "volunteers" && (
          <FilterBar tab={effectiveTab} q={q} sort={sort} status={status} shown={shownCount} total={counts[effectiveTab]} />
        )}

        {effectiveTab === "pending" && <PendingTab requests={shownPending} />}
        {effectiveTab === "volunteers" && <VolunteersTab volunteers={allVolunteers} />}
        {effectiveTab === "unclaimed" && <UnclaimedTab requests={shownUnclaimed} volunteers={volunteers} fullAdmin={fullAdmin} />}
        {effectiveTab === "progress" && <ProgressTab requests={shownProgress} volunteers={volunteers} fullAdmin={fullAdmin} />}
      </div>
    </div>
  );
}

// A plain GET form — no client component needed, and the result is a
// real URL. Sorting is hidden on the pending queue, which is always
// worked oldest-first; the status filter only means anything among the
// several in-progress statuses.
function FilterBar({ tab, q, sort, status, shown, total }) {
  const compact = { ...inputStyle, marginBottom: 0 };
  return (
    <form method="get" action="/admin" style={{ ...card, padding: 16, marginBottom: 16 }}>
      <input type="hidden" name="tab" value={tab} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "center" }}>
        <input name="q" defaultValue={q} placeholder="Search name, city, zip, request number" style={compact} />
        {tab === "progress" ? (
          <select name="status" defaultValue={status} style={compact}>
            <option value="">Any status</option>
            {IN_PROGRESS_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        ) : tab === "unclaimed" ? (
          <select name="sort" defaultValue={sort} style={compact}>
            {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ) : <span />}
        <button type="submit" style={primaryBtn()}>Apply</button>
      </div>
      {tab === "progress" && (
        <div style={{ marginTop: 8 }}>
          <select name="sort" defaultValue={sort} style={{ ...compact, maxWidth: 240 }}>
            {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}
      {(q || status) && (
        <p style={{ fontSize: 12, color: COLORS.inkSoft, fontFamily, margin: "10px 0 0" }}>
          Showing {shown} of {total}. <a href={`/admin?tab=${tab}`} style={{ color: COLORS.berry }}>Clear filters</a>
        </p>
      )}
    </form>
  );
}

// ==================== tab: pending review ====================

function PendingTab({ requests }) {
  return (
    <>
      <p style={{ color: COLORS.inkSoft, fontSize: 14, marginBottom: 16 }}>
        Every field is editable — correct anything before approving; your changes save when you approve.
      </p>
      {requests.length === 0 && <p style={{ color: COLORS.inkSoft }}>Nothing waiting for review.</p>}
      {requests.map((r) => {
        const p = r.recipients;
        return (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={requestNumberStyle}>Request {r.request_number}</span>
              <span style={{ fontSize: 13, color: COLORS.inkSoft, fontFamily }}>{submittedLabel(r.created_at)}</span>
            </div>
            <form action={approveRequest}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="recipient_id" value={p.id} />

              <SectionHeader>Requesting parent/guardian</SectionHeader>
              <Row><TextField name="parent_first_name" label="First name" defaultValue={p.first_name} /><TextField name="parent_last_name" label="Last name" defaultValue={p.last_name} /></Row>
              <TextField name="parent_email" label="Email" defaultValue={p.email} />
              <TextField name="street_address" label="Street address" defaultValue={p.street_address} />
              <Row><TextField name="apartment_number" label="Apt/unit" defaultValue={p.apartment_number} /><TextField name="apartment_complex_name" label="Complex name" defaultValue={p.apartment_complex_name} /></Row>
              <Row cols="2fr 1fr 1fr"><TextField name="city" label="City" defaultValue={p.city} /><TextField name="state" label="State" defaultValue={p.state} /><TextField name="zip_code" label="Zip" defaultValue={p.zip_code} /></Row>
              <Row><TextField name="phone_number" label="Phone" defaultValue={p.phone_number} /><TextField name="backup_phone_number" label="Backup phone" defaultValue={p.backup_phone_number} /></Row>
              <Row><TextField name="backup_contact_first_name" label="Backup contact first" defaultValue={p.backup_contact_first_name} /><TextField name="backup_contact_last_name" label="Backup contact last" defaultValue={p.backup_contact_last_name} /></Row>
              <Row>
                <SelectField name="preferred_contact_method" label="Preferred contact" defaultValue={p.preferred_contact_method} options={[["phone", "Phone"], ["text", "Text"], ["email", "Email"]]} />
                <TextField name="relationship_to_recipient" label="Relationship to child" defaultValue={p.relationship_to_recipient} />
              </Row>
              <p style={{ fontSize: 13, color: COLORS.inkSoft }}>Guardian permission confirmed: <strong>{p.guardian_permission_confirmed ? "Yes" : "No"}</strong></p>

              <SectionHeader>Cake details</SectionHeader>
              <Row><TextField name="requested_datetime" label="Requested date & time" hint="Columbus time" type="datetime-local" defaultValue={utcToOrgLocalInput(r.requested_datetime)} /><TextField name="child_age" label="Child's age" type="number" defaultValue={r.recipient_age} /></Row>
              <TextField name="child_first_name" label="Child's first name" defaultValue={r.recipient_first_name} />
              <Row>
                <SelectField name="cake_or_cupcakes" label="Cake or cupcakes" defaultValue={r.cake_or_cupcakes} options={CAKE_FORMAT_OPTIONS} />
                {r.cake_or_cupcakes === "cupcakes" ? <TextField name="cupcake_count" label="Cupcake count (max 24)" type="number" defaultValue={r.cupcake_count} /> : <TextField name="servings" label="Servings (max 16)" type="number" defaultValue={r.servings} />}
              </Row>
              <TextField name="flavor_options" label="Flavor options" hint="comma-separated" defaultValue={r.flavor_options?.join(", ")} />
              <TextField name="icing_options" label="Icing options" hint="comma-separated" defaultValue={r.icing_options?.join(", ")} />
              <TextAreaField name="interests" label="Interests" defaultValue={r.interests} />
              <TextField name="favorite_colors" label="Favorite colors" defaultValue={r.favorite_colors} />

              <SectionHeader>Allergies & other</SectionHeader>
              <CheckboxField name="has_allergies" label="Has allergies/dietary restrictions" defaultChecked={r.has_allergies} />
              <TextAreaField name="allergy_details" label="Allergy details" defaultValue={r.allergy_details} rows={2} />
              <SelectField name="allergy_severity" label="Severity" defaultValue={r.allergy_severity || ""} options={[["", "N/A"], ["mild", "Mild"], ["severe", "Severe"]]} />
              <TextField name="heard_about_us" label="Heard about us via" defaultValue={r.heard_about_us} />
              <CheckboxField name="photo_sharing_ok" label="OK to share photos in volunteer group" defaultChecked={r.photo_sharing_ok} />

              <div style={{ marginTop: 16 }}>
                <button type="submit" style={primaryBtn()}>Save changes & approve → post to volunteers</button>
              </div>
            </form>

            <form action={rejectRequest} style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input type="hidden" name="id" value={r.id} />
              <input name="notes" placeholder="Reason (optional)" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <button type="submit" style={dangerBtn()}>Reject</button>
            </form>
          </div>
        );
      })}
    </>
  );
}

// ==================== tab: approved, no volunteer ====================

function UnclaimedTab({ requests, volunteers, fullAdmin }) {
  return (
    <>
      {requests.length === 0 && <p style={{ color: COLORS.inkSoft }}>Nothing approved and waiting for a volunteer.</p>}
      {requests.map((r) => (
        <div key={r.id} style={card}>
          <span style={requestNumberStyle}>Request {r.request_number}</span>
          <h3 style={{ ...heading, fontSize: 17, margin: "8px 0 6px" }}>
            {r.recipient_first_name}, age {r.recipient_age} — {cakeFormatLabel(r.cake_or_cupcakes)}
          </h3>
          <p style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 10 }}>
            📍 {r.recipients.city}, {r.recipients.zip_code} · Needed by {formatDateTime(r.requested_datetime)}
          </p>
          <AssignForm requestId={r.id} volunteers={volunteers} buttonLabel="Assign volunteer" />

          {fullAdmin && (
            <>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                <form action={revertToSubmitted} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" style={outlineBtn()}>Send back for editing</button>
                </form>
                <span style={{ fontSize: 12, color: COLORS.inkSoft, marginLeft: 10, fontFamily }}>
                  Returns it to Pending review. No volunteer has claimed it yet.
                </span>
              </div>
              <CancelForm requestId={r.id} />
            </>
          )}
        </div>
      ))}
    </>
  );
}

// ==================== tab: in progress ====================

function ProgressTab({ requests, volunteers, fullAdmin }) {
  return (
    <>
      {requests.length === 0 && <p style={{ color: COLORS.inkSoft }}>Nothing in progress right now.</p>}
      {requests.map((r) => {
        const claim = r.claims?.[0];
        const v = volunteers.find((v) => v.id === claim?.volunteer_id);
        return (
          <div key={r.id} style={card}>
            <span style={requestNumberStyle}>Request {r.request_number}</span>
            <h3 style={{ ...heading, fontSize: 17, margin: "8px 0 6px" }}>
              {r.recipient_first_name}, age {r.recipient_age} — {cakeFormatLabel(r.cake_or_cupcakes)}
            </h3>
            <p style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 6 }}>
              📍 {r.recipients.city}, {r.recipients.zip_code} · Needed by {formatDateTime(r.requested_datetime)}
            </p>
            <p style={{ fontSize: 14, marginBottom: 10 }}>
              <strong>Volunteer:</strong> {v ? `${v.first_name} ${v.last_name}`.trim() || v.id : "Unknown"} &nbsp;·&nbsp;
              <strong>Status:</strong> <span style={{ color: COLORS.berry }}>{statusLabel(r.status)}</span>
            </p>
            <AssignForm requestId={r.id} volunteers={volunteers} buttonLabel="Reassign to different volunteer" currentVolunteerId={claim?.volunteer_id} />
            {fullAdmin && <CancelForm requestId={r.id} hasVolunteer />}
          </div>
        );
      })}
    </>
  );
}

// ==================== tab: volunteers ====================

function VolunteersTab({ volunteers }) {
  const waiting = volunteers.filter((v) => !v.approved);
  const active = volunteers.filter((v) => v.approved);

  return (
    <>
      <p style={{ color: COLORS.inkSoft, fontSize: 14, marginBottom: 16 }}>
        Approving a volunteer lets them claim requests, which means seeing recipient names,
        addresses and phone numbers. Only approve people you know.
      </p>

      <h3 style={{ ...heading, fontSize: 17, marginBottom: 10 }}>Waiting for approval ({waiting.length})</h3>
      {waiting.length === 0 && <p style={{ color: COLORS.inkSoft, marginBottom: 24 }}>Nobody waiting.</p>}
      {waiting.map((v) => <VolunteerRow key={v.id} volunteer={v} />)}

      <h3 style={{ ...heading, fontSize: 17, margin: "28px 0 10px" }}>Approved ({active.length})</h3>
      {active.length === 0 && <p style={{ color: COLORS.inkSoft }}>No approved volunteers yet.</p>}
      {active.map((v) => <VolunteerRow key={v.id} volunteer={v} />)}
    </>
  );
}

function VolunteerRow({ volunteer: v }) {
  const name = `${v.first_name} ${v.last_name}`.trim();
  const does = [v.can_bake && "bakes", v.can_buy && "buys", v.can_deliver && "delivers"].filter(Boolean).join(" · ");

  return (
    <div style={{ ...card, padding: 16, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <strong style={{ fontFamily, fontSize: 15 }}>{name || "(no name set)"}</strong>
          {v.email && <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: "2px 0 0", fontFamily }}>{v.email}</p>}
          <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: "4px 0 0", fontFamily }}>
            {v.general_area || "Area not set"}
            {v.travel_distance ? ` · travels ${travelDistanceLabel(v.travel_distance)}` : ""}
            {does ? ` · ${does}` : ""}
          </p>
          {v.interests && <p style={{ fontSize: 13, color: COLORS.ink, margin: "6px 0 0", fontFamily }}>{v.interests}</p>}
          <p style={{ fontSize: 12, color: COLORS.inkSoft, margin: "6px 0 0", fontFamily }}>
            Signed up {new Date(v.created_at).toLocaleDateString()}
          </p>
        </div>

        <form action={setVolunteerApproval}>
          <input type="hidden" name="volunteer_id" value={v.id} />
          <input type="hidden" name="approved" value={v.approved ? "false" : "true"} />
          <button type="submit" style={v.approved ? dangerBtn() : primaryBtn()}>
            {v.approved ? "Revoke access" : "Approve"}
          </button>
        </form>
      </div>
    </div>
  );
}

// The reason is required, not decoration — it's what gets emailed to
// the volunteer holding the request, so the button stays disabled-ish
// by virtue of the server action refusing an empty one.
function CancelForm({ requestId, hasVolunteer }) {
  return (
    <form action={cancelRequest} style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-start" }}>
      <input type="hidden" name="id" value={requestId} />
      <div style={{ flex: 1 }}>
        <input
          name="reason"
          required
          placeholder="Why is this being cancelled? (required)"
          style={{ ...inputStyle, marginBottom: 4 }}
        />
        <span style={{ fontSize: 12, color: COLORS.inkSoft, fontFamily }}>
          {hasVolunteer
            ? "The assigned volunteer is emailed this reason."
            : "Takes the request off the volunteer board."}
        </span>
      </div>
      <button type="submit" style={dangerBtn()}>Cancel request</button>
    </form>
  );
}

function AssignForm({ requestId, volunteers, buttonLabel, currentVolunteerId }) {
  return (
    <form action={assignVolunteer} style={{ display: "flex", gap: 8 }}>
      <input type="hidden" name="request_id" value={requestId} />
      <select name="volunteer_id" defaultValue={currentVolunteerId || ""} style={{ ...inputStyle, marginBottom: 0, flex: 1 }}>
        <option value="">Select a volunteer…</option>
        {volunteers.map((v) => (
          <option key={v.id} value={v.id}>
            {`${v.first_name} ${v.last_name}`.trim() || v.id}{v.city ? ` — ${v.city}` : ""}{v.travel_distance ? ` (travels ${travelDistanceLabel(v.travel_distance)})` : ""}
          </option>
        ))}
      </select>
      <button type="submit" style={primaryBtn()}>{buttonLabel}</button>
    </form>
  );
}

// ==================== field primitives ====================

function SectionHeader({ children }) {
  return <h4 style={{ ...heading, fontSize: 16, marginTop: 20, marginBottom: 10, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 6 }}>{children}</h4>;
}
function Row({ children, cols }) {
  return <div style={{ display: "grid", gridTemplateColumns: cols || "1fr 1fr", gap: 10 }}>{children}</div>;
}
function TextField({ name, label, hint, type = "text", defaultValue }) {
  return (
    <div>
      <label style={labelStyle}>{label}{hint && <span style={{ fontWeight: 400, color: COLORS.inkSoft }}> ({hint})</span>}</label>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} style={inputStyle} />
    </div>
  );
}
function TextAreaField({ name, label, defaultValue, rows = 2 }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={rows} style={{ ...inputStyle, resize: "vertical" }} />
    </div>
  );
}
function SelectField({ name, label, defaultValue, options }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select name={name} defaultValue={defaultValue ?? ""} style={inputStyle}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
function CheckboxField({ name, label, defaultChecked }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14, fontFamily }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
