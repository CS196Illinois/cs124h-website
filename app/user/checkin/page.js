"use client";

import CheckInPanel from "../components/CheckInPanel";

// Role-agnostic - any signed-in role can check in to any open event, not
// just students (staff attend events too). This is the one canonical URL
// every role's sidebar links to, and what the QR code behind an event's
// magnifying-glass view points at (see middleware.js's SHARED_PATHS and
// EventsPanel's enlarged code view).
export default function CheckIn() {
  return <CheckInPanel />;
}
