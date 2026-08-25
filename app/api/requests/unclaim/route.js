import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";

export async function POST(req) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { requestId } = await req.json();
  const supabase = createAdminClient();

  // Ownership check — same pattern as /api/requests/status: a
  // volunteer can only release a claim that's actually theirs.
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("id")
    .eq("request_id", requestId)
    .eq("volunteer_id", userId)
    .maybeSingle();

  if (claimError || !claim) {
    return NextResponse.json({ error: "not your claim" }, { status: 403 });
  }

  await supabase.from("claims").delete().eq("id", claim.id);
  await supabase.from("requests").update({ status: "posted" }).eq("id", requestId);

  return NextResponse.json({ ok: true });
}
