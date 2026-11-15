"use client";

import { useState } from "react";
import styles from "./EventAudiencePicker.module.css";

// Staff (besides the creator) who can run this event's check-in.
export default function EventHostsPicker({ value, onChange, roster, creator }) {
  const [search, setSearch] = useState("");
  const staff = roster.filter((person) => person.role && String(person.role).toUpperCase() !== "STUDENT" && person.net_id !== creator);
  const matches = staff.filter((person) => `${person.name || ""} ${person.net_id}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (netID) => onChange(value.includes(netID) ? value.filter((item) => item !== netID) : [...value, netID]);

  return <fieldset className={styles.picker}>
    <legend>Hosts</legend>
    <p className={styles.hint}>Hosts can open and close check-in, show the code, and manage attendees. Course leads can always do this. Only you can edit or delete the event.</p>
    <label className={styles.search}>Find staff<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or NetID" /></label>
    <p className={styles.hint}>{value.length} selected</p>
    <div className={styles.options}>{matches.map((person) => <label key={person.net_id}><input type="checkbox" checked={value.includes(person.net_id)} onChange={() => toggle(person.net_id)} />{person.name ? `${person.name} (${person.net_id})` : person.net_id}</label>)}</div>
    {!matches.length && <p className={styles.hint}>No matches. Try another name or NetID.</p>}
  </fieldset>;
}
