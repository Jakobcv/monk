import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, BG, BG_SIDEBAR, SIZE, WEIGHT, RADIUS, MOTION } from "./lib/theme";
import { editArea } from "./ui/text";
import { cornerBadge } from "./ui/cardStyles";
import AutoTextarea from "./ui/AutoTextarea";
import IconButton from "./ui/IconButton";

// MOCKUP ONLY (DEV route #/flow-preview) — local state, nothing persists. A spec's flow map: a
// story map where rows are the Design tab's use cases (in priority order) and columns are stages
// you name. Cards are steps; connectors go from any step to any other and can carry a label.
//
// Connector readability, per graph-drawing research (crossings hurt most, then high curvature;
// swimlane practice: flow left→right, don't attach to tops/bottoms):
//   1. Orthogonal, gutter-only routing. Every connector leaves a card's right edge and enters the
//      target's left edge; in between it travels only along column and row boundaries — never
//      behind a card — with small rounded corners.
//   2. Distinct ports and lanes. Several connectors on one card side get their own ports, ordered
//      by the far end to avoid crossing; connectors sharing a gutter get parallel lanes.
//   3. Focus on demand, not colour-coding. At rest every line is one quiet grey. Hovering a step
//      (or a use case) brings its whole path forward in ink and dims the rest.
// Loop-backs are dashed. A label sits on its connector's longest straight run.

const TIERS = ["Primary", "Secondary", "Tertiary"];
const HEADER_W = 220;
const LINE = "#A9A9A5";
const LANE = 6;     // px between parallel lanes in one gutter
const CORNER = 6;   // corner radius

let seq = 100;
const nid = (p) => `${p}${seq++}`;

const SAMPLE = {
  columns: [
    { id: "c1", name: "Discover" }, { id: "c2", name: "Choose" },
    { id: "c3", name: "Export" }, { id: "c4", name: "Share" },
  ],
  rows: [
    { id: "r1", tier: 0, text: "Export every signal behind one insight as a shareable doc" },
    { id: "r2", tier: 1, text: "Export a filtered set of signals from Research Repository" },
    { id: "r3", tier: 2, text: "Re-export after edits without redoing the selection" },
  ],
  cards: [
    { id: "a", row: "r1", col: "c1", text: "Open insight" },
    { id: "b", row: "r1", col: "c2", text: "Pick format" },
    { id: "x", row: "r1", col: "c2", text: "Export disabled — explain why" },
    { id: "c", row: "r1", col: "c3", text: "Preview the doc" },
    { id: "d", row: "r1", col: "c4", text: "Copy link" },
    { id: "e", row: "r2", col: "c1", text: "Filter the repository" },
    { id: "f", row: "r2", col: "c2", text: "Select signals" },
    { id: "g", row: "r3", col: "c2", text: "Reopen last export" },
    { id: "h", row: "r3", col: "c3", text: "Re-export" },
  ],
  links: [
    { id: "l1", from: "a", to: "b", label: "" },
    { id: "l2", from: "a", to: "x", label: "no linked signals" },
    { id: "l3", from: "b", to: "c", label: "" },
    { id: "l4", from: "c", to: "d", label: "" },
    { id: "l5", from: "c", to: "b", label: "change format" },
    { id: "l6", from: "e", to: "f", label: "" },
    { id: "l7", from: "f", to: "b", label: "" },
    { id: "l8", from: "g", to: "h", label: "" },
    { id: "l9", from: "h", to: "d", label: "" },
  ],
};

// Polyline → SVG path with rounded corners (radius clamped to half of each adjoining run).
function roundedPath(pts) {
  const p = pts.filter((q, i) => i === 0 || Math.abs(q.x - pts[i - 1].x) > 0.5 || Math.abs(q.y - pts[i - 1].y) > 0.5);
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1];
    const d1 = Math.hypot(b.x - a.x, b.y - a.y), d2 = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(CORNER, d1 / 2, d2 / 2);
    const p1 = { x: b.x - ((b.x - a.x) / d1) * r, y: b.y - ((b.y - a.y) / d1) * r };
    const p2 = { x: b.x + ((c.x - b.x) / d2) * r, y: b.y + ((c.y - b.y) / d2) * r };
    d += ` L${p1.x} ${p1.y} Q${b.x} ${b.y} ${p2.x} ${p2.y}`;
  }
  const z = p[p.length - 1];
  return `${d} L${z.x} ${z.y}`;
}

