import NextAuth from "next-auth";
import { randomUUID } from "node:crypto";
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
          // CILogon can omit `email` for an existing browser session while
          // still returning one of these equivalent verified identifiers.
          email: profile.email,
          preferred_username: profile.preferred_username,
          eppn: profile.eppn,
          subject_id: profile.subject_id,
          idp: profile.idp,
        };
      },
    },
  ],

  pages: { signIn: "/signin" },

  logger: {
    error(code) {
      // Keep provider errors in the server log without writing tokens or
      // authorization codes. This makes login loops diagnosable in hosting
      // logs instead of looking like a generic redirect failure.
      console.error("NextAuth authentication error", {
        code,
      });
    },
  },

  callbacks: {
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        if (target.origin === new URL(baseUrl).origin) return target.href;
      } catch {}
      return baseUrl;
    },

    async jwt({ token, user }) {
      // ── Sign-in: user object is present (only on the initial authentication) ──
      if (user) {
        // Both values come from CILogon's signed ID token - verified server-side
        // by Next-Auth's PKCE + state checks. The client cannot forge either.
        const sub = user.id; // CILogon's immutable OIDC subject identifier
        if (!sub) throw new Error("Missing CILogon subject");
        token.sub = sub;

        const clogonName = user.name || "";

        // Step 1: Look up by sub - handles any user who has logged in before.
        // sub is a CILogon UUID, not something a user can guess or predict.
        let record = await fetchRoleBySub(sub, clogonName);
        // A missing sub match means this is the first successful login for the
        // pre-created roster entry. Preserve that fact in the signed session
        // token because the claim below fills the database sub immediately.
        const isNewUser = !record;

        if (!record) {
          const netID = getNetIDFromIdentity(user);
          if (!netID) {
            console.error("CILogon sign-in did not provide a usable Illinois NetID", {
              sub,
              identityFields: Object.keys(user).filter((key) => key !== "access_token" && key !== "id_token"),
            });
            token.role = "error";
            token.authError = "identity-missing";
            token.netID = null;
            token.isNewUser = false;
            token.onboardingSession = null;
            token.roleVerifiedAt = Date.now();
            return token;
          }
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

        token.netID = record?.net_id ?? getNetIDFromIdentity(user);
        token.authError = null;
        token.role = record ? mapRole(record.role) : "error";
        token.isNewUser = isNewUser && Boolean(record);
        token.onboardingSession = token.isNewUser ? randomUUID() : null;
        token.roleVerifiedAt = Date.now();
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
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.netID = token.netID;
        session.user.role = token.role;
        session.user.isNewUser = token.isNewUser === true;
        session.user.onboardingSession = token.onboardingSession ?? null;
        session.user.authError = token.authError ?? null;
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
  const { data, error } = await supabaseServer
    .from(table("users"))
    .select("role, net_id, name")
    .eq("sub", sub)
    .maybeSingle();
  if (error) {
    console.error("CILogon role lookup failed", { code: error.code, message: error.message });
    throw new Error("Course roster is temporarily unavailable");
  }
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
 * second re-reads by sub, allowing only the same identity to complete sign-in.
 * Once a sub is bound it can only be changed by an admin directly in the DB.
 */
async function claimRosterEntry(netID, sub, clogonName = "") {
  // SELECT first so we have the role to return even if the UPDATE rows = 0
  const { data: unclaimed, error: lookupError } = await supabaseServer
    .from(table("users"))
    .select("role, net_id, name")
    .eq("net_id", netID)
    .is("sub", null)
    .maybeSingle();

  if (lookupError) {
    console.error("CILogon roster lookup failed", { netID, code: lookupError.code, message: lookupError.message });
    throw new Error("Course roster is temporarily unavailable");
  }

  if (!unclaimed) return fetchRoleBySub(sub, clogonName);

  // Atomic bind - only updates rows where sub is still NULL
  // Also write the CILogon name if the roster entry has none yet
  const patch = { sub, ...(clogonName && !unclaimed.name ? { name: clogonName } : {}) };
  const { data: claimed, error } = await supabaseServer
    .from(table("users"))
    .update(patch)
    .eq("net_id", netID)
    .is("sub", null)
    .select("role, net_id, name")
    .maybeSingle();

  if (error) throw new Error("Could not claim course roster entry");
  // Concurrent callbacks for the SAME identity should both succeed. A
  // different identity still cannot take over an already-bound roster row.
  return claimed ?? fetchRoleBySub(sub, clogonName);
}

/** Extract a stable Illinois NetID from the identity fields CILogon may send. */
function getNetIDFromIdentity(user) {
  if (user?.idp && user.idp !== "urn:mace:incommon:uiuc.edu") return null;
  const candidates = [
    user?.eppn,
    user?.subject_id,
    user?.email,
    user?.emailAddress,
    user?.preferred_username,
    user?.profile?.email,
    user?.profile?.preferred_username,
    user?.profile?.eppn,
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim().toLowerCase();
    if (!value) continue;
    const email = value.match(/^([a-z0-9][a-z0-9._-]*)@illinois\.edu$/);
    if (email) return email[1];
    if (user?.idp === "urn:mace:incommon:uiuc.edu" && !value.includes("@") && /^[a-z0-9][a-z0-9._-]*$/.test(value)) return value;
  }
  return null;
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
