"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import styles from "./ChatWidget.module.css";

const WELCOME_VISITOR = "Hi! I'm H.A.L. - the Honors Assistant for Learning. Ask me anything about CS 124 Honors: registration, grading, structure, or anything else.";
const WELCOME_USER = (name) => `Hi ${name}! I'm H.A.L. - the Honors Assistant for Learning. I know your role, so feel free to ask me anything course-related.`;

export default function ChatWidget() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const initialized = useRef(false);
  const closeTimer = useRef(null);

  const startClose = () => {
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 160);
  };

  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true;
      const welcome = session?.user?.name
        ? WELCOME_USER(session.user.name.split(" ")[0])
        : WELCOME_VISITOR;
      setMessages([{ role: "assistant", content: welcome }]);
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[H.A.L. API error]", data.error);
        throw new Error("api");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (e) {
      if (e.message === "api") {
        setError("H.A.L. is having trouble responding right now. Please try again in a moment.");
      } else {
        console.error("[H.A.L. network error]", e);
        setError("Couldn't reach H.A.L. — check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {(open || closing) && (
        <div className={`${styles.panel} ${closing ? styles.panelClosing : ""}`}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>H.A.L.</div>
              <div className={styles.panelSubtitle}>
                {session?.user ? `Signed in as ${session.user.name}` : "Not signed in"}
              </div>
            </div>
            <button className={styles.closeBtn} onClick={startClose} aria-label="Close chat">
              ×
            </button>
          </div>

          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.bubble} ${m.role === "user" ? styles.userBubble : styles.assistantBubble}`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className={styles.typing}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            )}
            {error && <div className={styles.error}>{error}</div>}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
            />
            <button className={styles.sendBtn} onClick={send} disabled={!input.trim() || loading}>
              Send
            </button>
          </div>
        </div>
      )}

      <button
        className={styles.fab}
        onClick={() => (open ? startClose() : setOpen(true))}
        aria-label="Open chat assistant"
      >
        {open ? "×" : "💬"}
      </button>
    </>
  );
}
