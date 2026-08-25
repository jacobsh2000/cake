"use client";

import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";

const STATUS_LABELS = {
  claimed: "Claimed — not yet contacted",
  contacted: "Contacted recipient",
  confirmed: "Confirmed delivery day/time",
  no_response: "No response from recipient",
  delivered: "Delivered",
};

export default function VolunteerBoard() {
  const { user, isLoaded } = useUser();
  const [requests, setRequests] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open"); // "open" | "mine" | "profile"

  useEffect(() => {
    if (isLoaded && user) loadAll();
  }, [isLoaded, user]);

  async function loadAll() {
    setLoading(true);
    const [openRes, mineRes, profileRes] = await Promise.all([
      fetch("/api/requests/open"),
      fetch("/api/requests/mine"),
      fetch("/api/volunteer/profile"),
    ]);
    if (openRes.ok) setRequests(await openRes.json());
    if (mineRes.ok) setMyClaims(await mineRes.json());
    if (profileRes.ok) setProfile(await profileRes.json());
    setLoading(false);
  }

  async function claim(requestId) {
    const res = await fetch("/api/requests/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (!res.ok) {
      alert("This request may have just been claimed by someone else. Refreshing the list.");
    } else {
      alert("Claimed! Check your email for the recipient's full details, or see them under \"My Claimed Requests\" below.");
      setTab("mine");
    }
    loadAll();
  }

  async function updateStatus(requestId, status) {
    const res = await fetch("/api/requests/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, status }),
    });
    if (!res.ok) alert("Couldn't update status — please try again.");
    loadAll();
  }

  if (!isLoaded) return null;

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1>Cake requests</h1>
        <UserButton />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid #ddd" }}>
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          Open requests ({requests.length})
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          My claimed requests ({myClaims.length})
        </TabButton>
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
          My profile
        </TabButton>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && tab === "open" && (
        <>
          {requests.length === 0 && <p>No open requests right now — check back soon!</p>}
          {requests.map((r) => (
            <div key={r.id} style={cardStyle}>
              <h3>
                Age {r.recipient_age} — {r.cake_or_cupcakes}
                {r.has_allergies && (
                  <span style={{ color: "#c62828", fontSize: 14, marginLeft: 8 }}>
                    ⚠ Allergy: {r.allergy_severity}
                  </span>
                )}
              </h3>
              {r.general_area && (
                <p style={{ fontSize: 13, color: "#1565c0", fontWeight: 600 }}>📍 {r.general_area}</p>
              )}
              <p><strong>Needed by:</strong> {r.requested_datetime}</p>
              <p><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
              {r.interests && <p><strong>Interests:</strong> {r.interests}</p>}
              {r.favorite_colors && <p><strong>Favorite colors:</strong> {r.favorite_colors}</p>}
              <p style={{ fontSize: 13, color: "#777" }}>
                Recipient name, address, and phone are revealed once you claim this request.
              </p>
              <button onClick={() => claim(r.id)} style={claimBtnStyle}>Claim this request</button>
            </div>
          ))}
        </>
      )}

      {!loading && tab === "mine" && (
        <>
          {myClaims.length === 0 && <p>You haven't claimed any requests yet.</p>}
          {myClaims.map((c) => {
            const r = c.requests;
            const p = r.recipients;
            return (
              <div key={c.id} style={cardStyle}>
                <h3>{r.recipient_first_name}, age {r.recipient_age} — {r.cake_or_cupcakes}</h3>
                <p style={{ fontSize: 13, color: "#777" }}>Claimed {new Date(c.claimed_at).toLocaleDateString()}</p>

                <div style={{ background: "#f7f7f7", borderRadius: 8, padding: 12, margin: "12px 0" }}>
                  <strong>Recipient contact info</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    {p.first_name} {p.last_name}<br />
                    {p.street_address} {p.apartment_number}{p.apartment_complex_name ? ` (${p.apartment_complex_name})` : ""}<br />
                    {p.city}, {p.state} {p.zip_code}<br />
                    {p.phone_number} · preferred: {p.preferred_contact_method}<br />
                    {p.email}<br />
                    Relationship to child: {p.relationship_to_recipient}
                    {p.backup_phone_number && <><br />Backup: {p.backup_contact_first_name} {p.backup_contact_last_name} — {p.backup_phone_number}</>}
                  </p>
                </div>

                <p><strong>Needed by:</strong> {r.requested_datetime}</p>
                <p><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
                {r.has_allergies && <p style={{ color: "#c62828" }}><strong>Allergies ({r.allergy_severity}):</strong> {r.allergy_details}</p>}
                {r.interests && <p><strong>Interests:</strong> {r.interests}</p>}
                {r.favorite_colors && <p><strong>Favorite colors:</strong> {r.favorite_colors}</p>}

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Status: <span style={{ color: "#1565c0" }}>{STATUS_LABELS[r.status] || r.status}</span>
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <StatusButton onClick={() => updateStatus(r.id, "contacted")}>Contacted recipient</StatusButton>
                    <StatusButton onClick={() => updateStatus(r.id, "confirmed")}>Confirmed delivery day/time</StatusButton>
                    <StatusButton onClick={() => updateStatus(r.id, "delivered")}>Delivered</StatusButton>
                    <StatusButton danger onClick={() => updateStatus(r.id, "no_response")}>No response from recipient</StatusButton>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {!loading && tab === "profile" && (
        <ProfileForm profile={profile} onSaved={loadAll} />
      )}
    </main>
  );
}

function ProfileForm({ profile, onSaved }) {
  const [city, setCity] = useState(profile?.city || "");
  const [state, setState] = useState(profile?.state || "");
  const [frequency, setFrequency] = useState(profile?.volunteer_frequency || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCity(profile?.city || "");
    setState(profile?.state || "");
    setFrequency(profile?.volunteer_frequency || "");
  }, [profile]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/volunteer/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, state, volunteerFrequency: frequency }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={save} style={{ ...cardStyle, maxWidth: 400 }}>
      <h3 style={{ marginTop: 0 }}>My location & preferences</h3>
      <label style={labelStyle}>City</label>
      <input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} placeholder="e.g. Columbus" />

      <label style={labelStyle}>State</label>
      <input value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} placeholder="e.g. OH" />

      <label style={labelStyle}>How often would you like to volunteer?</label>
      <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={inputStyle}>
        <option value="">Select one</option>
        <option value="weekly">As often as possible (weekly)</option>
        <option value="monthly">A few times a month</option>
        <option value="occasionally">Occasionally</option>
      </select>

      <button type="submit" disabled={saving} style={claimBtnStyle}>
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        border: "none",
        borderBottom: active ? "2px solid #1565c0" : "2px solid transparent",
        background: "none",
        fontWeight: active ? 600 : 400,
        color: active ? "#1565c0" : "#555",
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      {children}
    </button>
  );
}

function StatusButton({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 12,
        border: `1px solid ${danger ? "#c62828" : "#1565c0"}`,
        background: "#fff",
        color: danger ? "#c62828" : "#1565c0",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const cardStyle = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 };
const claimBtnStyle = { padding: "8px 14px", background: "#1565c0", color: "white", border: "none", borderRadius: 4, cursor: "pointer" };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, marginTop: 10 };
const inputStyle = { width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 14, boxSizing: "border-box" };
