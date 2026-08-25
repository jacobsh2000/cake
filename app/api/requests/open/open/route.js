import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  // NOTE: this join reaches into recipients, but the select list below
  // deliberately pulls only city + zip_code — never name, street
  // address, phone, or email. Those stay hidden until claimed (see
  // /api/requests/mine). city+zip gives volunteers a real sense of
  // distance/travel without exposing anything identifying.
  const { data, error } = await supabase
    .from("requests")
    .select(`
      id, status, requested_datetime, recipient_age, cake_or_cupcakes,
      servings, cupcake_count, flavor_options, icing_options, interests,
      favorite_colors, has_allergies, allergy_severity,
      recipients ( city, zip_code )
    `)
    .eq("status", "posted")
    .order("requested_datetime", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  // Flatten so the client just sees `general_area`, not a nested
  // recipients object that might tempt someone to add more fields to
  // it later without noticing they're PII.
  const shaped = data.map((r) => ({
    ...r,
    recipients: undefined,
    general_area: r.recipients ? `${r.recipients.city}, ${r.recipients.zip_code}` : null,
  }));

  return NextResponse.json(shaped);
}
