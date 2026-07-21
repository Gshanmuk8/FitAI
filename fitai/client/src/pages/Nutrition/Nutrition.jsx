import React, { useEffect, useRef, useState } from 'react';
import { analyzeFoodImage, saveMeal, getTodayMeals, deleteMeal } from '../../services/nutritionService';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';

const emptyManual = { name: '', calories: '', protein: '' };

// tone: which color the bar takes once the target line is crossed —
// emerald is right for protein everywhere and calories on a bulk, but a
// blown cut budget must read amber/red, never like a win. The % shown is
// the TRUE figure (108%), only the bar width caps at 100.
//
// Presented as a ledger column rather than a labelled bar: the figure is
// the thing being read, so it is set at display size and tabular, with the
// target as its denominator and the rail beneath as the reading aid. A bar
// with the number tucked above it in 0.8rem makes you read the bar — and a
// bar is a rough instrument for a number you have to act on.
function ProgressBar({ value, target, unit, label, fullTone = 'emerald' }) {
  if (!target) return null;
  const pct = Math.round((value / target) * 100);
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
        {Number(value).toLocaleString()}
        <span style={{ fontSize: 'var(--t-h3)', fontWeight: 500, color: 'var(--faint)', letterSpacing: '-0.014em' }}>
          / {Number(target).toLocaleString()}
        </span>
      </div>
      <div className="progress-track" style={{ marginTop: 'var(--s3)' }}>
        <div className={`progress-fill${pct >= 100 ? ` tone-${fullTone}` : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="progress-meta">
        <span>{unit}</span>
        <span className={pct > 100 && fullTone !== 'emerald' ? `tone-${fullTone}-text` : ''}>{pct}%</span>
      </div>
    </div>
  );
}

// What the calorie total means for THIS user's goal — mirrors the server's
// completion rule (checklistService.caloriesCompleted) so page and mission
// can never tell different stories.
function calorieStatus(summary) {
  const target = summary?.targets?.calorieTarget;
  if (!target || !summary.calories) return { tone: 'emerald', note: null };
  const v = summary.calories;
  const goal = summary.goal;
  const over = Math.round(v - target);
  if (goal === 'lose_fat') {
    if (v > target * 1.05) return { tone: 'red', note: `⚠ ${over.toLocaleString()} kcal over your cut budget — shown on today's mission too.` };
    if (v > target) return { tone: 'amber', note: `${over.toLocaleString()} kcal over target — still inside the 5% grace, but stop here.` };
    return { tone: 'emerald', note: summary.caloriesCompleted ? "✓ On budget — synced to today's mission." : null };
  }
  if (goal === 'build_muscle') {
    if (v >= target * 0.95) return { tone: 'emerald', note: "✓ Fuel target reached — checked off on today's mission." };
    return { tone: 'emerald', note: `${Math.round(target - v).toLocaleString()} kcal still to eat to fuel the build.` };
  }
  if (v > target * 1.1) return { tone: 'amber', note: `⚠ ${over.toLocaleString()} kcal over your maintenance band.` };
  return { tone: 'emerald', note: summary.caloriesCompleted ? "✓ Within your maintenance band — synced to today's mission." : null };
}

// Pending photo analysis survives a refresh — losing it would force the
// user to pay a second AI analysis for the same plate. Keyed per user so
// a draft never survives an account switch in the same tab.
const analysisKey = (userId) => `fitai.pendingAnalysis.${userId}`;
function loadPendingAnalysis(userId) {
  try {
    // Drop the legacy shared key: drafts written before per-user keying
    // must not surface for whoever logs in next.
    sessionStorage.removeItem('fitai.pendingAnalysis');
    if (!userId) return null;
    return JSON.parse(sessionStorage.getItem(analysisKey(userId))) || null;
  } catch {
    return null;
  }
}

