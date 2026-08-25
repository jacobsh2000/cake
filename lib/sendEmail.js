// Minimal Resend wrapper — no SDK needed, just their REST API.
// Requires RESEND_API_KEY and EMAIL_FROM in env (see .env.local.example).
export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY not set — skipping email send");
    return { skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Columbus Cake Celebrations <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Resend send failed:", res.status, text);
    return { ok: false };
  }
  return { ok: true };
}
