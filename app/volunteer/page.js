"use client";

import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { COLORS, pageWrap, heading, card, inputStyle, labelStyle, primaryBtn, outlineBtn, dangerBtn, tabBtn, fontFamily } from "../../lib/theme";
import { statusLabel, cakeFormatLabel, TRAVEL_DISTANCE_OPTIONS } from "../../lib/labels";

export default function VolunteerBoard() {
  const { user, isLoaded } = useUser();
  const [requests, setRequests] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");

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

  async function claim(request) {
    const when = new Date(`${request.requested_datetime}T00:00:00`).toLocaleDateString();
    if (!confirm(`Claim this request? You'll be committing to a ${cakeFormatLabel(request.cake_or_cupcakes)} needed by ${when}, and the recipient's contact details will be shared with you.`)) return;
    const requestId = request.id;
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

  async function unclaim(requestId) {
    if (!confirm("Release this request? It will go back on the open board for another volunteer.")) return;
    const res = await fetch("/api/requests/unclaim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (!res.ok) alert("Couldn't release this request — please try again.");
    loadAll();
  }

  if (!isLoaded) return null;

  return (
    <div style={pageWrap}>
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ ...heading, fontSize: 28 }}>Cake requests</h1>
          <UserButton />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: `1px solid ${COLORS.border}` }}>
          <button style={tabBtn(tab === "open")} onClick={() => setTab("open")}>Open requests ({requests.length})</button>
          <button style={tabBtn(tab === "mine")} onClick={() => setTab("mine")}>My claimed requests ({myClaims.length})</button>
          <button style={tabBtn(tab === "profile")} onClick={() => setTab("profile")}>My profile</button>
        </div>

        {loading && <p style={{ color: COLORS.inkSoft }}>Loading...</p>}

        {!loading && tab === "open" && (
          <>
            {requests.length === 0 && <p style={{ color: COLORS.inkSoft }}>No open requests right now — check back soon!</p>}
            {requests.map((r) => (
              <div key={r.id} style={card}>
                <h3 style={{ ...heading, fontSize: 18, marginBottom: 4 }}>
                  Age {r.recipient_age} — {cakeFormatLabel(r.cake_or_cupcakes)}
                  {r.has_allergies && <span style={{ color: COLORS.error, fontSize: 13, marginLeft: 8, fontFamily, fontWeight: 500 }}>⚠ Allergy: {r.allergy_severity}</span>}
                </h3>
                {r.general_area && <p style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600 }}>📍 {r.general_area}</p>}
                <p style={pText}><strong>Needed by:</strong> {r.requested_datetime}</p>
                <p style={pText}><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
                {r.interests && <p style={pText}><strong>Interests:</strong> {r.interests}</p>}
                {r.favorite_colors && <p style={pText}><strong>Favorite colors:</strong> {r.favorite_colors}</p>}
                <p style={{ fontSize: 13, color: COLORS.inkSoft }}>Recipient name, address, and phone are revealed once you claim this request.</p>
                <button onClick={() => claim(r)} style={primaryBtn({ marginTop: 8 })}>Claim this request</button>
              </div>
            ))}
          </>
        )}

        {!loading && tab === "mine" && (
          <>
            {myClaims.length === 0 && <p style={{ color: COLORS.inkSoft }}>You haven't claimed any requests yet.</p>}
            {myClaims.map((c) => {
              const r = c.requests;
              const p = r.recipients;
              return (
                <div key={c.id} style={card}>
                  <h3 style={{ ...heading, fontSize: 18, marginBottom: 4 }}>{r.recipient_first_name}, age {r.recipient_age} — {cakeFormatLabel(r.cake_or_cupcakes)}</h3>
                  <p style={{ fontSize: 13, color: COLORS.inkSoft }}>Claimed {new Date(c.claimed_at).toLocaleDateString()}</p>

                  <div style={{ background: COLORS.bg, borderRadius: 10, padding: 14, margin: "12px 0", border: `1px solid ${COLORS.border}` }}>
                    <strong style={{ fontFamily }}>Recipient contact info</strong>
                    <p style={{ ...pText, margin: "6px 0 0" }}>
                      {p.first_name} {p.last_name}<br />
                      {p.street_address} {p.apartment_number}{p.apartment_complex_name ? ` (${p.apartment_complex_name})` : ""}<br />
                      {p.city}, {p.state} {p.zip_code}<br />
                      {p.phone_number} · preferred: {p.preferred_contact_method}<br />
                      {p.email}<br />
                      Relationship to child: {p.relationship_to_recipient}
                      {p.backup_phone_number && <><br />Backup: {p.backup_contact_first_name} {p.backup_contact_last_name} — {p.backup_phone_number}</>}
                    </p>
                  </div>

                  <p style={pText}><strong>Needed by:</strong> {r.requested_datetime}</p>
                  <p style={pText}><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
                  {r.has_allergies && <p style={{ ...pText, color: COLORS.error }}><strong>Allergies ({r.allergy_severity}):</strong> {r.allergy_details}</p>}
                  {r.interests && <p style={pText}><strong>Interests:</strong> {r.interests}</p>}
                  {r.favorite_colors && <p style={pText}><strong>Favorite colors:</strong> {r.favorite_colors}</p>}

                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, fontFamily }}>
                      Status: <span style={{ color: COLORS.berry }}>{statusLabel(r.status)}</span>
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <button style={outlineBtn()} onClick={() => updateStatus(r.id, "contacted")}>Contacted recipient</button>
                      <button style={outlineBtn()} onClick={() => updateStatus(r.id, "confirmed")}>Confirmed delivery day/time</button>
                      <button style={outlineBtn(COLORS.success)} onClick={() => updateStatus(r.id, "delivered")}>Delivered</button>
                      <button style={outlineBtn(COLORS.error)} onClick={() => updateStatus(r.id, "no_response")}>No response from recipient</button>
                    </div>
                    <button style={dangerBtn()} onClick={() => unclaim(r.id)}>Release this request</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!loading && tab === "profile" && <ProfileForm profile={profile} onSaved={loadAll} />}
      </div>
    </div>
  );
}

function ProfileForm({ profile, onSaved }) {
  const [city, setCity] = useState(profile?.city || "");
  const [state, setState] = useState(profile?.state || "");
  const [frequency, setFrequency] = useState(profile?.volunteer_frequency || "");
  const [travelDistance, setTravelDistance] = useState(profile?.travel_distance || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCity(profile?.city || "");
    setState(profile?.state || "");
    setFrequency(profile?.volunteer_frequency || "");
    setTravelDistance(profile?.travel_distance || "");
  }, [profile]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/volunteer/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, state, volunteerFrequency: frequency, travelDistance }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={save} style={{ ...card, maxWidth: 400 }}>
      <h3 style={{ ...heading, fontSize: 18, marginBottom: 14 }}>My location & preferences</h3>
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
      <label style={labelStyle}>How far are you willing to travel to deliver?</label>
      <select value={travelDistance} onChange={(e) => setTravelDistance(e.target.value)} style={inputStyle}>
        <option value="">Select one</option>
        {TRAVEL_DISTANCE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <button type="submit" disabled={saving} style={primaryBtn()}>{saving ? "Saving..." : "Save"}</button>
    </form>
  );
}

const pText = { fontSize: 14, color: COLORS.ink, fontFamily, margin: "4px 0" };
