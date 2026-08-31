import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { spreadsheetId } from "../../../lib/googleSheets";
import { SHEET_ACCESS_PATH_ROLES } from "../../../lib/sheetAccess";

// Hands back the shared attendance sheet's URL to whoever is signed in with
// a role that actually has Editor access to it (kept in sync by
// lib/sheetAccess.js) - the id itself lives server-side only, same as the
// service account credentials.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!SHEET_ACCESS_PATH_ROLES.has(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  return NextResponse.json({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId()}/edit` });
}
