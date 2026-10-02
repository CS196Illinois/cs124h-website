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
  if (!netID || !role) return { error: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (!isSandboxRole(role)) return { error: NextResponse.json({ error: "Sandbox mode is only available to web devs" }, { status: 403 }) };
  return { netID };
}

export async function GET() {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;
  try { return NextResponse.json({ mode: await getSandboxMode(netID) }); }
  catch { return NextResponse.json({ error: "Sandbox settings could not be loaded. Please try again." }, { status: 500 }); }
}

export async function PATCH(request) {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  if (!["off", "ephemeral", "persistent"].includes(mode)) {
    return NextResponse.json({ error: "Please choose Off, Ephemeral, or Persistent sandbox mode." }, { status: 400 });
  }

  try {
    await setSandboxMode(netID, mode);
    return NextResponse.json({ mode });
  } catch {
    return NextResponse.json({ error: "Sandbox mode could not be updated. Please try again." }, { status: 500 });
  }
}

// Manual "reset sandbox" - clears the overlay diff without changing the mode.
export async function DELETE() {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;

  try {
    await resetSandbox(netID);
    return NextResponse.json({ reset: true });
  } catch {
    return NextResponse.json({ error: "Sandbox data could not be reset. Please try again." }, { status: 500 });
  }
}

// Ends the caller's ephemeral sandbox session (clears its data, keeps the
// mode). Only ever acts when the caller's mode is currently ephemeral - a
// stray or malicious request must never be able to wipe a persistent sandbox.
export async function POST() {
  const { netID, error } = await requireSandboxUser();
  if (error) return error;

  try {
    if ((await getSandboxMode(netID)) === "ephemeral") await deactivateEphemeral(netID);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Sandbox cleanup could not be completed. Please try again." }, { status: 500 });
  }
}
