import { deriveCode } from "../../app/api/events/[id]/code/route";

// Check-in codes rotate every 30 seconds, so a code read just before a
// boundary belongs to the previous window by the time the test derives its
// own. Accept either window, the same ones check-in itself accepts.
export function recentCodes(eventId) {
  return [deriveCode(eventId, 0), deriveCode(eventId, -1)];
}
