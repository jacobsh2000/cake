import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../lib/supabaseAdmin";
import { sendEmail } from "../../lib/sendEmail";
import { claimEmailHtml } from "../../lib/emailTemplates";
import { revalidatePath } from "next/cache";
import { COLORS, pageWrap, heading, card, inputStyle, labelStyle, primaryBtn, dangerBtn, tabBtn, fontFamily, requestNumberStyle } from "../../lib/theme";
import { statusLabel, cakeFormatLabel, travelDistanceLabel } from "../../lib/labels";
import { formatDateTime, orgLocalToUtcIso, utcToOrgLocalInput } from "../../lib/datetime";

async function requireAdmin() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");
  const user = await clerkClient().users.getUser(userId);
  if (user.publicMetadata?.role !== "admin") redirect("/volunteer");
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

async function getVolunteerOptions(supabase) {
  const { data } = await supabase.from("volunteer_profiles").select("id, first_name, last_name, city, state, travel_distance").order("first_name");
  return data || [];
}

// ==================== server actions ====================

async function approveRequest(formData) {
  "use server";
  await requireAdmin();
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
  await requireAdmin();
  const id = formData.get("id");
  const notes = formData.get("notes");
  const supabase = createAdminClient();
  await supabase.from("requests").update({ status: "rejected", admin_notes: notes || null }).eq("id", id);
  revalidatePath("/admin");
}

// Handles BOTH first assignment (unclaimed -> claimed) and reassignment
// (swap the volunteer on an already-in-progress request) — same action
// either way: replace whatever claim exists, reset to 'claimed', email
// the newly assigned volunteer their details.
async function assignVolunteer(formData) {
  "use server";
  await requireAdmin();
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

export default async function AdminPage({ searchParams }) {
  await requireAdmin();
  const tab = searchParams?.tab || "pending";
  const supabase = createAdminClient();

  const [pending, unclaimed, inProgress, volunteers] = await Promise.all([
    getPendingRequests(supabase),
    getUnclaimedRequests(supabase),
    getInProgressRequests(supabase),
    getVolunteerOptions(supabase),
  ]);

  return (
    <div style={pageWrap}>
      <div style={{ maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <h1 style={{ ...heading, fontSize: 28, marginBottom: 20 }}>Admin dashboard</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: `1px solid ${COLORS.border}` }}>
          <a href="/admin?tab=pending" style={{ textDecoration: "none" }}><span style={tabBtn(tab === "pending")}>Pending review ({pending.length})</span></a>
          <a href="/admin?tab=unclaimed" style={{ textDecoration: "none" }}><span style={tabBtn(tab === "unclaimed")}>Approved — no volunteer ({unclaimed.length})</span></a>
          <a href="/admin?tab=progress" style={{ textDecoration: "none" }}><span style={tabBtn(tab === "progress")}>In progress ({inProgress.length})</span></a>
        </div>

        {tab === "pending" && <PendingTab requests={pending} />}
        {tab === "unclaimed" && <UnclaimedTab requests={unclaimed} volunteers={volunteers} />}
        {tab === "progress" && <ProgressTab requests={inProgress} volunteers={volunteers} />}
      </div>
    </div>
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

function UnclaimedTab({ requests, volunteers }) {
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
        </div>
      ))}
    </>
  );
}

// ==================== tab: in progress ====================

function ProgressTab({ requests, volunteers }) {
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
          </div>
        );
      })}
    </>
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
