"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import styles from "../../dashboard.module.css";
import checkInStyles from "../CheckIn.module.css";

export default function StudentAttendance() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState([]);
  const [checkedIn, setCheckedIn] = useState(new Set());
  const [codes, setCodes] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [feedback, setFeedback] = useState({});

  const fetchEvents = useCallback(async () => {
    const res = await fetch("/api/events");
    if (!res.ok) return;
    setEvents(await res.json());
  }, []);

  const fetchMyAttendance = useCallback(async () => {
    const res = await fetch("/api/events/my-checkins");
    if (!res.ok) return;
    const data = await res.json();
    setCheckedIn(new Set(data.map((r) => r.event_id)));
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchEvents();
      fetchMyAttendance();
    }
  }, [status, fetchEvents, fetchMyAttendance]);

  const handleCheckIn = async (eventId) => {
    const code = codes[eventId]?.trim();
    if (!code) return;
    setSubmitting((prev) => ({ ...prev, [eventId]: true }));
    setFeedback((prev) => ({ ...prev, [eventId]: null }));
    const res = await fetch(`/api/events/${eventId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    if (res.ok) {
      setFeedback((prev) => ({ ...prev, [eventId]: { ok: true, msg: `Checked in to "${json.event_title}"!` } }));
      setCheckedIn((prev) => new Set([...prev, eventId]));
      setCodes((prev) => ({ ...prev, [eventId]: "" }));
    } else {
      setFeedback((prev) => ({ ...prev, [eventId]: { ok: false, msg: json.error } }));
    }
    setSubmitting((prev) => ({ ...prev, [eventId]: false }));
  };

  const openEvents = events.filter((e) => e.check_in_open);
  const closedEvents = events.filter((e) => !e.check_in_open && checkedIn.has(e.id));

  if (status === "loading") return <div className={styles.loading}>Loading…</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Attendance</h1>
        <p>{checkedIn.size} event{checkedIn.size !== 1 ? "s" : ""} attended</p>
      </div>

      <div className={styles.panel}>
        {openEvents.length > 0 && (
          <div className={checkInStyles.section}>
            <h3 className={checkInStyles.sectionTitle}>Check-in Open Now</h3>
            <div className={checkInStyles.eventList}>
              {openEvents.map((event) => {
                const alreadyIn = checkedIn.has(event.id);
                const fb = feedback[event.id];
                return (
                  <div key={event.id} className={checkInStyles.eventCard}>
                    <div className={checkInStyles.eventMeta}>
                      <span className={checkInStyles.eventTitle}>{event.title}</span>
                      {event.presenter && (
                        <span className={checkInStyles.eventDetail}>Presenter: {event.presenter}</span>
                      )}
                      {event.location && (
                        <span className={checkInStyles.eventDetail}>Location: {event.location}</span>
                      )}
                    </div>
                    {alreadyIn ? (
                      <div className={checkInStyles.alreadyIn}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: "0.4rem" }}>
                          <circle cx="8" cy="8" r="7" stroke="#4ade80" strokeWidth="1.5" />
                          <path d="M5 8l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Checked in
                      </div>
                    ) : (
                      <div className={checkInStyles.codeEntry}>
                        <input
                          className={checkInStyles.codeInput}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          value={codes[event.id] ?? ""}
                          onChange={(e) =>
                            setCodes((prev) => ({
                              ...prev,
                              [event.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                            }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && handleCheckIn(event.id)}
                        />
                        <button
                          className={checkInStyles.codeSubmit}
                          onClick={() => handleCheckIn(event.id)}
                          disabled={submitting[event.id] || (codes[event.id] ?? "").length < 6}
                        >
                          {submitting[event.id] ? "…" : "Check In"}
                        </button>
                      </div>
                    )}
                    {fb && (
                      <div className={fb.ok ? checkInStyles.feedbackOk : checkInStyles.feedbackErr}>
                        {fb.msg}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {closedEvents.length > 0 && (
          <div className={checkInStyles.section}>
            <h3 className={checkInStyles.sectionTitle}>Past Attendance</h3>
            <div className={checkInStyles.eventList}>
              {closedEvents.map((event) => (
                <div key={event.id} className={`${checkInStyles.eventCard} ${checkInStyles.pastCard}`}>
                  <div className={checkInStyles.eventMeta}>
                    <span className={checkInStyles.eventTitle}>{event.title}</span>
                    {event.start_time && (
                      <span className={checkInStyles.eventDetail}>
                        {new Date(event.start_time).toLocaleDateString([], { dateStyle: "medium" })}
                      </span>
                    )}
                  </div>
                  <div className={checkInStyles.alreadyIn}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: "0.4rem" }}>
                      <circle cx="8" cy="8" r="7" stroke="#4ade80" strokeWidth="1.5" />
                      <path d="M5 8l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Attended
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {openEvents.length === 0 && closedEvents.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📅</span>
            No events available right now.
          </div>
        )}
      </div>
    </div>
  );
}
