import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { isSandboxRole, getSandboxMode, setSandboxMode, resetSandbox, deactivateEphemeral } from "../../../../../lib/sandbox";

// Self-service only - a user can only ever change their own sandbox
// settings, never another user's. Restricted to the roles the sandbox
// feature is actually for (web_dev / lead_web_dev).
async function requireSandboxUser() {
  const session = await getServerSession(authOptions);
  const netID = session?.user?.netID;
  const role = session?.user?.role;
  if (!netID || !role) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isSandboxRole(role)) return { error: NextResponse.json({ error: "Sandbox mode is only available to web devs" }, { status: 403 }) };
  return { netID };
}

export async function GET() {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;
  return NextResponse.json({ mode: await getSandboxMode(netID) });
}

export async function PATCH(request) {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  if (!["off", "ephemeral", "persistent"].includes(mode)) {
    return NextResponse.json({ error: "mode must be one of off, ephemeral, persistent" }, { status: 400 });
  }

  await setSandboxMode(netID, mode);
  return NextResponse.json({ mode });
}

// Manual "reset sandbox" - clears the overlay diff without changing the mode.
export async function DELETE() {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;

  await resetSandbox(netID);
  return NextResponse.json({ reset: true });
}

// navigator.sendBeacon only supports POST, so the sidebar uses this (instead
// of DELETE above) for its best-effort clear when the user navigates away
// from the dashboard while ephemeral. Only ever deactivates if the caller's
// mode is currently ephemeral - a stray/malicious beacon call must never be
// able to wipe a persistent sandbox. Not the safety net (getSandboxMode()'s
// lazy TTL expiry is); this only helps the clean in-app-navigation case.
// deactivateEphemeral() reverts the mode to "off", not just the data - an
// ephemeral session that ended but still reads as "ephemeral" is exactly
// the confusing state ("sandbox active" banner stuck on) this must avoid.
export async function POST() {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;

  if ((await getSandboxMode(netID)) === "ephemeral") {
    await deactivateEphemeral(netID);
  }
  return new NextResponse(null, { status: 204 });
}
