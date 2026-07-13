import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { askTutor } from '../../services/aiService';
import Button from '../../components/ui/Button';

const MODES = [
  { key: 'gym', label: 'Gym', hint: 'technique, programming, injury prevention' },
  { key: 'diet', label: 'Diet', hint: 'calories, macros, food choices' },
  { key: 'recovery', label: 'Recovery', hint: 'sleep, soreness, rest' },
];

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
      <div className="page-header">
        <h2 className="page-title">Coach</h2>
        {/* The coach's memory belongs to the coach — reached from here, not
            a top-level nav slot. */}
        <Link to="/memory" className="small">What your coach remembers →</Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
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
        {messages.length === 0 && (
          <p className="muted small">
            Ask anything about {MODES.find((m) => m.key === mode)?.hint}. The coach knows your plan, your pace,
            and what it has learned about you — durable facts it picks up here are saved to its memory.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
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
          <div className="thinking" aria-label="Coach is thinking">
            <i /><i /><i />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask your ${mode} coach…`}
          maxLength={1000}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button type="submit" disabled={busy || !input.trim()}>{busy ? 'Thinking…' : 'Send'}</Button>
      </form>
    </div>
  );
}
