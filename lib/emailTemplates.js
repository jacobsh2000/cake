import { formatDateTime } from "./datetime";

export function claimEmailHtml(reqRow) {
  const r = reqRow.recipients;
  return `
    <p>Here's everything you need to coordinate delivery. This is <strong>request ${reqRow.request_number}</strong> — quote that number if you need to reach Emily about it.</p>
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
      Needed by: ${formatDateTime(reqRow.requested_datetime)}<br/>
      ${reqRow.cake_or_cupcakes === "cake" ? `Servings: ${reqRow.servings}` : `Cupcakes: ${reqRow.cupcake_count}`}<br/>
      Flavor options: ${reqRow.flavor_options?.join(", ")}<br/>
      Icing options: ${reqRow.icing_options?.join(", ")}<br/>
      ${reqRow.has_allergies ? `<strong>Allergies (${reqRow.allergy_severity}):</strong> ${reqRow.allergy_details}<br/>` : ""}
      Interests: ${reqRow.interests || "—"}<br/>
      Favorite colors: ${reqRow.favorite_colors || "—"}
    </p>
    <p>Please reach out to the family within 48 hours to confirm delivery details.</p>
  `;
}
