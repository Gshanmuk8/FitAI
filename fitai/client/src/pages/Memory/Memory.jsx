import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMemoryTimeline } from '../../services/memoryService';

export default function Memory() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMemoryTimeline()
      .then(setSummaries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading what your coach remembers…</div>;

  return (
    <div className="page page-mid page-enter">
      <div className="page-header">
        <div>
          <p className="eyebrow" style={{ margin: '0 0 var(--s1)' }}>Newest first</p>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Coach memory</h2>
        </div>
        <Link to="/tutor" className="small">← Back to your coach</Link>
      </div>

      {error && (
        <div className="notice tone-red" style={{ padding: 'var(--s4)' }}>
          <p className="error-text" style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!error && summaries.length === 0 && (
        <p
          className="small muted"
          style={{
            margin: 'var(--s5) 0 0',
            padding: 'var(--s7) var(--s4)',
            textAlign: 'center',
            border: '1px dashed var(--border2)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          No memories yet — chat with your coach a few times and durable facts land here.
        </p>
      )}

      {/* A timeline is a ruled ledger: the date column holds one vertical,
          the fact holds another, and every entry lines up down the page.
          Nothing here is an action, so nothing here is loud — this is a
          record you read, not a screen you operate. */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--s5) 0 0' }}>
        {summaries.map((s) => (
          <li
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 7.5rem) minmax(0, 1fr)',
              gap: 'var(--s2) var(--s4)',
              alignItems: 'baseline',
              padding: 'var(--s3) 0',
              borderTop: '1px solid var(--border)',
            }}
          >
            <time className="eyebrow" style={{ whiteSpace: 'nowrap' }}>
              {new Date(s.created_at).toLocaleDateString()}
            </time>
            <div style={{ minWidth: 0 }}>
              <div className="small" style={{ marginBottom: '0.2rem' }}>{s.summary}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', flexWrap: 'wrap' }}>
                <span className="eyebrow">{s.mode}</span>
                {s.category && s.category !== 'conversation' && (
                  <span className="chip tone-cyan">
                    {s.category}{s.importance >= 3 ? ' ★' : ''}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
