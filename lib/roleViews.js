import { getSupabaseServer } from "./supabaseServer";
import { table } from "./tables";

/**
 * Fetch the list of approved, non-expired role-view paths for a web_dev user,
 * straight from the DB. Shared by the NextAuth jwt callback (to seed the JWT
 * cache) and middleware (as a live fallback - see middleware.js).
 */
export async function fetchApprovedViews(netID) {
  const { data } = await getSupabaseServer()
    .from(table("roleViewRequests"))
    .select("requested_role")
    .eq("requester_net_id", netID)
    .eq("status", "approved")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  return data?.map((r) => r.requested_role) ?? [];
}
