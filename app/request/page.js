"use client";

import { useState } from "react";
import { COLORS } from "../../lib/theme";

// Requests need this much lead time. Used for validation, the date
// input's min attribute, and the copy in both places it's mentioned —
// change it here only.
const MIN_NOTICE_DAYS = 10;

const FLAVORS = ["White/Vanilla", "Chocolate", "Yellow", "Strawberry", "Marble"];
const ICINGS = ["Vanilla Buttercream", "Chocolate"];

// Selecting this pill reveals a write-in field; on submit the typed
// value replaces it in the submitted array, so "Other" itself is never
// stored as a flavor or icing.
const OTHER = "Other";

const MAX_CHOICES = 3;

// Returns YYYY-MM-DD in the visitor's own timezone. Built from local
// date parts rather than toISOString(), which converts to UTC and would
// push the cutoff a day late for anyone filling the form in the evening
// west of Greenwich.
function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Merges the write-in value into the chosen options, dropping the
// "Other" placeholder itself.
function resolveOptions(selected, otherText) {
  const base = selected.filter((v) => v !== OTHER);
  const typed = otherText.trim();
  return selected.includes(OTHER) && typed ? [...base, typed] : base;
}

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
    flavorOptions: [], flavorOther: "",
    icingOptions: [], icingOther: "",
    interests: "", favoriteColors: "",
    hasAllergies: false, allergyDetails: "", allergySeverity: "",
    photoSharingOk: false,
    heardAboutUs: "",
    termsAccepted: false,
  });
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleMulti(field, value, max) {
    setForm((f) => {
      const current = f[field];
      if (current.includes(value)) return { ...f, [field]: current.filter((v) => v !== value) };
      if (current.length >= max) return f;
      return { ...f, [field]: [...current, value] };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    if (form.requestedDatetime < todayPlus(MIN_NOTICE_DAYS)) {
      setStatus("error");
      setErrorMsg(`Requested date must be at least ${MIN_NOTICE_DAYS} days from today.`);
      return;
    }
    if (!form.termsAccepted || !form.guardianPermissionConfirmed) {
      setStatus("error");
      setErrorMsg("Please confirm the terms and guardian permission before submitting.");
      return;
    }

    const flavorOptions = resolveOptions(form.flavorOptions, form.flavorOther);
    const icingOptions = resolveOptions(form.icingOptions, form.icingOther);
    if (flavorOptions.length === 0 || icingOptions.length === 0) {
      setStatus("error");
      setErrorMsg("Please choose at least one flavor and one frosting. If you picked \"Other,\" fill in the write-in box.");
      return;
    }

    const res = await fetch("/api/submit-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, flavorOptions, icingOptions }),
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
      <div style={pageWrap}>
        <div style={{ ...card, maxWidth: 480, textAlign: "center", padding: "48px 32px" }}>
          <Logo size={104} />
          <h1 style={{ ...heading, fontSize: 28, marginTop: 20 }}>Request received</h1>
          <p style={{ ...bodyText, marginTop: 8 }}>
            Thank you for reaching out. Our team will review your request, and a volunteer
            will be in touch once one is matched.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={{ maxWidth: 640, width: "100%" }}>
        <header style={{ textAlign: "center", marginBottom: 32 }}>
          <Logo size={88} />
          <h1 style={{ ...heading, fontSize: 32, marginTop: 12, marginBottom: 8 }}>
            Request a Cake
          </h1>
          <p style={{ ...bodyText, maxWidth: 440, margin: "0 auto" }}>
            Every child deserves a birthday cake. Tell us a little about the celebration —
            requests need at least {MIN_NOTICE_DAYS} days' notice, and everything you share
            stays private until a volunteer is matched.
          </p>
        </header>

        <form onSubmit={handleSubmit}>
          <Section number={1} title="Your information">
            <Row>
              <Field label="First name" value={form.firstName} onChange={(v) => update("firstName", v)} required />
              <Field label="Last name" value={form.lastName} onChange={(v) => update("lastName", v)} required />
            </Row>
            <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
            <Field label="Street address" value={form.streetAddress} onChange={(v) => update("streetAddress", v)} required />
            <Row>
              <Field label="Apartment / unit (optional)" value={form.apartmentNumber} onChange={(v) => update("apartmentNumber", v)} />
              <Field label="Complex name (optional)" value={form.apartmentComplexName} onChange={(v) => update("apartmentComplexName", v)} />
            </Row>
            <Row cols="2fr 1fr 1fr">
              <Field label="City" value={form.city} onChange={(v) => update("city", v)} required />
              <Field label="State" value={form.state} onChange={(v) => update("state", v)} required />
              <Field label="Zip code" value={form.zipCode} onChange={(v) => update("zipCode", v)} required />
            </Row>
            <Row>
              <Field label="Phone number" value={form.phoneNumber} onChange={(v) => update("phoneNumber", v)} required />
              <Field label="Backup phone (optional)" value={form.backupPhoneNumber} onChange={(v) => update("backupPhoneNumber", v)} />
            </Row>
            <Row>
              <Field label="Backup contact — first name" value={form.backupContactFirstName} onChange={(v) => update("backupContactFirstName", v)} />
              <Field label="Backup contact — last name" value={form.backupContactLastName} onChange={(v) => update("backupContactLastName", v)} />
            </Row>

            <SelectField
              label="Preferred method of contact"
              value={form.preferredContactMethod}
              onChange={(v) => update("preferredContactMethod", v)}
              options={[["phone", "Phone call"], ["text", "Text"], ["email", "Email"]]}
            />

            <Field label="Your relationship to the cake recipient" value={form.relationshipToRecipient} onChange={(v) => update("relationshipToRecipient", v)} required />

            <Checkbox
              label="I confirm I have received permission from the parent/guardian to request a cake/cupcakes."
              checked={form.guardianPermissionConfirmed}
              onChange={(v) => update("guardianPermissionConfirmed", v)}
            />
          </Section>

          <Section number={2} title="Cake details">
            <Row>
              <Field label="Requested delivery date" hint={`At least ${MIN_NOTICE_DAYS} days out`} type="date" min={todayPlus(MIN_NOTICE_DAYS)} value={form.requestedDatetime} onChange={(v) => update("requestedDatetime", v)} required />
              <Field label="Age of cake recipient" type="number" value={form.recipientAge} onChange={(v) => update("recipientAge", v)} required />
            </Row>
            <Field label="First name of cake recipient" value={form.recipientFirstName} onChange={(v) => update("recipientFirstName", v)} required />

            <SelectField
              label="Cake or cupcakes?"
              value={form.cakeOrCupcakes}
              onChange={(v) => update("cakeOrCupcakes", v)}
              options={[["cake", "Cake"], ["cupcakes", "Cupcakes"], ["no_preference", "No preference — either is great"]]}
            />

            {/* Cupcakes get their own count; cake and no-preference both
                record servings, since the volunteer decides the format. */}
            {form.cakeOrCupcakes === "cupcakes" ? (
              <Field label="Cupcake count" hint="Max 24" type="number" max={24} value={form.cupcakeCount} onChange={(v) => update("cupcakeCount", v)} required />
            ) : (
              <Field
                label={form.cakeOrCupcakes === "no_preference" ? "How many people need to be served?" : "Servings"}
                hint={form.cakeOrCupcakes === "no_preference" ? "Max 16 for a cake, or 24 cupcakes" : "Max 16"}
                type="number"
                max={form.cakeOrCupcakes === "no_preference" ? 24 : 16}
                value={form.servings}
                onChange={(v) => update("servings", v)}
                required
              />
            )}

            <PillSelect
              label="Flavor options"
              hint={`Choose up to ${MAX_CHOICES} — our volunteer will pick one`}
              options={[...FLAVORS, OTHER]}
              selected={form.flavorOptions}
              onToggle={(v) => toggleMulti("flavorOptions", v, MAX_CHOICES)}
              otherValue={form.flavorOther}
              onOtherChange={(v) => update("flavorOther", v)}
              otherPlaceholder="Tell us the flavor you'd like"
            />
            <PillSelect
              label="Frosting options"
              hint={`Choose up to ${MAX_CHOICES}`}
              options={[...ICINGS, OTHER]}
              selected={form.icingOptions}
              onToggle={(v) => toggleMulti("icingOptions", v, MAX_CHOICES)}
              otherValue={form.icingOther}
              onOtherChange={(v) => update("icingOther", v)}
              otherPlaceholder="Tell us the frosting you'd like"
            />

            <TextAreaField
              label="Interests"
              hint="Hobbies, shows, characters, colors — anything that helps a volunteer design something special"
              value={form.interests}
              onChange={(v) => update("interests", v)}
            />
            <Field label="Favorite colors" value={form.favoriteColors} onChange={(v) => update("favoriteColors", v)} />
          </Section>

          <Section number={3} title="Allergies & preferences" isLast>
            <Checkbox label="Does the recipient have allergies or dietary restrictions?" checked={form.hasAllergies} onChange={(v) => update("hasAllergies", v)} />
            {form.hasAllergies && (
              <div style={{ marginLeft: 4, borderLeft: `3px solid ${COLORS.border}`, paddingLeft: 16, marginTop: 4, marginBottom: 16 }}>
                <TextAreaField label="List allergies / dietary restrictions" value={form.allergyDetails} onChange={(v) => update("allergyDetails", v)} rows={2} />
                <SelectField
                  label="Severity"
                  value={form.allergySeverity}
                  onChange={(v) => update("allergySeverity", v)}
                  options={[["", "Select one"], ["mild", "Mild — preference or mild sensitivity"], ["severe", "Severe — safety-critical, cross-contamination risk"]]}
                />
              </div>
            )}

            <Field label="Where did you hear about us?" value={form.heardAboutUs} onChange={(v) => update("heardAboutUs", v)} />
            <Checkbox label="OK for volunteers to share photos of the recipient within the private volunteer group?" checked={form.photoSharingOk} onChange={(v) => update("photoSharingOk", v)} />
            <Checkbox label="I have read and accept the terms of service." checked={form.termsAccepted} onChange={(v) => update("termsAccepted", v)} />
          </Section>

          {errorMsg && (
            <p style={{ color: COLORS.error, background: "#FDECEA", padding: "12px 16px", borderRadius: 10, fontSize: 14, marginBottom: 16 }}>
              {errorMsg}
            </p>
          )}

          <button type="submit" disabled={status === "submitting"} style={submitBtn}>
            {status === "submitting" ? "Submitting…" : "Submit request"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==================== layout primitives ====================

const pageWrap = {
  minHeight: "100vh",
  background: COLORS.bg,
  display: "flex",
  justifyContent: "center",
  padding: "56px 20px",
  fontFamily: "'Inter', -apple-system, sans-serif",
  color: COLORS.ink,
};

const heading = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 600,
  color: COLORS.berryDark,
  margin: 0,
};

const bodyText = { color: COLORS.inkSoft, fontSize: 15, lineHeight: 1.6 };

const card = {
  background: COLORS.card,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxShadow: "0 2px 12px rgba(122,46,69,0.06)",
};

const submitBtn = {
  width: "100%",
  padding: "16px 24px",
  fontSize: 16,
  fontWeight: 600,
  fontFamily: "'Inter', sans-serif",
  color: "#fff",
  background: COLORS.berry,
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(122,46,69,0.25)",
};

function Section({ number, title, children, isLast }) {
  return (
    <div style={{ ...card, padding: 28, marginBottom: isLast ? 28 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span
          style={{
            width: 28, height: 28, borderRadius: "50%",
            background: COLORS.berry, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
        >
          {number}
        </span>
        <h2 style={{ ...heading, fontSize: 19 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ children, cols }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols || "1fr 1fr", gap: 14 }}>
      {children}
    </div>
  );
}

// ==================== field primitives ====================

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 6 };
const hintStyle = { display: "block", fontSize: 12, color: COLORS.inkSoft, fontWeight: 400, marginTop: 2 };
const inputBase = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  color: COLORS.ink,
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 8,
  marginBottom: 16,
  boxSizing: "border-box",
  background: "#FFFDFB",
  outline: "none",
};

function FieldLabel({ label, hint }) {
  return (
    <label style={labelStyle}>
      {label}
      {hint && <span style={hintStyle}>{hint}</span>}
    </label>
  );
}

function Field({ label, hint, value, onChange, type = "text", required = false, max, min }) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <input
        type={type}
        value={value}
        max={max}
        min={min}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={inputBase}
      />
    </div>
  );
}

function TextAreaField({ label, hint, value, onChange, rows = 3 }) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} style={{ ...inputBase, resize: "vertical" }} />
    </div>
  );
}

