"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EventForm from "./EventForm";
import styles from "./Schedule.module.css";

const DAY_MS = 86_400_000;
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const fmt = (day, opts) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

/**
 * Horizontal timeline: one column per day, rows for sprints, MPs, and events.
 * Opens scrolled to today. Selecting anything shows its details underneath.
 */
export default function Timeline({ data, viewer }) {
  const { start, days, today, sprints, mps, events } = data;
  const router = useRouter();
  const canCreate = Boolean(viewer?.canCreate);
  const [formDay, setFormDay] = useState(null); // open the new-event form on this day
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  const todayCell = useRef(null);

  const col = (day) => Math.min(Math.max(daysBetween(start, day), 0), days - 1) + 2; // column 1 is the row label
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);

  // Months across the top: one cell per run of days in the same month.
  const months = useMemo(() => {
    const runs = [];
    dayList.forEach((day, i) => {
      const key = day.slice(0, 7);
      if (runs.at(-1)?.key === key) runs.at(-1).span += 1;
      else runs.push({ key, first: i, span: 1, label: fmt(day, { month: "long" }) });
    });
    return runs;
  }, [dayList]);

  // Events on the same day stack in lanes.
  const placedEvents = useMemo(() => {
    const perDay = {};
    return events.map((e) => {
      const lane = (perDay[e.day] = (perDay[e.day] ?? -1) + 1);
      return { ...e, lane };
    });
  }, [events]);
  const eventLanes = Math.max(1, ...placedEvents.map((e) => e.lane + 1));

  // Default selection: the next thing coming up, so the panel is never empty.
  const initial = useMemo(() => {
    const next = events.find((e) => e.day >= today);
    if (next) return { kind: "event", ...next };
    const sprint = sprints.find((s) => s.start <= today && today <= s.end);
    return sprint ? { kind: "sprint", title: sprint.label, detail: sprint.detail, href: sprint.href } : null;
  }, [events, sprints, today]);
  const [selected, setSelected] = useState(initial);

  const jumpToToday = (behavior = "smooth") => {
    const el = scroller.current;
    const cell = todayCell.current;
    if (!el || !cell) return;
    el.scrollTo({ left: Math.max(0, cell.offsetLeft - el.clientWidth * 0.3), behavior });
  };
  useEffect(() => { jumpToToday("instant"); }, []);

  const removeEvent = async (event, series) => {
    const what = series ? "every event in this weekly series" : `"${event.title}"`;
    if (!window.confirm(`Delete ${what}? Check-ins recorded for ${series ? "them" : "it"} are removed too.`)) return;
    setBusy(true);
    const res = await fetch(`/api/events/${event.id}${series ? "?series=all" : ""}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setStatus("The event could not be deleted. Try again.");
    setSelected(null);
    setStatus(series ? "Series deleted." : "Event deleted.");
    router.refresh();
  };

  const todayInRange = today >= start && daysBetween(start, today) < days;
  // Grid rows: 1 months, 2 days, 3 sprints, 4 MPs, then one per event lane.
  const eventRow = 5;
  const lastRow = eventRow + eventLanes;

  return (
    <div className={styles.timelineWrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarActions}>
          <button type="button" className="btn" onClick={() => jumpToToday()} disabled={!todayInRange}>Jump to today</button>
          {canCreate && <button type="button" className="btn btnPrimary" onClick={() => setFormDay(today)}>Add event</button>}
          {status && <span className={styles.status} role="status">{status}</span>}
        </div>
        <ul className={styles.legend} aria-label="Legend">
          <li><span className={styles.keySprint} /> Sprint</li>
          <li><span className={styles.keyMp} /> MP</li>
          <li><span className={styles.keyEvent} /> Event</li>
        </ul>
      </div>

      <div className={styles.scroller} ref={scroller}>
        <div className={styles.grid} style={{ "--days": days, gridTemplateRows: `auto auto repeat(${2 + eventLanes}, auto)` }}>
          <div className={styles.corner} style={{ gridRow: "1 / 3" }} />
          {months.map((m) => (
            <div key={m.key} className={styles.month} style={{ gridColumn: `${m.first + 2} / span ${m.span}`, gridRow: 1 }}>
              <span>{m.label}</span>
            </div>
          ))}
          {dayList.map((day, i) => {
            const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
            const isToday = day === today;
            const cls = `${weekday === 0 || weekday === 6 ? styles.weekend : ""} ${weekday === 1 ? styles.monday : ""} ${isToday ? styles.today : ""}`;
            return [
              <div key={`h-${day}`} ref={isToday ? todayCell : undefined} className={`${styles.dayHead} ${cls}`} style={{ gridColumn: i + 2, gridRow: 2 }}>
                <span>{fmt(day, { weekday: "narrow" })}</span>
                <strong>{fmt(day, { day: "numeric" })}</strong>
              </div>,
              <div
                key={`c-${day}`}
                className={`${styles.dayCol} ${cls} ${canCreate ? styles.addable : ""}`}
                style={{ gridColumn: i + 2, gridRow: `3 / ${lastRow}` }}
                aria-hidden="true"
                title={canCreate ? `Add an event on ${fmt(day, { weekday: "long", month: "short", day: "numeric" })}` : undefined}
                onClick={canCreate ? () => setFormDay(day) : undefined}
              />,
            ];
          })}

          <div className={styles.rowLabel} style={{ gridRow: 3 }}>Sprints</div>
          <div className={styles.rowLabel} style={{ gridRow: 4 }}>MPs</div>
          <div className={styles.rowLabel} style={{ gridRow: `${eventRow} / ${lastRow}` }}>Events</div>

          {sprints.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className={`${styles.bar} ${styles.sprintBar}`}
              style={{ gridColumn: `${col(s.start)} / ${col(s.end) + 1}`, gridRow: 3 }}
              onMouseEnter={() => setSelected({ kind: "sprint", title: s.label, detail: s.detail, href: s.href })}
              onFocus={() => setSelected({ kind: "sprint", title: s.label, detail: s.detail, href: s.href })}
            >
              <span>{s.label}</span>
            </Link>
          ))}

          {mps.map((m) => {
            const select = () => setSelected({ kind: "mp", title: m.label, detail: m.detail, href: m.href, external: m.external });
            const props = m.external ? { href: m.href, target: "_blank", rel: "noopener noreferrer" } : { href: m.href };
            return m.start ? (
              <a key={m.id} {...props} className={`${styles.bar} ${styles.mpBar}`} style={{ gridColumn: `${col(m.start)} / ${col(m.due) + 1}`, gridRow: 4 }} onMouseEnter={select} onFocus={select}>
                <span>{m.label}</span>
              </a>
            ) : (
              // Release date unknown: mark only the due date, label to its left.
              <a key={m.id} {...props} className={styles.due} style={{ gridColumn: `${Math.max(2, col(m.due) - 6)} / ${col(m.due) + 1}`, gridRow: 4 }} onMouseEnter={select} onFocus={select}>
                <span>{m.label} due</span>
                <i aria-hidden="true" />
              </a>
            );
          })}

          {placedEvents.map((e) => (
            <button
              key={e.id}
              type="button"
              className={styles.event}
              style={{ gridColumn: col(e.day), gridRow: eventRow + e.lane }}
              aria-label={`${e.title} (${e.category}), ${e.detail}`}
              title={e.title}
              onMouseEnter={() => setSelected({ kind: "event", ...e })}
              onFocus={() => setSelected({ kind: "event", ...e })}
              onClick={() => setSelected({ kind: "event", ...e })}
            />
          ))}
        </div>
      </div>

      <div className={styles.selected} aria-live="polite">
        {selected ? (
          <>
            <strong>{selected.title}</strong>
            {selected.category && <span className={styles.categoryTag}>{selected.category}</span>}
            <span>{selected.detail}</span>
            {selected.kind === "event" && selected.canManage && (
              <span className={styles.manage}>
                <button type="button" className={styles.linkButton} disabled={busy} onClick={() => removeEvent(selected, false)}>Delete</button>
                {selected.inSeries && <button type="button" className={styles.linkButton} disabled={busy} onClick={() => removeEvent(selected, true)}>Delete whole series</button>}
              </span>
            )}
            {selected.href && (
              selected.external
                ? <a href={selected.href} target="_blank" rel="noopener noreferrer">Open on PrairieLearn</a>
                : <Link href={selected.href}>Details</Link>
            )}
          </>
        ) : (
          <span>{canCreate ? "Select anything to see its details, or click a day to add an event." : "Select anything on the timeline to see its details."}</span>
        )}
      </div>

      {formDay && (
        <EventForm
          day={formDay}
          viewer={viewer}
          onClose={() => setFormDay(null)}
          onCreated={(message) => { setFormDay(null); setStatus(message); router.refresh(); }}
        />
      )}
    </div>
  );
}