// Where a label sits: the middle of the connector's longest straight run.
function labelAt(pts) {
  let best = null, len = -1;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (l > len) { len = l; best = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 }; }
  }
  return best;
}

// All connector geometry for the current layout. `layout` holds measured card rects and the
// column/row boundaries (the gutters connectors are allowed to travel along).
function computeRoutes(m, layout) {
  const { cards: cp, cols, rows } = layout;
  if (!cp || !cols || !rows) return [];
  const colIdx = Object.fromEntries(m.columns.map((c, i) => [c.id, i]));
  const rowIdx = Object.fromEntries(m.rows.map((r, i) => [r.id, i]));
  const card = Object.fromEntries(m.cards.map((c) => [c.id, c]));
  const links = m.links.filter((l) => cp[l.from] && cp[l.to] && cols[card[l.from]?.col] && cols[card[l.to]?.col]);

  // Ports: spread a card side's connectors along it, ordered by where their other end sits.
  const port = {};
  const spread = (byCard, key, otherEnd) => {
    for (const [id, list] of Object.entries(byCard)) {
      const r = cp[id];
      list.sort((a, b) => cp[a[otherEnd]].cy - cp[b[otherEnd]].cy);
      list.forEach((l, k) => { port[`${l.id}:${key}`] = r.top + ((r.bottom - r.top) * (k + 1)) / (list.length + 1); });
    }
  };
  const outs = {}, ins = {};
  for (const l of links) { (outs[l.from] ||= []).push(l); (ins[l.to] ||= []).push(l); }
  spread(outs, "out", "to");
  spread(ins, "in", "from");

  const blocked = (x1, x2, y, skip) => Object.entries(cp).some(([id, r]) =>
    !skip.includes(id) && r.right > x1 && r.left < x2 && y > r.top - 4 && y < r.bottom + 4);

  const routes = links.map((l) => {
    const a = card[l.from], b = card[l.to];
    const sc = colIdx[a.col], tc = colIdx[b.col], sr = rowIdx[a.row], tr = rowIdx[b.row];
    const sy = port[`${l.id}:out`], ty = port[`${l.id}:in`];
    const gx1 = cols[a.col].right, gx2 = cols[b.col].left;
    // Which row boundary to travel along when a connector can't go straight: the one between the
    // source's row and the target's, or the source row's top edge for same-row detours and loops.
    const hy = tr > sr ? rows[a.row].bottom : rows[a.row].top;
    const r = { l, sx: cp[l.from].right, tx: cp[l.to].left, sy, ty, back: tc < sc, v1: null, h: null, v2: { x: gx2, span: 0 } };
    if (tc === sc + 1) {
      // Next stage: one elbow in the gutter between them.
    } else if (tc > sc && !blocked(gx1, gx2, sy, [l.from, l.to])) {
      // Skipping stages with a clear run at the port's height: straight across, elbow at the end.
    } else {
      r.v1 = { x: gx1 };
      r.h = { y: hy };
    }
    r.v2.span = Math.min(r.h ? r.h.y : sy, ty);
    if (r.v1) { r.v1.span = Math.min(sy, hy); r.h.span = Math.min(gx1, gx2); }
    return r;
  });

  // Lanes: connectors running in the same gutter get parallel offsets, ordered by where they start.
  const lanes = (items) => {
    const groups = {};
    for (const it of items) (groups[Math.round(it.x ?? it.y)] ||= []).push(it);
    for (const g of Object.values(groups)) {
      g.sort((p, q) => p.span - q.span);
      g.forEach((it, k) => { it.off = (k - (g.length - 1) / 2) * LANE; });
    }
  };
  lanes(routes.flatMap((r) => [r.v1, r.v2].filter(Boolean)));
  lanes(routes.map((r) => r.h).filter(Boolean));

  return routes.map((r) => {
    const X2 = r.v2.x + r.v2.off;
    const pts = [{ x: r.sx, y: r.sy }];
    if (r.v1) {
      const X1 = r.v1.x + r.v1.off, Y = r.h.y + r.h.off;
      pts.push({ x: X1, y: r.sy }, { x: X1, y: Y }, { x: X2, y: Y });
    } else {
      pts.push({ x: X2, y: r.sy });
    }
    pts.push({ x: X2, y: r.ty }, { x: r.tx, y: r.ty });
    return { link: r.l, d: roundedPath(pts), at: labelAt(pts), back: r.back };
  });
}

