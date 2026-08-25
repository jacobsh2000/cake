import { COLORS, pageWrap, heading, primaryBtn } from "../lib/theme";

export default function Home() {
  return (
    <div style={{ ...pageWrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <h1 style={{ ...heading, fontSize: 32, marginBottom: 8 }}>Columbus Cake Celebrations</h1>
        <p style={{ color: COLORS.inkSoft, fontSize: 15, marginBottom: 32 }}>Every kid deserves a birthday cake.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a href="/request" style={{ ...primaryBtn({ display: "block", textDecoration: "none", padding: "14px 20px" }) }}>
            Request a Cake
          </a>
          <a
            href="/volunteer"
            style={{
              display: "block",
              padding: "14px 20px",
              textDecoration: "none",
              color: COLORS.berry,
              background: "#fff",
              border: `1.5px solid ${COLORS.berry}`,
              borderRadius: 10,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Volunteer — View Open Requests
          </a>
        </div>
      </div>
    </div>
  );
}
