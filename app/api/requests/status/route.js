import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseAdmin";

const ALLOWED = ["contacted", "confirmed", "delivered", "no_response"];

export async function POST(req) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { requestId, status } = await req.json();
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Ownership check: this volunteer must actually hold the claim on
  // this request. Without this, anyone signed in could change the
  // status of any request — this filter is the real security check.
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("id, requests(status)")
    .eq("request_id", requestId)
    .eq("volunteer_id", userId)
    .maybeSingle();

  if (claimError || !claim) {
    return NextResponse.json({ error: "not your claim" }, { status: 403 });
  }

  // A cancelled request is finished. The claim row is kept so the
  // volunteer can still see what happened and why, but it must not be
  // advanceable — nobody should be able to mark a cancelled request
  // delivered.
  if (claim.requests?.status === "cancelled") {
    return NextResponse.json({ error: "request cancelled" }, { status: 409 });
  }

  const requestUpdate = { status };
  await supabase.from("requests").update(requestUpdate).eq("id", requestId);

  const claimUpdate = {};
  if (status === "contacted") claimUpdate.contacted_recipient_at = new Date().toISOString();
  if (status === "delivered") claimUpdate.delivery_confirmed_at = new Date().toISOString();
  if (Object.keys(claimUpdate).length > 0) {
    await supabase.from("claims").update(claimUpdate).eq("id", claim.id);
  }

  return NextResponse.json({ ok: true });
}
