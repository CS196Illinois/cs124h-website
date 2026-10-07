import { NextResponse } from "next/server";
import { spreadsheetId } from "../../../lib/googleSheets";
import { SHEET_ACCESS_PATH_ROLES } from "../../../lib/sheetAccess";
import { signInRequired } from "../../../lib/apiResponses";
import { getSessionUser } from "../../../lib/session";

// Hands back the shared attendance sheet's URL to whoever is signed in with
// a role that actually has Editor access to it (kept in sync by
// lib/sheetAccess.js) - the id itself lives server-side only, same as the
// service account credentials.
export async function GET() {
  const caller = await getSessionUser();
  if (!SHEET_ACCESS_PATH_ROLES.has(caller.role)) {
    return signInRequired(403);
  }
  return NextResponse.json({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId()}/edit` });
}
