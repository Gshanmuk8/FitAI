import React, { useEffect, useState } from 'react';
import { useChecklist } from '../../hooks/useChecklist';
import Button from '../ui/Button';

// Fallback labels for rows created before plan-aware snapshots existed —
// the server normally sends concrete items ("Protein: 144g") built from
// the user's live plan.
const DEFAULT_ITEMS = [
  { field: 'workout_completed', label: 'Workout completed' },
  { field: 'protein_completed', label: 'Protein target' },
  { field: 'calories_completed', label: 'Calorie target' },
  { field: 'water_completed', label: 'Water target' },
  { field: 'sleep_completed', label: 'Sleep target' },
  { field: 'steps_completed', label: 'Steps target' },
];

// The four measurable items accept a typed value. Each maps to its storage
// column, the plan-snapshot target it is measured against, and how the
// number is shown vs. stored (water is entered in litres but persisted in
// millilitres to match the plan targets).
const MEASURE = {
  protein_completed: { col: 'protein_grams', targetKey: 'proteinGrams', unit: 'g', step: '1', toInput: (v) => v, fromInput: (n) => n, fmtTarget: (t) => String(t) },
  calories_completed: { col: 'calories_kcal', targetKey: 'calorieTarget', unit: 'kcal', step: '10', toInput: (v) => v, fromInput: (n) => Math.round(n), fmtTarget: (t) => Number(t).toLocaleString() },
  water_completed: { col: 'water_ml', targetKey: 'waterMl', unit: 'L', step: '0.1', toInput: (v) => v / 1000, fromInput: (n) => Math.round(n * 1000), fmtTarget: (t) => (t / 1000).toFixed(1) },
  sleep_completed: { col: 'sleep_hours', targetKey: 'sleepHours', unit: 'h', step: '0.5', toInput: (v) => v, fromInput: (n) => n, fmtTarget: (t) => String(t) },
  steps_completed: { col: 'steps_count', targetKey: 'stepsTarget', unit: 'steps', step: '100', toInput: (v) => v, fromInput: (n) => Math.round(n), fmtTarget: (t) => Number(t).toLocaleString() },
};

// Every inline "Save" in this component is the same quiet ghost control — a
// row-scoped confirmation, sized from the type scale rather than a magic
// 0.78rem. It must stay subordinate to the row's label.
const ROW_SAVE = { padding: '0.2rem 0.7rem', fontSize: 'var(--t-tiny)', minHeight: '34px' };

