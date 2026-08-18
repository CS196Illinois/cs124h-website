import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

// GET: proxy-fetch a Google Sheets CSV to avoid CORS
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!["course_lead", "lead_web_dev", "web_dev"].includes(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const csvUrl = toSheetsCsvUrl(url);
  if (!csvUrl) {
    return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
  }

  try {
    const res = await fetch(csvUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Could not fetch sheet. Make sure it is shared with "Anyone with the link can view".' },
        { status: 400 }
      );
    }
    const csv = await res.text();
    return NextResponse.json({ csv });
  } catch {
    return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 500 });
  }
}

function toSheetsCsvUrl(url) {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

// POST: perform the bulk import
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!["course_lead", "lead_web_dev", "web_dev"].includes(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { rows, mode, conflictResolution, roleScope } = body;
  // mode: "append" | "replace"
  // conflictResolution: "keep_existing" | "use_imported" (append mode only)
  // roleScope: optional role string - scopes replace/delete to only that role

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const VALID_ROLES = ["LEAD", "HEAD", "PM", "WEB", "STUDENT"];
  const validRows = [];
  const errors = [];

  for (const row of rows) {
    const net_id = row.net_id?.trim().toLowerCase();
    const role = row.role?.toUpperCase().trim();
    if (!net_id) { errors.push({ row, reason: "Missing net_id" }); continue; }
    if (!VALID_ROLES.includes(role)) { errors.push({ row, reason: `Invalid role: ${row.role}` }); continue; }
    validRows.push({
      net_id,
      role,
      name: row.name?.trim() || null,
      group_number: row.group_number ? Number(row.group_number) : null,
    });
  }

  if (validRows.length === 0) {
    return NextResponse.json({ error: "No valid rows to import", errors }, { status: 400 });
  }

  // Fetch current roster (scoped to roleScope if provided, else all)
  let existingQuery = supabaseServer.from(table("users")).select("net_id, role, sub, name");
  if (roleScope) existingQuery = existingQuery.eq("role", roleScope);
  const { data: existing, error: fetchErr } = await existingQuery;
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const existingMap = new Map(existing.map((u) => [u.net_id, u]));
  const importSet = new Set(validRows.map((r) => r.net_id));

  let inserted = 0, updated = 0, deleted = 0, skipped = 0;

  if (mode === "replace") {
    // Upsert all rows, preserving sub and existing name
    const toUpsert = validRows.map((r) => {
      const existing = existingMap.get(r.net_id);
      return {
        ...r,
        sub: existing?.sub ?? null,
        name: existing?.name || r.name,
      };
    });

    const { error: upsertErr } = await supabaseServer
      .from(table("users"))
      .upsert(toUpsert, { onConflict: "net_id" });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    for (const r of validRows) {
      if (existingMap.has(r.net_id)) updated++;
      else inserted++;
    }

    // Remove everyone not in the import (scoped to roleScope if provided)
    const toDelete = existing.filter((u) => !importSet.has(u.net_id)).map((u) => u.net_id);
    if (toDelete.length > 0) {
      const { error: delErr } = await supabaseServer
        .from(table("users"))
        .delete()
        .in("net_id", toDelete);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      deleted = toDelete.length;
    }
  } else {
    // Append mode
    const toInsert = [];
    const toUpdate = [];

    for (const row of validRows) {
      if (existingMap.has(row.net_id)) {
        if (conflictResolution === "use_imported") {
          const existing = existingMap.get(row.net_id);
          toUpdate.push({ ...row, sub: existing?.sub ?? null, name: existing?.name || row.name });
        } else {
          skipped++;
        }
      } else {
        toInsert.push(row);
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabaseServer.from(table("users")).insert(toInsert);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      inserted = toInsert.length;
    }

    for (const row of toUpdate) {
      const { error: upErr } = await supabaseServer
        .from(table("users"))
        .update({ role: row.role, name: row.name, group_number: row.group_number })
        .eq("net_id", row.net_id);
      // note: row.name is already the preserved DB name (set above when building toUpdate)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      updated++;
    }
  }

  return NextResponse.json({ inserted, updated, deleted, skipped, errors });
}