function SelectField({ label, hint, value, onChange, options }) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputBase}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, fontSize: 14, color: COLORS.ink, cursor: "pointer", lineHeight: 1.4 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, accentColor: COLORS.berry, flexShrink: 0 }}
      />
      {label}
    </label>
  );
}

function PillSelect({ label, hint, options, selected, onToggle, otherValue, onOtherChange, otherPlaceholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <FieldLabel label={label} hint={hint} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onToggle(opt)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                cursor: "pointer",
                border: `1.5px solid ${active ? COLORS.berry : COLORS.border}`,
                background: active ? COLORS.berry : "#FFFDFB",
                color: active ? "#fff" : COLORS.ink,
                transition: "all 0.12s ease",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected.includes(OTHER) && onOtherChange && (
        <input
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder={otherPlaceholder}
          style={{ ...inputBase, marginTop: 10, marginBottom: 0 }}
        />
      )}
    </div>
  );
}

// The Columbus Cake Celebrations logo, with the drawn cake icon as a
// stand-in until the asset lands at public/logo.png. Rendering falls
// back on error rather than on a missing-file check, so the page never
// shows a broken image and starts using the real mark the moment the
// file is dropped in — no code change needed.
function Logo({ size = 88 }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CakeIcon size={Math.round(size * 0.45)} color={COLORS.berry} />;
  return (
    <img
      src="/logo.png"
      alt="Columbus Cake Celebrations"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ display: "block", margin: "0 auto", height: "auto", maxWidth: "100%" }}
    />
  );
}

function CakeIcon({ size = 40, color = "#7A2E45" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto", display: "block" }}>
      <path d="M14 18 L14 14 C14 12 16 12 16 10 C16 8 14 8 14 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M24 18 L24 14 C24 12 26 12 26 10 C26 8 24 8 24 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M34 18 L34 14 C34 12 36 12 36 10 C36 8 34 8 34 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="8" y="20" width="32" height="9" rx="2" fill={color} opacity="0.15" stroke={color} strokeWidth="2" />
      <path d="M8 29 C8 29 12 33 16 29 C20 33 24 29 24 29 C24 29 28 33 32 29 C36 33 40 29 40 29 L40 38 C40 40 38 42 36 42 L12 42 C10 42 8 40 8 38 Z" fill={color} />
    </svg>
  );
}
