import { useEffect, useState, useCallback, useRef } from "react";
import {
  getTodayChecklist,
  updateChecklistItem,
  updateChecklistValues,
  addCustomChecklistItem,
  toggleCustomChecklistItem,
  removeCustomChecklistItem,
} from "../services/workoutService";
import { createSerialQueue } from "../utils/productState";
export function useChecklist() {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(0);
  const queue = useRef(createSerialQueue());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const refresh = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    return queue.current(async () => {
      try {
        const row = await getTodayChecklist();
        if (mounted.current) {
          setChecklist(row);
          setError(null);
        }
      } catch (err) {
        if (mounted.current) setError(err.message);
      } finally {
        if (mounted.current) setLoading(false);
      }
    });
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);
  function mutate(work) {
    setPending((n) => n + 1);
    return queue.current(async () => {
      try {
        const row = await work();
        if (mounted.current) {
          setChecklist((prev) => ({ ...prev, ...row }));
          setError(null);
        }
        return row;
      } finally {
        if (mounted.current) setPending((n) => n - 1);
      }
    });
  }
  return {
    checklist,
    loading,
    error,
    pending,
    refresh,
    toggleItem: (field, value) =>
      mutate(() => updateChecklistItem(field, value)),
    setValues: (values) => mutate(() => updateChecklistValues(values)),
    addCustom: (label) => mutate(() => addCustomChecklistItem(label)),
    toggleCustom: (id, done) =>
      mutate(() => toggleCustomChecklistItem(id, done)),
    removeCustom: (id) => mutate(() => removeCustomChecklistItem(id)),
  };
}
