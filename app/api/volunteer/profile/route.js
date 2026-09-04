import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";

// Reading the profile also registers it. A volunteer who signs in but
// hasn't filled anything in yet still needs a row, otherwise they never
// appear in the admin's approval queue and can never be approved —
// which, now that claiming is gated on approval, would leave them
// permanently stuck with nothing to click.
export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("volunteer_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  if (data) return NextResponse.json(data);

  const user = await currentUser();
  const { data: created, error: insertError } = await supabase
    .from("volunteer_profiles")
    .insert({
      id: userId,
      first_name: user?.firstName || "",
      last_name: user?.lastName || "",
      email: user?.emailAddresses?.[0]?.emailAddress || null,
      // approved deliberately left at its default of false — a new
      // signup waits for an admin.
    })
    .select()
    .single();

  if (insertError) {
    console.error(insertError);
    return NextResponse.json({ error: "profile create failed" }, { status: 500 });
  }
  return NextResponse.json(created);
}

export async function POST(req) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const user = await currentUser();
  const supabase = createAdminClient();

  // Note the columns listed here: `approved` is absent on purpose.
  // This endpoint is the volunteer editing their own profile, so it
  // must never be able to set its own approval — only the admin action
  // does that. An upsert only writes the columns it names, so the
  // stored value survives untouched.
  const { error } = await supabase.from("volunteer_profiles").upsert({
    id: userId,
    first_name: user?.firstName || "",
    last_name: user?.lastName || "",
    email: user?.emailAddresses?.[0]?.emailAddress || null,
    city: body.city || null,
    state: body.state || null,
    general_area: body.city && body.state ? `${body.city}, ${body.state}` : null,
    volunteer_frequency: body.volunteerFrequency || null,
    travel_distance: body.travelDistance || null,
    interests: body.interests || null,
    can_bake: !!body.canBake,
    can_buy: !!body.canBuy,
    can_deliver: !!body.canDeliver,
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
