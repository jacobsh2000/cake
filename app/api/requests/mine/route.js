import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Filtering by volunteer_id = userId here is what keeps this safe —
  // a volunteer only ever sees recipient PII for requests THEY claimed,
  // never anyone else's. This is enforced in code (service role
  // bypasses RLS), so this filter is the actual security boundary —
  // don't remove it or loosen it without replacing it with something
  // equivalent.
  const { data, error } = await supabase
    .from("claims")
    .select(`
      id, claimed_at, contacted_recipient_at, delivery_confirmed_at, volunteer_role,
      requests (
        id, request_number, status, cancellation_reason,
        requested_datetime, recipient_age, recipient_first_name,
        cake_or_cupcakes, servings, cupcake_count, flavor_options, icing_options,
        interests, favorite_colors, has_allergies, allergy_details, allergy_severity,
        photo_sharing_ok,
        recipients (
          first_name, last_name, email, street_address, apartment_number,
          apartment_complex_name, city, state, zip_code, phone_number,
          backup_phone_number, backup_contact_first_name, backup_contact_last_name,
          preferred_contact_method, relationship_to_recipient
        )
      )
    `)
    .eq("volunteer_id", userId)
    .order("claimed_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
