import { useEffect, useRef, useState } from "react";

// The connect/rewire gestures every connectable canvas shares — the Discovery board and a spec's
// flow map. Each canvas keeps its own layout, drawing and rules; this owns only the pointer work:
//
//   - drag from a node's handle onto a node → onConnect(from, to, "drag")
//   - tap a handle (or Enter/Space on it) → click-connect mode: `connectFrom` holds the source
//     until completeConnect(to) is called (a target button or a click on a node) → onConnect(from,
//     to, "click"); Escape or tapping the same handle again cancels
//   - drag an existing connector → onRewire(id, from, to | null) — null when released over no valid
//     node, which both canvases treat as "remove"
//   - tap a connector without moving it → onTapLink(id)
//
// `pending` describes a drag in flight — { from, x, y, over, moved, rewireId? } in coordinates
// relative to `containerRef` — for the canvas to draw its preview and target highlight from.
// Nodes mark themselves with `data-node-id`; `canTarget(from, to, el)` decides which are valid.
// A drag only counts once it has moved a few pixels, so a slightly unsteady tap stays a tap.

const DRAG_THRESHOLD = 4;

export function useConnectGesture({ containerRef, canTarget, onConnect, onRewire, onTapLink }) {
  const [pending, setPending] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const origin = useRef(null);

  useEffect(() => {
    if (connectFrom == null) return;
    const onKey = (e) => { if (e.key === "Escape") setConnectFrom(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectFrom]);

  const point = (e) => {
    const r = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // A DOM attribute is always a string. Some canvases use numeric ids (the board's actions and
  // results) and some UUID strings (signals, insights, flow steps), so only re-numify what is one.
  const targetAt = (e, from) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-node-id]");
    if (!el) return null;
    const raw = el.getAttribute("data-node-id");
    const n = Number(raw);
    const id = raw !== "" && !Number.isNaN(n) ? n : raw;
    return id !== from && canTarget(from, id, el) ? id : null;
  };

  const start = (fields) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
    origin.current = { x: e.clientX, y: e.clientY };
    setPending({ ...fields, ...point(e), over: null, moved: false });
  };

  const move = (e) => {
    if (!pending) return;
    const o = origin.current;
    const moved = pending.moved || Math.hypot(e.clientX - o.x, e.clientY - o.y) > DRAG_THRESHOLD;
    setPending({ ...pending, ...point(e), moved, over: moved ? targetAt(e, pending.from) : null });
  };

  const end = () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    if (p.rewireId != null) {
      if (!p.moved) onTapLink?.(p.rewireId);
      else onRewire(p.rewireId, p.from, p.over);
    } else if (!p.moved) {
      setConnectFrom((cur) => (cur === p.from ? null : p.from));
    } else if (p.over != null) {
      onConnect(p.from, p.over, "drag");
    }
  };

  const cancel = () => setPending(null);

  // Spread onto a node's connect handle.
  const handleProps = (id) => ({
    onPointerDown: start({ from: id }),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setConnectFrom((cur) => (cur === id ? null : id)); }
    },
  });

  // Spread onto a connector's (wide, transparent) hit path. `link` is { id, from }.
  const linkProps = (link) => ({
    onPointerDown: start({ from: link.from, rewireId: link.id }),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
  });

  const completeConnect = (to) => {
    if (connectFrom == null) return;
    const from = connectFrom;
    setConnectFrom(null);
    if (to !== from) onConnect(from, to, "click");
  };

  return { pending, connectFrom, setConnectFrom, completeConnect, handleProps, linkProps };
}
