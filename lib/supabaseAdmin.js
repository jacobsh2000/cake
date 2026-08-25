import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY client. Uses the service_role key, which bypasses
// Row Level Security entirely — this is how Emily's admin queue
// can see recipient PII and every request regardless of status.
//
// Never import this file from a "use client" component, and never
// send SUPABASE_SERVICE_ROLE_KEY to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
