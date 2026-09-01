// middleware.js
import { decode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { fetchApprovedViews } from "./lib/roleViews";

export default async function middleware(req) {
  // getToken() uses bracket-access on req.cookies which breaks in Next.js 15
  // edge runtime. Read the cookie directly with the correct API and decode manually.
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  const cookieValue =
    req.cookies.get("__Secure-next-auth.session-token")?.value ??
    req.cookies.get("next-auth.session-token")?.value;

  let token = null;
  if (cookieValue) {
    try {
      token = await decode({ token: cookieValue, secret });
    } catch {
      token = null;
    }
  }

  const role = token?.role;
  const path = req.nextUrl.pathname;

  if (!token) {
    const loginUrl = new URL("/signin", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
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
    url.searchParams.set("reason", "not-enrolled");
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
  // before the role-specific gating below (web_dev's branch in particular is
  // an allowlist of its own known paths, so without this a web_dev would be
  // bounced from a page that isn't actually role-restricted at all).
  const SHARED_PATHS = ["/user/checkin"];
  if (SHARED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  // Lead web devs have full admin-level access and can navigate any dashboard
  if (role === "lead_web_dev") {
    return NextResponse.next();
  }

  // Web devs can visit role dashboards they have an approved (non-expired) view request for.
  if (role === "web_dev") {
    const ROLE_PATH_MAP = {
      "/user/course_lead": "course_lead",
      "/user/head_pm":     "head_pm",
      "/user/pm":          "pm",
      "/user/student":     "student",
    };
    const matchedPrefix = Object.keys(ROLE_PATH_MAP).find((prefix) => path.startsWith(prefix));

    if (matchedPrefix) {
      const viewRole = ROLE_PATH_MAP[matchedPrefix];
      // Checked live against the DB rather than cached on the JWT: a JWT
      // snapshot only refreshes at sign-in or the periodic reverify window,
      // which made both directions of this wrong - a freshly *approved* view
      // stayed blocked, and a freshly *revoked* one stayed accessible. This
      // path (a web_dev browsing another role's dashboard) is rare enough
      // that a DB hit here is cheap insurance for an access-control decision.
      const liveViews = await fetchApprovedViews(token.netID);
      if (liveViews.includes(viewRole)) {
        return NextResponse.next();
      }
      const url = new URL("/unauthorized", req.url);
      url.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(url);
    }

    if (!path.startsWith("/user/web_dev")) {
      const url = new URL("/unauthorized", req.url);
      url.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
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
  if (path.startsWith("/user/web_dev") && role !== "web_dev") {
    const url = new URL("/unauthorized", req.url);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/user/:path*"],
};