function ValueInput({ field, checklist, onSave, onError, onSaved }) {
  const cfg = MEASURE[field];
  const stored = checklist?.[cfg.col];
  const wasDone = Boolean(checklist?.[field]);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);

  // Track the server value; re-sync when it changes from elsewhere (e.g. a
  // weigh-in save returns the whole row).
  useEffect(() => {
    setVal(stored != null ? String(cfg.toInput(Number(stored))) : '');
  }, [stored]); // eslint-disable-line react-hooks/exhaustive-deps

  // The planned figure this value is measured against — read from the day's
  // frozen plan snapshot (never hardcoded). Shown as "actual / target".
  const target = checklist?.plan_snapshot?.targets?.[cfg.targetKey];

  // Over/hit chip for the two directional nutrition rows. Color follows the
  // SERVER's completion verdict, so this can never contradict the checkbox:
  // calories over target reads amber while still inside the goal's grace
  // (checkbox on) and red once it's a genuine miss; protein over target is
  // always a win. Water/sleep/steps overshoot is neutral — no chip.
  let chip = null;
  if (stored != null && target != null) {
    const v = Number(stored);
    const t = Number(target);
    if (cfg.col === 'calories_kcal' && v > t) {
      const goal = checklist?.plan_snapshot?.goal;
      chip = goal === 'build_muscle'
        // On a bulk, past the target is the POINT — never a warning.
        ? { text: `+${Math.round(v - t).toLocaleString()}`, cls: 'tone-emerald-text' }
        : {
            text: `+${Math.round(v - t).toLocaleString()} over`,
            cls: checklist?.[field] ? 'tone-amber-text' : 'tone-red-text',
          };
    } else if (cfg.col === 'protein_grams' && v > t) {
      chip = { text: `+${Math.round((v - t) * 10) / 10}g`, cls: 'tone-emerald-text' };
    }
  }

  // Nothing is saved until the user says so: the input only becomes dirty
  // (Save enabled) when it holds a number different from the server's.
  const dirty = val !== '' && !(stored != null && String(cfg.toInput(Number(stored))) === String(Number(val)));

  async function commit() {
    if (!dirty || saving) return;
    const num = Number(val);
    if (Number.isNaN(num) || num < 0) {
      onError('Enter a positive number.');
      return;
    }
    setSaving(true);
    try {
      const updated = await onSave({ [cfg.col]: cfg.fromInput(num) });
      // Saving must never be silent — and when the value crosses the target
      // and checks the item off, SAY that's what happened.
      onSaved(!wasDone && updated?.[field] ? 'Saved — target hit, checked off ✓' : 'Saved');
    } catch (err) {
      // The value LOOKS accepted in the input — say plainly that it wasn't.
      onError(`Couldn't save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="check-value">
      <input
        type="number"
        inputMode="decimal"
        step={cfg.step}
        min="0"
        value={val}
        disabled={saving}
        placeholder="—"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        aria-label={`Log ${cfg.col}`}
      />
      {/* "/ 144 g" is the denominator of the figure beside it, so it is set
          in the mono label voice and stays faint — a target is a reference,
          never a second value competing with the one just typed. */}
      <span className="mono faint" style={{ whiteSpace: 'nowrap', fontSize: 'var(--t-tiny)' }}>
        {target != null ? `/ ${cfg.fmtTarget(Number(target))} ${cfg.unit}` : cfg.unit}
      </span>
      {chip && <span className={`tiny ${chip.cls}`} style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{chip.text}</span>}
      <Button
        type="button"
        variant="ghost"
        disabled={!dirty || saving}
        onClick={commit}
        style={ROW_SAVE}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </span>
  );
}

function WeighInAndNotes({ checklist, onSave, onError }) {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => { setWeight(checklist?.weight_kg != null ? String(checklist.weight_kg) : ''); }, [checklist?.weight_kg]);
  useEffect(() => { setNotes(checklist?.notes || ''); }, [checklist?.notes]);

  const flash = (msg) => { setSavedFlash(msg); setTimeout(() => setSavedFlash(''), 1500); };

  // Explicit save only — typing never persists anything on its own.
  const weightDirty = weight !== '' && !(checklist?.weight_kg != null && Number(checklist.weight_kg) === Number(weight));
  const notesDirty = (checklist?.notes || '') !== notes;

  async function saveWeight() {
    if (!weightDirty || savingWeight) return;
    const num = Number(weight);
    if (Number.isNaN(num) || num < 30 || num > 300) {
      onError('Weight must be between 30 and 300 kg.');
      return;
    }
    setSavingWeight(true);
    try {
      await onSave({ weight_kg: num });
      flash('Weigh-in saved');
    } catch (err) {
      onError(`Couldn't save weigh-in: ${err.message}`);
    } finally {
      setSavingWeight(false);
    }
  }

  async function saveNotes() {
    if (!notesDirty || savingNotes) return;
    setSavingNotes(true);
    try {
      await onSave({ notes });
      flash('Note saved');
    } catch (err) {
      onError(`Couldn't save note: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="checklist-manual">
      <div className="check-row">
        <label className="check-label" htmlFor="weighin">Today's weight</label>
        <span className="check-value">
          <input
            id="weighin"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="300"
            value={weight}
            disabled={savingWeight}
            placeholder="kg"
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveWeight(); } }}
          />
          <span className="mono faint" style={{ fontSize: 'var(--t-tiny)' }}>kg</span>
          <Button
            type="button"
            variant="ghost"
            disabled={!weightDirty || savingWeight}
            onClick={saveWeight}
            style={ROW_SAVE}
          >
            {savingWeight ? 'Saving…' : 'Save'}
          </Button>
        </span>
      </div>
      <textarea
        value={notes}
        placeholder="Notes for today — how you felt, energy, anything the coach should know…"
        onChange={(e) => setNotes(e.target.value)}
        maxLength={1000}
        rows={2}
        disabled={savingNotes}
        style={{ width: '100%', marginTop: 'var(--s2)', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', marginTop: 'var(--s1)' }}>
        <Button
          type="button"
          variant="ghost"
          disabled={!notesDirty || savingNotes}
          onClick={saveNotes}
          style={ROW_SAVE}
        >
          {savingNotes ? 'Saving…' : 'Save note'}
        </Button>
        {savedFlash && <span className="tiny tone-emerald-text">{savedFlash}</span>}
      </div>
    </div>
  );
}

export default function DailyChecklist() {
  const { checklist, loading, error, toggleItem, setValues, addCustom, toggleCustom, removeCustom } = useChecklist();
  const [saveError, setSaveError] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [newItem, setNewItem] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  function flash(msg) {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(''), 1800);
  }

  if (loading) {
    // The loading state holds the shape of the list — a header rule and four
    // row-height bars — so the mission doesn't pop into existence.
    return (
      <div className="checklist-skeleton">
        <p className="eyebrow" style={{ margin: '0 0 var(--s3)' }}>Today's mission</p>
        <p style={{ margin: '0 0 var(--s4)' }}>Loading today's mission…</p>
        <div aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 12, width: `${72 - i * 9}%`, margin: 'var(--s4) 0' }} />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <div className="checklist-error">Couldn't load today's mission: {error}</div>;

  const items = checklist?.items?.length ? checklist.items : DEFAULT_ITEMS;
  const workout = checklist?.plan_snapshot?.workout;
  const adaptations = checklist?.plan_snapshot?.adaptations || [];
  const customItems = Array.isArray(checklist?.custom_items) ? checklist.custom_items : [];
  const done = items.filter(({ field }) => checklist?.[field]).length + customItems.filter((i) => i.done).length;
  const total = items.length + customItems.length;

  // A failed toggle must not read as success — the checkbox stays where the
  // server left it (state only updates from the response), and we say why.
  async function handleToggle(field, value) {
    setSaveError('');
    try {
      await toggleItem(field, value);
    } catch (err) {
      setSaveError(`Couldn't update: ${err.message}`);
    }
  }

  async function handleSave(values) {
    setSaveError('');
    return setValues(values);
  }

  return (
    <div className="daily-checklist">
      {/* The score belongs at the TOP. It is the one-glance answer to "how is
          today going" — at the foot of a long list it was the last thing
          read instead of the first. */}
      <div className="page-header" style={{ marginBottom: 'var(--s3)' }}>
        <h3 style={{ margin: 0 }}>Today's mission</h3>
        {workout?.weekday && <span className="eyebrow">{workout.weekday}</span>}
      </div>

      <div className="progress-track" aria-hidden="true">
        <div className={`progress-fill ${done === total ? 'tone-emerald' : ''}`} style={{ width: `${(done / total) * 100}%` }} />
      </div>
      {done === total ? (
        <p className="checklist-score tone-emerald-text" style={{ margin: 'var(--s2) 0 var(--s4)' }}>Mission complete — see you tomorrow. ✓</p>
      ) : (
        <p className="checklist-score" style={{ margin: 'var(--s2) 0 var(--s4)' }}>{done} / {total} completed</p>
      )}

      {adaptations.map((a) => (
        <p key={a.code} className="notice">{a.message}</p>
      ))}

      {/* Today's prescribed session, collapsed, directly above the rows it
          explains — it is context for the checklist, not an appendix to it. */}
      {workout?.type === 'workout' && workout.exercises?.length > 0 && (
        <details style={{ marginBottom: 'var(--s2)' }}>
          <summary className="eyebrow" style={{ cursor: 'pointer', padding: 'var(--s2) 0' }}>Today's exercises</summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--s2)' }}>
            {workout.exercises.map((ex) => (
              <li
                key={ex.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--s3)',
                  padding: '0.35rem 0',
                  borderTop: '1px solid var(--border)',
                  fontSize: 'var(--t-small)',
                }}
              >
                <span className="muted">{ex.name}</span>
                <span className="mono faint" style={{ whiteSpace: 'nowrap' }}>{ex.sets}×{ex.reps}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Rows, hairlines, 48px targets — the CSS owns all of it. A checked
          item recedes (line-through in --faint) rather than lighting up, so
          the eye lands on what is still outstanding. */}
      <ul>
        {items.map(({ field, label, detail }) => (
          <li key={field} className={`check-row${checklist?.[field] ? ' done' : ''}`}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(checklist?.[field])}
                onChange={(e) => handleToggle(field, e.target.checked)}
              />
              <span className="check-label">
                {label}
                {detail ? <span className="tiny faint"> — {detail}</span> : null}
              </span>
            </label>
            {MEASURE[field] && <ValueInput field={field} checklist={checklist} onSave={handleSave} onError={setSaveError} onSaved={flash} />}
          </li>
        ))}
        {customItems.map((item) => (
          <li key={item.id} className={`check-row${item.done ? ' done' : ''}`}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(item.done)}
                onChange={(e) => toggleCustom(item.id, e.target.checked).catch((err) => setSaveError(`Couldn't update: ${err.message}`))}
              />
              <span className="check-label">{item.label}</span>
            </label>
            <button
              type="button"
              className="ghost-button tiny"
              aria-label={`Remove ${item.label}`}
              onClick={() => removeCustom(item.id).catch((err) => setSaveError(`Couldn't remove: ${err.message}`))}
              style={{ color: 'var(--faint)', marginLeft: 'auto' }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* The mission is the user's too: anything they want tracked today —
          "20 min yoga", "no sugar" — becomes a real item the AI sees in
          history, not a note lost to a text field. It sits below a rule as
          the quiet continuation of the list. */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const label = newItem.trim();
          if (!label || addingItem) return;
          setAddingItem(true);
          setSaveError('');
          try {
            await addCustom(label);
            setNewItem('');
          } catch (err) {
            setSaveError(`Couldn't add: ${err.message}`);
          } finally {
            setAddingItem(false);
          }
        }}
        style={{ display: 'flex', gap: 'var(--s1)', margin: 0, paddingTop: 'var(--s3)', borderTop: '1px solid var(--border)' }}
      >
        <input
          value={newItem}
          maxLength={120}
          placeholder="Add your own — e.g. 20 min yoga, no sugar today…"
          onChange={(e) => setNewItem(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
          aria-label="Add your own checklist item"
        />
        <Button type="submit" variant="ghost" disabled={addingItem || !newItem.trim()}>
          {addingItem ? 'Adding…' : 'Add'}
        </Button>
      </form>

      <WeighInAndNotes checklist={checklist} onSave={handleSave} onError={setSaveError} />

      {savedFlash && <p className="tiny tone-emerald-text" style={{ margin: 'var(--s2) 0 0' }}>{savedFlash}</p>}
      {saveError && <p className="error-text small" style={{ margin: 'var(--s2) 0 0' }}>{saveError}</p>}
    </div>
  );
}
