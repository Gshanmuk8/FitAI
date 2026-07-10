import React, { useEffect, useRef, useState } from 'react';
import { analyzeFoodImage, saveMeal, getTodayMeals, deleteMeal } from '../../services/nutritionService';
import Button from '../../components/ui/Button';

const emptyManual = { name: '', calories: '', protein: '' };

function ProgressBar({ value, target, unit }) {
  if (!target) return null;
  const pctNum = Math.min(100, Math.round((value / target) * 100));
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
        <span>{value} / {target} {unit}</span>
        <span>{pctNum}%</span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill${pctNum >= 100 ? ' tone-emerald' : ''}`} style={{ width: `${pctNum}%` }} />
      </div>
    </div>
  );
}

// Pending photo analysis survives a refresh — losing it would force the
// user to pay a second AI analysis for the same plate.
const ANALYSIS_KEY = 'fitai.pendingAnalysis';
function loadPendingAnalysis() {
  try {
    return JSON.parse(sessionStorage.getItem(ANALYSIS_KEY)) || null;
  } catch {
    return null;
  }
}

export default function Nutrition() {
  const [analysis, setAnalysisState] = useState(loadPendingAnalysis); // items pending confirmation
  const [meals, setMeals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true); // initial diary fetch
  const [manual, setManual] = useState(emptyManual);
  const [busy, setBusy] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  function setAnalysis(next) {
    setAnalysisState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      try {
        if (value?.foods?.length) sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify(value));
        else sessionStorage.removeItem(ANALYSIS_KEY);
      } catch { /* storage unavailable — analysis just won't survive refresh */ }
      return value;
    });
  }

  // One click for the whole plate — per-item "Add" stays as the exception
  // path for when one estimate looks wrong.
  async function confirmAll() {
    if (!analysis?.foods?.length) return;
    setBusy('saving');
    setError('');
    try {
      for (const food of analysis.foods) {
        // Sequential on purpose: each save recomputes the diary sync.
        // eslint-disable-next-line no-await-in-loop
        await saveMeal({
          name: food.name,
          grams: food.grams,
          calories: Math.round(food.calories),
          protein: food.protein ?? 0,
          carbs: food.carbs,
          fat: food.fat,
          source: 'photo',
        });
      }
      setAnalysis(null);
      await refreshDiary();
    } catch (err) {
      setError(`Couldn't add all items: ${err.message}`);
      await refreshDiary(); // some may have saved — show the truth
    } finally {
      setBusy('');
    }
  }

  async function refreshDiary() {
    try {
      const { meals: m, summary: s } = await getTodayMeals();
      setMeals(m);
      setSummary(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshDiary(); }, []);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy('analyzing');
    setError('');
    setAnalysis(null);
    try {
      setAnalysis(await analyzeFoodImage(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
      e.target.value = ''; // allow re-selecting the same file
    }
  }

  async function confirmAnalyzedItem(food) {
    setBusy('saving');
    setError('');
    try {
      await saveMeal({
        name: food.name,
        grams: food.grams,
        calories: Math.round(food.calories),
        protein: food.protein ?? 0,
        carbs: food.carbs,
        fat: food.fat,
        source: 'photo',
      });
      setAnalysis((a) => ({ ...a, foods: a.foods.filter((f) => f !== food) }));
      await refreshDiary();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleManualSave(e) {
    e.preventDefault();
    setBusy('saving');
    setError('');
    try {
      await saveMeal({
        name: manual.name,
        calories: Number(manual.calories),
        protein: manual.protein ? Number(manual.protein) : 0,
        source: 'manual',
      });
      setManual(emptyManual);
      await refreshDiary();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleDelete(id, name) {
    // Deleting a logged meal is destructive and has no undo — confirm, and
    // block double-fires while the request is in flight.
    if (deletingId) return;
    if (!window.confirm(`Remove "${name}" from today's diary?`)) return;
    setDeletingId(id);
    setError('');
    try {
      await deleteMeal(id);
      await refreshDiary();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page page-narrow page-enter">
      <h2 className="page-title">Nutrition</h2>

      {/* ---- Today so far ---- */}
      {summary && (
        <section className="card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
          <h3 style={{ marginTop: 0 }}>Today so far</h3>
          <ProgressBar value={summary.calories} target={summary.targets?.calorieTarget} unit="kcal" />
          <ProgressBar value={summary.protein} target={summary.targets?.proteinGrams} unit="g protein" />
          {!summary.targets && (
            <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Complete onboarding to get calorie and protein targets.</p>
          )}
          {summary.proteinTargetHit && (
            <p className="success-text tiny">✓ Protein target hit — checked off on today's mission.</p>
          )}
        </section>
      )}

      {/* ---- Photo analysis ---- */}
      <section style={{ marginBottom: '1.25rem' }}>
        <h3 className="section-title">Analyze a photo</h3>
        {/* Two entry points, one pipeline: the camera on mobile (capture
            hints the OS to open it directly), the picker everywhere. Both
            are hidden inputs behind labelled buttons — a bare file input
            gives no hint that the camera works at all. */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={busy === 'analyzing'} style={{ display: 'none' }} />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} disabled={busy === 'analyzing'} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button type="button" disabled={busy === 'analyzing'} onClick={() => cameraInputRef.current?.click()}>
            📷 Take a photo
          </Button>
          <Button type="button" variant="ghost" disabled={busy === 'analyzing'} onClick={() => fileInputRef.current?.click()}>
            Upload a photo
          </Button>
        </div>
        {busy === 'analyzing' && <p className="muted">Analyzing your photo…</p>}
        {analysis?.needsManualInput && <p className="muted">{analysis.prompt} Add it manually below.</p>}
        {analysis?.foods?.length > 0 && (
          <>
            <div className="page-header" style={{ marginTop: '0.5rem' }}>
              <p className="small muted" style={{ margin: 0 }}>Estimates — add the plate, or pick items individually.</p>
              <Button type="button" disabled={busy === 'saving'} onClick={confirmAll}>
                {busy === 'saving' ? 'Adding…' : `Add all ${analysis.foods.length > 1 ? analysis.foods.length + ' items' : ''}`.trim()}
              </Button>
            </div>
            {analysis.foods.map((f, i) => (
              <div key={`${f.name}-${i}`} className="card" style={{ marginTop: '0.5rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span>
                  <strong>{f.name}</strong>{f.grams ? ` · ~${f.grams}g` : ''} — {Math.round(f.calories)} kcal, {f.protein ?? 0}g protein
                </span>
                <Button variant="ghost" type="button" disabled={busy === 'saving'} onClick={() => confirmAnalyzedItem(f)}>Add</Button>
              </div>
            ))}
          </>
        )}
      </section>

      {/* ---- Manual entry ---- */}
      <section style={{ marginBottom: '1.25rem' }}>
        <h3 className="section-title">Add manually</h3>
        <form onSubmit={handleManualSave} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <input placeholder="Food" value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} required style={{ flex: '2 1 140px' }} />
          <input placeholder="kcal" type="number" min="0" max="5000" value={manual.calories} onChange={(e) => setManual((m) => ({ ...m, calories: e.target.value }))} required style={{ flex: '1 1 70px' }} />
          <input placeholder="protein g" type="number" min="0" max="300" step="0.1" value={manual.protein} onChange={(e) => setManual((m) => ({ ...m, protein: e.target.value }))} style={{ flex: '1 1 70px' }} />
          <Button type="submit" disabled={busy === 'saving'}>{busy === 'saving' ? 'Adding…' : 'Add'}</Button>
        </form>
      </section>

      {/* ---- Today's diary ---- */}
      <section>
        <h3 className="section-title">Today's meals {summary?.mealCount ? `(${summary.mealCount})` : ''}</h3>
        {loading && <p className="small muted">Loading today's diary…</p>}
        {!loading && meals.length === 0 && <p className="small muted">Nothing logged yet today — snap a photo or add a meal above.</p>}
        {meals.map((m) => (
          <div key={m.id} className="list-row">
            <span>
              {m.name} — {m.calories} kcal, {Number(m.protein)}g protein
              {m.source === 'photo' && <span className="chip tone-cyan" style={{ marginLeft: 8 }}>photo</span>}
            </span>
            <Button
              variant="ghost"
              type="button"
              disabled={deletingId === m.id}
              aria-label={`Remove ${m.name}`}
              onClick={() => handleDelete(m.id, m.name)}
            >
              ✕
            </Button>
          </div>
        ))}
      </section>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
