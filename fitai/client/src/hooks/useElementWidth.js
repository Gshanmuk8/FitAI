import { useEffect, useState, useRef } from 'react';

/**
 * Measures an element's width in CSS pixels, kept current as it resizes.
 * Returns [ref, width]; width is 0 until first measured, so callers need a
 * fallback for the initial paint.
 */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
