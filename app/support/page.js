"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { SUPPORT_CATEGORIES, SUPPORT_MAX_BYTES, SUPPORT_MAX_FILES, SUPPORT_TYPES } from "../../lib/support";
import styles from "./Support.module.css";

export default function SupportPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [files, setFiles] = useState([]);
  const requestID = useRef(null);
  const inFlight = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (files.length > SUPPORT_MAX_FILES || files.reduce((total, file) => total + file.size, 0) > SUPPORT_MAX_BYTES) {
      setError("Attach up to 3 screenshots totaling at most 3 MB."); return;
    }
    if (files.some((file) => !SUPPORT_TYPES.includes(file.type))) { setError("Choose PNG, JPEG, or WebP screenshots."); return; }
    const form = new FormData(event.currentTarget);
    requestID.current ||= crypto.randomUUID();
    form.set("request_id", requestID.current);
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/support", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your ticket could not be submitted. Please try again.");
      setReceipt(data);
    } catch (error) { setError(error.message || "Check your connection and try again. Your form is still here."); }
    finally { setBusy(false); inFlight.current = false; }
  }

  return <main className={styles.page}><div className={styles.card}>
    <p className={styles.eyebrow}>CS 124H · Support</p>
    <h1>{receipt ? "Your ticket is saved" : "How can we help?"}</h1>
    {receipt ? <>
      <p role="status">Your reference number is <strong>{receipt.id}</strong>. Keep it for follow-up.</p>
      <p>{receipt.notification === "sent" ? "The lead web developer has been notified." : "Your report is in the lead web developer’s support inbox. Email notification is pending."} We can reply to your Illinois email address.</p>
      <Link href="/">Back to the course website</Link>
    </> : <>
      <p>Report a login problem, ask about the website, or tell us what isn’t working. You don’t need to sign in.</p>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.row}>
          <label className={styles.field}>Full name<input name="full_name" autoComplete="name" required minLength={2} maxLength={120} /></label>
          <div className={styles.field}><label htmlFor="support-netid">NetID</label><input id="support-netid" name="net_id" autoComplete="username" required pattern="[A-Za-z][A-Za-z0-9]{1,15}" maxLength={16} aria-describedby="netid-hint" /><span id="netid-hint" className={styles.hint}>Without @illinois.edu. We’ll reply to your Illinois email.</span></div>
        </div>
        <label className={styles.field}>Issue category<select name="category" defaultValue="Login / access">{SUPPORT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className={styles.field}>Subject<input name="subject" required minLength={3} maxLength={160} placeholder="A short summary of your issue" /></label>
        <label className={styles.field}>What happened?<textarea name="description" required minLength={10} maxLength={10000} rows={6} placeholder="What were you trying to do? What happened instead? For login issues, include your browser and device if you know them." /></label>
        <div className={styles.field}><label htmlFor="support-screenshots">Screenshots (optional)</label><input id="support-screenshots" name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} aria-describedby="screenshot-hint" /><span id="screenshot-hint" className={styles.hint}>Up to 3 PNG, JPEG, or WebP images, 3 MB total. Remove passwords or other sensitive information before uploading.</span></div>
        {files.length > 0 && <p className={styles.hint}>{files.length} selected · {(files.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(2)} MB</p>}
        <div className={styles.trap} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        {error && <p role="alert" className={styles.notice}>{error}</p>}
        <p className={styles.hint}>Your report and screenshots are shared privately with the lead web developer.</p>
        <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Submitting your ticket…" : "Submit support ticket"}</button>
      </form>
    </>}
  </div></main>;
}
