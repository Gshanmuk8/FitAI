import React, { useEffect, useState } from 'react';
import { analyzeFoodImage, saveMeal, getTodayMeals, deleteMeal } from '../../services/nutritionService';
import Button from '../../components/ui/Button';

const emptyManual = { name: '', grams: '', calories: '', protein: '' };

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

export default function Nutrition() {
  const [analysis, setAnalysis] = useState(null); // items pending confirmation
  const [meals, setMeals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [manual, setManual] = useState(emptyManual);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function refreshDiary() {
    try {
      const { meals: m, summary: s } = await getTodayMeals();
      setMeals(m);
      setSummary(s);
    } catch (err) {
      setError(err.message);
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
        ...(manual.grams ? { grams: Number(manual.grams) } : {}),
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

  async function handleDelete(id) {
    try {
      await deleteMeal(id);
      await refreshDiary();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '2.5rem auto', padding: '0 2rem' }}>
      <h2 className="page-title">Nutrition</h2>

      {/* ---- Today so far ---- */}
      {summary && (
        <section className="intelligence-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
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
        <h3>Analyze a photo</h3>
        <input type="file" accept="image/*" onChange={handleFile} disabled={busy === 'analyzing'} />
        {busy === 'analyzing' && <p>Analyzing…</p>}
        {analysis?.needsManualInput && <p style={{ opacity: 0.75 }}>{analysis.prompt} Add it manually below.</p>}
        {analysis?.foods?.length > 0 && (
          <>
            <p style={{ fontSize: '0.82rem', opacity: 0.7 }}>
              Estimates{analysis.confidence != null ? ` (confidence ${Math.round(analysis.confidence * 100)}%)` : ''} —
              confirm each item to add it to today's diary.
            </p>
            {analysis.foods.map((f, i) => (
              <div key={`${f.name}-${i}`} className="intelligence-card" style={{ marginTop: '0.5rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span>
                  <strong>{f.name}</strong>{f.grams ? ` · ~${f.grams}g` : ''} — {Math.round(f.calories)} kcal, {f.protein ?? 0}g protein
                </span>
                <Button type="button" disabled={busy === 'saving'} onClick={() => confirmAnalyzedItem(f)}>Add</Button>
              </div>
            ))}
          </>
        )}
      </section>

      {/* ---- Manual entry ---- */}
      <section style={{ marginBottom: '1.25rem' }}>
        <h3>Add manually</h3>
        <form onSubmit={handleManualSave} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <input placeholder="Food" value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} required style={{ flex: '2 1 140px' }} />
          <input placeholder="kcal" type="number" min="0" max="5000" value={manual.calories} onChange={(e) => setManual((m) => ({ ...m, calories: e.target.value }))} required style={{ flex: '1 1 70px' }} />
          <input placeholder="protein g" type="number" min="0" max="300" step="0.1" value={manual.protein} onChange={(e) => setManual((m) => ({ ...m, protein: e.target.value }))} style={{ flex: '1 1 70px' }} />
          <Button type="submit" disabled={busy === 'saving'}>Add</Button>
        </form>
      </section>

      {/* ---- Today's diary ---- */}
      <section>
        <h3>Today's meals {summary?.mealCount ? `(${summary.mealCount})` : ''}</h3>
        {meals.length === 0 && <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>Nothing logged yet today.</p>}
        {meals.map((m) => (
          <div key={m.id} className="list-row">
            <span>
              {m.source === 'photo' ? '📷 ' : ''}{m.name} — {m.calories} kcal, {Number(m.protein)}g protein
            </span>
            <Button variant="ghost" type="button" onClick={() => handleDelete(m.id)}>✕</Button>
          </div>
        ))}
      </section>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
