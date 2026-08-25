import { createAdminClient } from "../../lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

// NOTE: this page currently has no auth gate — that's the first thing
// to add before going live (see README "Before go-live" section).
// For the MVP it's meant to be used only by Emily via a private link.

async function getPendingRequests() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("requests")
    .select("*, recipients(*)")
    .eq("status", "submitted")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

async function approveRequest(formData) {
  "use server";
  const id = formData.get("id");
  const supabase = createAdminClient();
  await supabase.from("requests").update({ status: "posted" }).eq("id", id);
  revalidatePath("/admin");
}

async function rejectRequest(formData) {
  "use server";
  const id = formData.get("id");
  const notes = formData.get("notes");
  const supabase = createAdminClient();
  await supabase.from("requests").update({ status: "rejected", admin_notes: notes || null }).eq("id", id);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const requests = await getPendingRequests();

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Pending requests ({requests.length})</h1>

      {requests.length === 0 && <p>Nothing waiting for review right now.</p>}

      {requests.map((r) => (
        <div key={r.id} style={cardStyle}>
          <h3>
            {r.recipient_first_name}, age {r.recipient_age} — {r.cake_or_cupcakes}
            {r.has_allergies && (
              <span style={{ color: "#c62828", fontSize: 14, marginLeft: 8 }}>
                ⚠ Allergies ({r.allergy_severity})
              </span>
            )}
          </h3>
          <p><strong>Requested date:</strong> {r.requested_datetime}</p>
          <p><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
          <p><strong>Interests:</strong> {r.interests || "—"} · <strong>Colors:</strong> {r.favorite_colors || "—"}</p>
          {r.has_allergies && <p><strong>Allergy details:</strong> {r.allergy_details}</p>}

          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Recipient contact info (PII)</summary>
            <p>
              {r.recipients.first_name} {r.recipients.last_name}<br />
              {r.recipients.street_address} {r.recipients.apartment_number}<br />
              {r.recipients.city}, {r.recipients.state} {r.recipients.zip_code}<br />
              {r.recipients.phone_number} · {r.recipients.email}<br />
              Relationship to recipient: {r.recipients.relationship_to_recipient}<br />
              Guardian permission confirmed: {r.recipients.guardian_permission_confirmed ? "Yes" : "No"}
            </p>
          </details>

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <form action={approveRequest}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" style={approveBtnStyle}>Approve → post to volunteers</button>
            </form>
            <form action={rejectRequest} style={{ display: "flex", gap: 8 }}>
              <input type="hidden" name="id" value={r.id} />
              <input name="notes" placeholder="Reason (optional)" style={{ padding: 6 }} />
              <button type="submit" style={rejectBtnStyle}>Reject</button>
            </form>
          </div>
        </div>
      ))}
    </main>
  );
}

const cardStyle = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 };
const approveBtnStyle = { padding: "8px 14px", background: "#2e7d32", color: "white", border: "none", borderRadius: 4, cursor: "pointer" };
const rejectBtnStyle = { padding: "8px 14px", background: "#c62828", color: "white", border: "none", borderRadius: 4, cursor: "pointer" };
