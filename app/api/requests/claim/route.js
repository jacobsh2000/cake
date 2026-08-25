import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";

export async function POST(req) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { requestId } = await req.json();
  const supabase = createAdminClient();

  // Ensure a volunteer_profiles row exists for this Clerk user
  // (id is the Clerk user id, stored as text — see schema migration).
  const user = await currentUser();
  await supabase.from("volunteer_profiles").upsert({
    id: userId,
    first_name: user?.firstName || "",
    last_name: user?.lastName || "",
  });

  // Only succeeds if the request is still 'posted' — the unique
  // constraint on claims.request_id also blocks a double-claim race.
  const { data: reqRow, error: reqError } = await supabase
    .from("requests")
    .select("status")
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
  return NextResponse.json({ ok: true });
}
