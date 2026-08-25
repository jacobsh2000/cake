export default function Home() {
  return (
    <main style={{ maxWidth: 500, margin: "100px auto", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>Columbus Cake Celebrations</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>Every kid deserves a birthday cake.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <a href="/request" style={linkStyle}>Request a Cake</a>
        <a href="/volunteer" style={linkStyle}>Volunteer — View Open Requests</a>
        {/* No separate login link needed — visiting /volunteer signed-out
            automatically redirects to Clerk's /sign-in via middleware.js */}
      </div>
    </main>
  );
}

const linkStyle = {
  display: "block",
  padding: "12px 20px",
  background: "#1565c0",
  color: "white",
  textDecoration: "none",
  borderRadius: 6,
};
