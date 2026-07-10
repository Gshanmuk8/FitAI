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
        <h2 className="page-title">Coach memory</h2>
        <Link to="/tutor" className="small">← Back to your coach</Link>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!error && summaries.length === 0 && (
        <p className="muted">No memories yet — chat with your coach a few times and durable facts land here.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, borderLeft: summaries.length ? '2px solid var(--border)' : 'none' }}>
        {summaries.map((s) => (
          <li key={s.id} style={{ padding: '0.75rem 1rem' }}>
            <div className="muted small">
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
      </ul>
    </div>
  );
}
