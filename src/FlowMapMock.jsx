import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, BG, BG_SIDEBAR, SIZE, WEIGHT, RADIUS } from "./lib/theme";
import { editArea } from "./ui/text";
import { cornerBadge } from "./ui/cardStyles";
import AutoTextarea from "./ui/AutoTextarea";
import IconButton from "./ui/IconButton";

// MOCKUP ONLY (DEV route #/flow-preview) — local state, nothing persists. A spec's flow map: a
// story map where rows are the Design tab's use cases (in priority order) and columns are stages
// you name. Cards are steps; connectors go from any card to any other — forward, up/down within a
// stage, or back (a loop, drawn dashed over the top) — and can carry a label for a branch.

const TIERS = ["Primary", "Secondary", "Tertiary"];
const HEADER_W = 220;
const LINE = "#A9A9A5";

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

// Cubic midpoint — where a connector's label sits.
const mid = (p0, p1, p2, p3) => ({
  x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
  y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
});

// Forward → right edge to left edge. Same stage → straight up or down between the cards, unless
// another card sits between them, in which case a bracket out to the left and back — a straight
// line would run behind that card and read as connecting to it. Back (a loop) → out of the top of
// one card, arcing over, into the top of the other — above, so it never cuts through the cards
// stacked beneath. `all` is every card's position, for spotting what's in the way.
function route(s, t, all) {
  if (t.left >= s.right - 4) {
    const p0 = { x: s.right, y: s.cy }, p3 = { x: t.left, y: t.cy };
    const dx = Math.max(28, (p3.x - p0.x) / 2);
    const p1 = { x: p0.x + dx, y: p0.y }, p2 = { x: p3.x - dx, y: p3.y };
    return { d: `M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`, m: mid(p0, p1, p2, p3), back: false };
  }
  if (Math.abs(t.cx - s.cx) < 12) {
    const lo = Math.min(s.bottom, t.bottom), hi = Math.max(s.top, t.top);
    const blocked = Object.values(all || {}).some((o) =>
      o !== s && o !== t && Math.abs(o.cx - s.cx) < 12 && o.top >= lo - 1 && o.bottom <= hi + 1);
    if (blocked) {
      const x = Math.min(s.left, t.left) - 24;
      const p0 = { x: s.left, y: s.cy }, p3 = { x: t.left, y: t.cy };
      const p1 = { x, y: p0.y }, p2 = { x, y: p3.y };
      return { d: `M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`, m: mid(p0, p1, p2, p3), back: false };
    }
    const down = t.top > s.bottom;
    const p0 = { x: s.cx, y: down ? s.bottom : s.top }, p3 = { x: t.cx, y: down ? t.top : t.bottom };
    const dy = (p3.y - p0.y) / 2;
    const p1 = { x: p0.x, y: p0.y + dy }, p2 = { x: p3.x, y: p3.y - dy };
    return { d: `M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`, m: mid(p0, p1, p2, p3), back: false };
  }
  const p0 = { x: s.cx, y: s.top }, p3 = { x: t.cx, y: t.top };
  const peak = Math.min(p0.y, p3.y) - 34;
  const p1 = { x: p0.x, y: peak }, p2 = { x: p3.x, y: peak };
  return { d: `M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`, m: mid(p0, p1, p2, p3), back: true };
}

