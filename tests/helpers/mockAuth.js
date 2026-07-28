import { vi } from "vitest";

// Factory must not reference outer-scope variables (Vitest hoists vi.mock
// calls), so it just installs a bare mock function — behavior is configured
// afterwards via getServerSession.mockResolvedValue()/mockReset() below.
vi.mock("next-auth", () => ({
  // app/api/auth/[...nextauth]/route.js calls NextAuth(authOptions) at
  // module scope just by being imported (for its authOptions export) —
  // needs a harmless default export so that doesn't throw.
  default: () => ({}),
  getServerSession: vi.fn(),
}));

// eslint-disable-next-line import/order -- must come after vi.mock
import { getServerSession } from "next-auth";

/**
 * Point the mocked getServerSession() at a fake session for the given role.
 * `role` is the URL-path role string used throughout the app
 * (course_lead / lead_web_dev / head_pm / pm / web_dev / student).
 */
export function asRole(role, netID, extra = {}) {
  getServerSession.mockResolvedValue({
    user: { role, netID, name: netID, ...extra },
  });
}

/** No session — exercises the app's Unauthorized paths. */
export function asAnonymous() {
  getServerSession.mockResolvedValue(null);
}

/** A session whose role no longer resolves to a roster entry. */
export function asError(netID) {
  getServerSession.mockResolvedValue({ user: { role: "error", netID } });
}
