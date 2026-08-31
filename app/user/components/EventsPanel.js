"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { MagnifyingGlassIcon, ArrowSquareOutIcon, X } from "@phosphor-icons/react";
import { useUndo } from "../../../components/UndoProvider";
import styles from "../dashboard.module.css";
import panelStyles from "./EventsPanel.module.css";

// Roles with standing Editor access to the shared attendance sheet (kept in
// sync with lib/sheetAccess.js's SHEET_ACCESS_PATH_ROLES) - only these see
// the "Open Attendance Sheet" button, since it 404s/prompts for access for
// everyone else.
const SHEET_ACCESS_ROLES = new Set(["course_lead", "head_pm", "lead_web_dev"]);

export default function EventsPanel() {
  const { scheduleUndo } = useUndo();
  const { data: session } = useSession();
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState(null); // event whose attendees are shown
  const [attendees, setAttendees]   = useState({});   // eventId → [{ net_id, checked_in_at }]
  const [sheetSync, setSheetSync]   = useState({});   // eventId → "syncing" | "synced" | "failed"
  const [enlargedId, setEnlargedId] = useState(null);  // event whose code is shown full-screen
  const [sheetUrl, setSheetUrl]     = useState(null);  // shared attendance sheet, if this role has access
  const [roster, setRoster]         = useState([]);   // full roster, for the add-attendee autocomplete
  const [addInputs, setAddInputs]   = useState({});   // eventId → in-progress net_id text
  const [addErrors, setAddErrors]   = useState({});   // eventId → error message from the last add attempt

  // Create-event modal
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({ title: "", description: "", location: "", presenter: "", start_time: "", end_time: "" });
  const [formError, setFormError]   = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Live rotating codes: eventId → { code, expiresIn }
  const [liveCodes, setLiveCodes]   = useState({});
  const pollRef                     = useRef({});
  const tickRef                     = useRef(null);

  // ── Data fetching ──────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/events");
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Roster, for the add-attendee autocomplete - fetched once since this
  // panel is staff-only and GET /api/users is available to any signed-in
  // role.
  useEffect(() => {
    fetch("/api/users").then(async (res) => {
      if (res.ok) setRoster(await res.json());
    });
  }, []);

  // Only roles with standing Editor access to the sheet get a link to it -
  // ask the server (which knows the real signed-in role, not just which
  // dashboard directory this happens to be rendered under - a lead_web_dev
  // or web_dev with an approved view can land here from another role's path).
  useEffect(() => {
    if (!SHEET_ACCESS_ROLES.has(session?.user?.role)) { setSheetUrl(null); return; }
    fetch("/api/sheet-link").then(async (res) => {
      if (res.ok) setSheetUrl((await res.json()).url);
    });
  }, [session?.user?.role]);

  // ── Code polling: start/stop per open event ────────────────────

  const fetchCode = useCallback(async (eventId) => {
    const res = await fetch(`/api/events/${eventId}/code`);
    if (res.ok) {
      const { code, expiresIn } = await res.json();
      setLiveCodes(prev => ({ ...prev, [eventId]: { code, expiresIn } }));
    }
  }, []);

  useEffect(() => {
    const openIds = events.filter(e => e.check_in_open).map(e => e.id);
    const prevIds = Object.keys(pollRef.current);

    // Stop polling for events that closed
    prevIds.forEach(id => {
      if (!openIds.includes(id)) {
        clearInterval(pollRef.current[id]);
        delete pollRef.current[id];
        setLiveCodes(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    });

    // Start polling for newly opened events
    openIds.forEach(id => {
      if (!pollRef.current[id]) {
        fetchCode(id);
        pollRef.current[id] = setInterval(() => fetchCode(id), 5_000);
      }
    });
  }, [events, fetchCode]);

  // Tick-down the expiresIn counters every second
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setLiveCodes(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (next[id].expiresIn > 0) {
            next[id] = { ...next[id], expiresIn: next[id].expiresIn - 1 };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1_000);
    return () => clearInterval(tickRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollRef.current).forEach(clearInterval);
      clearInterval(tickRef.current);
    };
  }, []);

  // Escape closes the enlarged code view
  useEffect(() => {
    if (!enlargedId) return;
    const onKeyDown = (e) => { if (e.key === "Escape") setEnlargedId(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enlargedId]);

  // ── Actions ────────────────────────────────────────────────────

  const toggleCheckIn = async (eventId, currentlyOpen) => {
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ check_in_open: !currentlyOpen }),
    });
    await fetchEvents();
  };

  const deleteEvent = (eventId) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    scheduleUndo({
      message: `Deleted "${event.title}" and its check-ins`,
      onExpire: () => fetch(`/api/events/${eventId}`, { method: "DELETE" }),
      onCancel: () => setEvents((prev) => [...prev, event]),
    });
  };

  const viewAttendees = async (eventId) => {
    if (expandedId === eventId) { setExpandedId(null); return; }
    const res = await fetch(`/api/events/${eventId}/checkin`);
    if (res.ok) {
      const data = await res.json();
      setAttendees((prev) => ({ ...prev, [eventId]: data }));
    }
    setExpandedId(eventId);
  };

  const syncSheet = async (eventId) => {
    setSheetSync((prev) => ({ ...prev, [eventId]: "syncing" }));
    const res = await fetch(`/api/events/${eventId}/sync-sheet`, { method: "POST" });
    setSheetSync((prev) => ({ ...prev, [eventId]: res.ok ? "synced" : "failed" }));
  };

  const addAttendee = async (eventId) => {
    const netId = (addInputs[eventId] || "").trim().toLowerCase();
    if (!netId) return;
    setAddErrors((prev) => ({ ...prev, [eventId]: "" }));
    const res = await fetch(`/api/events/${eventId}/checkin/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ net_id: netId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setAddErrors((prev) => ({ ...prev, [eventId]: error || "Failed to add attendee." }));
      return;
    }
    setAddInputs((prev) => ({ ...prev, [eventId]: "" }));
    setAttendees((prev) => ({
      ...prev,
      [eventId]: [...(prev[eventId] || []), { net_id: netId, checked_in_at: new Date().toISOString() }],
    }));
  };

  const removeAttendee = (eventId, netId) => {
    const removed = attendees[eventId]?.find((a) => a.net_id === netId);
    if (!removed) return;
    setAttendees((prev) => ({
      ...prev,
      [eventId]: prev[eventId].filter((a) => a.net_id !== netId),
    }));
    scheduleUndo({
      message: `Removed ${netId} from attendees`,
      onExpire: () => fetch(`/api/events/${eventId}/checkin/manual?net_id=${encodeURIComponent(netId)}`, { method: "DELETE" }),
      onCancel: () => setAttendees((prev) => ({ ...prev, [eventId]: [...prev[eventId], removed] })),
    });
  };

  const handleCreate = async () => {
    setFormError("");
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    setFormLoading(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setFormError(json.error || "Failed to create event."); setFormLoading(false); return; }
    setShowModal(false);
    setForm({ title: "", description: "", location: "", presenter: "", start_time: "", end_time: "" });
    setFormLoading(false);
    await fetchEvents();
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span style={{ color: "#f9f9f9", fontFamily: "Inter", fontWeight: 600 }}>
          Events ({events.length})
        </span>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnSecondary}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}
            >
              <ArrowSquareOutIcon size={16} weight="bold" />
              Attendance Sheet
            </a>
          )}
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
            + New Event
          </button>
        </div>
      </div>

      {/* Event list */}
      {loading ? (
        <div className={styles.loading}>Loading events…</div>
      ) : events.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📅</span>
          No events yet. Create one to get started.
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date / Time</th>
                <th>Created by</th>
                <th>Check-in</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <>
                  {/* Main row */}
                  <tr key={event.id}>
                    <td style={{ fontWeight: 500 }}>{event.title}</td>
                    <td style={{ color: "rgba(249,249,249,0.55)", fontSize: "0.85rem" }}>
                      {event.start_time
                        ? new Date(event.start_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                        : "-"}
                    </td>
                    <td className={styles.cellMono}>{event.created_by ?? "-"}</td>
                    <td>
                      {event.check_in_open
                        ? <span style={{ color: "#4ade80", fontWeight: 600, fontSize: "0.85rem" }}>● Open</span>
                        : <span style={{ color: "rgba(249,249,249,0.35)", fontSize: "0.85rem" }}>● Closed</span>}
                    </td>
                    <td>
                      <div className={styles.cellActions}>
                        <button
                          className={`${styles.btnSmall} ${event.check_in_open ? styles.btnDanger : styles.btnComplete}`}
                          onClick={() => toggleCheckIn(event.id, event.check_in_open)}
                        >
                          {event.check_in_open ? "Close Check-in" : "Open Check-in"}
                        </button>
                        <button
                          className={styles.btnSmall}
                          style={{ background: expandedId === event.id ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)", color: "#f9f9f9", border: "1px solid rgba(255,255,255,0.15)" }}
                          onClick={() => viewAttendees(event.id)}
                        >
                          Attendees
                        </button>
                        <button className={styles.btnDanger} onClick={() => deleteEvent(event.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Live code row - shown when check-in is open */}
                  {event.check_in_open && liveCodes[event.id] && (
                    <tr key={`${event.id}-code`}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div className={panelStyles.codeRow}>
                          <div className={panelStyles.codeBlock}>
                            <span className={panelStyles.codeLabel}>Check-in Code</span>
                            <div className={panelStyles.codeDigitsRow}>
                              <span className={panelStyles.codeDigits}>
                                {liveCodes[event.id].code}
                              </span>
                              <button
                                className={panelStyles.enlargeBtn}
                                onClick={() => setEnlargedId(event.id)}
                                aria-label="Enlarge check-in code"
                                title="Enlarge for projecting"
                              >
                                <MagnifyingGlassIcon size={18} weight="bold" />
                              </button>
                            </div>
                          </div>
                          <div className={panelStyles.timerBlock}>
                            <span className={panelStyles.codeLabel}>Rotates in</span>
                            <span
                              className={panelStyles.timerDigits}
                              style={{ color: liveCodes[event.id].expiresIn <= 5 ? "#f87171" : "#f9f9f9" }}
                            >
                              {liveCodes[event.id].expiresIn}s
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Attendees row */}
                  {expandedId === event.id && (
                    <tr key={`${event.id}-att`}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div className={panelStyles.attendeeRow}>
                          <div className={panelStyles.attendeeHeader}>
                            <span>
                              {attendees[event.id]?.length ?? 0} attendee{attendees[event.id]?.length !== 1 ? "s" : ""}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              {sheetSync[event.id] === "synced" && (
                                <span style={{ color: "#4ade80", fontSize: "0.78rem" }}>Synced ✓</span>
                              )}
                              {sheetSync[event.id] === "failed" && (
                                <span style={{ color: "#f87171", fontSize: "0.78rem" }}>Sync failed</span>
                              )}
                              <button
                                className={styles.btnSecondary}
                                style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                                onClick={() => syncSheet(event.id)}
                                disabled={sheetSync[event.id] === "syncing"}
                              >
                                {sheetSync[event.id] === "syncing" ? "Syncing…" : "Sync to Sheet"}
                              </button>
                              <button
                                className={styles.btnSecondary}
                                style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                                onClick={() => setExpandedId(null)}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                          {!attendees[event.id]?.length ? (
                            <p className={panelStyles.attendeeEmpty}>No check-ins yet.</p>
                          ) : (
                            <div className={panelStyles.attendeeChips}>
                              {attendees[event.id].map(a => (
                                <span key={a.net_id} className={panelStyles.chip}>
                                  {a.net_id}
                                  <button
                                    className={panelStyles.chipRemove}
                                    onClick={() => removeAttendee(event.id, a.net_id)}
                                    aria-label={`Remove ${a.net_id}`}
                                    title="Remove attendee"
                                  >
                                    <X size={10} weight="bold" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <form
                            className={panelStyles.addAttendeeRow}
                            onSubmit={(e) => { e.preventDefault(); addAttendee(event.id); }}
                          >
                            <input
                              className={styles.searchBar}
                              style={{ flex: "0 1 220px" }}
                              list={`roster-${event.id}`}
                              placeholder="NetID to add…"
                              value={addInputs[event.id] || ""}
                              onChange={(e) => setAddInputs((prev) => ({ ...prev, [event.id]: e.target.value }))}
                            />
                            <datalist id={`roster-${event.id}`}>
                              {roster.map((p) => (
                                <option key={p.net_id} value={p.net_id}>{p.name}</option>
                              ))}
                            </datalist>
                            <button
                              type="submit"
                              className={styles.btnSecondary}
                              style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                              disabled={!addInputs[event.id]?.trim()}
                            >
                              Add
                            </button>
                          </form>
                          {addErrors[event.id] && (
                            <p className={panelStyles.addAttendeeError}>{addErrors[event.id]}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create event modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>New Event</h2>
            {formError && <div className={styles.alertError}>{formError}</div>}
            <div className={styles.formGroup}>
              <label>Title *</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Week 5 Guest Lecture"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional details…"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Presenter</label>
              <input
                value={form.presenter}
                onChange={e => setForm({ ...form, presenter: e.target.value })}
                placeholder="Speaker name (optional)"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Location</label>
              <input
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Siebel 1404"
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <div className={styles.formGroup} style={{ flex: "1 1 160px" }}>
                <label>Start Time</label>
                <input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={e => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className={styles.formGroup} style={{ flex: "1 1 160px" }}>
                <label>End Time <span style={{ color: "rgba(249,249,249,0.35)", fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={e => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleCreate} disabled={formLoading}>
                {formLoading ? "Creating…" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged check-in code, for projecting - closes itself if check-in
          closes (liveCodes entry disappears) or the event is deleted. */}
      {enlargedId && liveCodes[enlargedId] && (
        <div className={panelStyles.enlargeOverlay} onClick={() => setEnlargedId(null)}>
          <button
            className={panelStyles.enlargeCloseBtn}
            onClick={(e) => { e.stopPropagation(); setEnlargedId(null); }}
            aria-label="Close enlarged code"
          >
            <X size={28} weight="bold" />
          </button>
          <div className={panelStyles.enlargeContent} onClick={(e) => e.stopPropagation()}>
            <div className={panelStyles.enlargeEventTitle}>
              {events.find((e) => e.id === enlargedId)?.title}
            </div>
            <div className={panelStyles.enlargeLabel}>Check-in Code</div>
            <div className={panelStyles.enlargeDigits}>{liveCodes[enlargedId].code}</div>
            <div
              className={panelStyles.enlargeTimer}
              style={{ color: liveCodes[enlargedId].expiresIn <= 5 ? "#f87171" : "rgba(249,249,249,0.55)" }}
            >
              Rotates in {liveCodes[enlargedId].expiresIn}s
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
