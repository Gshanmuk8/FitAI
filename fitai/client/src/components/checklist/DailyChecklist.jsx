import React from 'react';
import { useChecklist } from '../../hooks/useChecklist';

// Fallback labels for rows created before plan-aware snapshots existed —
// the server normally sends concrete items ("Protein: 144g") built from
// the user's live plan.
const DEFAULT_ITEMS = [
  { field: 'workout_completed', label: 'Workout completed' },
  { field: 'protein_completed', label: 'Protein target' },
  { field: 'water_completed', label: 'Water target' },
  { field: 'sleep_completed', label: 'Sleep target' },
  { field: 'steps_completed', label: 'Steps target' },
];

export default function DailyChecklist() {
  const { checklist, loading, error, toggleItem } = useChecklist();

  if (loading) return <div className="checklist-skeleton">Loading today's mission…</div>;
  if (error) return <div className="checklist-error">Couldn't load checklist: {error}</div>;

  const items = checklist?.items?.length ? checklist.items : DEFAULT_ITEMS;
  const workout = checklist?.plan_snapshot?.workout;
  const adaptations = checklist?.plan_snapshot?.adaptations || [];
  const done = items.filter(({ field }) => checklist?.[field]).length;

  return (
    <div className="daily-checklist">
      <div className="page-header">
        <h3 style={{ margin: 0 }}>Today's Mission</h3>
        {workout?.weekday && <span className="chip">{workout.weekday}</span>}
      </div>

      {adaptations.map((a) => (
        <p key={a.code} className="notice">{a.message}</p>
      ))}

      <ul>
        {items.map(({ field, label, detail }) => (
          <li key={field} className={`check-row${checklist?.[field] ? ' done' : ''}`}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(checklist?.[field])}
                onChange={(e) => toggleItem(field, e.target.checked)}
              />
              <span className="check-label">
                {label}
                {detail ? <span className="tiny faint"> — {detail}</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {workout?.type === 'workout' && workout.exercises?.length > 0 && (
        <details className="small" style={{ marginBottom: '0.5rem' }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>Today's exercises</summary>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.4rem', marginTop: '0.35rem' }}>
            {workout.exercises.map((ex) => (
              <li key={ex.name} className="check-row" style={{ border: 0 }}>
                <span className="muted">{ex.name} — <span className="mono">{ex.sets}×{ex.reps}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="progress-track" aria-hidden="true">
        <div className={`progress-fill ${done === items.length ? 'tone-emerald' : ''}`} style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <p className="checklist-score">{done} / {items.length} completed</p>
    </div>
  );
}
