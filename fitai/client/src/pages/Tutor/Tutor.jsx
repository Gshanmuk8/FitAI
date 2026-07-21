import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { askTutor } from '../../services/aiService';
import Button from '../../components/ui/Button';

const MODES = [
  { key: 'gym', label: 'Gym', hint: 'technique, programming, injury prevention' },
  { key: 'diet', label: 'Diet', hint: 'calories, macros, food choices' },
  { key: 'recovery', label: 'Recovery', hint: 'sleep, soreness, rest' },
];

// The coach speaks on the page itself — a stem in the margin, text at a
// comfortable measure, no container. Only the user gets a bubble. Two
// facing bubbles turn a conversation into a chat-app pastiche; one bubble
// and one margin stem reads as a transcript, which is what this is.
const COACH_STYLE = {
  alignSelf: 'flex-start',
  maxWidth: '60ch',
  background: 'transparent',
  border: 0,
  borderLeft: '2px solid var(--cyan)',
  borderRadius: 0,
  boxShadow: 'none',
  padding: '0 0 0 var(--s3)',
};
const USER_STYLE = { maxWidth: '46ch' };
const ERROR_STYLE = { maxWidth: '60ch' };

// Conversations are intentionally not persisted server-side — the coach
// keeps only one-line durable facts (see the Memory page). This mirrors
// that honestly: refresh = fresh chat, memory carries over.
export default function Tutor() {
  const [mode, setMode] = useState('gym');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function handleSend(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput('');
    // Last few exchanges ride along so follow-up questions keep context.
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'coach')
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 600) }));
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const res = await askTutor(mode, question, history);
      setMessages((m) => [
        ...m,
        {
          role: 'coach',
          text: res.answer,
          source: res.source,
          seeProfessional: res.recommendSeeProfessional,
        },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', text: err.message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-mid page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: '75vh' }}>
      <div className="page-header" style={{ marginBottom: 'var(--s3)' }}>
        <div>
          <p className="eyebrow" style={{ margin: '0 0 var(--s1)' }}>Not saved · memory carries over</p>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Coach</h2>
        </div>
        {/* The coach's memory belongs to the coach — reached from here, not
            a top-level nav slot. */}
        <Link to="/memory" className="small">What your coach remembers →</Link>
      </div>

      {/* The mode is the subject of the conversation, so it sits on the
          thread's own rule rather than floating as a toolbar. */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--s1)',
          paddingBottom: 'var(--s3)',
          borderBottom: '1px solid var(--border)',
          marginBottom: 'var(--s4)',
        }}
      >
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            title={m.hint}
            aria-pressed={mode === m.key}
            className={`mode-pill${mode === m.key ? ' active' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="chat-thread">
        {/* The opening state is the first thing the coach "says" — set at
            the same measure as its answers so the thread starts already in
            rhythm rather than with a stranded paragraph. */}
        {messages.length === 0 && (
          <div style={{ ...COACH_STYLE, padding: 'var(--s1) 0 var(--s1) var(--s3)' }}>
            <p className="muted small" style={{ margin: 0 }}>
              Ask anything about {MODES.find((m) => m.key === mode)?.hint}. The coach knows your plan, your pace,
              and what it has learned about you — durable facts it picks up here are saved to its memory.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble ${msg.role}`}
            style={msg.role === 'coach' ? COACH_STYLE : msg.role === 'error' ? ERROR_STYLE : USER_STYLE}
          >
            {msg.text}
            {msg.seeProfessional && (
              <div className="chat-meta tone-amber-text">⚠ raise this with a professional in person</div>
            )}
            {msg.role === 'coach' && msg.source === 'fallback' && (
              <div className="chat-meta">general guidance — AI coach unreachable right now</div>
            )}
          </div>
        ))}

        {busy && (
          <div className="thinking" style={{ alignSelf: 'flex-start', paddingLeft: 'var(--s3)' }} aria-label="Coach is thinking">
            <i /><i /><i />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* The composer is anchored: it sits on a rule at the foot of the
          thread with the page ground behind it, so the thread scrolls under
          a fixed place to type rather than pushing it around. */}
      <form
        onSubmit={handleSend}
        style={{
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          gap: 'var(--s2)',
          alignItems: 'center',
          paddingTop: 'var(--s3)',
          paddingBottom: 'var(--s3)',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg0)',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask your ${mode} coach…`}
          maxLength={1000}
          style={{ flex: 1, minWidth: 0, minHeight: 48 }}
        />
        <Button type="submit" disabled={busy || !input.trim()} style={{ minHeight: 48, flex: 'none' }}>{busy ? 'Thinking…' : 'Send'}</Button>
      </form>
    </div>
  );
}