export default function FlowMapMock() {
  const [m, setM] = useState(SAMPLE);
  const [pos, setPos] = useState({});
  const [connectFrom, setConnectFrom] = useState(null);
  const [selLink, setSelLink] = useState(null);
  const [fresh, setFresh] = useState(null);
  const gridRef = useRef(null);
  const cardEls = useRef({});

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
  const finishConnect = (to) => {
    if (connectFrom && to !== connectFrom && !m.links.some((l) => l.from === connectFrom && l.to === to)) {
      set("links", (ls) => [...ls, { id: nid("l"), from: connectFrom, to, label: "" }]);
    }
    setConnectFrom(null);
  };

  // Card positions relative to the grid (the SVG and label layer live inside it, so they scroll
  // with it). Re-measured on every change and whenever the grid resizes — a card growing as you
  // type moves everything below it.
  const measure = () => {
    const g = gridRef.current;
    if (!g) return;
    const gr = g.getBoundingClientRect();
    const next = {};
    for (const [id, el] of Object.entries(cardEls.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[id] = {
        left: r.left - gr.left, right: r.right - gr.left, top: r.top - gr.top, bottom: r.bottom - gr.top,
        cx: (r.left + r.right) / 2 - gr.left, cy: (r.top + r.bottom) / 2 - gr.top,
      };
    }
    setPos(next);
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

  const cols = `${HEADER_W}px repeat(${m.columns.length}, minmax(200px, 1fr)) 52px`;
  const cellBorder = { borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` };

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
        .fm-link { transition: stroke 120ms ease, stroke-width 120ms ease; }
        .fm-connecting .fm-card:not(.fm-source):hover { outline: 2px solid ${INK_SOFT}; outline-offset: 2px; cursor: crosshair; }
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
        className={connectFrom ? "fm-connecting" : undefined}
        style={{ position: "relative", display: "grid", gridTemplateColumns: cols, minWidth: "min-content" }}
      >
        {/* Stage header row */}
        <div style={{ ...cellBorder, position: "sticky", left: 0, zIndex: 4, background: BG_SIDEBAR, padding: "14px 16px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: SIZE.micro, fontWeight: WEIGHT.semibold, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_SOFT }}>Use cases</span>
        </div>
        {m.columns.map((c) => (
          <div key={c.id} className="fm-col" style={{ ...cellBorder, padding: "12px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
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
            <div style={{ ...cellBorder, position: "sticky", left: 0, zIndex: 4, background: BG_SIDEBAR, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
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
                    <div key={k.id} className="reveal-group" style={{ position: "relative", zIndex: 2 }}>
                      <div
                        ref={(el) => { cardEls.current[k.id] = el; }}
                        className={`el-card fm-card${connectFrom === k.id ? " fm-source" : ""}`}
                        onClickCapture={connectFrom && connectFrom !== k.id ? (e) => { e.preventDefault(); e.stopPropagation(); finishConnect(k.id); } : undefined}
                        style={{
                          background: BG, border: `1px solid ${BORDER}`,
                          outline: connectFrom === k.id ? `2px solid ${INK}` : undefined, outlineOffset: "2px",
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
                          className="reveal" title="Connect to another step" aria-label="Connect to another step"
                          onClick={() => { setSelLink(null); setConnectFrom(k.id); }}
                          style={{ position: "absolute", right: "-6px", top: "50%", transform: "translateY(-50%)", width: "12px", height: "12px", borderRadius: "50%", border: `2px solid ${INK_SOFT}`, background: "#fff", padding: 0, cursor: "pointer", zIndex: 3 }}
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
          {m.links.map((l) => {
            const s = pos[l.from], t = pos[l.to];
            if (!s || !t) return null;
            const { d, back } = route(s, t, pos);
            const sel = selLink === l.id;
            return (
              <g key={l.id}>
                <path className="fm-link" d={d} fill="none" stroke={sel ? INK : LINE} strokeWidth={sel ? 2.25 : 1.5} strokeDasharray={back ? "5 4" : undefined} markerEnd="url(#fm-cap)" />
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth="14" style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setConnectFrom(null); setSelLink(sel ? null : l.id); }}
                >
                  <title>Click to label or remove</title>
                </path>
              </g>
            );
          })}
        </svg>

        {/* Connector labels — shown when a link has one, or while it's selected (to add one) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
          {m.links.map((l) => {
            const s = pos[l.from], t = pos[l.to];
            if (!s || !t) return null;
            const sel = selLink === l.id;
            if (!l.label && !sel) return null;
            const { m: at } = route(s, t, pos);
            return (
              <div key={l.id} style={{ position: "absolute", left: at.x, top: at.y, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: "2px", pointerEvents: "auto" }}>
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
