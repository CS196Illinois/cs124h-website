// middleware.js
import { NextResponse } from "next/server";
import { readSession, expireCookies } from "./lib/sessionCookies";

export default async function middleware(req) {
  const { token, stale, present } = await readSession(req);
  if (present && !token) {
    // Names only - never cookie values. Makes a sign-in loop diagnosable in logs.
    console.warn("Unreadable session cookie", { path: req.nextUrl.pathname, cookies: stale });
  }
  // Expiring stale session cookies (an unreadable session, or leftovers beside a
  // valid one) keeps a refresh from looping back here, and lets next-auth's own
  // session endpoint - which joins every matching cookie - read the valid one.
  return expireCookies(await route(req, token, present), stale);
}

async function route(req, token, hadSessionCookie) {
  const role = token?.role;
  const path = req.nextUrl.pathname;

  if (!token) {
    const loginUrl = new URL("/signin", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    if (hadSessionCookie) loginUrl.searchParams.set("error", "SessionExpired");
    return NextResponse.redirect(loginUrl);
  }

  // A signed-in user with no roster role - most commonly a student who has
  // enrolled but hasn't been added to the Supabase roster yet (e.g. before
  // kickoff at the start of a semester). This isn't a permissions mismatch
  // like the role-specific checks below, so it gets its own explanation
  // rather than the generic "Unauthorized" messaging.
  if (!role || role === "error") {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("reason", token.authError || "not-enrolled");
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // Which signed-in roles may open each signed-in page. Any enrolled role
  // may check in; the rest are staff tools. Anything not listed is denied.
  const PAGE_ROLES = {
    "/checkin": ["student", "pm", "head_pm", "course_lead", "lead_web_dev"],
    "/my-group": ["pm"],
    "/people": ["course_lead", "head_pm"],
    "/support/tickets": ["lead_web_dev"],
  };
  const page = Object.keys(PAGE_ROLES).find((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!page || !PAGE_ROLES[page].includes(role)) {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/checkin", "/my-group", "/people", "/support/tickets"],
};
