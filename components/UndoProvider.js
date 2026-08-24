"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import styles from "./UndoToast.module.css";

/**
 * Deferred-execution undo for destructive actions (deletes, revokes, bulk
 * removals). The caller optimistically removes something from its own UI
 * state immediately, then calls scheduleUndo() instead of firing the real
 * request right away:
 *
 *   setItems(prev => prev.filter(i => i.id !== item.id));
 *   scheduleUndo({
 *     message: `Deleted "${item.title}"`,
 *     onExpire: () => fetch(`/api/action_items/${item.id}`, { method: "DELETE" }),
 *     onCancel: () => setItems(prev => [...prev, item]),
 *   });
 *
 * If the user clicks Undo before the countdown ends, onCancel() restores the
 * UI and the real request is never sent - the action never happened. If the
 * countdown runs out, onExpire() fires the real request. Mounted at the root
 * layout so the toast (and its timer) survive client-side navigation between
 * pages; only a hard reload/close loses a pending undo, which is the safe
 * failure mode - the item just never actually got deleted.
 */
const UndoContext = createContext(null);

const DEFAULT_DURATION_MS = 8000;

export function UndoProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    delete timers.current[id];
  }, []);

  const scheduleUndo = useCallback(({ message, duration = DEFAULT_DURATION_MS, onExpire, onCancel }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const timeoutId = setTimeout(async () => {
      remove(id);
      try {
        const result = await onExpire();
        // Every call site's onExpire is `() => fetch(...)`, so the resolved
        // value is a Response - a non-2xx here (e.g. a permission check that
        // only the server can make, like deleting someone else's event)
        // means the action never actually happened server-side, so treat it
        // like any other failure and put the UI back the way it was.
        if (result && typeof result.ok === "boolean" && !result.ok) {
          throw new Error(`Request failed (${result.status})`);
        }
      } catch (err) {
        console.error("[undo] failed to commit action, restoring:", err);
        onCancel();
      }
    }, duration);

    timers.current[id] = { timeoutId, onCancel };
    setEntries((prev) => [...prev, { id, message, duration }]);
    return id;
  }, [remove]);

  const cancelUndo = useCallback((id) => {
    const entry = timers.current[id];
    if (!entry) return;
    clearTimeout(entry.timeoutId);
    remove(id);
    entry.onCancel();
  }, [remove]);

  return (
    <UndoContext.Provider value={{ scheduleUndo }}>
      {children}
      {entries.length > 0 && (
        <div className={styles.stack}>
          {entries.map((e) => (
            <div key={e.id} className={styles.toast}>
              <span className={styles.message}>{e.message}</span>
              <button className={styles.undoBtn} onClick={() => cancelUndo(e.id)}>
                Undo
              </button>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressBar}
                  style={{ animationDuration: `${e.duration}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </UndoContext.Provider>
  );
}

/** Returns { scheduleUndo }. Must be called within <UndoProvider>. */
export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo() must be used within <UndoProvider>");
  return ctx;
}
