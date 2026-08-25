"use client";

import { useState } from "react";

const FLAVORS = ["Vanilla", "Chocolate", "Funfetti", "Red Velvet", "Lemon", "Marble"];
const ICINGS = ["Buttercream", "Cream Cheese", "Chocolate Ganache", "Whipped"];

export default function RequestPage() {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    streetAddress: "", apartmentNumber: "", apartmentComplexName: "",
    city: "", state: "", zipCode: "", country: "USA",
    phoneNumber: "", backupPhoneNumber: "",
    backupContactFirstName: "", backupContactLastName: "",
    preferredContactMethod: "phone",
    relationshipToRecipient: "",
    guardianPermissionConfirmed: false,
    requestedDatetime: "",
    recipientAge: "",
    recipientFirstName: "",
    cakeOrCupcakes: "cake",
    servings: "", cupcakeCount: "",
    flavorOptions: [], icingOptions: [],
    interests: "", favoriteColors: "",
    hasAllergies: false, allergyDetails: "", allergySeverity: "",
    photoSharingOk: false,
    heardAboutUs: "",
    termsAccepted: false,
  });
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const [errorMsg, setErrorMsg] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleMulti(field, value, max) {
    setForm((f) => {
      const current = f[field];
      if (current.includes(value)) {
        return { ...f, [field]: current.filter((v) => v !== value) };
      }
      if (current.length >= max) return f; // cap enforced client-side
      return { ...f, [field]: [...current, value] };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    // 5-day lead time check, enforced client-side AND should be re-checked
    // server-side / in a DB constraint before go-live.
    const requestedDate = new Date(form.requestedDatetime);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 5);
    if (requestedDate < minDate) {
      setStatus("error");
      setErrorMsg("Requested date must be at least 5 days from today.");
      return;
    }
    if (!form.termsAccepted || !form.guardianPermissionConfirmed) {
      setStatus("error");
      setErrorMsg("Please confirm the terms and guardian permission before submitting.");
      return;
    }

    const res = await fetch("/api/submit-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      setStatus("error");
      setErrorMsg("Something went wrong submitting your request. Please try again.");
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <main style={{ maxWidth: 640, margin: "60px auto", padding: 24, fontFamily: "sans-serif" }}>
        <h1>Request submitted</h1>
        <p>Thank you! Our team will review your request and a volunteer will reach out once matched.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>Request a Cake</h1>
      <p style={{ color: "#555" }}>
        Requests must be submitted at least 5 days in advance. All information is kept private
        and only shared with your matched volunteer.
      </p>

      <form onSubmit={handleSubmit}>
        <fieldset style={fieldsetStyle}>
          <legend>Your information</legend>
          <Field label="First name" value={form.firstName} onChange={(v) => update("firstName", v)} required />
          <Field label="Last name" value={form.lastName} onChange={(v) => update("lastName", v)} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <Field label="Street address" value={form.streetAddress} onChange={(v) => update("streetAddress", v)} required />
          <Field label="Apartment/room number (optional)" value={form.apartmentNumber} onChange={(v) => update("apartmentNumber", v)} />
          <Field label="Apartment complex name (optional)" value={form.apartmentComplexName} onChange={(v) => update("apartmentComplexName", v)} />
          <Field label="City" value={form.city} onChange={(v) => update("city", v)} required />
          <Field label="State" value={form.state} onChange={(v) => update("state", v)} required />
          <Field label="Zip code" value={form.zipCode} onChange={(v) => update("zipCode", v)} required />
          <Field label="Phone number" value={form.phoneNumber} onChange={(v) => update("phoneNumber", v)} required />
          <Field label="Backup phone number (optional)" value={form.backupPhoneNumber} onChange={(v) => update("backupPhoneNumber", v)} />
          <Field label="Backup contact first name (optional)" value={form.backupContactFirstName} onChange={(v) => update("backupContactFirstName", v)} />
          <Field label="Backup contact last name (optional)" value={form.backupContactLastName} onChange={(v) => update("backupContactLastName", v)} />

          <Label text="Preferred method of contact">
            <select value={form.preferredContactMethod} onChange={(e) => update("preferredContactMethod", e.target.value)}>
              <option value="phone">Phone call</option>
              <option value="text">Text</option>
              <option value="email">Email</option>
            </select>
          </Label>

          <Field label="Your relationship to the cake recipient" value={form.relationshipToRecipient} onChange={(v) => update("relationshipToRecipient", v)} required />

          <Checkbox
            label="I confirm I have received permission from the parent/guardian to request a cake/cupcakes."
            checked={form.guardianPermissionConfirmed}
            onChange={(v) => update("guardianPermissionConfirmed", v)}
          />
        </fieldset>

        <fieldset style={fieldsetStyle}>
          <legend>Cake details</legend>
          <Field label="Requested delivery date (at least 5 days out)" type="date" value={form.requestedDatetime} onChange={(v) => update("requestedDatetime", v)} required />
          <Field label="Age of cake recipient" type="number" value={form.recipientAge} onChange={(v) => update("recipientAge", v)} required />
          <Field label="First name of cake recipient" value={form.recipientFirstName} onChange={(v) => update("recipientFirstName", v)} required />

          <Label text="Cake or cupcakes?">
            <select value={form.cakeOrCupcakes} onChange={(e) => update("cakeOrCupcakes", e.target.value)}>
              <option value="cake">Cake</option>
              <option value="cupcakes">Cupcakes</option>
            </select>
          </Label>

          {form.cakeOrCupcakes === "cake" ? (
            <Field label="Servings (max 16)" type="number" max={16} value={form.servings} onChange={(v) => update("servings", v)} required />
          ) : (
            <Field label="Cupcake count (max 24)" type="number" max={24} value={form.cupcakeCount} onChange={(v) => update("cupcakeCount", v)} required />
          )}

          <MultiSelect label="Flavor options (choose up to 3)" options={FLAVORS} selected={form.flavorOptions} onToggle={(v) => toggleMulti("flavorOptions", v, 3)} />
          <MultiSelect label="Icing options (choose up to 3)" options={ICINGS} selected={form.icingOptions} onToggle={(v) => toggleMulti("icingOptions", v, 3)} />

          <Label text="Interests (hobbies, shows, characters, etc.)">
            <textarea value={form.interests} onChange={(e) => update("interests", e.target.value)} rows={3} style={inputStyle} />
          </Label>
          <Field label="Favorite colors" value={form.favoriteColors} onChange={(v) => update("favoriteColors", v)} />
        </fieldset>

        <fieldset style={fieldsetStyle}>
          <legend>Allergies & preferences</legend>
          <Checkbox label="Does the recipient have allergies or dietary restrictions?" checked={form.hasAllergies} onChange={(v) => update("hasAllergies", v)} />
          {form.hasAllergies && (
            <>
              <Label text="List allergies/dietary restrictions">
                <textarea value={form.allergyDetails} onChange={(e) => update("allergyDetails", e.target.value)} rows={2} style={inputStyle} />
              </Label>
              <Label text="Severity">
                <select value={form.allergySeverity} onChange={(e) => update("allergySeverity", e.target.value)}>
                  <option value="">Select one</option>
                  <option value="mild">Mild — preference/mild sensitivity</option>
                  <option value="severe">Severe — safety-critical, cross-contamination risk</option>
                </select>
              </Label>
            </>
          )}

          <Field label="Where did you hear about us?" value={form.heardAboutUs} onChange={(v) => update("heardAboutUs", v)} />
          <Checkbox label="OK to share photos of the recipient within the private volunteer group?" checked={form.photoSharingOk} onChange={(v) => update("photoSharingOk", v)} />
          <Checkbox label="I have read and accept the terms of service." checked={form.termsAccepted} onChange={(v) => update("termsAccepted", v)} />
        </fieldset>

        {errorMsg && <p style={{ color: "#c62828" }}>{errorMsg}</p>}

        <button type="submit" disabled={status === "submitting"} style={buttonStyle}>
          {status === "submitting" ? "Submitting..." : "Submit request"}
        </button>
      </form>
    </main>
  );
}

// --- small presentational helpers ---
const fieldsetStyle = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 20 };
const inputStyle = { width: "100%", padding: 8, marginTop: 4, marginBottom: 12, boxSizing: "border-box" };
const buttonStyle = { padding: "10px 20px", fontSize: 16, cursor: "pointer" };

function Label({ text, children }) {
  return (
    <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
      {text}
      {children}
    </label>
  );
}

function Field({ label, value, onChange, type = "text", required = false, max }) {
  return (
    <Label text={label}>
      <input
        type={type}
        value={value}
        max={max}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </Label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function MultiSelect({ label, options, selected, onToggle }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {options.map((opt) => (
        <label key={opt} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 12 }}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => onToggle(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}
