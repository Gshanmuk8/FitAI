import { useEffect, useState, useCallback } from 'react';
import { getTodayChecklist, updateChecklistItem } from '../services/workoutService';

export function useChecklist() {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  async function toggleItem(field, value) {
    const updated = await updateChecklistItem(field, value);
    setChecklist((prev) => ({ ...prev, ...updated }));
  }

  return { checklist, loading, error, refresh, toggleItem };
}
