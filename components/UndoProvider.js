"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import styles from "./UndoToast.module.css";

/**
 * Deferred-execution undo for destructive actions (deletes, revokes, bulk
 * removals). Update UI state optimistically, then schedule the real request
 * instead of firing it immediately:
 *
 *   setItems(prev => prev.filter(i => i.id !== item.id));
 *   scheduleUndo({
 *     message: `Deleted "${item.title}"`,
 *     onExpire: () => fetch(`/api/action_items/${item.id}`, { method: "DELETE" }),
 *     onCancel: () => setItems(prev => [...prev, item]),
 *   });
 *
 * Mounted at the root layout so the toast survives client-side navigation;
 * only a hard reload loses a pending undo, which just means the delete never
 * actually happened - the safe failure mode.
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
        // onExpire is always `() => fetch(...)` - a non-2xx Response (e.g. a
        // server-side permission check) means the delete didn't really
        // happen, so treat it as a failure and restore the UI.
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
