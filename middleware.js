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
  // rather than the generic "Unauthorized" messaging. Checked before the
  // /user passthrough so it also covers the bare root.
  if (!role || role === "error") {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("reason", token.authError || "not-enrolled");
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // The bare /user root just redirects to /user/<role> (handled by that page
  // itself, which also gates on an invalid/missing role) - every role needs
  // to reach it, so let it through before any role-specific path checks.
  if (path === "/user") {
    return NextResponse.next();
  }

  // Role-agnostic shared routes - any enrolled role can reach these, checked
  // before the role-specific gating below.
  const SHARED_PATHS = ["/user/checkin"];
  if (SHARED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  // Lead web devs have full admin-level access and can navigate any dashboard
  if (role === "lead_web_dev") {
    return NextResponse.next();
  }

  if (path.startsWith("/user/lead_web_dev")) {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/user/student") && role !== "student") {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }
  if (path.startsWith("/user/pm") && role !== "pm") {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }
  if (path.startsWith("/user/head_pm") && role !== "head_pm") {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }
  if (path.startsWith("/user/course_lead") && role !== "course_lead") {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/user/:path*"],
};
