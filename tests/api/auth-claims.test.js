import { it, expect, beforeEach, afterAll } from "vitest";
import "../helpers/mockAuth";
import { insertUser, clearAllTestTables, testClient } from "../helpers/db";
import { table } from "../../lib/tables";
import { authOptions } from "../../app/api/auth/[...nextauth]/route";

beforeEach(clearAllTestTables);
afterAll(clearAllTestTables);
it("only one identity can claim an unbound roster entry during concurrent sign-ins", async () => {
  await insertUser({ net_id: "claim-student", role: "STUDENT", sub: null });
  const results = await Promise.all(["claim-sub-a", "claim-sub-b"].map((id) => authOptions.callbacks.jwt({ token: {}, user: { id, email: "claim-student@illinois.edu", name: "Claim Student" } })));
  expect(results.filter((token) => token.role === "student")).toHaveLength(1);
  expect(results.filter((token) => token.role === "error")).toHaveLength(1);
  const { data } = await testClient().from(table("users")).select("sub").eq("net_id", "claim-student").single();
  expect(results.find((token) => token.role === "student").sub).toBe(data.sub);
});

it("allows a returning user whose provider response omits email", async () => {
  await insertUser({ net_id: "known-student", role: "STUDENT", sub: "known-sub" });
  const token = await authOptions.callbacks.jwt({ token: {}, user: { id: "known-sub", name: "Known Student" } });
  expect(token.role).toBe("student");
  expect(token.netID).toBe("known-student");
});

it("accepts CILogon's alternate preferred username identity for first login", async () => {
  await insertUser({ net_id: "alternate-student", role: "STUDENT", sub: null });
  const token = await authOptions.callbacks.jwt({ token: {}, user: { id: "alternate-sub", preferred_username: "alternate-student@illinois.edu", name: "Alternate Student" } });
  expect(token.role).toBe("student");
  expect(token.netID).toBe("alternate-student");
});

it("retains an Illinois principal when the provider also sends a non-Illinois email", async () => {
  await insertUser({ net_id: "principal", role: "STUDENT", sub: null });
  const user = authOptions.providers[0].profile({ sub: "principal-sub", email: "someone@example.org", eppn: "principal@illinois.edu" });
  const token = await authOptions.callbacks.jwt({ token: {}, user });
  expect(token.role).toBe("student");
  expect(token.netID).toBe("principal");
});

it("allows simultaneous first sign-ins from the same identity", async () => {
  await insertUser({ net_id: "sameidentity", role: "STUDENT", sub: null });
  const tokens = await Promise.all([1, 2].map(() => authOptions.callbacks.jwt({ token: {}, user: { id: "same-sub", email: "sameidentity@illinois.edu" } })));
  expect(tokens.map((token) => token.role)).toEqual(["student", "student"]);
});

it("does not claim a roster row using an unscoped username from an unrelated IdP", async () => {
  await insertUser({ net_id: "unscoped", role: "STUDENT", sub: null });
  const token = await authOptions.callbacks.jwt({ token: {}, user: { id: "other-sub", preferred_username: "unscoped", idp: "https://other.example" } });
  expect(token.role).toBe("error");
  expect(token.authError).toBe("identity-missing");
});

it("does not trust an Illinois-looking email from an unrelated identity provider", async () => {
  await insertUser({ net_id: "foreignidp", role: "STUDENT", sub: null });
  const user = authOptions.providers[0].profile({ sub: "foreign-sub", email: "foreignidp@illinois.edu", idp: "https://other.example" });
  expect((await authOptions.callbacks.jwt({ token: {}, user })).role).toBe("error");
});
