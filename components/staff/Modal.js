"use client";

import styles from "./dashboard.module.css";
import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";

export default function Modal({ onClose, children, maxWidth }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    const el = dialog.current;
    const heading = el.querySelector("h2");
    if (heading) heading.id = titleId;
    const focusable = () => [...el.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length);
    (focusable()[0] || el).focus();
    const handleKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0] || el;
      const last = nodes.at(-1) || el;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === el)) {
        event.preventDefault(); first.focus();
      }
    };
    el.addEventListener("keydown", handleKey);
    return () => {
      el.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [titleId]);

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.modal}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>, document.body
  );
}
