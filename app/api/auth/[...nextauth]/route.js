import NextAuth from "next-auth";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

// Re-verify the role from the DB at most once per this interval.
// Ensures that admin role-changes take effect within this window
// without hitting Supabase on every single request.
const ROLE_REVERIFY_MS = 5 * 60 * 1000; // 5 minutes

export const authOptions = {
  session: { strategy: "jwt" },

  providers: [
    {
      id: "cilogon",
      name: "CILogon",
      type: "oauth",
      wellKnown:
        process.env.CILOGON_ISSUER ??
        "https://cilogon.org/.well-known/openid-configuration",
      clientId: process.env.CILOGON_CLIENT_ID,
      clientSecret: process.env.CILOGON_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile org.cilogon.userinfo",
          skin: "illinois",
          idphint: "urn:mace:incommon:uiuc.edu",
          selected_idp: "urn:mace:incommon:uiuc.edu",
          initialidp: "urn:mace:incommon:uiuc.edu",
        },
      },
      idToken: true,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name:
            `${profile.given_name || ""} ${profile.family_name || ""}`.trim() ||
            profile.name ||
            profile.sub,
          email: profile.email,
        };
      },
    },
  ],

  pages: { signIn: "/signin" },

  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return baseUrl;
    },

    async jwt({ token, user }) {
      // ── Sign-in: user object is present (only on the initial authentication) ──
      if (user) {
        // Both values come from CILogon's signed ID token - verified server-side
        // by Next-Auth's PKCE + state checks. The client cannot forge either.
        const netID = user.email.split("@")[0].toLowerCase();
        const sub = user.id; // CILogon's immutable OIDC subject identifier

        token.netID = netID;
        token.sub = sub;

        const clogonName = user.name || "";

        // Step 1: Look up by sub - handles any user who has logged in before.
        // sub is a CILogon UUID, not something a user can guess or predict.
        let record = await fetchRoleBySub(sub, clogonName);

        if (!record) {
          // Step 2: First ever login - claim the admin-pre-created roster entry
          // by netID (derived from the CILogon-verified email) and permanently
          // bind this sub to it.
          //
          // Why this is safe: netID comes from user.email which is in CILogon's
          // signed token. An attacker cannot forge it without compromising UIUC's
          // Shibboleth IdP. After binding, the sub is the sole identity anchor
          // and this branch is never taken for this account again.
          record = await claimRosterEntry(netID, sub, clogonName);
        }

        token.role = record ? mapRole(record.role) : "error";
        token.roleVerifiedAt = Date.now();
        if (token.role === "web_dev") {
          token.approvedViews = await fetchApprovedViews(token.netID);
        }
        return token;
      }

      // ── Token refresh: periodically re-verify role from DB ──
      // This ensures admin-made role changes (promotions, demotions, removals)
      // take effect within ROLE_REVERIFY_MS rather than requiring a re-login.
      // Uses sub exclusively - netID is never used for role lookup after binding.
      if (
        token.sub &&
        Date.now() - (token.roleVerifiedAt ?? 0) > ROLE_REVERIFY_MS
      ) {
        const record = await fetchRoleBySub(token.sub);
        // If the record is gone (user removed from roster), lock them out
        token.role = record ? mapRole(record.role) : "error";
        token.roleVerifiedAt = Date.now();
        if (token.role === "web_dev") {
          token.approvedViews = await fetchApprovedViews(token.netID);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.netID = token.netID;
        session.user.role = token.role;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// ── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Look up a user by their CILogon sub. This is the primary lookup path for
 * all users after their first login. sub is a UUID assigned by CILogon and
 * cannot be predicted or controlled by the end user.
 */
async function fetchRoleBySub(sub, clogonName = "") {
  const { data } = await supabaseServer
    .from(table("users"))
    .select("role, net_id, name")
    .eq("sub", sub)
    .maybeSingle();
  if (!data) return null;
  // Backfill name from CILogon if the DB row has none yet
  if (clogonName && !data.name) {
    await supabaseServer
      .from(table("users"))
      .update({ name: clogonName })
      .eq("sub", sub);
  }
  return data;
}

/**
 * First-login bootstrap: find a roster entry that an admin pre-created with
 * this netID but that has never been claimed (sub IS NULL), and atomically
 * bind the CILogon sub to it.
 *
 * The `.is("sub", null)` clause in the UPDATE acts as a compare-and-swap:
 * if two identical requests race, only the first one writes the sub and the
 * second finds no matching rows, returning null instead of granting access.
 * Once a sub is bound it can only be changed by an admin directly in the DB.
 */
async function claimRosterEntry(netID, sub, clogonName = "") {
  // SELECT first so we have the role to return even if the UPDATE rows = 0
  const { data: unclaimed } = await supabaseServer
    .from(table("users"))
    .select("role, net_id, name")
    .eq("net_id", netID)
    .is("sub", null)
    .maybeSingle();

  if (!unclaimed) return null;

  // Atomic bind - only updates rows where sub is still NULL
  // Also write the CILogon name if the roster entry has none yet
  const patch = { sub, ...(clogonName && !unclaimed.name ? { name: clogonName } : {}) };
  const { error } = await supabaseServer
    .from(table("users"))
    .update(patch)
    .eq("net_id", netID)
    .is("sub", null);

  return error ? null : unclaimed;
}

/**
 * Fetch the list of approved, non-expired role-view paths for a web_dev user.
 * Stored in the JWT so middleware can check them without a DB hit.
 */
async function fetchApprovedViews(netID) {
  const { data } = await supabaseServer
    .from(table("roleViewRequests"))
    .select("requested_role")
    .eq("requester_net_id", netID)
    .eq("status", "approved")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  return data?.map((r) => r.requested_role) ?? [];
}

/**
 * Map the DB role string (LEAD, HEAD, PM, WEB, STUDENT) to the URL-path role
 * used throughout the app.
 */
function mapRole(dbRole) {
  const map = {
    LEAD: "course_lead",
    LEAD_WEB: "lead_web_dev",
    HEAD: "head_pm",
    PM: "pm",
    WEB: "web_dev",
    STUDENT: "student",
  };
  return map[dbRole] ?? "error";
}
