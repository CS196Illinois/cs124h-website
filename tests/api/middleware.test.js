import { it, expect, vi } from "vitest";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
vi.mock("../../lib/roleViews", () => ({ fetchApprovedViews: vi.fn(async () => []) }));
import middleware from "../../middleware";

it.each(["student", "pm", "head_pm", "course_lead", "web_dev"])("%s cannot visit lead web developer pages", async (role) => {
  const token = await encode({ token: { role, netID: "test" }, secret: process.env.NEXTAUTH_SECRET });
  const req = new NextRequest("http://localhost/user/lead_web_dev/people", { headers: { cookie: `next-auth.session-token=${token}` } });
  const res = await middleware(req);
  expect(res.status).toBe(307);
  expect(new URL(res.headers.get("location")).pathname).toBe("/unauthorized");
});

it("accepts a chunked session cookie instead of redirecting a signed-in student to login", async () => {
  const token = await encode({ token: { role: "student", netID: "test" }, secret: process.env.NEXTAUTH_SECRET });
  const midpoint = Math.ceil(token.length / 2);
  const req = new NextRequest("http://localhost/user/student", {
    headers: { cookie: `next-auth.session-token.0=${token.slice(0, midpoint)}; next-auth.session-token.1=${token.slice(midpoint)}` },
  });
  const res = await middleware(req);
  expect(res.status).toBe(200);
});

it("rejects a legacy cookie that NextAuth's session endpoint does not recognize", async () => {
  const token = await encode({ token: { role: "student", netID: "test" }, secret: process.env.NEXTAUTH_SECRET });
  const req = new NextRequest("http://localhost/user/student", { headers: { cookie: `__Host-next-auth.session-token=${token}` } });
  const res = await middleware(req);
  expect(res.status).toBe(307);
  expect(new URL(res.headers.get("location")).pathname).toBe("/signin");
});

it("preserves query parameters and stops invalid sessions at the recovery screen", async () => {
  const req = new NextRequest("http://localhost/user/student/action_items?tab=done", { headers: { cookie: "next-auth.session-token=invalid" } });
  const res = await middleware(req);
  const target = new URL(res.headers.get("location"));
  expect(target.searchParams.get("callbackUrl")).toBe("/user/student/action_items?tab=done");
  expect(target.searchParams.get("error")).toBe("SessionExpired");
});

const expired = (res) => res.cookies.getAll().filter((cookie) => cookie.maxAge === 0).map((cookie) => cookie.name).sort();

it("keeps a valid session beside a leftover chunk, and expires the leftover so next-auth can read it", async () => {
  const token = await encode({ token: { role: "student", netID: "test" }, secret: process.env.NEXTAUTH_SECRET });
  const req = new NextRequest("http://localhost/user/student", { headers: { cookie: `next-auth.session-token=${token}; next-auth.session-token.1=stale` } });
  const res = await middleware(req);
  expect(res.status).toBe(200);
  expect(expired(res)).toEqual(["next-auth.session-token.1"]);
});

it("expires an unreadable session so a refresh cannot loop back to the recovery screen", async () => {
  const req = new NextRequest("http://localhost/user/student", { headers: { cookie: "next-auth.session-token=invalid; __Host-next-auth.session-token=legacy; preference=keep" } });
  const res = await middleware(req);
  expect(new URL(res.headers.get("location")).searchParams.get("error")).toBe("SessionExpired");
  expect(expired(res)).toEqual(["__Host-next-auth.session-token", "next-auth.session-token"]);

  const retry = await middleware(new NextRequest("http://localhost/user/student", { headers: { cookie: "preference=keep" } }));
  expect(new URL(retry.headers.get("location")).searchParams.get("error")).toBeNull();
});

it("leaves a healthy session's cookies untouched", async () => {
  const token = await encode({ token: { role: "student", netID: "test" }, secret: process.env.NEXTAUTH_SECRET });
  const res = await middleware(new NextRequest("http://localhost/user/student", { headers: { cookie: `next-auth.session-token=${token}` } }));
  expect(res.status).toBe(200);
  expect(expired(res)).toEqual([]);
});

it("over HTTPS, reads the __Secure- cookie and treats a leftover plain cookie as stale", async () => {
  vi.stubEnv("NEXTAUTH_URL", "https://course.example");
  try {
    const token = await encode({ token: { role: "student", netID: "test" }, secret: process.env.NEXTAUTH_SECRET });
    const req = new NextRequest("https://course.example/user/student", { headers: { cookie: `__Secure-next-auth.session-token=${token}; __Secure-next-auth.session-token.0=stale; next-auth.session-token=old` } });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(expired(res)).toEqual(["__Secure-next-auth.session-token.0", "next-auth.session-token"]);
  } finally {
    vi.unstubAllEnvs();
  }
});
