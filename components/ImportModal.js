"use client";

import { useState, useRef } from "react";
import styles from "../app/user/dashboard.module.css";
import { ALL_ROLES, ROLE_ALIASES } from "../lib/roles";

// ─── CSV parser (handles quoted fields) ──────────────────────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const out = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (line[i] === "," && !inQ) {
        out.push(cur.trim()); cur = "";
      } else {
        cur += line[i];
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map((l) => {
    const vals = parseLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

// ─── Role normalization ───────────────────────────────────────────────────────
const VALID_ROLES = ALL_ROLES.map((r) => r.id);

function normalizeRole(r) {
  const key = (r ?? "").toLowerCase().trim();
  return ROLE_ALIASES[key] ?? r?.toUpperCase().trim() ?? "";
}

// ─── Auto-detect column mapping ───────────────────────────────────────────────
function autoDetect(headers) {
  const norm = (h) => h.toLowerCase().replace(/[\s_-]+/g, "");
  const MAPS = {
    net_id: ["netid", "netid", "username", "userid", "uid", "login", "illinoisnetid"],
    name: ["name", "fullname", "full_name", "displayname", "studentname"],
    role: ["role", "type", "position", "title"],
    group_number: ["group", "groupnumber", "group_number", "team", "teamnumber", "groupno"],
  };
  const mapping = { net_id: "", name: "", role: "", group_number: "" };
  for (const h of headers) {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(MAPS)) {
      if (!mapping[field] && aliases.includes(n)) mapping[field] = h;
    }
  }
  return mapping;
}

// ─── Apply mapping to raw rows ────────────────────────────────────────────────
function applyMapping(rawRows, mapping) {
  return rawRows.map((row) => ({
    net_id: row[mapping.net_id]?.toLowerCase().trim() ?? "",
    name: mapping.name ? (row[mapping.name]?.trim() ?? "") : "",
    role: mapping._injectRole
      ? mapping._injectRole
      : normalizeRole(mapping.role ? row[mapping.role] : ""),
    group_number: mapping.group_number ? (row[mapping.group_number] || "") : "",
  }));
}

// ─── Validate + deduplicate rows ──────────────────────────────────────────────
function processRows(mappedRows) {
  const seen = new Map();
  const order = [];

  for (const r of mappedRows) {
    if (!r.net_id) continue;
    if (seen.has(r.net_id)) {
      const prev = seen.get(r.net_id);
      seen.set(r.net_id, {
        net_id: r.net_id,
        name: r.name || prev.name,
        role: r.role || prev.role,
        group_number: r.group_number || prev.group_number,
        _merged: true,
      });
    } else {
      seen.set(r.net_id, { ...r });
      order.push(r.net_id);
    }
  }

  return order.map((id) => {
    const r = seen.get(id);
    const errs = [
      !r.net_id && "Missing NetID",
      !VALID_ROLES.includes(r.role) && `Invalid role "${r.role || "(empty)"}"`,
    ].filter(Boolean);
    return { ...r, _valid: errs.length === 0, _errors: errs };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const colors = {
    LEAD:     { bg: "rgba(124,58,237,0.2)",  color: "#c4b5fd" },
    LEAD_WEB: { bg: "rgba(99,102,241,0.2)",  color: "#a5b4fc" },
    HEAD:     { bg: "rgba(5,150,105,0.2)",   color: "#6ee7b7" },
    PM:       { bg: "rgba(79,141,222,0.2)",  color: "#93c5fd" },
    WEB:      { bg: "rgba(219,39,119,0.2)",  color: "#f9a8d4" },
    STUDENT:  { bg: "rgba(236,181,87,0.2)",  color: "#fcd34d" },
  };
  const c = colors[role] ?? { bg: "rgba(255,255,255,0.08)", color: "rgba(249,249,249,0.45)" };
  return (
    <span style={{ display: "inline-block", padding: "0.15rem 0.55rem", borderRadius: 20, fontSize: "0.7rem", fontWeight: 600, fontFamily: "Inter, sans-serif", background: c.bg, color: c.color }}>
      {role || "-"}
    </span>
  );
}

function StatPill({ value, label, color = "rgba(249,249,249,0.5)" }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.5rem 0.85rem", textAlign: "center", minWidth: 72 }}>
      <div style={{ color, fontWeight: 700, fontSize: "1.35rem", fontFamily: "Kufam, sans-serif", lineHeight: 1 }}>{value}</div>
      <div style={{ color: "rgba(249,249,249,0.4)", fontSize: "0.7rem", fontFamily: "Inter, sans-serif", marginTop: "0.2rem", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

function RadioOption({ selected, onClick, title, desc, danger = false }) {
  const accent = danger ? "#f87171" : "#ecb557";
  const accentBg = danger ? "rgba(248,113,113,0.07)" : "rgba(236,181,87,0.07)";
  const accentBorder = danger ? "rgba(248,113,113,0.45)" : "rgba(236,181,87,0.45)";
  return (
    <div
      onClick={onClick}
      style={{
        border: `1px solid ${selected ? accentBorder : "rgba(255,255,255,0.1)"}`,
        borderRadius: 8,
        padding: "0.75rem 1rem",
        marginBottom: "0.5rem",
        cursor: "pointer",
        background: selected ? accentBg : "transparent",
        transition: "all 0.18s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%",
          border: `2px solid ${selected ? accent : "rgba(255,255,255,0.25)"}`,
          background: selected ? accent : "transparent",
          flexShrink: 0, marginTop: 2, transition: "all 0.18s",
        }} />
        <div>
          <p style={{ color: "#f9f9f9", fontSize: "0.88rem", fontFamily: "Inter, sans-serif", fontWeight: 600, margin: 0 }}>{title}</p>
          <p style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.78rem", fontFamily: "Inter, sans-serif", margin: "0.2rem 0 0" }}>{desc}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const STEPS = ["Source", "Map Columns", "Review & Options", "Done"];

const ROLE_LABELS = Object.fromEntries(ALL_ROLES.map((r) => [r.id, r.label]));

export default function ImportModal({ onClose, onComplete, roleScope }) {
  const [step, setStep] = useState(0);

  // Step 0
  const [sourceTab, setSourceTab] = useState("csv");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Parsed data
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);

  // Step 1
  const [mapping, setMapping] = useState({ net_id: "", name: "", role: "", group_number: "" });

  // Step 2 - when roleScope is set, always use replace (scoped)
  const [mode, setMode] = useState(roleScope ? "replace" : "append");
  const [conflictResolution, setConflictResolution] = useState("keep_existing");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // Step 3
  const [result, setResult] = useState(null);

  // Derived state - inject roleScope as the role when no role column is mapped
  const effectiveMapping = roleScope && !mapping.role ? { ...mapping, _injectRole: roleScope } : mapping;
  const processed = step >= 1 ? processRows(applyMapping(rawRows, effectiveMapping)) : [];
  const validRows = processed.filter((r) => r._valid);
  const errorRows = processed.filter((r) => !r._valid);
  const mergedCount = processed.filter((r) => r._merged).length;

  function loadCsv(text) {
    const { headers: h, rows: r } = parseCsv(text);
    if (!h.length) {
      setSourceError("Could not parse the file. Make sure it has a header row and is comma-separated.");
      return;
    }
    setHeaders(h);
    setRawRows(r);
    const det = autoDetect(h);
    setMapping(det);
    setSourceError("");
    // Skip manual mapping if required fields were confidently detected
    const allRequiredMapped = det.net_id && (roleScope || det.role);
    setStep(allRequiredMapped ? 2 : 1);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadCsv(ev.target.result);
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadCsv(ev.target.result);
    reader.readAsText(file);
  }

  async function handleSheetsLoad() {
    if (!sheetsUrl.trim()) { setSourceError("Please enter a Google Sheets URL."); return; }
    setSheetsLoading(true);
    setSourceError("");
    try {
      const res = await fetch(`/api/users/import?url=${encodeURIComponent(sheetsUrl.trim())}`);
      const json = await res.json();
      if (!res.ok) { setSourceError(json.error || "Failed to load sheet."); return; }
      loadCsv(json.csv);
    } catch {
      setSourceError("Network error. Please try again.");
    } finally {
      setSheetsLoading(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map(({ _valid, _errors, _merged, ...r }) => r),
          mode,
          conflictResolution: mode === "append" ? conflictResolution : undefined,
          roleScope: roleScope || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setImportError(json.error || "Import failed. Please try again."); return; }
      setResult(json);
      onComplete?.();
      setStep(3);
    } catch {
      setImportError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  const modalWidth = step === 2 ? 700 : 520;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth: modalWidth, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.2rem" }}>
              {roleScope ? `Replace ${ROLE_LABELS[roleScope] ?? roleScope}s` : "Import Roster"}
            </h2>
            <p style={{ color: "rgba(249,249,249,0.4)", fontSize: "0.78rem", fontFamily: "Inter, sans-serif", margin: 0 }}>
              Step {step + 1} of {STEPS.length} - {STEPS[step]}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(249,249,249,0.45)", fontSize: "1.3rem", cursor: "pointer", lineHeight: 1, padding: "0 0.1rem", marginTop: "-0.1rem" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: "1.75rem" }}>
          <div style={{ height: "100%", background: "#ecb557", borderRadius: 2, width: `${((step + 1) / STEPS.length) * 100}%`, transition: "width 0.35s ease" }} />
        </div>

        {/* ── Step 0: Source ── */}
        {step === 0 && (
          <div>
            <div className={styles.subTabs} style={{ marginBottom: "1.25rem" }}>
              <button className={`${styles.subTab} ${sourceTab === "csv" ? styles.activeSubTab : ""}`} onClick={() => { setSourceTab("csv"); setSourceError(""); }}>
                Upload CSV
              </button>
              <button className={`${styles.subTab} ${sourceTab === "sheets" ? styles.activeSubTab : ""}`} onClick={() => { setSourceTab("sheets"); setSourceError(""); }}>
                Google Sheets
              </button>
            </div>

            {sourceTab === "csv" ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "rgba(236,181,87,0.6)" : "rgba(255,255,255,0.15)"}`,
                  borderRadius: 10,
                  padding: "2.75rem 1.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(236,181,87,0.04)" : "transparent",
                  transition: "all 0.18s",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.6rem" }}>📄</div>
                <p style={{ color: "#f9f9f9", fontFamily: "Inter, sans-serif", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.95rem" }}>
                  Drop a CSV file here
                </p>
                <p style={{ color: "rgba(249,249,249,0.35)", fontFamily: "Inter, sans-serif", fontSize: "0.82rem" }}>
                  or click to browse your files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>
            ) : (
              <div>
                <div className={styles.formGroup}>
                  <label>Google Sheets URL</label>
                  <input
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    onKeyDown={(e) => e.key === "Enter" && handleSheetsLoad()}
                  />
                </div>
                <p style={{ color: "rgba(249,249,249,0.35)", fontSize: "0.78rem", fontFamily: "Inter, sans-serif", marginBottom: "1rem", lineHeight: 1.5 }}>
                  The spreadsheet must be shared with <strong style={{ color: "rgba(249,249,249,0.55)" }}>"Anyone with the link can view"</strong> access. Paste any tab&apos;s URL to import that specific sheet.
                </p>
                <button
                  className={styles.btnPrimary}
                  onClick={handleSheetsLoad}
                  disabled={sheetsLoading}
                  style={{ width: "100%" }}
                >
                  {sheetsLoading ? "Loading sheet…" : "Load Sheet"}
                </button>
              </div>
            )}

            {sourceError && <div className={styles.alertError} style={{ marginTop: "1rem" }}>{sourceError}</div>}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: "1.5rem", paddingTop: "1rem" }}>
              <p style={{ color: "rgba(249,249,249,0.28)", fontSize: "0.75rem", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
                <strong style={{ color: "rgba(249,249,249,0.45)" }}>Expected columns:</strong>{" "}
                <code style={{ color: "rgba(249,249,249,0.5)" }}>net_id</code> is required.{" "}
                {roleScope
                  ? <>All imported people will be set to <strong style={{ color: "rgba(249,249,249,0.55)" }}>{ROLE_LABELS[roleScope] ?? roleScope}</strong> - the role column is optional.</>
                  : <><code style={{ color: "rgba(249,249,249,0.5)" }}>role</code> is required. Valid roles: {VALID_ROLES.join(", ")}.</>
                }{" "}
                <code style={{ color: "rgba(249,249,249,0.5)" }}>name</code> and{" "}
                <code style={{ color: "rgba(249,249,249,0.5)" }}>group_number</code> are optional.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 1: Column Mapping ── */}
        {step === 1 && (
          <div>
            <p style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.85rem", fontFamily: "Inter, sans-serif", marginBottom: "1.25rem" }}>
              <strong style={{ color: "rgba(249,249,249,0.7)" }}>{rawRows.length} rows</strong> detected.
              Confirm which column in your file maps to each field. Columns with a good match were auto-detected.
            </p>

            {[
              { field: "net_id", label: "NetID", required: true },
              { field: "role", label: "Role", required: !roleScope },
              { field: "name", label: "Full Name", required: false },
              { field: "group_number", label: "Group Number", required: false },
            ].map(({ field, label, required }) => (
              <div className={styles.formGroup} key={field}>
                <label>
                  {label}{" "}
                  {required
                    ? <span style={{ color: "#ecb557" }}>*</span>
                    : <span style={{ color: "rgba(249,249,249,0.3)", fontWeight: 400 }}>(optional)</span>
                  }
                </label>
                <select
                  value={mapping[field]}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                >
                  <option value="">- skip this field -</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}

            {/* Live preview */}
            {mapping.net_id && (
              <div style={{ marginTop: "1.25rem" }}>
                <p style={{ color: "rgba(249,249,249,0.35)", fontSize: "0.73rem", fontFamily: "Inter, sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                  Preview - first 3 rows
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                    <thead>
                      <tr><th>NetID</th><th>Name</th><th>Role</th><th>Group</th></tr>
                    </thead>
                    <tbody>
                      {applyMapping(rawRows.slice(0, 3), mapping).map((r, i) => (
                        <tr key={i}>
                          <td className={styles.cellMono}>{r.net_id || <span style={{ opacity: 0.3 }}>-</span>}</td>
                          <td>{r.name || <span style={{ opacity: 0.3 }}>-</span>}</td>
                          <td><RoleBadge role={r.role} /></td>
                          <td>{r.group_number || <span style={{ opacity: 0.3 }}>-</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setStep(0)}>Back</button>
              <button
                className={styles.btnPrimary}
                disabled={!mapping.net_id || (!roleScope && !mapping.role)}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review & Options ── */}
        {step === 2 && (
          <div>
            {/* Summary pills */}
            <div style={{ display: "flex", gap: "0.65rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
              <StatPill value={processed.length} label="Total rows" />
              <StatPill value={validRows.length} label="Ready to import" color="#4ade80" />
              {mergedCount > 0 && <StatPill value={mergedCount} label="Duplicates merged" color="#ecb557" />}
              {errorRows.length > 0 && <StatPill value={errorRows.length} label="Will be skipped" color="#f87171" />}
            </div>

            {/* Row errors */}
            {errorRows.length > 0 && (
              <div className={styles.alertError} style={{ marginBottom: "1rem" }}>
                <strong>{errorRows.length} row{errorRows.length !== 1 ? "s" : ""} will be skipped</strong> due to validation errors:
                <ul style={{ margin: "0.4rem 0 0 1.1rem", fontSize: "0.8rem", lineHeight: 1.7 }}>
                  {errorRows.slice(0, 5).map((r, i) => (
                    <li key={i}>
                      <code style={{ color: "#fca5a5" }}>{r.net_id || "(no netid)"}</code>: {r._errors.join(", ")}
                    </li>
                  ))}
                  {errorRows.length > 5 && <li style={{ opacity: 0.7 }}>…and {errorRows.length - 5} more</li>}
                </ul>
              </div>
            )}

            {mergedCount > 0 && (
              <div className={styles.alertSuccess} style={{ marginBottom: "1rem" }}>
                {mergedCount} duplicate NetID{mergedCount !== 1 ? "s" : ""} found and auto-merged - the last occurrence of each was kept with any non-empty fields filled in.
              </div>
            )}

            {/* Data preview */}
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ color: "rgba(249,249,249,0.35)", fontSize: "0.73rem", fontFamily: "Inter, sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                Data preview {validRows.length > 8 ? `(8 of ${validRows.length} shown)` : `(${validRows.length} rows)`}
              </p>
              <div style={{ overflowX: "auto", maxHeight: 200, overflowY: "auto", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)" }}>
                <table className={styles.table} style={{ fontSize: "0.78rem" }}>
                  <thead>
                    <tr><th>NetID</th><th>Name</th><th>Role</th><th>Group</th></tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td className={styles.cellMono}>{r.net_id}</td>
                        <td>{r.name || <span style={{ opacity: 0.3 }}>-</span>}</td>
                        <td><RoleBadge role={r.role} /></td>
                        <td>{r.group_number || <span style={{ opacity: 0.3 }}>-</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import mode */}
            {roleScope ? (
              <div className={styles.alertError} style={{ marginBottom: "1.1rem", background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.35)" }}>
                <strong style={{ color: "#fca5a5" }}>Scoped replace:</strong>{" "}
                <span style={{ color: "rgba(249,249,249,0.65)", fontSize: "0.85rem" }}>
                  All existing <strong>{ROLE_LABELS[roleScope] ?? roleScope}</strong> users not present in this file will be removed. People in other roles are unaffected. Login bindings for returning members are preserved.
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: "1.1rem" }}>
                <p style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.73rem", fontFamily: "Inter, sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.65rem" }}>
                  Import Mode
                </p>
                <RadioOption
                  selected={mode === "append"}
                  onClick={() => setMode("append")}
                  title="Append - add to existing roster"
                  desc="Keep everyone already in the roster. Only new people from this file will be added, unless you choose to overwrite conflicts below."
                />
                <RadioOption
                  selected={mode === "replace"}
                  onClick={() => setMode("replace")}
                  title="Replace - overwrite entire roster"
                  desc="Everyone not in this file will be removed from the roster. Login bindings for returning members are preserved."
                  danger
                />
              </div>
            )}

            {/* Conflict resolution - append only (not available in scoped replace) */}
            {!roleScope && mode === "append" && (
              <div style={{ marginBottom: "1rem", paddingTop: "0.25rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ color: "rgba(249,249,249,0.45)", fontSize: "0.73rem", fontFamily: "Inter, sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "1rem 0 0.65rem" }}>
                  When a Person Already Exists in the Roster
                </p>
                <RadioOption
                  selected={conflictResolution === "keep_existing"}
                  onClick={() => setConflictResolution("keep_existing")}
                  title="Keep existing data"
                  desc="Leave their current role, name, and group unchanged. The imported data for that person is ignored."
                />
                <RadioOption
                  selected={conflictResolution === "use_imported"}
                  onClick={() => setConflictResolution("use_imported")}
                  title="Use imported data"
                  desc="Overwrite their current role, name, and group number with the values from this file."
                />
              </div>
            )}

            {importError && <div className={styles.alertError}>{importError}</div>}

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setStep(mapping.net_id && (roleScope || mapping.role) ? 0 : 1)} disabled={importing}>Back</button>
              <button
                className={styles.btnPrimary}
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
              >
                {importing
                  ? "Importing…"
                  : `Import ${validRows.length} ${validRows.length === 1 ? "Person" : "People"}`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && result && (
          <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
            <div style={{ fontSize: "2.75rem", marginBottom: "0.65rem" }}>✅</div>
            <h3 style={{ color: "#f9f9f9", fontFamily: "Kufam, sans-serif", fontSize: "1.2rem", marginBottom: "0.4rem" }}>
              Import Complete
            </h3>
            <p style={{ color: "rgba(249,249,249,0.4)", fontSize: "0.85rem", fontFamily: "Inter, sans-serif", marginBottom: "1.75rem" }}>
              The roster has been updated successfully.
            </p>

            <div style={{ display: "flex", gap: "0.65rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "1.75rem" }}>
              {result.inserted > 0 && <StatPill value={result.inserted} label="Added" color="#4ade80" />}
              {result.updated > 0 && <StatPill value={result.updated} label="Updated" color="#93c5fd" />}
              {result.deleted > 0 && <StatPill value={result.deleted} label="Removed" color="#f87171" />}
              {result.skipped > 0 && <StatPill value={result.skipped} label="Skipped" color="rgba(249,249,249,0.4)" />}
              {result.inserted === 0 && result.updated === 0 && result.deleted === 0 && result.skipped === 0 && (
                <StatPill value={0} label="Changes" />
              )}
            </div>

            {result.errors?.length > 0 && (
              <div className={styles.alertError} style={{ textAlign: "left", marginBottom: "1.25rem" }}>
                {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} could not be imported due to errors.
              </div>
            )}

            <button className={styles.btnPrimary} onClick={onClose} style={{ width: "100%" }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
