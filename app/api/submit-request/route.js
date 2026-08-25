import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabaseAdmin";

// Runs server-side only. Uses the service role key so an anonymous
// visitor can submit a request without needing write access to the
// recipients table directly (which stays locked down by RLS).
export async function POST(req) {
  const body = await req.json();
  const supabase = createAdminClient();

  // 1. Insert the private recipient record
  const { data: recipient, error: recipientError } = await supabase
    .from("recipients")
    .insert({
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      street_address: body.streetAddress,
      apartment_number: body.apartmentNumber || null,
      apartment_complex_name: body.apartmentComplexName || null,
      city: body.city,
      state: body.state,
      zip_code: body.zipCode,
      country: body.country,
      phone_number: body.phoneNumber,
      backup_phone_number: body.backupPhoneNumber || null,
      backup_contact_first_name: body.backupContactFirstName || null,
      backup_contact_last_name: body.backupContactLastName || null,
      preferred_contact_method: body.preferredContactMethod,
      relationship_to_recipient: body.relationshipToRecipient,
      guardian_permission_confirmed: body.guardianPermissionConfirmed,
    })
    .select()
    .single();

  if (recipientError) {
    console.error(recipientError);
    return NextResponse.json({ error: "recipient insert failed" }, { status: 500 });
  }

  // 2. Insert the request, linked to that recipient, status = submitted
  const { error: requestError } = await supabase.from("requests").insert({
    recipient_id: recipient.id,
    status: "submitted",
    requested_datetime: body.requestedDatetime,
    recipient_age: body.recipientAge,
    recipient_first_name: body.recipientFirstName,
    cake_or_cupcakes: body.cakeOrCupcakes,
    servings: body.servings || null,
    cupcake_count: body.cupcakeCount || null,
    flavor_options: body.flavorOptions,
    icing_options: body.icingOptions,
    interests: body.interests || null,
    favorite_colors: body.favoriteColors || null,
    has_allergies: body.hasAllergies,
    allergy_details: body.allergyDetails || null,
    allergy_severity: body.allergySeverity || null,
    photo_sharing_ok: body.photoSharingOk,
    heard_about_us: body.heardAboutUs || null,
    terms_accepted: body.termsAccepted,
  });

  if (requestError) {
    console.error(requestError);
    return NextResponse.json({ error: "request insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
