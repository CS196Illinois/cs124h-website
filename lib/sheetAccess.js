/**
 * Grants/revokes Editor access to the shared attendance Google Sheet based
 * on a user's DB role. Called from every place a user's role can change:
 * app/api/users/route.js, app/api/users/[net_id]/route.js, and
 * app/api/users/import/route.js (CSV import) - all three must call
 * syncSheetAccessForRole() after writing a role, or access silently drifts
 * out of sync with the roster.
 *
 * There's no email column on users - every part of the app (including the
 * registration instructions on the home page) assumes NetID@illinois.edu,
 * so that's the address shared/unshared here too.
 */
import { driveClient, spreadsheetId } from "./googleSheets";

// DB role ids (see lib/roles.js) that should have standing access:
// course_lead, head_pm, lead_web_dev.
export const SHEET_ACCESS_ROLES = new Set(["LEAD", "HEAD", "LEAD_WEB"]);

function emailFor(netId) {
  return `${netId}@illinois.edu`;
}

async function findPermission(email) {
  const drive = driveClient();
  const { data } = await drive.permissions.list({
    fileId: spreadsheetId(),
    fields: "permissions(id, emailAddress)",
  });
  return (data.permissions || []).find(
    (p) => (p.emailAddress || "").toLowerCase() === email.toLowerCase()
  );
}

function testMode() {
  return process.env.USE_TEST_TABLES === "true";
}

export async function grantSheetAccess(netId) {
  // Never grant/revoke real Drive permissions for fake e2e net_ids - there's
  // no test-mode equivalent of the sheet, so this is a hard no-op in tests.
  if (testMode()) return;
  const email = emailFor(netId);
  const existing = await findPermission(email);
  if (existing) return; // already has access - avoid a duplicate permission entry
  const drive = driveClient();
  await drive.permissions.create({
    fileId: spreadsheetId(),
    sendNotificationEmail: true,
    requestBody: { type: "user", role: "writer", emailAddress: email },
  });
}

export async function revokeSheetAccess(netId) {
  if (testMode()) return;
  const email = emailFor(netId);
  const existing = await findPermission(email);
  if (!existing) return; // already has no access - nothing to do
  const drive = driveClient();
  await drive.permissions.delete({ fileId: spreadsheetId(), permissionId: existing.id });
}

/**
 * Call this after any write that could change a user's role or remove them
 * from the roster entirely. `newRole` is `null`/`undefined` when the user
 * was deleted outright.
 */
export async function syncSheetAccessForRole(netId, newRole) {
  if (newRole && SHEET_ACCESS_ROLES.has(newRole)) {
    await grantSheetAccess(netId);
  } else {
    await revokeSheetAccess(netId);
  }
}
