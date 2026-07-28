// middleware.js
import { decode } from "next-auth/jwt";
import { NextResponse } from "next/server";

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

  // Lead web devs have full admin-level access and can navigate any dashboard
  if (role === "lead_web_dev") {
    return NextResponse.next();
  }

  // Web devs can visit role dashboards they have an approved (non-expired) view request for.
  // Approved views are stored in the JWT so there's no DB hit here.
  if (role === "web_dev") {
    const approvedViews = token?.approvedViews ?? [];
    const ROLE_PATH_MAP = {
      "/user/course_lead": "course_lead",
      "/user/head_pm":     "head_pm",
      "/user/pm":          "pm",
      "/user/student":     "student",
    };
    for (const [prefix, viewRole] of Object.entries(ROLE_PATH_MAP)) {
      if (path.startsWith(prefix) && approvedViews.includes(viewRole)) {
        return NextResponse.next();
      }
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
