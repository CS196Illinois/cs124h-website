import { it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/auth/reset/route";

it("clears stale auth chunks and transaction cookies but preserves unrelated cookies", async () => {
  const request = new NextRequest("https://course.example/api/auth/reset", { method: "POST", headers: { origin: "https://course.example", cookie: "__Secure-next-auth.session-token.0=old; __Secure-next-auth.state=old; next-auth.session-token=old; preference=keep" } });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(response.cookies.getAll().map((cookie) => cookie.name)).toEqual(["__Secure-next-auth.session-token.0", "__Secure-next-auth.state", "next-auth.session-token"]);
  expect(response.cookies.getAll().every((cookie) => cookie.maxAge === 0)).toBe(true);
});

it("rejects cross-site session-reset requests", async () => {
  const response = await POST(new NextRequest("https://course.example/api/auth/reset", { method: "POST", headers: { origin: "https://other.example" } }));
  expect(response.status).toBe(403);
});
