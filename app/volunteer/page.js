"use client";

import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";

export default function VolunteerBoard() {
  const { user, isLoaded } = useUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && user) loadRequests();
  }, [isLoaded, user]);

  async function loadRequests() {
    setLoading(true);
    const res = await fetch("/api/requests/open");
    if (res.ok) setRequests(await res.json());
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
    }
    loadRequests();
  }

  if (!isLoaded) return null;

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Open cake requests</h1>
        <UserButton />
      </div>

      {loading && <p>Loading...</p>}
      {!loading && requests.length === 0 && <p>No open requests right now — check back soon!</p>}

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
          <p><strong>Needed by:</strong> {r.requested_datetime}</p>
          <p><strong>Flavors:</strong> {r.flavor_options?.join(", ")} · <strong>Icing:</strong> {r.icing_options?.join(", ")}</p>
          {r.interests && <p><strong>Interests:</strong> {r.interests}</p>}
          {r.favorite_colors && <p><strong>Favorite colors:</strong> {r.favorite_colors}</p>}
          <p style={{ fontSize: 13, color: "#777" }}>
            Recipient contact info is revealed once you claim this request.
          </p>
          <button onClick={() => claim(r.id)} style={claimBtnStyle}>Claim this request</button>
        </div>
      ))}
    </main>
  );
}

const cardStyle = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 };
const claimBtnStyle = { padding: "8px 14px", background: "#1565c0", color: "white", border: "none", borderRadius: 4, cursor: "pointer" };
