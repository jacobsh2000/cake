"use client";

import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { COLORS, pageWrap, heading, card, inputStyle, labelStyle, primaryBtn, outlineBtn, dangerBtn, tabBtn, fontFamily, requestNumberStyle } from "../../lib/theme";
import { statusLabel, cakeFormatLabel, claimRoleLabel, TRAVEL_DISTANCE_OPTIONS, CLAIM_ROLE_OPTIONS } from "../../lib/labels";
import { formatDateTime } from "../../lib/datetime";
import {
  SORT_OPTIONS, CAKE_FILTER_OPTIONS, ALLERGY_FILTER_OPTIONS,
  matchesCakeFormat, matchesAllergy, matchesQuery, sortRequests,
} from "../../lib/filters";

export default function VolunteerBoard() {
  const { user, isLoaded } = useUser();
  const [requests, setRequests] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");
  const [filters, setFilters] = useState({ q: "", format: "", allergy: "", sort: "soonest" });

  // Until the profile has loaded, treat the volunteer as unapproved so
  // the claim controls don't flash into view and then disappear.
  const approved = profile?.approved === true;

  const visibleRequests = sortRequests(
    requests.filter((r) =>
      matchesCakeFormat(r.cake_or_cupcakes, filters.format) &&
      matchesAllergy(r, filters.allergy) &&
      matchesQuery(
        [r.general_area, r.interests, r.favorite_colors, `request ${r.request_number}`,
         r.flavor_options?.join(" "), r.icing_options?.join(" ")],
        filters.q,
      )
    ),
    filters.sort,
  );

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

  async function claim(request, volunteerRole) {
    const when = formatDateTime(request.requested_datetime);
    if (!confirm(`Claim this request? You'll be committing to ${claimRoleLabel(volunteerRole).toLowerCase()} for a ${cakeFormatLabel(request.cake_or_cupcakes)} needed by ${when}, and the recipient's contact details will be shared with you.`)) return;
    const res = await fetch("/api/requests/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: request.id, volunteerRole }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "This request may have just been claimed by someone else. Refreshing the list.");
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

        {!loading && profile && !approved && (
          <div style={{ ...card, background: "#FFF8E8", border: `1px solid ${COLORS.gold}`, padding: 16, marginBottom: 16 }}>
            <strong style={{ fontFamily, color: COLORS.gold }}>Your account is awaiting approval</strong>
            <p style={{ ...pText, margin: "6px 0 0" }}>
              You can browse open requests and fill in your profile now. An admin will approve
              your account shortly, and claiming will unlock then.
            </p>
          </div>
        )}

        {loading && <p style={{ color: COLORS.inkSoft }}>Loading...</p>}

        {!loading && tab === "open" && (
          <>
            <OpenFilters filters={filters} setFilters={setFilters} shown={visibleRequests.length} total={requests.length} />
            {requests.length === 0 && <p style={{ color: COLORS.inkSoft }}>No open requests right now — check back soon!</p>}
            {requests.length > 0 && visibleRequests.length === 0 && (
              <p style={{ color: COLORS.inkSoft }}>
                No open requests match these filters.{" "}
                <button onClick={() => setFilters({ q: "", format: "", allergy: "", sort: "soonest" })} style={{ ...outlineBtn(), marginLeft: 4 }}>
                  Clear filters
                </button>
              </p>
            )}
            {visibleRequests.map((r) => (
              <div key={r.id} style={card}>
                <span style={requestNumberStyle}>Request {r.request_number}</span>
                <h3 style={{ ...heading, fontSize: 18, margin: "8px 0 4px" }}>
                  Age {r.recipient_age} — {cakeFormatLabel(r.cake_or_cupcakes)}
                  {r.has_allergies && <span style={{ color: COLORS.error, fontSize: 13, marginLeft: 8, fontFamily, fontWeight: 500 }}>⚠ Allergy: {r.allergy_severity}</span>}
                </h3>
                {r.general_area && <p style={{ fontSize: 13, color: COLORS.gold, fontWeight: 600 }}>📍 {r.general_area}</p>}
                <p style={pText}><strong>Needed by:</strong> {formatDateTime(r.requested_datetime)}</p>
                <p style={pText}><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
                {r.interests && <p style={pText}><strong>Interests:</strong> {r.interests}</p>}
                {r.favorite_colors && <p style={pText}><strong>Favorite colors:</strong> {r.favorite_colors}</p>}
                <p style={{ fontSize: 13, color: COLORS.inkSoft }}>Recipient name, address, and phone are revealed once you claim this request.</p>
                {approved
                  ? <ClaimControls request={r} onClaim={claim} />
                  : <p style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 8, fontFamily }}>Claiming unlocks once an admin approves your account.</p>}
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
              const cancelled = r.status === "cancelled";
              return (
                <div key={c.id} style={card}>
                  <span style={requestNumberStyle}>Request {r.request_number}</span>
                  <h3 style={{ ...heading, fontSize: 18, margin: "8px 0 4px" }}>{r.recipient_first_name}, age {r.recipient_age} — {cakeFormatLabel(r.cake_or_cupcakes)}</h3>
                  <p style={{ fontSize: 13, color: COLORS.inkSoft }}>Claimed {new Date(c.claimed_at).toLocaleDateString()} · {claimRoleLabel(c.volunteer_role)}</p>

                  {cancelled && (
                    <div style={{ background: "#FDECEA", border: `1px solid ${COLORS.error}`, borderRadius: 10, padding: 14, marginTop: 12 }}>
                      <strong style={{ fontFamily, color: COLORS.error }}>This request was cancelled</strong>
                      {r.cancellation_reason && <p style={{ ...pText, margin: "6px 0 0" }}>{r.cancellation_reason}</p>}
                      <p style={{ ...pText, margin: "6px 0 0", color: COLORS.inkSoft }}>
                        Nothing more to do here — please don't contact the family about it.
                      </p>
                    </div>
                  )}

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

                  <p style={pText}><strong>Needed by:</strong> {formatDateTime(r.requested_datetime)}</p>
                  <p style={pText}><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
                  {r.has_allergies && <p style={{ ...pText, color: COLORS.error }}><strong>Allergies ({r.allergy_severity}):</strong> {r.allergy_details}</p>}
                  {r.interests && <p style={pText}><strong>Interests:</strong> {r.interests}</p>}
                  {r.favorite_colors && <p style={pText}><strong>Favorite colors:</strong> {r.favorite_colors}</p>}

                  {!cancelled && (
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
                  )}
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

// The role is picked before claiming rather than after, because it's
// part of what the volunteer is agreeing to — the confirmation names it.
function ClaimControls({ request, onClaim }) {
  const [role, setRole] = useState("both");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
      <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, marginBottom: 0, maxWidth: 240 }}>
        {CLAIM_ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button onClick={() => onClaim(request, role)} style={primaryBtn()}>Claim this request</button>
    </div>
  );
}

function OpenFilters({ filters, setFilters, shown, total }) {
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const compact = { ...inputStyle, marginBottom: 0 };
  const isFiltered = filters.q || filters.format || filters.allergy;

  return (
    <div style={{ ...card, padding: 16, marginBottom: 16 }}>
      <input
        value={filters.q}
        onChange={set("q")}
        placeholder="Search area, zip, interests, colors, flavors, request number"
        style={{ ...compact, marginBottom: 10 }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <select value={filters.format} onChange={set("format")} style={compact}>
          {CAKE_FILTER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.allergy} onChange={set("allergy")} style={compact}>
          {ALLERGY_FILTER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filters.sort} onChange={set("sort")} style={compact}>
          {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {isFiltered && (
        <p style={{ fontSize: 12, color: COLORS.inkSoft, fontFamily, margin: "10px 0 0" }}>
          Showing {shown} of {total} open requests.{" "}
          <button
            onClick={() => setFilters({ q: "", format: "", allergy: "", sort: filters.sort })}
            style={{ background: "none", border: "none", padding: 0, color: COLORS.berry, cursor: "pointer", fontFamily, fontSize: 12, textDecoration: "underline" }}
          >
            Clear
          </button>
        </p>
      )}
    </div>
  );
}

function ProfileForm({ profile, onSaved }) {
  const [form, setForm] = useState(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setForm(profileToForm(profile)); }, [profile]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/volunteer/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    onSaved();
  }

  return (
    <form onSubmit={save} style={{ ...card, maxWidth: 460 }}>
      <h3 style={{ ...heading, fontSize: 18, marginBottom: 4 }}>My profile</h3>
      <p style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 0, marginBottom: 16 }}>
        This helps match you to requests near you that suit what you like to make.
      </p>

      <label style={labelStyle}>City</label>
      <input value={form.city} onChange={set("city")} style={inputStyle} placeholder="e.g. Columbus" />

      <label style={labelStyle}>State</label>
      <input value={form.state} onChange={set("state")} style={inputStyle} placeholder="e.g. OH" />

      <label style={labelStyle}>How often would you like to volunteer?</label>
      <select value={form.volunteerFrequency} onChange={set("volunteerFrequency")} style={inputStyle}>
        <option value="">Select one</option>
        <option value="weekly">As often as possible (weekly)</option>
        <option value="monthly">A few times a month</option>
        <option value="occasionally">Occasionally</option>
      </select>

      <label style={labelStyle}>How far are you willing to travel to deliver?</label>
      <select value={form.travelDistance} onChange={set("travelDistance")} style={inputStyle}>
        <option value="">Select one</option>
        {TRAVEL_DISTANCE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <label style={labelStyle}>What are you up for?</label>
      <p style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: -2, marginBottom: 8 }}>
        You can still pick something different on any individual request.
      </p>
      <Check label="Baking from scratch" checked={form.canBake} onChange={set("canBake")} />
      <Check label="Buying a cake or cupcakes" checked={form.canBuy} onChange={set("canBuy")} />
      <Check label="Delivering" checked={form.canDeliver} onChange={set("canDeliver")} />

      <label style={{ ...labelStyle, marginTop: 16 }}>Anything you especially enjoy making?</label>
      <textarea
        value={form.interests}
        onChange={set("interests")}
        rows={3}
        style={{ ...inputStyle, resize: "vertical" }}
        placeholder="Themed decorating, dietary-restriction bakes, character cakes, last-minute fills…"
      />

      <button type="submit" disabled={saving} style={primaryBtn()}>{saving ? "Saving..." : "Save"}</button>
      {saved && !saving && <span style={{ marginLeft: 10, fontSize: 13, color: COLORS.success, fontFamily }}>Saved</span>}
    </form>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14, fontFamily, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 16, height: 16, accentColor: COLORS.berry }} />
      {label}
    </label>
  );
}

const emptyProfile = {
  city: "", state: "", volunteerFrequency: "", travelDistance: "",
  interests: "", canBake: true, canBuy: true, canDeliver: true,
};

function profileToForm(profile) {
  if (!profile) return emptyProfile;
  return {
    city: profile.city || "",
    state: profile.state || "",
    volunteerFrequency: profile.volunteer_frequency || "",
    travelDistance: profile.travel_distance || "",
    interests: profile.interests || "",
    canBake: profile.can_bake !== false,
    canBuy: profile.can_buy !== false,
    canDeliver: profile.can_deliver !== false,
  };
}

const pText = { fontSize: 14, color: COLORS.ink, fontFamily, margin: "4px 0" };
