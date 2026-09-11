import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

// Measured positions of a canvas's nodes, relative to `containerRef` — what connectors are drawn
// from. Register an element with `ref={setRef(id)}`; `rects[id]` is then
// { left, right, top, bottom, cx, cy }. Re-measured after every render (cheap at this scale, and
// the only way to catch a card growing as you type) and whenever the container or window resizes;
// the state only changes when a rect actually did, so measuring can't loop.
export function useRects(containerRef) {
  const els = useRef({});
  const [rects, setRects] = useState({});
  const [, bump] = useReducer((x) => x + 1, 0);

  const setRef = (id) => (el) => { if (el) els.current[id] = el; else delete els.current[id]; };

  const measure = () => {
    const box = containerRef.current;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const next = {};
    for (const id in els.current) {
      const r = els.current[id].getBoundingClientRect();
      next[id] = {
        left: r.left - b.left, right: r.right - b.left, top: r.top - b.top, bottom: r.bottom - b.top,
        cx: r.left - b.left + r.width / 2, cy: r.top - b.top + r.height / 2,
      };
    }
    setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  };
  // Deliberately after every render (no deps) — the equality check above is what stops it looping.
  useLayoutEffect(measure);

  useEffect(() => {
    const ro = new ResizeObserver(bump);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", bump);
    return () => { ro.disconnect(); window.removeEventListener("resize", bump); };
  }, [containerRef]);

  return { setRef, rects, els };
}
