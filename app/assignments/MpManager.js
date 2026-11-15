"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { courseTimeToISO, isoToCourseParts } from "../../lib/courseTime";
import styles from "./Assignments.module.css";

const EMPTY = { id: null, plId: "", name: "", prairielearn_url: "", openDay: "", openTime: "00:00", dueDay: "", dueTime: "23:59" };

const describe = (iso) => {
  if (!iso) return "Open now";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
};

/**
 * Course leads and head PMs add, edit, and remove MPs here. Picking the MP
 * from the PrairieLearn list fills in its name and link, so only the dates
 * need typing. Times are Chicago time.
 */
export default function MpManager() {
  const router = useRouter();
  const [mps, setMps] = useState([]);
  const [prairieLearn, setPrairieLearn] = useState([]);
  const [form, setForm] = useState(null); // null = closed
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [mine, pl] = await Promise.all([fetch("/api/mps").catch(() => null), fetch("/api/mps/prairielearn").catch(() => null)]);
    if (mine?.ok) setMps(await mine.json());
    if (pl?.ok) setPrairieLearn(await pl.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const pick = (plId) => {
    const match = prairieLearn.find((a) => a.id === plId);
    set(match ? { plId, name: match.title, prairielearn_url: match.url } : { plId: "" });
  };
  const edit = (mp) => {
    const open = mp.release_at ? isoToCourseParts(mp.release_at) : { day: "", time: "00:00" };
    const due = isoToCourseParts(mp.due_at);
    const plId = prairieLearn.find((a) => a.url === mp.prairielearn_url)?.id || "";
    setError("");
    setForm({ id: mp.id, plId, name: mp.name, prairielearn_url: mp.prairielearn_url || "", openDay: open.day, openTime: open.time, dueDay: due.day, dueTime: due.time });
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Give the MP a name.");
    if (!form.dueDay) return setError("Choose the due date.");
    const body = {
      name: form.name.trim(),
      prairielearn_url: form.prairielearn_url.trim() || null,
      release_at: form.openDay ? courseTimeToISO(form.openDay, form.openTime || "00:00") : null,
      due_at: courseTimeToISO(form.dueDay, form.dueTime || "23:59"),
    };
    setSaving(true);
    const res = await fetch(form.id ? `/api/mps/${form.id}` : "/api/mps", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError((await res?.json().catch(() => null))?.error || "The MP could not be saved. Try again.");
    setForm(null);
    await load();
    router.refresh();
  };

  const remove = async (mp) => {
    if (!window.confirm(`Remove MP ${mp.name} from the site? This doesn't change anything on PrairieLearn.`)) return;
    const res = await fetch(`/api/mps/${mp.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("The MP could not be removed. Try again.");
    await load();
    router.refresh();
  };

  return (
    <section id="manage-mps" className={styles.tool} aria-labelledby="manage-mps-heading">
      <div className={styles.toolHead}>
        <div>
          <h2 id="manage-mps-heading">Manage MPs</h2>
          <p className={styles.toolLede}>MPs show on the home page, the schedule, and here, from when they open until they&apos;re due. Times are Chicago time.</p>
        </div>
        {!form && <button type="button" className="btn btnPrimary" onClick={() => { setError(""); setForm(EMPTY); }}>Add MP</button>}
      </div>

      {error && <p className={styles.formError} role="alert">{error}</p>}

      {form && (
        <form className={styles.mpForm} onSubmit={save} aria-label={form.id ? "Edit MP" : "Add MP"}>
          {prairieLearn.length > 0 && (
            <label className={styles.field}>
              <span>MP on PrairieLearn</span>
              <select value={form.plId} onChange={(e) => pick(e.target.value)}>
                <option value="">Not on PrairieLearn, or choose one</option>
                {prairieLearn.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.label})</option>)}
              </select>
            </label>
          )}
          <label className={styles.field}>
            <span>Name</span>
            <input value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. NeuralNet" required />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field}><span>Opens <em>(blank = open now)</em></span><input type="date" value={form.openDay} onChange={(e) => set({ openDay: e.target.value })} /></label>
            <label className={styles.field}><span>at</span><input type="time" value={form.openTime} onChange={(e) => set({ openTime: e.target.value })} /></label>
            <label className={styles.field}><span>Due</span><input type="date" value={form.dueDay} onChange={(e) => set({ dueDay: e.target.value })} required /></label>
            <label className={styles.field}><span>at</span><input type="time" value={form.dueTime} onChange={(e) => set({ dueTime: e.target.value })} required /></label>
          </div>
          <label className={styles.field}>
            <span>PrairieLearn link <em>(optional)</em></span>
            <input value={form.prairielearn_url} onChange={(e) => set({ prairielearn_url: e.target.value, plId: "" })} placeholder="https://us.prairielearn.com/…" />
          </label>
          <div className={styles.formActions}>
            <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" className="btn btnPrimary" disabled={saving}>{saving ? "Saving…" : form.id ? "Save MP" : "Add MP"}</button>
          </div>
        </form>
      )}

      {mps.length > 0 ? (
        <ul className={styles.list}>
          {mps.map((mp) => (
            <li key={mp.id}>
              <div className={styles.main}>
                <h3>MP {mp.name}</h3>
                <p className={styles.meta}>Opens {describe(mp.release_at)}. Due {describe(mp.due_at)}.{mp.prairielearn_url ? "" : " No PrairieLearn link."}</p>
              </div>
              <div className={styles.rowActions}>
                <button type="button" className={styles.textButton} onClick={() => edit(mp)}>Edit</button>
                <button type="button" className={`${styles.textButton} ${styles.danger}`} onClick={() => remove(mp)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No MPs yet. Add the first one when it&apos;s posted on PrairieLearn.</p>
      )}
    </section>
  );
}
