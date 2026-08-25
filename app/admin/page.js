import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");
  const user = await clerkClient().users.getUser(userId);
  if (user.publicMetadata?.role !== "admin") redirect("/volunteer");
}

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

function num(v) {
  return v === "" || v === null || v === undefined ? null : Number(v);
}
function splitList(v) {
  return (v || "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function approveRequest(formData) {
  "use server";
  await requireAdmin();
  const supabase = createAdminClient();

  const id = formData.get("id");
  const recipientId = formData.get("recipient_id");

  // Every field Emily can see is also editable — she's saving her
  // corrected version (e.g. a vague address fixed to a real one)
  // at the same time she approves, not just flipping a status flag.
  const { error: recipientError } = await supabase
    .from("recipients")
    .update({
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
    })
    .eq("id", recipientId);

  const { error: requestError } = await supabase
    .from("requests")
    .update({
      status: "posted",
      requested_datetime: formData.get("requested_datetime"),
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
    })
    .eq("id", id);

  if (recipientError) console.error("recipient update failed:", recipientError);
  if (requestError) console.error("request update failed:", requestError);

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

export default async function AdminPage() {
  await requireAdmin();
  const requests = await getPendingRequests();

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Pending requests ({requests.length})</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Every field below is editable — correct anything before approving (e.g. a vague
        address) and your changes save when you approve.
      </p>

      {requests.length === 0 && <p>Nothing waiting for review right now.</p>}

      {requests.map((r) => {
        const p = r.recipients;
        return (
          <div key={r.id} style={cardStyle}>
            <form action={approveRequest}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="recipient_id" value={p.id} />

              <SectionHeader>Requesting parent/guardian</SectionHeader>
              <Row>
                <TextField name="parent_first_name" label="First name" defaultValue={p.first_name} />
                <TextField name="parent_last_name" label="Last name" defaultValue={p.last_name} />
              </Row>
              <TextField name="parent_email" label="Email" defaultValue={p.email} />
              <TextField name="street_address" label="Street address" defaultValue={p.street_address} />
              <Row>
                <TextField name="apartment_number" label="Apt/unit" defaultValue={p.apartment_number} />
                <TextField name="apartment_complex_name" label="Complex name" defaultValue={p.apartment_complex_name} />
              </Row>
              <Row cols="2fr 1fr 1fr">
                <TextField name="city" label="City" defaultValue={p.city} />
                <TextField name="state" label="State" defaultValue={p.state} />
                <TextField name="zip_code" label="Zip" defaultValue={p.zip_code} />
              </Row>
              <Row>
                <TextField name="phone_number" label="Phone" defaultValue={p.phone_number} />
                <TextField name="backup_phone_number" label="Backup phone" defaultValue={p.backup_phone_number} />
              </Row>
              <Row>
                <TextField name="backup_contact_first_name" label="Backup contact first name" defaultValue={p.backup_contact_first_name} />
                <TextField name="backup_contact_last_name" label="Backup contact last name" defaultValue={p.backup_contact_last_name} />
              </Row>
              <Row>
                <SelectField name="preferred_contact_method" label="Preferred contact" defaultValue={p.preferred_contact_method}
                  options={[["phone", "Phone"], ["text", "Text"], ["email", "Email"]]} />
                <TextField name="relationship_to_recipient" label="Relationship to child" defaultValue={p.relationship_to_recipient} />
              </Row>
              <p style={{ fontSize: 13, color: "#666" }}>
                Guardian permission confirmed: <strong>{p.guardian_permission_confirmed ? "Yes" : "No"}</strong>
              </p>

              <SectionHeader>Cake details</SectionHeader>
              <Row>
                <TextField name="requested_datetime" label="Requested date" type="date" defaultValue={r.requested_datetime} />
                <TextField name="child_age" label="Child's age" type="number" defaultValue={r.recipient_age} />
              </Row>
              <TextField name="child_first_name" label="Child's first name" defaultValue={r.recipient_first_name} />
              <Row>
                <SelectField name="cake_or_cupcakes" label="Cake or cupcakes" defaultValue={r.cake_or_cupcakes}
                  options={[["cake", "Cake"], ["cupcakes", "Cupcakes"]]} />
                {r.cake_or_cupcakes === "cake" ? (
                  <TextField name="servings" label="Servings (max 16)" type="number" defaultValue={r.servings} />
                ) : (
                  <TextField name="cupcake_count" label="Cupcake count (max 24)" type="number" defaultValue={r.cupcake_count} />
                )}
              </Row>
              <TextField name="flavor_options" label="Flavor options" hint="comma-separated" defaultValue={r.flavor_options?.join(", ")} />
              <TextField name="icing_options" label="Icing options" hint="comma-separated" defaultValue={r.icing_options?.join(", ")} />
              <TextAreaField name="interests" label="Interests" defaultValue={r.interests} />
              <TextField name="favorite_colors" label="Favorite colors" defaultValue={r.favorite_colors} />

              <SectionHeader>Allergies & other</SectionHeader>
              <CheckboxField name="has_allergies" label="Has allergies/dietary restrictions" defaultChecked={r.has_allergies} />
              <TextAreaField name="allergy_details" label="Allergy details" defaultValue={r.allergy_details} rows={2} />
              <SelectField name="allergy_severity" label="Severity" defaultValue={r.allergy_severity || ""}
                options={[["", "N/A"], ["mild", "Mild"], ["severe", "Severe"]]} />
              <TextField name="heard_about_us" label="Heard about us via" defaultValue={r.heard_about_us} />
              <CheckboxField name="photo_sharing_ok" label="OK to share photos in volunteer group" defaultChecked={r.photo_sharing_ok} />

              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button type="submit" style={approveBtnStyle}>Save changes & approve → post to volunteers</button>
              </div>
            </form>

            <form action={rejectRequest} style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input type="hidden" name="id" value={r.id} />
              <input name="notes" placeholder="Reason (optional)" style={{ padding: 6, flex: 1 }} />
              <button type="submit" style={rejectBtnStyle}>Reject</button>
            </form>
          </div>
        );
      })}
    </main>
  );
}

// ==================== field primitives ====================

const cardStyle = { border: "1px solid #ddd", borderRadius: 8, padding: 20, marginBottom: 20 };
const approveBtnStyle = { padding: "10px 16px", background: "#2e7d32", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 };
const rejectBtnStyle = { padding: "8px 14px", background: "#c62828", color: "white", border: "none", borderRadius: 4, cursor: "pointer" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 3 };
const inputStyle = { width: "100%", padding: 7, marginBottom: 12, boxSizing: "border-box", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 };

function SectionHeader({ children }) {
  return <h4 style={{ marginTop: 20, marginBottom: 10, color: "#333", borderBottom: "1px solid #eee", paddingBottom: 4 }}>{children}</h4>;
}

function Row({ children, cols }) {
  return <div style={{ display: "grid", gridTemplateColumns: cols || "1fr 1fr", gap: 10 }}>{children}</div>;
}

function TextField({ name, label, hint, type = "text", defaultValue }) {
  return (
    <div>
      <label style={labelStyle}>{label}{hint && <span style={{ fontWeight: 400, color: "#888" }}> ({hint})</span>}</label>
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
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14 }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
