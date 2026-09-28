import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { askTutor } from "../../services/aiService";
import { useAuth } from "../../contexts/AuthContext";
import { readSessionDraft, saveSessionDraft } from "../../utils/productState";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import {
  PageHeader,
  SourceBadge,
  ConfirmDialog,
} from "../../components/ui/PageKit";
const MODES = [
  {
    key: "gym",
    label: "Training",
    prompts: [
      "What should I focus on in my next session?",
      "How can I improve my exercise technique?",
      "I missed a workout. What now?",
      "Help me make training more consistent.",
    ],
  },
  {
    key: "diet",
    label: "Nutrition",
    prompts: [
      "Help me reach my protein target.",
      "What can I eat before training?",
      "Suggest a meal that fits my restrictions.",
      "Explain my daily calorie target.",
    ],
  },
  {
    key: "recovery",
    label: "Recovery",
    prompts: [
      "I slept poorly. Should I train today?",
      "How do I know when to take a rest day?",
      "Help me build a wind-down routine.",
      "I feel sore after my last session.",
    ],
  },
];
function Answer({ text }) {
  const inline = (s) =>
    s
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, i) =>
        part.startsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      );
  return (
    <div className="chat-answer">
      {String(text || "")
        .split(/\n\s*\n/)
        .map((part, i) => {
          const lines = part.split("\n");
          return lines.every((line) => /^\s*(?:[-*]|\d+[.)])\s/.test(line)) ? (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>
                  {inline(line.replace(/^\s*(?:[-*]|\d+[.)])\s/, ""))}
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>{inline(part.replace(/^#{1,4}\s/gm, ""))}</p>
          );
        })}
    </div>
  );
}
export default function Tutor() {
  const { user } = useAuth();
  const location = useLocation();
  const key = `fitai.chat.${user.id}`;
  const [mode, setMode] = useState(
    () => location.state?.mode || readSessionDraft(key, {}).mode || "gym",
  );
  const [messages, setMessages] = useState(() => {
    const m = readSessionDraft(key, {}).messages;
    return Array.isArray(m)
      ? m
          .slice(-60)
          .map((entry) =>
            entry.role === "pending"
              ? {
                  ...entry,
                  role: "error",
                  text: "This reply hasn’t arrived yet. You can retry the question.",
                }
              : entry,
          )
      : [];
  });
  const [input, setInput] = useState(
    () => location.state?.question || readSessionDraft(key, {}).input || "",
  );
  const [busy, setBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const lock = useRef(false);
  const bottomRef = useRef(null);
  const composer = useRef(null);
  useEffect(() => {
    saveSessionDraft(key, { mode, messages: messages.slice(-60), input });
  }, [key, mode, messages, input]);
  useEffect(() => {
    const receive = (e) => {
      if (e.detail === key) {
        const saved = readSessionDraft(key, null);
        if (saved) setMessages(saved.messages);
      }
    };
    window.addEventListener("fitai:chat-reply", receive);
    return () => window.removeEventListener("fitai:chat-reply", receive);
  }, [key]);
  useEffect(() => {
    if (messages.length || busy)
      bottomRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
      });
  }, [messages, busy]);
  async function send(question, retryId = null) {
    question = question.trim();
    if (!question || lock.current) return;
    lock.current = true;
    setBusy(true);
    setInput("");
    const context = retryId
      ? messages.slice(0, messages.findIndex((m) => m.id === retryId) - 1)
      : messages;
    const history = context
      .filter(
        (m) => ["user", "coach"].includes(m.role) && m.source !== "fallback",
      )
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 600) }));
    const id = crypto.randomUUID();
    const activeMode = retryId
      ? messages.find((m) => m.id === retryId)?.mode || mode
      : mode;
    const pending = {
      id,
      role: "pending",
      text: "Considering your question…",
      question,
      mode: activeMode,
    };
    const next = retryId
      ? messages.map((entry) => (entry.id === retryId ? pending : entry))
      : [
          ...messages,
          { id: `${id}-question`, role: "user", text: question },
          pending,
        ];
    setMessages(next);
    saveSessionDraft(key, { mode, messages: next.slice(-60), input: "" });
    const receive = (reply) => {
      // The request may finish on a different screen. Persist the reply in
      // place, but never recreate a draft cleared by sign-out or New chat.
      const saved = readSessionDraft(key, null);
      if (!saved?.messages?.some((m) => m.id === id)) return;
      saveSessionDraft(key, {
        ...saved,
        messages: saved.messages.map((m) =>
          m.id === id ? { id, question, mode: activeMode, ...reply } : m,
        ),
      });
      window.dispatchEvent(
        new CustomEvent("fitai:chat-reply", { detail: key }),
      );
    };
    try {
      const res = await askTutor(activeMode, question, history);
      receive({
        role: "coach",
        text: res.answer,
        source: res.source,
        stale: res.stale,
        seeProfessional: res.recommendSeeProfessional,
      });
    } catch (err) {
      receive({ role: "error", text: err.message });
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <div className="page coach-layout page-enter">
      <PageHeader
        eyebrow="IN YOUR CORNER"
        title="Your coach."
        description="A conversation that starts with your goals, not a blank slate."
      >
        <Link to="/memory" className="btn btn-ghost">
          <Icon name="memory" size={16} />
          Memory
        </Link>
      </PageHeader>
      <div className="coach-space">
        <div className="coach-toolbar">
          <div className="mode-group" aria-label="Coaching topic">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={`mode-pill${mode === m.key ? " active" : ""}`}
                aria-pressed={mode === m.key}
                disabled={busy}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            className="ghost-button"
            disabled={!messages.length || busy}
            onClick={() => setClearOpen(true)}
          >
            New chat
          </button>
        </div>
        <div
          className="chat-thread"
          role="log"
          aria-label="Conversation with your coach"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.length === 0 && (
            <div className="coach-welcome">
              <span className="coach-orb">
                <Icon name="coach" size={29} />
              </span>
              <h2>What’s on your mind?</h2>
              <p>
                Your plan, recent activity, and coaching memory help shape the
                conversation. Start wherever you are.
              </p>
              <div className="prompt-grid">
                {(MODES.find((m) => m.key === mode) || MODES[0]).prompts.map(
                  (q) => (
                    <button
                      className="prompt-card"
                      key={q}
                      onClick={() => {
                        setInput(q);
                        composer.current?.focus();
                      }}
                    >
                      {q}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div className={`chat-bubble ${msg.role}`} key={msg.id}>
              {msg.role === "coach" && (
                <div className="message-header">
                  <span className="coach-orb">
                    <Icon name="coach" size={15} />
                  </span>
                  FitAI coach
                  <SourceBadge source={msg.source} stale={msg.stale} />
                </div>
              )}
              {msg.role === "coach" ? <Answer text={msg.text} /> : msg.text}
              {msg.seeProfessional && (
                <p className="notice tone-amber">
                  This needs a qualified professional’s advice. Your coach
                  cannot diagnose an injury or condition.
                </p>
              )}
              {(msg.role === "error" || msg.source === "fallback") && (
                <div className="chat-meta">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => send(msg.question, msg.id)}
                  >
                    Try this question again
                  </Button>
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="thinking" role="status">
              <i />
              <i />
              <i />
              <span>Considering your question and context…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="composer-row">
            <textarea
              ref={composer}
              aria-label="Message your coach"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question. Make it personal."
              rows={1}
              maxLength={1000}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
            >
              <span className="send-label">Send</span>
              <Icon name="arrow" size={18} />
            </Button>
          </div>
          <p className="composer-note">
            Chat stays in this tab until sign-out. Useful facts may enter
            memory. AI can be wrong; not medical advice.
          </p>
        </form>
      </div>
      <ConfirmDialog
        open={clearOpen}
        title="Start a fresh conversation?"
        confirmLabel="Start new chat"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setMessages([]);
          setInput("");
          setClearOpen(false);
        }}
      >
        <p>
          This clears this tab’s conversation. Your coach’s saved memory and
          your plan stay unchanged.
        </p>
      </ConfirmDialog>
    </div>
  );
}
