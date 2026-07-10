import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getTodayChecklist, updateChecklistItem, updateChecklistValues,
  addCustomChecklistItem, toggleCustomChecklistItem, removeCustomChecklistItem,
} from '../services/workoutService';

export function useChecklist() {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Monotonic guard: rapid toggles can resolve out of order — only the
  // latest response is allowed to write state.
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setChecklist(await getTodayChecklist());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // A tab left open across the user's midnight still shows yesterday under
  // "Today's mission" — refetch whenever the tab regains focus so the day
  // (and any changes made in another tab) stay truthful.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        getTodayChecklist().then(setChecklist).catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // Optimistic: flip immediately (a checkbox that doesn't move on click
  // reads as broken on slow networks), reconcile with the server response,
  // revert on failure so a failed toggle never reads as success.
  async function toggleItem(field, value) {
    const mySeq = ++seq.current;
    setChecklist((prev) => (prev ? { ...prev, [field]: value } : prev));
    try {
      const updated = await updateChecklistItem(field, value);
      if (seq.current === mySeq) setChecklist((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      if (seq.current === mySeq) setChecklist((prev) => (prev ? { ...prev, [field]: !value } : prev));
      throw err;
    }
  }

  // Manual value entry (protein/water/sleep/steps/weight/notes). The server
  // writes the value AND flips the matching *_completed flag, then returns the
  // full row — so a single call keeps numbers and checkboxes in sync.
  async function setValues(values) {
    const mySeq = ++seq.current;
    const updated = await updateChecklistValues(values);
    if (seq.current === mySeq) setChecklist((prev) => ({ ...prev, ...updated }));
    return updated;
  }

  // Custom (user-authored) items. Each server call returns the whole updated
  // row — reconcile the same way setValues does. Toggle is optimistic like
  // the plan items; add/remove wait for the server (an item that appears and
  // then vanishes reads worse than a short wait).
  async function addCustom(label) {
    const mySeq = ++seq.current;
    const updated = await addCustomChecklistItem(label);
    if (seq.current === mySeq) setChecklist((prev) => ({ ...prev, ...updated }));
    return updated;
  }

  async function toggleCustom(id, done) {
    const mySeq = ++seq.current;
    setChecklist((prev) => prev ? {
      ...prev,
      custom_items: (prev.custom_items || []).map((i) => (i.id === id ? { ...i, done } : i)),
    } : prev);
    try {
      const updated = await toggleCustomChecklistItem(id, done);
      if (seq.current === mySeq) setChecklist((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      if (seq.current === mySeq) {
        setChecklist((prev) => prev ? {
          ...prev,
          custom_items: (prev.custom_items || []).map((i) => (i.id === id ? { ...i, done: !done } : i)),
        } : prev);
      }
      throw err;
    }
  }

  async function removeCustom(id) {
    const mySeq = ++seq.current;
    const updated = await removeCustomChecklistItem(id);
    if (seq.current === mySeq) setChecklist((prev) => ({ ...prev, ...updated }));
    return updated;
  }

  return { checklist, loading, error, refresh, toggleItem, setValues, addCustom, toggleCustom, removeCustom };
}
