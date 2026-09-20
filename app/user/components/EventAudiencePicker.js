"use client";

import { useState } from "react";
import { ALL_ROLES } from "../../../lib/roles";
import { audienceMatches } from "../../../lib/eventAudience";
import styles from "./EventAudiencePicker.module.css";

export default function EventAudiencePicker({ value, onChange, roster, groupNumber }) {
  const [mode, setMode] = useState(value.audience_type === "groups" && groupNumber != null && value.audience_values.length === 1 && value.audience_values[0] === String(groupNumber) ? "my-group" : value.audience_type);
  const [search, setSearch] = useState("");
  const choices = [
    { id: "my-group", title: groupNumber == null ? "My group" : `My group · Group ${groupNumber}`, hint: groupNumber == null ? "No group is assigned to your account." : "Students and staff assigned to your group.", disabled: groupNumber == null },
    { id: "groups", title: "Choose groups", hint: "Invite one or more project groups." },
    { id: "people", title: "Choose people", hint: "Search for names or NetIDs." },
    { id: "roles", title: "Choose roles", hint: "For example, all PMs or all students." },
    { id: "all", title: "Everyone in the course", hint: "Anyone enrolled can join." },
  ];
  const selected = value.audience_values;
  const toggle = (key) => onChange({ audience_type: mode, audience_values: selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key] });
  const options = mode === "roles" ? ALL_ROLES.map((role) => [role.id, role.label])
    : mode === "groups" ? [...new Set(roster.map((person) => person.group_number).filter((group) => group != null))].sort((a, b) => a - b).map((group) => [String(group), `Group ${group} · ${roster.filter((person) => person.group_number === group).length} people`])
    : roster.filter((person) => `${person.name || ""} ${person.net_id}`.toLowerCase().includes(search.toLowerCase())).map((person) => [person.net_id, person.name ? `${person.name} (${person.net_id})` : person.net_id]);
  const count = roster.filter((person) => audienceMatches(value, { netID: person.net_id, role: person.role, groupNumber: person.group_number })).length;

  return <fieldset className={styles.picker}>
    <legend>Who is this event for?</legend>
    <p className={styles.hint}>Only the audience you choose can join when you open check-in.</p>
    <div className={styles.choices}>{choices.map((choice) => <label key={choice.id} className={`${styles.choice} ${mode === choice.id ? styles.selected : ""}`}>
      <input type="radio" name="event-audience" value={choice.id} checked={mode === choice.id} disabled={choice.disabled} onChange={() => {
        setMode(choice.id); setSearch("");
        onChange({ audience_type: choice.id === "my-group" ? "groups" : choice.id, audience_values: choice.id === "my-group" ? [String(groupNumber)] : [] });
      }} />
      <span><strong>{choice.title}</strong><small>{choice.hint}</small></span>
    </label>)}</div>
    {["groups", "people", "roles"].includes(mode) && <div className={styles.selection}>
      {mode === "people" && <label className={styles.search}>Find people<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or NetID" /></label>}
      <p className={styles.hint}>{selected.length} selected</p>
      <div className={styles.options}>{options.map(([key, label]) => <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} />{label}</label>)}</div>
      {!options.length && <p className={styles.hint}>No matches. Try another name or NetID.</p>}
    </div>}
    <p className={styles.preview} role="status">{mode !== "all" && selected.length === 0 ? "Choose at least one audience member before creating the event." : `${count} ${count === 1 ? "person" : "people"} can join${mode === "my-group" ? ` · Group ${groupNumber} only` : mode === "all" ? " · Course-wide event" : ""}.`}</p>
  </fieldset>;
}
