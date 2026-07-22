import { useEffect, useState, useRef } from 'react';

/**
 * Measures an element's content width in CSS pixels and keeps it current as
 * the element resizes (rotation, foldable unfold, window drag). Returns
 * [ref, width]; width is 0 until the first measurement, so callers pick a
 * sensible fallback for the initial paint.
 *
 * Why this exists: the Progress charts draw into an SVG whose viewBox we set
 * to the REAL pixel width, so one SVG user unit equals one CSS pixel. That is
 * what keeps an 11px axis label rendering at 11px on a 360px phone instead of
 * being scaled down to ~6px by a fixed 640-wide viewBox. Legibility on small
 * screens is a sizing problem, and the size we need is the on-screen one.
 */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // ResizeObserver is supported everywhere this app runs; guard anyway so a
    // missing implementation degrades to the one-time measurement below
    // rather than throwing during render.
    const measure = () => setWidth(el.clientWidth);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
