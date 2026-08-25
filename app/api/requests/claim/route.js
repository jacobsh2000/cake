import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";
import { sendEmail } from "../../../../lib/sendEmail";

export async function POST(req) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { requestId } = await req.json();
  const supabase = createAdminClient();

  const user = await currentUser();
  await supabase.from("volunteer_profiles").upsert({
    id: userId,
    first_name: user?.firstName || "",
    last_name: user?.lastName || "",
  });

  const { data: reqRow, error: reqError } = await supabase
    .from("requests")
    .select("*, recipients(*)")
    .eq("id", requestId)
    .single();

  if (reqError || reqRow?.status !== "posted") {
    return NextResponse.json({ error: "no longer available" }, { status: 409 });
  }

  const { error: claimError } = await supabase.from("claims").insert({
    request_id: requestId,
    volunteer_id: userId,
  });
  if (claimError) {
    return NextResponse.json({ error: "already claimed" }, { status: 409 });
  }

  await supabase.from("requests").update({ status: "claimed" }).eq("id", requestId);

  const volunteerEmail = user?.emailAddresses?.[0]?.emailAddress;
  if (volunteerEmail) {
    const r = reqRow.recipients;
    await sendEmail({
      to: volunteerEmail,
      subject: `You've claimed a cake request — ${reqRow.recipient_first_name}, age ${reqRow.recipient_age}`,
      html: `
        <p>Thank you for claiming this cake request! Here's everything you need to coordinate delivery:</p>
        <h3>Recipient</h3>
        <p>
          ${r.first_name} ${r.last_name}<br/>
          ${r.street_address} ${r.apartment_number || ""}${r.apartment_complex_name ? ` (${r.apartment_complex_name})` : ""}<br/>
          ${r.city}, ${r.state} ${r.zip_code}<br/>
          Phone: ${r.phone_number} (preferred: ${r.preferred_contact_method})<br/>
          Email: ${r.email}<br/>
          Relationship to child: ${r.relationship_to_recipient}
        </p>
        <h3>Cake details</h3>
        <p>
          Needed by: ${reqRow.requested_datetime}<br/>
          ${reqRow.cake_or_cupcakes === "cake" ? `Servings: ${reqRow.servings}` : `Cupcakes: ${reqRow.cupcake_count}`}<br/>
          Flavor options: ${reqRow.flavor_options?.join(", ")}<br/>
          Icing options: ${reqRow.icing_options?.join(", ")}<br/>
          ${reqRow.has_allergies ? `<strong>Allergies (${reqRow.allergy_severity}):</strong> ${reqRow.allergy_details}<br/>` : ""}
          Interests: ${reqRow.interests || "—"}<br/>
          Favorite colors: ${reqRow.favorite_colors || "—"}
        </p>
        <p>Please reach out to the family within 48 hours to confirm delivery details.</p>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}