export default function Nutrition() {
  const { user } = useAuth();
  const [analysis, setAnalysisState] = useState(() => loadPendingAnalysis(user?.id)); // items pending confirmation
  // null = never loaded (or the load failed), [] = genuinely empty. The two
  // must render differently: "nothing logged yet" over a failed load is a
  // lie that makes people re-log meals they already have.
  const [meals, setMeals] = useState(null);
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
        if (user?.id) {
          if (value?.foods?.length) sessionStorage.setItem(analysisKey(user.id), JSON.stringify(value));
          else sessionStorage.removeItem(analysisKey(user.id));
        }
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
      setError('');
    } catch (err) {
      // Leave `meals` null on failure. Setting it to [] renders "Nothing
      // logged yet today" over a day that may hold four meals, and people
      // re-log food they already logged — double-counting the day.
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
    <div className="page page-mid page-enter">
      <header className="page-header">
        <div>
          <p className="eyebrow" style={{ margin: '0 0 var(--s1)' }}>Today</p>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Nutrition</h2>
        </div>
      </header>

      {/* ---- Today so far — every save/delete here re-syncs these same
              numbers into the dashboard's mission rows.

              This is the answer the page exists to give, so it is the first
              and largest thing: two figures in the ledger, tabular, with
              their targets as denominators. The status sentence sits under
              the rule as a caption — it explains the number, it does not
              compete with it. */}
      {summary && (() => {
        const cal = calorieStatus(summary);
        const proteinOver = summary.targets?.proteinGrams != null && summary.protein > summary.targets.proteinGrams
          ? Math.round((summary.protein - summary.targets.proteinGrams) * 10) / 10
          : null;
        return (
          <section style={{ marginBottom: 'var(--s6)' }}>
            {summary.targets && (
              <div className="stat-grid" style={{ marginBottom: 'var(--s3)' }}>
                <ProgressBar label="Calories" value={summary.calories} target={summary.targets?.calorieTarget} unit="kcal" fullTone={cal.tone} />
                <ProgressBar label="Protein" value={summary.protein} target={summary.targets?.proteinGrams} unit="g protein" />
              </div>
            )}
            {!summary.targets && (
              <p className="notice">Complete onboarding to get calorie and protein targets.</p>
            )}
            {/* Colour only where it changes the decision: an over-budget day
                keeps its amber/red ink, a confirmation goes quiet. A green
                tick set in green is the same tick twice. */}
            {cal.note && (
              <p className={`small ${cal.tone === 'emerald' ? 'muted' : `tone-${cal.tone}-text`}`} style={{ margin: '0 0 var(--s1)' }}>
                {cal.note}
              </p>
            )}
            {summary.proteinTargetHit && (
              <p className="small muted" style={{ margin: 0 }}>
                ✓ Protein target hit{proteinOver ? ` (+${proteinOver}g)` : ''} — checked off on today's mission.
              </p>
            )}
          </section>
        );
      })()}

      {/* ---- Photo analysis ----
              The capture action is the screen's ONE pigment moment: photo →
              confirm → diary is the loop, and the camera is where it starts. */}
      <section style={{ marginBottom: 'var(--s6)' }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Log a meal</h3>
        {/* Two entry points, one pipeline: the camera on mobile (capture
            hints the OS to open it directly), the picker everywhere. Both
            are hidden inputs behind labelled buttons — a bare file input
            gives no hint that the camera works at all. */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={busy === 'analyzing'} style={{ display: 'none' }} />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} disabled={busy === 'analyzing'} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
          <Button type="button" disabled={busy === 'analyzing'} onClick={() => cameraInputRef.current?.click()} style={{ minHeight: 52, flex: '2 1 220px' }}>
            📷 Take a photo
          </Button>
          <Button type="button" variant="ghost" disabled={busy === 'analyzing'} onClick={() => fileInputRef.current?.click()} style={{ minHeight: 52, flex: '1 1 160px' }}>
            Upload a photo
          </Button>
        </div>

        {busy === 'analyzing' && (
          <p className="page-loading" style={{ padding: 'var(--s4) 0 0', textAlign: 'left' }}>Analyzing your photo…</p>
        )}

        {/* Two different failures wear the same shape. `source: 'fallback'`
            means the whole vision cascade was unreachable — blaming the
            photo there sends people off to retake, crop and re-shoot a
            perfectly good plate, burning an AI-limited request each time. */}
        {analysis?.needsManualInput && (
          <p className="notice">
            {analysis.source === 'fallback'
              ? "Your coach couldn't be reached to read this photo — nothing wrong with your picture. Add it manually below, or try again in a moment."
              : `${analysis.prompt} Add it manually below.`}
          </p>
        )}

        {/* The confirm step: estimates are rows on a rule, not a stack of
            cards. They are one list of one plate — six card edges around six
            lines of text is packaging around nothing. */}
        {analysis?.foods?.length > 0 && (
          <div className="card" style={{ marginTop: 'var(--s4)', padding: 'var(--s4)' }}>
            <div className="page-header" style={{ marginBottom: 'var(--s2)' }}>
              <p className="small muted" style={{ margin: 0 }}>Estimates — add the plate, or pick items individually.</p>
              <Button type="button" disabled={busy === 'saving'} onClick={confirmAll}>
                {busy === 'saving' ? 'Adding…' : `Add all ${analysis.foods.length > 1 ? analysis.foods.length + ' items' : ''}`.trim()}
              </Button>
            </div>
            {analysis.foods.map((f, i) => (
              <div key={`${f.name}-${i}`} className="list-row" style={{ alignItems: 'baseline', gap: 'var(--s3)' }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ fontWeight: 550 }}>{f.name}</strong>
                  {f.grams ? <span className="muted">{` · ~${f.grams}g`}</span> : ''}
                  <span className="mono muted" style={{ display: 'block', marginTop: '0.15rem' }}>
                    {Math.round(f.calories)} kcal · {f.protein ?? 0}g protein
                  </span>
                </span>
                <Button variant="ghost" type="button" disabled={busy === 'saving'} onClick={() => confirmAnalyzedItem(f)}>Add</Button>
              </div>
            ))}
          </div>
        )}

        {/* ---- Manual entry — the same section, because it is the same job:
                getting a meal into the diary. It sits below the camera as
                the quieter of the two routes. ---- */}
        <form
          onSubmit={handleManualSave}
          style={{
            display: 'flex',
            gap: 'var(--s1)',
            flexWrap: 'wrap',
            marginTop: 'var(--s4)',
            paddingTop: 'var(--s4)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span className="eyebrow" style={{ flex: '1 1 100%', marginBottom: 'var(--s1)' }}>Or type it in</span>
          <input placeholder="Food" value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} required style={{ flex: '2 1 140px' }} />
          <input placeholder="kcal" type="number" min="0" max="5000" value={manual.calories} onChange={(e) => setManual((m) => ({ ...m, calories: e.target.value }))} required style={{ flex: '1 1 70px', fontVariantNumeric: 'tabular-nums' }} />
          <input placeholder="protein g" type="number" min="0" max="300" step="0.1" value={manual.protein} onChange={(e) => setManual((m) => ({ ...m, protein: e.target.value }))} style={{ flex: '1 1 70px', fontVariantNumeric: 'tabular-nums' }} />
          <Button type="submit" variant="ghost" disabled={busy === 'saving'}>{busy === 'saving' ? 'Adding…' : 'Add'}</Button>
        </form>
      </section>

      {/* ---- Today's diary — a list of rows. The count lives in the section
              rule so the heading stays a heading. ---- */}
      <section>
        <h3 className="section-title">
          <span>Today's meals</span>
          {summary?.mealCount ? <span className="mono" style={{ letterSpacing: '0.14em' }}>{`(${summary.mealCount})`}</span> : ''}
        </h3>

        {loading && <p className="page-loading" style={{ padding: 'var(--s5) 0', textAlign: 'left' }}>Loading today's diary…</p>}

        {/* meals === null is NOT "empty" — it is "we don't know". Saying
            "nothing logged yet" over a failed load makes people re-add food
            they already have. It gets the loudest treatment on the page
            after the totals, because acting on it wrongly costs real data. */}
        {!loading && meals === null && (
          <div className="notice tone-red" style={{ padding: 'var(--s4)' }}>
            <p style={{ margin: '0 0 var(--s3)', color: 'var(--text)' }}>
              Couldn't load today's diary{error ? ` — ${error}` : ''}. Your logged meals are safe — don't re-add them.
            </p>
            <Button onClick={refreshDiary}>Try again</Button>
          </div>
        )}

        {/* The genuine empty day: an invitation, with room around it. */}
        {!loading && meals?.length === 0 && (
          <p
            className="small muted"
            style={{
              margin: 0,
              padding: 'var(--s6) var(--s4)',
              textAlign: 'center',
              border: '1px dashed var(--border2)',
              borderRadius: 'var(--r-lg)',
            }}
          >
            Nothing logged yet today — snap a photo or add a meal above.
          </p>
        )}

        {(meals || []).map((m) => (
          <div key={m.id} className="list-row" style={{ alignItems: 'baseline', gap: 'var(--s3)', paddingTop: 'var(--s3)', paddingBottom: 'var(--s3)' }}>
            <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 'var(--s2)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500 }}>{m.name}</span>
              {m.source === 'photo' && <span className="chip tone-cyan">photo</span>}
              <span className="mono muted" style={{ whiteSpace: 'nowrap' }}>{m.calories} kcal · {Number(m.protein)}g protein</span>
            </span>
            <button
              type="button"
              className="ghost-button"
              disabled={deletingId === m.id}
              aria-label={`Remove ${m.name}`}
              onClick={() => handleDelete(m.id, m.name)}
              style={{ flex: 'none', minWidth: 32, minHeight: 32, color: 'var(--faint)' }}
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {error && <p className="error-text" style={{ marginTop: 'var(--s4)' }}>{error}</p>}
    </div>
  );
}
