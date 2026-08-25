import { test as base, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import dotenv from "dotenv";
import path from "path";

// process.cwd() rather than import.meta.url-derived __dirname: this file gets
// require()'d as CJS by Playwright's loader (no "type": "module" in
// package.json), where import.meta isn't available. Tests always run from
// the project root via npm/npx, so cwd is reliable here.
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), quiet: true });

const SESSION_COOKIE = "next-auth.session-token";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Mints a real NextAuth JWT (signed with the same NEXTAUTH_SECRET the app
 * verifies against) and drops it in as the session cookie — bypasses the
 * real CILogon OAuth handshake entirely while still exercising the app's
 * actual session/middleware code, unlike the Vitest mock-based approach.
 *
 * `role` is the URL-path role string (course_lead / head_pm / pm / web_dev /
 * lead_web_dev / student). Pair with a seeded roster row for that netID so
 * pages that fetch /api/users/me etc. have something to find.
 */
export async function loginAs(context, { netID, role, sub } = {}) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET missing from .env.test.local");

  const token = await encode({
    token: {
      netID,
      sub: sub || `test-sub-${netID}`,
      role,
      roleVerifiedAt: Date.now(),
      name: netID,
    },
    secret,
    maxAge: MAX_AGE,
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Extends Playwright's `test` with a `loginAs(role, netID, opts)` shortcut bound to the current page's context. */
export const test = base.extend({
  loginAs: async ({ context }, use) => {
    await use((opts) => loginAs(context, opts));
  },
});

export { expect };
