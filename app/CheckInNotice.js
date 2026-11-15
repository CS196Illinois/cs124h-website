"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import styles from "./home.module.css";

/** "Check-in is open for X" on the home page, for events the viewer can still check in to. */
export default function CheckInNotice() {
  const { status } = useSession();
  const [open, setOpen] = useState([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let live = true;
    (async () => {
      const [eventsRes, mineRes] = await Promise.all([fetch("/api/events?scope=checkin"), fetch("/api/events/my-checkins")]).catch(() => []);
      if (!live || !eventsRes?.ok || !mineRes?.ok) return;
      const [events, mine] = await Promise.all([eventsRes.json(), mineRes.json()]);
      const done = new Set(mine.map((row) => row.event_id));
      setOpen(events.filter((event) => event.check_in_open && !done.has(event.id)));
    })();
    return () => { live = false; };
  }, [status]);

  if (!open.length) return null;
  const names = open.map((event) => event.title).join(", ");
  return (
    <p className={styles.notice} role="status">
      <span>Check-in is open for <strong>{names}</strong>.</span>
      <Link href={open.length === 1 ? `/checkin?event=${open[0].id}` : "/checkin"} className="btn btnPrimary">Check in</Link>
    </p>
  );
}
