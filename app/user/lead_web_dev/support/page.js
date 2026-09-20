"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import ticketStyles from "../../components/CompletedItems.module.css";
import { formatLocalDate } from "../../../../lib/dateFormat";

export default function SupportInbox() {
  const [tickets, setTickets] = useState([]);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState({});
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/support?offset=${offset}`);
      if (!response.ok) throw new Error("Support tickets could not be loaded. Please try again.");
      setTickets(await response.json());
    } catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }, [offset]);
  useEffect(() => { load(); }, [load]);

  async function update(id, body) {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
      if (data.notification === "pending") setError("The ticket is saved, but email delivery is still pending. Check the SMTP configuration and assigned lead web developer, then retry.");
    } catch (error) { setError(error.message || "The update failed."); }
    finally { setBusy(null); }
  }
  async function showAttachments(id) {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/support/${id}`);
      if (!response.ok) throw new Error("Screenshots could not be loaded.");
      const data = await response.json();
      setAttachments((previous) => ({ ...previous, [id]: data.attachments }));
    } catch (error) { setError(error.message); }
    finally { setBusy(null); }
  }

  return <div className={styles.container}>
    <div className={styles.header}><h1>Support Tickets</h1><p>Student reports submitted through the public support form. Names and NetIDs are self-reported.</p></div>
    <div className={ticketStyles.section}>
      <div className={ticketStyles.toolbar}><label>Show on this page<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All tickets</option><option value="open">Open</option><option value="resolved">Resolved</option></select></label><button className={styles.btnSecondary} onClick={load}>Refresh</button></div>
      {error && <p role="alert">{error}</p>}
      {loading ? <p>Loading tickets…</p> : tickets.filter((ticket) => filter === "all" || ticket.status === filter).length === 0 ? <p>No tickets to show.</p> : tickets.filter((ticket) => filter === "all" || ticket.status === filter).map((ticket) => <article className={ticketStyles.assignment} key={ticket.id}>
        <div className={ticketStyles.summary}><div><h2>{ticket.subject}</h2><p className={ticketStyles.muted}>{ticket.full_name} · {ticket.net_id} · {formatLocalDate(ticket.created_at)} · {ticket.category}</p></div><span className={ticketStyles.pending}>{ticket.status}</span></div>
        <div className={ticketStyles.details}>
          <p>{ticket.description}</p><p className={ticketStyles.muted}>Reference: {ticket.id}<br />Email notification: {ticket.notification_status}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", alignItems: "center" }}>
            <a className={styles.btnSecondary} href={`mailto:${ticket.net_id}@illinois.edu?subject=${encodeURIComponent(`Re: [CS 124H Support #${ticket.id.slice(0, 8)}] ${ticket.subject}`)}`}>Reply by email</a>
            <button disabled={busy === ticket.id} onClick={() => update(ticket.id, { status: ticket.status === "open" ? "resolved" : "open" })}>{ticket.status === "open" ? "Resolve ticket" : "Reopen ticket"}</button>
            {ticket.notification_status !== "sent" && <button disabled={busy === ticket.id} onClick={() => update(ticket.id, { retry_notification: true })}>Retry email notification</button>}
            <button disabled={busy === ticket.id} onClick={() => showAttachments(ticket.id)}>View screenshots</button>
          </div>
          {attachments[ticket.id]?.length === 0 && <p>No screenshots attached.</p>}
          {attachments[ticket.id]?.map((file) => <a key={file.filename} download={file.filename} href={`data:${file.contentType};base64,${file.content}`}><img style={{ maxWidth: "100%", maxHeight: 350, marginTop: "1rem", objectFit: "contain" }} src={`data:${file.contentType};base64,${file.content}`} alt={file.filename} /></a>)}
        </div>
      </article>)}
      <div style={{ display: "flex", gap: "1rem" }}><button className={styles.btnSecondary} disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - 50))}>Previous page</button><button className={styles.btnSecondary} disabled={tickets.length < 50 || loading} onClick={() => setOffset((value) => value + 50)}>Next page</button></div>
    </div>
  </div>;
}