export default function FlowMapMock() {
  const [m, setM] = useState(SAMPLE);
  const [layout, setLayout] = useState({});
  const [connectFrom, setConnectFrom] = useState(null);
  const [selLink, setSelLink] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);
  const [hoverRow, setHoverRow] = useState(null);
  const [fresh, setFresh] = useState(null);
  const gridRef = useRef(null);
  const cardEls = useRef({});
  const colEls = useRef({});
  const rowEls = useRef({});

  const set = (key, fn) => setM((p) => ({ ...p, [key]: fn(p[key]) }));
  const patch = (key, id, fields) => set(key, (xs) => xs.map((x) => (x.id === id ? { ...x, ...fields } : x)));

  const addCard = (row, col) => { const id = nid("k"); setFresh(id); set("cards", (cs) => [...cs, { id, row, col, text: "" }]); };
  const removeCard = (id) => setM((p) => ({ ...p, cards: p.cards.filter((c) => c.id !== id), links: p.links.filter((l) => l.from !== id && l.to !== id) }));
  const addColumn = () => { const id = nid("c"); setFresh(id); set("columns", (cs) => [...cs, { id, name: "" }]); };
  const removeColumn = (id) => setM((p) => {
    const gone = new Set(p.cards.filter((c) => c.col === id).map((c) => c.id));
    return { ...p, columns: p.columns.filter((c) => c.id !== id), cards: p.cards.filter((c) => !gone.has(c.id)), links: p.links.filter((l) => !gone.has(l.from) && !gone.has(l.to)) };
  });
  const addRow = () => { const id = nid("r"); setFresh(id); set("rows", (rs) => [...rs, { id, tier: 2, text: "" }]); };
  // Drag from a step's handle onto another step to connect them — the Discovery board's gesture.
  // A dashed preview follows the pointer and snaps (solid, with an arrowhead) onto the step under
  // it. A tap without movement falls back to click-to-connect instead, as does Enter/Space.
  const [drag, setDrag] = useState(null); // { from, x, y, over, moved }
  const dragOrigin = useRef(null);
  const gridPoint = (e) => {
    const r = gridRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const cardUnder = (e, from) => {
    const id = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-card-id]")?.getAttribute("data-card-id");
    return id && id !== from ? id : null;
  };
  const startDrag = (from) => (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    setSelLink(null);
    setDrag({ from, ...gridPoint(e), over: null, moved: false });
  };
  const moveDrag = (e) => {
    if (!drag) return;
    const o = dragOrigin.current;
    const moved = drag.moved || Math.hypot(e.clientX - o.x, e.clientY - o.y) > 4;
    setDrag({ ...drag, ...gridPoint(e), over: moved ? cardUnder(e, drag.from) : null, moved });
  };
  const endDrag = () => {
    if (!drag) return;
    if (!drag.moved) setConnectFrom(drag.from);
    else if (drag.over && !m.links.some((l) => l.from === drag.from && l.to === drag.over)) {
      set("links", (ls) => [...ls, { id: nid("l"), from: drag.from, to: drag.over, label: "" }]);
    }
    setDrag(null);
  };

  const finishConnect = (to) => {
    if (connectFrom && to !== connectFrom && !m.links.some((l) => l.from === connectFrom && l.to === to)) {
      set("links", (ls) => [...ls, { id: nid("l"), from: connectFrom, to, label: "" }]);
    }
    setConnectFrom(null);
  };

  // Card rects and gutter boundaries, relative to the grid (the SVG and label layer live inside
  // it, so they scroll with it). Re-measured on every change and whenever the grid resizes.
  const measure = () => {
    const g = gridRef.current;
    if (!g) return;
    const gr = g.getBoundingClientRect();
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left - gr.left, right: r.right - gr.left, top: r.top - gr.top, bottom: r.bottom - gr.top, cx: (r.left + r.right) / 2 - gr.left, cy: (r.top + r.bottom) / 2 - gr.top };
    };
    const pick = (els) => Object.fromEntries(Object.entries(els).filter(([, el]) => el).map(([id, el]) => [id, rel(el)]));
    setLayout({ cards: pick(cardEls.current), cols: pick(colEls.current), rows: pick(rowEls.current) });
  };
  useLayoutEffect(measure, [m]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setConnectFrom(null); setSelLink(null); }
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
      if ((e.key === "Delete" || e.key === "Backspace") && selLink && !typing) {
        set("links", (ls) => ls.filter((l) => l.id !== selLink));
        setSelLink(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const routes = computeRoutes(m, layout);

  // Focus: a hovered step's whole path (everything upstream and downstream of it), a hovered use
  // case's connectors, or the selected connector. Everything else dims.
  const focus = (() => {
    if (connectFrom || drag) return null;
    if (hoverCard) {
      const onPath = new Set([hoverCard]);
      for (const forward of [true, false]) {
        const queue = [hoverCard], seen = new Set([hoverCard]);
        while (queue.length) {
          const at = queue.shift();
          for (const l of m.links) {
            const [from, to] = forward ? [l.from, l.to] : [l.to, l.from];
            if (from === at && !seen.has(to)) { seen.add(to); queue.push(to); onPath.add(to); }
          }
        }
      }
      return { cards: onPath, links: new Set(m.links.filter((l) => onPath.has(l.from) && onPath.has(l.to)).map((l) => l.id)) };
    }
    if (hoverRow) {
      const inRow = new Set(m.cards.filter((c) => c.row === hoverRow).map((c) => c.id));
      const ls = m.links.filter((l) => inRow.has(l.from) || inRow.has(l.to));
      const cards = new Set([...inRow, ...ls.flatMap((l) => [l.from, l.to])]);
      return { cards, links: new Set(ls.map((l) => l.id)) };
    }
    if (selLink) {
      const l = m.links.find((x) => x.id === selLink);
      return l ? { cards: new Set([l.from, l.to]), links: new Set([l.id]) } : null;
    }
    return null;
  })();
  const cardDim = (id) => focus && !focus.cards.has(id);
  const linkOn = (id) => !focus || focus.links.has(id);

  const cols = `${HEADER_W}px repeat(${m.columns.length}, minmax(200px, 1fr)) 52px`;
  const cellBorder = { borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` };
  const fade = `opacity ${MOTION.base} ${MOTION.ease}`;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setSelLink(null); }}
      style={{ position: "relative", height: "100%", backgroundColor: BG_SIDEBAR, border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "auto", fontFamily: font }}
    >
      <style>{`
        .fm-cell .fm-add { opacity: 0; transition: opacity 120ms ease; }
        .fm-cell:hover .fm-add, .fm-cell:focus-within .fm-add { opacity: 1; }
        .fm-col:hover .fm-col-x, .fm-col:focus-within .fm-col-x { opacity: 1; }
        .fm-col-x { opacity: 0; transition: opacity 120ms ease; }
        .fm-link { transition: stroke ${MOTION.base} ${MOTION.ease}, stroke-width ${MOTION.fast} ${MOTION.ease}, opacity ${MOTION.base} ${MOTION.ease}; }
        .fm-connecting .fm-card:not(.fm-source):hover { outline: 2px solid ${INK_SOFT}; outline-offset: 2px; cursor: crosshair; }
        /* Mid-drag nothing is selectable — a stray text selection under the pointer is never meant. */
        .fm-dragging, .fm-dragging * { user-select: none; -webkit-user-select: none; cursor: grabbing !important; }
      `}</style>

      {connectFrom && (
        <div style={{ position: "sticky", top: 0, left: 0, zIndex: 6, display: "flex", justifyContent: "center", pointerEvents: "none", height: 0 }}>
          <div style={{ marginTop: "8px", padding: "4px 10px", borderRadius: RADIUS.pill, background: INK, color: "#fff", fontSize: SIZE.xs, fontWeight: WEIGHT.medium, boxShadow: "var(--edge-float)", whiteSpace: "nowrap", height: "fit-content" }}>
            Click a step to connect · Esc to cancel
          </div>
        </div>
      )}

      <div
        ref={gridRef}
        className={[connectFrom && "fm-connecting", drag && "fm-dragging"].filter(Boolean).join(" ") || undefined}
        style={{ position: "relative", display: "grid", gridTemplateColumns: cols, minWidth: "min-content" }}
      >
        {/* Stage header row */}
        <div style={{ ...cellBorder, position: "sticky", left: 0, zIndex: 4, background: BG_SIDEBAR, padding: "14px 16px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: SIZE.micro, fontWeight: WEIGHT.semibold, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_SOFT }}>Use cases</span>
        </div>
        {m.columns.map((c) => (
          <div key={c.id} ref={(el) => { colEls.current[c.id] = el; }} className="fm-col" style={{ ...cellBorder, padding: "12px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              autoFocus={fresh === c.id}
              value={c.name} onChange={(e) => patch("columns", c.id, { name: e.target.value })}
              placeholder="Stage name" aria-label="Stage name"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: font, fontSize: SIZE.sm, fontWeight: WEIGHT.semibold, color: INK, padding: "2px 0" }}
            />
            <IconButton className="fm-col-x" title="Remove stage (and its steps)" onClick={() => removeColumn(c.id)} style={{ color: INK_SOFT, "--hit": "28px" }}>
              <X size={14} />
            </IconButton>
          </div>
        ))}
        <div style={{ borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconButton title="Add a stage" onClick={addColumn} style={{ color: INK_SOFT, "--hit": "32px" }}><Plus size={16} /></IconButton>
        </div>

        {/* One row per use case */}
        {m.rows.map((r) => (
          <FragmentRow key={r.id}>
            <div
              ref={(el) => { rowEls.current[r.id] = el; }}
              onMouseEnter={() => setHoverRow(r.id)} onMouseLeave={() => setHoverRow((h) => (h === r.id ? null : h))}
              style={{ ...cellBorder, position: "sticky", left: 0, zIndex: 4, background: BG_SIDEBAR, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <select
                className="design-select" aria-label="Priority" value={r.tier}
                onChange={(e) => patch("rows", r.id, { tier: Number(e.target.value) })}
                style={{ fontFamily: font, fontSize: SIZE.xs, lineHeight: 1.5, padding: 0, color: r.tier === 0 ? INK : INK_SOFT, fontWeight: r.tier === 0 ? WEIGHT.semibold : WEIGHT.normal, width: "fit-content" }}
              >
                {TIERS.map((t, n) => <option key={t} value={n}>{t}</option>)}
              </select>
              <AutoTextarea
                className="el-edit" minRows={1} autoFocus={fresh === r.id}
                value={r.text} onChange={(e) => patch("rows", r.id, { text: e.target.value })}
                placeholder="A use case…" aria-label="Use case"
                style={{ ...editArea, fontSize: SIZE.ui, color: r.tier === 0 ? INK : INK_SOFT }}
              />
            </div>
            {m.columns.map((c) => {
              const here = m.cards.filter((k) => k.row === r.id && k.col === c.id);
              return (
                <div key={c.id} className="fm-cell" style={{ ...cellBorder, padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px", minHeight: "88px" }}>
                  {here.map((k) => (
                    <div
                      key={k.id} className="reveal-group"
                      onMouseEnter={() => setHoverCard(k.id)} onMouseLeave={() => setHoverCard((h) => (h === k.id ? null : h))}
                      style={{ position: "relative", zIndex: 2, opacity: cardDim(k.id) ? 0.4 : 1, transition: fade }}
                    >
                      <div
                        ref={(el) => { cardEls.current[k.id] = el; }}
                        data-card-id={k.id}
                        className={`el-card fm-card${connectFrom === k.id ? " fm-source" : ""}`}
                        onClickCapture={connectFrom && connectFrom !== k.id ? (e) => { e.preventDefault(); e.stopPropagation(); finishConnect(k.id); } : undefined}
                        style={{
                          background: BG, border: `1px solid ${BORDER}`,
                          outline: connectFrom === k.id ? `2px solid ${INK}` : drag?.over === k.id ? `2px solid ${INK_SOFT}` : undefined,
                          outlineOffset: "2px",
                        }}
                      >
                        <AutoTextarea
                          className="el-edit" minRows={1} autoFocus={fresh === k.id}
                          value={k.text} onChange={(e) => patch("cards", k.id, { text: e.target.value })}
                          placeholder="A step…" aria-label="Step" style={editArea}
                        />
                      </div>
                      {!connectFrom && (
                        <button
                          className="reveal"
                          title="Drag to another step to connect — or click, then pick one"
                          aria-label="Connect to another step"
                          onPointerDown={startDrag(k.id)} onPointerMove={moveDrag} onPointerUp={endDrag}
                          onPointerCancel={() => setDrag(null)}
                          // Keyboard activation only (detail 0) — a mouse tap is handled by endDrag.
                          onClick={(e) => { if (e.detail === 0) { setSelLink(null); setConnectFrom(k.id); } }}
                          style={{
                            position: "absolute", right: "-6px", top: "50%", transform: "translateY(-50%)",
                            width: "12px", height: "12px", borderRadius: "50%", border: `2px solid ${INK_SOFT}`,
                            background: drag?.from === k.id ? INK_SOFT : "#fff", padding: 0, cursor: "grab", zIndex: 3, touchAction: "none",
                            // Stay visible (and keep receiving the captured pointer) while its drag is in flight.
                            ...(drag?.from === k.id ? { opacity: 1, pointerEvents: "auto" } : {}),
                          }}
                        />
                      )}
                      <IconButton className="reveal" title="Remove step" onClick={() => removeCard(k.id)} style={{ ...cornerBadge, right: "-7px" }}>
                        <X size={12} />
                      </IconButton>
                    </div>
                  ))}
                  <button
                    className="fm-add btn btn--subtle" onClick={() => addCard(r.id, c.id)} aria-label="Add a step here"
                    style={{ alignSelf: "flex-start", fontSize: SIZE.xs, padding: "2px 6px", margin: "-2px -6px", color: INK_SOFT, gap: "3px" }}
                  >
                    <Plus size={12} /> Step
                  </button>
                </div>
              );
            })}
            <div style={{ borderBottom: `1px solid ${BORDER}` }} />
          </FragmentRow>
        ))}

        {/* Add a use case */}
        <div style={{ position: "sticky", left: 0, zIndex: 4, background: BG_SIDEBAR, padding: "10px 10px", borderRight: `1px solid ${BORDER}` }}>
          <button className="btn btn--sm btn--subtle" onClick={addRow} style={{ color: INK_SOFT }}>
            <Plus size={16} /> Use case
          </button>
        </div>
        <div style={{ gridColumn: `span ${m.columns.length + 1}` }} />

        {/* Connectors — above the cell backgrounds, below the cards (z 2) */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 1, pointerEvents: "none" }}>
          <defs>
            <marker id="fm-cap" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 1 L8 5 L1 9" fill="none" stroke="context-stroke" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {routes.map(({ link: l, d, back }) => {
            const on = linkOn(l.id), lit = focus && on;
            return (
              <g key={l.id}>
                <path
                  className="fm-link" d={d} fill="none"
                  stroke={lit ? INK : LINE} strokeWidth={lit ? 2 : 1.5} opacity={on ? 1 : 0.15}
                  strokeDasharray={back ? "5 4" : undefined} markerEnd="url(#fm-cap)"
                />
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth="14" style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setConnectFrom(null); setSelLink(selLink === l.id ? null : l.id); }}
                >
                  <title>Click to label or remove</title>
                </path>
              </g>
            );
          })}
          {/* Drag preview: dashed while free, solid with an arrowhead once it snaps onto a step. */}
          {drag?.moved && layout.cards?.[drag.from] && (() => {
            const s = layout.cards[drag.from];
            const t = drag.over && layout.cards[drag.over];
            const x2 = t ? t.left : drag.x, y2 = t ? t.cy : drag.y;
            const mx = (s.right + x2) / 2;
            const d = roundedPath([{ x: s.right, y: s.cy }, { x: mx, y: s.cy }, { x: mx, y: y2 }, { x: x2, y: y2 }]);
            return (
              <path d={d} fill="none" stroke={INK} strokeWidth={t ? 2 : 1.5} strokeDasharray={t ? undefined : "4 4"}
                markerEnd={t ? "url(#fm-cap)" : undefined} opacity={t ? 1 : 0.7} style={{ pointerEvents: "none" }} />
            );
          })()}
        </svg>

        {/* Connector labels — shown when a link has one, or while it's selected (to add one) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
          {routes.map(({ link: l, at }) => {
            const sel = selLink === l.id;
            if ((!l.label && !sel) || !at) return null;
            return (
              <div key={l.id} style={{ position: "absolute", left: at.x, top: at.y, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: "2px", pointerEvents: "auto", opacity: linkOn(l.id) ? 1 : 0.25, transition: fade }}>
                <input
                  autoFocus={sel && !l.label}
                  value={l.label} onChange={(e) => patch("links", l.id, { label: e.target.value })}
                  onFocus={() => setSelLink(l.id)}
                  placeholder="Label…" aria-label="Connector label"
                  style={{
                    fieldSizing: "content", minWidth: "44px", fontFamily: font, fontSize: SIZE.xs, fontStyle: "italic",
                    color: sel ? INK : INK_SOFT, background: BG_SIDEBAR, border: `1px solid ${sel ? INK_SOFT : BORDER}`,
                    borderRadius: RADIUS.pill, padding: "1px 8px", outline: "none", textAlign: "center",
                  }}
                />
                {sel && (
                  <IconButton danger title="Remove connection" onClick={() => { set("links", (ls) => ls.filter((x) => x.id !== l.id)); setSelLink(null); }}
                    style={{ ...cornerBadge, position: "static", "--hit": "26px" }}>
                    <X size={12} />
                  </IconButton>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// A grid row is just its cells — `display: contents` keeps them direct grid children.
function FragmentRow({ children }) {
  return <div style={{ display: "contents" }}>{children}</div>;
}
