/**
 * Low-level Google Sheets/Drive API wrapper - auth, and the one-tab-per-event
 * bookkeeping. Callers that need actual attendance data go through
 * eventAttendanceSync.js instead; this file only knows about Sheets/Drive
 * mechanics, not the app's own tables.
 *
 * Credentials come from GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 - the full service
 * account JSON key, base64-encoded into one env var so its multi-line
 * private_key field never has to survive being pasted into a dotenv file or
 * the Vercel UI with newlines intact.
 */
import { google } from "googleapis";

let _sheetsClient;
let _driveClient;

function serviceAccountKey() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set");
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
}

function auth() {
  const key = serviceAccountKey();
  return new google.auth.GoogleAuth({
    credentials: { client_email: key.client_email, private_key: key.private_key },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export function sheetsClient() {
  if (!_sheetsClient) _sheetsClient = google.sheets({ version: "v4", auth: auth() });
  return _sheetsClient;
}

export function driveClient() {
  if (!_driveClient) _driveClient = google.drive({ version: "v3", auth: auth() });
  return _driveClient;
}

export function spreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set");
  return id;
}

// Sheet tab names can't exceed 100 chars or contain : \ / ? * [ ]
export function sanitizeTabName(title, startTime, createdBy) {
  const datePart = startTime
    ? new Date(startTime).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "no date set";
  const raw = `${title || "Untitled event"} - ${datePart}${createdBy ? ` - ${createdBy}` : ""}`
    .replace(/[:\\/?*[\]]/g, "-");
  return raw.length > 100 ? raw.slice(0, 100) : raw;
}

/**
 * Ensures a tab exists in the shared spreadsheet for this event, creating
 * or renaming it as needed, and returns its current name. `event` needs
 * { id, title, start_time, created_by, sheet_tab_gid }. `persistGid` is
 * called with the new gid the first time a tab is created, so the caller
 * can save it back onto the event row - this file has no knowledge of the
 * events table.
 */
export async function ensureEventTab(event, persistGid) {
  const sheets = sheetsClient();
  const wantedName = sanitizeTabName(event.title, event.start_time, event.created_by);

  if (event.sheet_tab_gid != null) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId() });
    const existing = meta.data.sheets.find((s) => s.properties.sheetId === event.sheet_tab_gid);
    if (existing) {
      if (existing.properties.title !== wantedName) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheetId(),
          requestBody: {
            requests: [{
              updateSheetProperties: {
                properties: { sheetId: event.sheet_tab_gid, title: wantedName },
                fields: "title",
              },
            }],
          },
        });
      }
      return wantedName;
    }
    // The gid was recorded but the tab is gone (e.g. someone deleted it by
    // hand in the sheet) - fall through and recreate it below.
  }

  // index: 0 - new events' tabs go at the front (left) of the sheet rather
  // than the default append-at-the-end, so the most recent event is always
  // the first tab. Existing tabs shift right automatically; a rename (the
  // branch above) never touches index, so re-syncing never reorders them.
  let addResult;
  try {
    addResult = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: { requests: [{ addSheet: { properties: { title: wantedName, index: 0 } } }] },
    });
  } catch (e) {
    // Sheets rejects duplicate tab names outright - two events with the same
    // title down to the minute is unlikely but not impossible.
    if (String(e.message).includes("already exists")) {
      const fallbackName = `${wantedName} (${event.id.slice(0, 8)})`;
      addResult = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId(),
        requestBody: { requests: [{ addSheet: { properties: { title: fallbackName, index: 0 } } }] },
      });
      const gid = addResult.data.replies[0].addSheet.properties.sheetId;
      await persistGid(gid);
      return fallbackName;
    }
    throw e;
  }

  const gid = addResult.data.replies[0].addSheet.properties.sheetId;
  await persistGid(gid);
  return wantedName;
}
