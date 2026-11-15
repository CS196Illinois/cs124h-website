"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_CATEGORIES } from "../../lib/eventCategories";
import styles from "./EventForm.module.css";

const TIME_ZONE = "America/Chicago";

/** "2026-11-18" + "17:30" in course time → ISO timestamp. */
function courseTimeToISO(day, time) {
  const guess = Date.parse(`${day}T${time}:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(guess)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offset = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(guess - offset * 60_000).toISOString();
}

const addMinutes = (time, minutes) => {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Who an event is for. Presets cover what PMs and leads create day to day;
 * finer audiences (specific people, several groups) are set from Events.
 */
function audienceOptions(groupNumber) {
  return [
    ...(groupNumber != null ? [{ id: "group", label: `My group (Group ${groupNumber})`, audience_type: "groups", audience_values: [String(groupNumber)] }] : []),
    { id: "students", label: "All students", audience_type: "roles", audience_values: ["STUDENT"] },
    { id: "everyone", label: "Everyone in the course", audience_type: "all", audience_values: [] },
    { id: "staff", label: "Staff only", audience_type: "roles", audience_values: ["LEAD", "LEAD_WEB", "HEAD", "PM"] },
  ];
}

// The audience a category usually goes with, until the person picks one.
const AUDIENCE_FOR_CATEGORY = { workshop: "students", info_session: "students", presentation: "everyone", social: "everyone", group_meeting: "group", staff_meeting: "staff", other: "students" };

export default function EventForm({ day, viewer, onClose, onCreated }) {
  const options = audienceOptions(viewer.groupNumber);
  const pick = (id) => options.find((o) => o.id === id) || options[0];
  const isPm = viewer.role === "pm";
  const initialCategory = isPm && viewer.groupNumber != null ? "group_meeting" : "workshop";

  const [form, setForm] = useState({
    title: "",
    category: initialCategory,
    audience: pick(AUDIENCE_FOR_CATEGORY[initialCategory]).id,
    day,
    start: "17:30",
    end: "18:30",
    location: "",
    presenter: "",
    repeat: false,
    until: "",
  });
  const [audienceTouched, setAudienceTouched] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setCategory = (category) => set({ category, ...(audienceTouched ? {} : { audience: pick(AUDIENCE_FOR_CATEGORY[category]).id }) });
  const setStart = (start) => set({ start, end: form.end > start ? form.end : addMinutes(start, 60) });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Give the event a title.");
    if (form.end <= form.start) return setError("The end time must be after the start time.");
    if (form.repeat && (!form.until || form.until < form.day)) return setError("Choose the date of the last repeat, on or after the first event.");
    const audience = pick(form.audience);
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          location: form.location.trim() || null,
          presenter: form.presenter.trim() || null,
          start_time: courseTimeToISO(form.day, form.start),
          end_time: courseTimeToISO(form.day, form.end),
          audience_type: audience.audience_type,
          audience_values: audience.audience_values,
          ...(form.repeat ? { repeat_weekly_until: form.until } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error || "The event could not be created. Try again.");
      onCreated(json.series_count > 1 ? `Created ${json.series_count} weekly events.` : "Event created.");
    } catch {
      setError("The event could not be created. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="event-form-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className={styles.head}>
          <h2 id="event-form-title">New event</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <label className={styles.field}>
          <span>Title</span>
          <input ref={titleRef} value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Weekly group meeting" required />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Category</span>
            <select value={form.category} onChange={(e) => setCategory(e.target.value)}>
              {EVENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Who it&apos;s for</span>
            <select value={form.audience} onChange={(e) => { setAudienceTouched(true); set({ audience: e.target.value }); }}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.row3}>
          <label className={styles.field}>
            <span>Date</span>
            <input type="date" value={form.day} onChange={(e) => set({ day: e.target.value })} required />
          </label>
          <label className={styles.field}>
            <span>Starts</span>
            <input type="time" value={form.start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span>Ends</span>
            <input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} required />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Where <em>(optional)</em></span>
            <input value={form.location} maxLength={120} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Siebel CS 2406" />
          </label>
          <label className={styles.field}>
            <span>Presenter <em>(optional)</em></span>
            <input value={form.presenter} maxLength={120} onChange={(e) => set({ presenter: e.target.value })} />
          </label>
        </div>

        <div className={styles.repeat}>
          <label className={styles.check}>
            <input type="checkbox" checked={form.repeat} onChange={(e) => set({ repeat: e.target.checked })} />
            <span>Repeat every week</span>
          </label>
          {form.repeat && (
            <label className={styles.inline}>
              <span>until</span>
              <input type="date" value={form.until} min={form.day} onChange={(e) => set({ until: e.target.value })} required />
            </label>
          )}
        </div>
        {form.repeat && <p className={styles.hint}>Each week gets its own event with its own check-in.</p>}

        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btnPrimary" disabled={saving}>{saving ? "Creating…" : form.repeat ? "Create events" : "Create event"}</button>
        </div>
      </form>
    </div>
  );
}
