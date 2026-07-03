import React, { useEffect, useState } from 'react';
import { getMemoryTimeline } from '../../services/memoryService';

export default function Memory() {
  const [summaries, setSummaries] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getMemoryTimeline().then(setSummaries).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page-enter" style={{ maxWidth: 600, margin: '4rem auto', padding: '0 2rem' }}>
      <h2 className="page-title">AI Coach Memory</h2>
      {error && <p className="error-text">{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0, borderLeft: '2px solid var(--border)' }}>
        {summaries.map((s) => (
          <li key={s.id} style={{ padding: '0.75rem 1rem' }}>
            <div style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>
              {new Date(s.created_at).toLocaleDateString()} · {s.mode}
              {s.category && s.category !== 'conversation' && (
                <span className="chip tone-cyan" style={{ marginLeft: 8 }}>
                  {s.category}{s.importance >= 3 ? ' ★' : ''}
                </span>
              )}
            </div>
            <div>{s.summary}</div>
          </li>
        ))}
        {summaries.length === 0 && !error && <p style={{ color: 'var(--slate)' }}>No memories yet — ask the AI tutor a few questions first.</p>}
      </ul>
    </div>
  );
}
