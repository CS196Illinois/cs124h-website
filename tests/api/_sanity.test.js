import { describe, it, expect } from "vitest";
import { table } from "../../lib/tables";

describe("test harness sanity", () => {
  it("resolves table names to their test_-prefixed twins", () => {
    expect(table("users")).toBe("test_user-testing");
    expect(table("actionItems")).toBe("test_action_items");
  });
});
