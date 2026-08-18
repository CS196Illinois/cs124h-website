import { createClient } from "@supabase/supabase-js";

// Server-only client — uses the secret key which is NEVER sent to the browser.
// Do NOT add NEXT_PUBLIC_ to these env vars.
// Lazily initialized so the build step doesn't fail when env vars are absent.
let _client = null;

export function getSupabaseServer() {
  if (!_client) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !supabaseSecretKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    }
    _client = createClient(supabaseUrl, supabaseSecretKey);
  }
  return _client;
}

/** @deprecated Use getSupabaseServer() instead */
export const supabaseServer = new Proxy(
  {},
  {
    get(_, prop) {
      return getSupabaseServer()[prop];
    },
  }
);
