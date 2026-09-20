import { NextResponse } from "next/server";

// Clear stale chunks and OAuth transaction cookies only on an explicit,
// same-origin POST. Cross-site pages cannot silently sign someone out.
export async function POST(request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  for (const { name } of request.cookies.getAll()) {
    if (/^(?:__Secure-|__Host-)?next-auth\./.test(name)) {
      response.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: name.startsWith("__") || new URL(request.url).protocol === "https:" });
    }
  }
  return response;
}
