import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id, status, requested_datetime, recipient_age, cake_or_cupcakes, servings, cupcake_count, flavor_options, icing_options, interests, favorite_colors, has_allergies, allergy_severity")
    .eq("status", "posted")
    .order("requested_datetime", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  return NextResponse.json(data);
}
