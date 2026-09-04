import { useState, useRef, useLayoutEffect, useEffect, useReducer, useMemo } from "react";
import { Plus, ChevronUp, ChevronDown, Download, ArrowUpRight } from "lucide-react";
import { genId, resolveRef } from "./lib/boardModel";
import { downloadBoardJson } from "./lib/exportBoard";
import {
  font, INK, INK_SOFT, INK_FAINT, BORDER, BORDER_STRONG, BG, BG_SIDEBAR, BG_HOVER, ACCENT,
  STATUS_OPTIONS, STATUS_COLOR, IMPACT_OPTIONS, IMPACT_COLOR, METHOD_OPTIONS,
} from "./lib/theme";

const ALLOWED = { signal: "insight", insight: "action", action: "result" };
const SIGNAL_TYPES = ["Metric", "Interview", "Support", "Analytics", "Other"];

// low-alpha accent fill/border so cards read as tinted, not flat white
const tint = (hex, alpha) => `${hex}${alpha}`;
const cardStyle = (kind) => ({ backgroundColor: tint(ACCENT[kind], "12"), border: `1px solid ${tint(ACCENT[kind], "38")}` });

const editArea = {
  width: "100%", border: "none", background: "transparent", outline: "none", resize: "none",
  fontFamily: font, fontWeight: 400, fontSize: "13.5px", lineHeight: 1.5, color: INK, padding: 0, boxSizing: "border-box",
};
const addIconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px",
  marginLeft: "auto", borderRadius: "5px", border: "none", background: "transparent", color: INK_SOFT, cursor: "pointer", padding: 0,
};
const orderBtnBase = {
  width: "16px", height: "16px", borderRadius: "3px", border: `1px solid ${BORDER}`, background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", color: INK_SOFT, padding: 0,
};
const orderBtnStyle = (disabled) => ({ ...orderBtnBase, opacity: disabled ? 0.3 : 1, cursor: disabled ? "default" : "pointer" });
const eyebrow = { fontFamily: font, fontWeight: 600, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: INK_FAINT };
const typeWrapStyle = { position: "relative", height: "22px", marginBottom: "8px", display: "flex", alignItems: "center" };
const typeSelectStyle = (hasValue) => ({
  appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
  border: "1px solid transparent", background: "transparent", borderRadius: "4px",
  padding: "2px 20px 2px 6px", margin: "0 -6px", width: "calc(100% + 12px)", boxSizing: "border-box",
  fontFamily: font, fontWeight: 600, fontSize: "10px", letterSpacing: "0.02em", textTransform: "uppercase",
  color: hasValue ? ACCENT.signal : INK_FAINT, cursor: "pointer",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
});
const sidebarSelectStyle = (color) => ({
  appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
  border: `1px solid ${BORDER}`, background: "#fff", borderRadius: "6px",
  padding: "6px 26px 6px 9px", width: "100%", boxSizing: "border-box",
  fontFamily: font, fontWeight: 500, fontSize: "13px", color: color || INK, cursor: "pointer",
});

function ColumnHeader({ kind, title, count, onAdd }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "2px" }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT[kind], flexShrink: 0 }} />
      <span style={{ fontFamily: font, fontWeight: 600, fontSize: "12.5px", color: INK }}>{title}</span>
      <span style={{ fontFamily: font, fontWeight: 400, fontSize: "12px", color: INK_FAINT }}>{count}</span>
      <button className="el-addbtn" onClick={onAdd} title={`Add ${title.toLowerCase()}`} style={addIconBtn}>
        <Plus size={13} />
      </button>
    </div>
  );
}

function Column({ kind, title, count, children, last, onAdd }) {
  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto", borderRight: last ? "none" : `1px solid ${BORDER}`, padding: "18px 26px", display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
      <ColumnHeader kind={kind} title={title} count={count} onAdd={onAdd} />
      {children}
    </div>
  );
}

// `board` is only used to seed local state on mount — the parent remounts this component
// (via `key={board.id}`) whenever the active board changes, so local state never needs to
// resync mid-life. Every change is pushed up via `onChange`; the parent owns persistence.
export default function Board({ board, onChange, highlightCardId, allBoards, onOpenBoard }) {
  const [name, setName] = useState(board.name);
  const [goal, setGoal] = useState(board.goal);
  const [target, setTarget] = useState(board.target);
  const [status, setStatus] = useState(board.status);
  const [impact, setImpact] = useState(board.impact);
  const [method, setMethod] = useState(board.method);
  const [author, setAuthor] = useState(board.author);
  const [description, setDescription] = useState(board.description);

  const [signals, setSignals] = useState(board.signals);
  const [insights, setInsights] = useState(board.insights);
  const [actions, setActions] = useState(board.actions);
  const [results, setResults] = useState(board.results);
  const [connections, setConnections] = useState(board.connections);

  const boardState = useMemo(
    () => ({ name, goal, target, status, impact, method, author, description, signals, insights, actions, results, connections }),
    [name, goal, target, status, impact, method, author, description, signals, insights, actions, results, connections]
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange(boardState);
  }, [boardState]);

  const handleExport = () => downloadBoardJson({
    id: board.id, createdAt: board.createdAt, updatedAt: Date.now(), ...boardState,
  });

  const boardRef = useRef(null);
  const els = useRef({});
  const setRef = (id) => (el) => { if (el) els.current[id] = el; else delete els.current[id]; };

  // deep link from search: scroll the matched card into view and pulse it briefly
  const [pulseId, setPulseId] = useState(null);
  useEffect(() => {
    if (highlightCardId == null) return;
    const el = els.current[highlightCardId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setPulseId(highlightCardId);
    const t = setTimeout(() => setPulseId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightCardId]);

  const [pos, setPos] = useState({});
  const [, force] = useReducer((x) => x + 1, 0);
  const [pending, setPending] = useState(null); // { from, kind, x, y, over, rewireId? }
  const [hoverId, setHoverId] = useState(null);
  const [hoverConnId, setHoverConnId] = useState(null);

  // all node ids reachable from the hovered card by following connections in either direction —
  // this is what traces the full signal -> insight -> action -> result throughline
  const connectedIds = useMemo(() => {
    if (hoverId == null) return null;
    const set = new Set([hoverId]);
    let frontier = [hoverId];
    while (frontier.length) {
      const next = [];
      for (const id of frontier) {
        for (const c of connections) {
          if (c.from === id && !set.has(c.to)) { set.add(c.to); next.push(c.to); }
          if (c.to === id && !set.has(c.from)) { set.add(c.from); next.push(c.from); }
        }
      }
      frontier = next;
    }
    return set;
  }, [hoverId, connections]);

  const nodeOpacity = (id) => (pending || hoverId == null ? 1 : connectedIds.has(id) ? 1 : 0.25);
  const hoverProps = (id) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId((h) => (h === id ? null : h)),
  });

  const measure = () => {
    const board = boardRef.current;
    if (!board) return;
    const b = board.getBoundingClientRect();
    const next = {};
    for (const id in els.current) {
      const r = els.current[id].getBoundingClientRect();
      next[id] = { left: r.left - b.left, right: r.right - b.left, top: r.top - b.top, bottom: r.bottom - b.top, cy: r.top - b.top + r.height / 2 };
    }
    setPos((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  };
  useLayoutEffect(measure);
  useEffect(() => { window.addEventListener("resize", force); return () => window.removeEventListener("resize", force); }, []);

  const kindOf = (id) => {
    if (signals.some((x) => x.id === id)) return "signal";
    if (insights.some((x) => x.id === id)) return "insight";
    if (actions.some((x) => x.id === id)) return "action";
    if (results.some((x) => x.id === id)) return "result";
    return null;
  };

  const patchSignal = (id, patch) => setSignals((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const patchInsight = (id, patch) => setInsights((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const patchAction = (id, patch) => setActions((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const patchResult = (id, patch) => setResults((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addSignal = () => setSignals((p) => [...p, { id: genId(), type: "", text: "" }]);
  const addInsight = () => setInsights((p) => [...p, { id: genId(), text: "" }]);
  const addAction = () => setActions((p) => [...p, { id: genId(), ifWe: "", then: "", expected: "" }]);
  const addResult = () => setResults((p) => [...p, { id: genId(), text: "" }]);

  const reorder = (setList) => (id, dir) => setList((prev) => {
    const idx = prev.findIndex((x) => x.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= prev.length) return prev;
    const copy = [...prev];
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    return copy;
  });
  const moveSignal = reorder(setSignals);
  const moveInsight = reorder(setInsights);
  const moveAction = reorder(setActions);
  const moveResult = reorder(setResults);

  const deleteCard = (id, kind) => {
    if (kind === "signal") setSignals((p) => p.filter((x) => x.id !== id));
    else if (kind === "insight") setInsights((p) => p.filter((x) => x.id !== id));
    else if (kind === "action") setActions((p) => p.filter((x) => x.id !== id));
    else if (kind === "result") setResults((p) => p.filter((x) => x.id !== id));
    setConnections((c) => c.filter((x) => x.from !== id && x.to !== id));
    delete els.current[id];
  };

  const boardPoint = (clientX, clientY) => {
    const b = boardRef.current.getBoundingClientRect();
    return { x: clientX - b.left, y: clientY - b.top };
  };
  const startConnect = (id, kind) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = boardPoint(e.clientX, e.clientY);
    setPending({ from: id, kind, x: p.x, y: p.y, over: null });
  };
  const moveConnect = (e) => {
    if (!pending) return;
    const p = boardPoint(e.clientX, e.clientY);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetEl = el && el.closest("[data-node-id]");
    let over = null;
    if (targetEl && targetEl.getAttribute("data-node-kind") === ALLOWED[pending.kind]) {
      over = Number(targetEl.getAttribute("data-node-id"));
    }
    setPending((prev) => (prev ? { ...prev, x: p.x, y: p.y, over } : prev));
  };
  const endConnect = () => {
    if (!pending) return;
    const { from, over, rewireId } = pending;
    if (rewireId != null) {
      // dragged an existing connector: drop on a valid card to retarget it, drop on nothing to delete it
      setConnections((c) => {
        const rest = c.filter((x) => x.id !== rewireId);
        if (over == null) return rest;
        if (rest.some((x) => x.from === from && x.to === over)) return rest; // would duplicate, just drop the dragged one
        return [...rest, { id: rewireId, from, to: over }];
      });
    } else if (over != null) {
      setConnections((c) => (c.some((x) => x.from === from && x.to === over) ? c : [...c, { id: genId(), from, to: over }]));
    }
    setPending(null);
  };

  const startRewire = (c) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = boardPoint(e.clientX, e.clientY);
    setPending({ from: c.from, kind: kindOf(c.from), x: p.x, y: p.y, over: null, rewireId: c.id });
  };

  const pathFor = (sx, sy, tx, ty) => {
    const off = Math.max(40, Math.abs(tx - sx) / 2);
    return `M ${sx} ${sy} C ${sx + off} ${sy}, ${tx - off} ${ty}, ${tx} ${ty}`;
  };

  const renderOrder = (id, idx, length, onMove) => (
    <div className="el-order" style={{ position: "absolute", left: "-22px", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "2px", zIndex: 4 }}>
      <button disabled={idx === 0} onClick={() => onMove(id, -1)} title="Move up" style={orderBtnStyle(idx === 0)}><ChevronUp size={11} /></button>
      <button disabled={idx === length - 1} onClick={() => onMove(id, 1)} title="Move down" style={orderBtnStyle(idx === length - 1)}><ChevronDown size={11} /></button>
    </div>
  );

  const renderDelete = (id, kind) => (
    <button
      className="el-del"
      onClick={() => deleteCard(id, kind)}
      title="Delete card"
      style={{
        position: "absolute", top: "-7px", right: "-7px", width: "16px", height: "16px", borderRadius: "50%",
        border: `1px solid ${BORDER_STRONG}`, background: "#fff", color: INK_SOFT, cursor: "pointer",
        fontSize: "11px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, padding: 0,
      }}
    >
      ×
    </button>
  );

  const renderHandle = (id, kind, connected) => (
    <div
      className="el-handle"
      onPointerDown={startConnect(id, kind)}
      onPointerMove={moveConnect}
      onPointerUp={endConnect}
      onPointerCancel={endConnect}
      title="Drag to connect"
      style={{
        position: "absolute", right: "-6px", top: "50%", transform: "translateY(-50%)",
        width: "12px", height: "12px", borderRadius: "50%",
        backgroundColor: connected ? ACCENT[kind] : "#fff",
        border: `2px solid ${ACCENT[kind]}`, cursor: "grab", zIndex: 3, touchAction: "none",
      }}
    />
  );

  const targetStyle = (id) => {
    const isTarget = pending && pending.over === id;
    if (!isTarget) return {};
    const c = ACCENT[pending.kind];
    return { outline: `2px solid ${c}`, outlineOffset: "2px", boxShadow: `0 4px 14px ${c}33` };
  };

  const cardClass = (id) => (pulseId === id ? "el-card el-card-pulse" : "el-card");

  const renderRefSource = (board) => (
    <button
      className="el-ref-source"
      onClick={(e) => { e.stopPropagation(); onOpenBoard?.(board.id); }}
      title={`Open "${board.name || "Untitled board"}"`}
      style={{
        display: "flex", alignItems: "center", gap: "4px", marginTop: "8px",
        fontFamily: font, fontSize: "10.5px", fontWeight: 500, color: INK_FAINT,
        background: "none", border: "none", cursor: "pointer", padding: 0,
      }}
    >
      <ArrowUpRight size={11} /> {board.name || "Untitled board"}
    </button>
  );

  // a card is either authored locally, or a live reference to a card of the same kind
  // living in another board (has `ref` instead) — resolved fresh on every render so edits
  // to the source, or the source disappearing, always show up here immediately
  const renderSignalCard = (s, idx) => {
    const ref = s.ref;
    const resolved = ref ? resolveRef(allBoards, "signal", ref) : null;
    return (
      <div key={s.id} className="el-node" style={{ opacity: nodeOpacity(s.id) }} {...hoverProps(s.id)}>
        {renderOrder(s.id, idx, signals.length, moveSignal)}
        {ref ? (
          <div
            ref={setRef(s.id)} data-node-id={s.id} data-node-kind="signal"
            className={cardClass(s.id)}
            style={{ ...cardStyle("signal"), borderStyle: "dashed" }}
          >
            {resolved ? (
              <>
                <div style={typeWrapStyle}>
                  <span style={typeSelectStyle(!!resolved.item.type)}>{resolved.item.type || "Type"}</span>
                </div>
                <div style={editArea}>{resolved.item.text}</div>
                {renderRefSource(resolved.board)}
              </>
            ) : (
              <div style={{ fontFamily: font, fontStyle: "italic", fontSize: "13px", color: INK_FAINT }}>
                Referenced signal no longer exists.
              </div>
            )}
          </div>
        ) : (
          <div ref={setRef(s.id)} data-node-id={s.id} data-node-kind="signal" className={cardClass(s.id)} style={cardStyle("signal")}>
            <div style={typeWrapStyle}>
              <select
                className="el-type-select"
                value={s.type}
                onChange={(ev) => patchSignal(s.id, { type: ev.target.value })}
                style={typeSelectStyle(!!s.type)}
              >
                <option value="">Type</option>
                {SIGNAL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown size={11} className="el-type-chevron" style={{ position: "absolute", right: "5px", top: "50%", transform: "translateY(-50%)", color: INK_SOFT }} />
            </div>
            <textarea className="el-edit" rows={2} value={s.text} onChange={(ev) => patchSignal(s.id, { text: ev.target.value })} placeholder="What did you observe?" style={editArea} />
          </div>
        )}
        {renderHandle(s.id, "signal", connections.some((c) => c.from === s.id))}
        {renderDelete(s.id, "signal")}
      </div>
    );
  };

  const renderInsightCard = (n, idx) => {
    const ref = n.ref;
    const resolved = ref ? resolveRef(allBoards, "insight", ref) : null;
    return (
      <div key={n.id} className="el-node" style={{ opacity: nodeOpacity(n.id) }} {...hoverProps(n.id)}>
        {renderOrder(n.id, idx, insights.length, moveInsight)}
        {ref ? (
          <div
            ref={setRef(n.id)} data-node-id={n.id} data-node-kind="insight"
            className={cardClass(n.id)}
            style={{ ...cardStyle("insight"), ...targetStyle(n.id), borderStyle: "dashed" }}
          >
            {resolved ? (
              <>
                <div style={editArea}>{resolved.item.text}</div>
                {renderRefSource(resolved.board)}
              </>
            ) : (
              <div style={{ fontFamily: font, fontStyle: "italic", fontSize: "13px", color: INK_FAINT }}>
                Referenced insight no longer exists.
              </div>
            )}
          </div>
        ) : (
          <div ref={setRef(n.id)} data-node-id={n.id} data-node-kind="insight" className={cardClass(n.id)} style={{ ...cardStyle("insight"), ...targetStyle(n.id) }}>
            <textarea className="el-edit" rows={2} value={n.text} onChange={(ev) => patchInsight(n.id, { text: ev.target.value })} placeholder="State the insight…" style={editArea} />
          </div>
        )}
        {renderHandle(n.id, "insight", connections.some((c) => c.from === n.id))}
        {renderDelete(n.id, "insight")}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: font, height: "100%", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .el-edit::placeholder { color: ${INK_FAINT}; font-weight: 400; }
        .el-board { display:grid; grid-template-columns: repeat(4, minmax(220px, 1fr)) 300px; grid-template-rows: 1fr; align-items:stretch; position:relative; z-index:1; flex:1; min-height:0; min-width:1180px; }
        .el-node { position:relative; transition: opacity .15s; }
        .el-handle { opacity:0; transition:opacity .12s; }
        .el-node:hover .el-handle { opacity:0.8; }
        .el-del { opacity:0; transition:opacity .12s; }
        .el-node:hover .el-del { opacity:1; }
        .el-order { opacity:0; transition:opacity .12s; }
        .el-node:hover .el-order { opacity:1; }
        .el-addbtn:hover { background:${BG_HOVER}; color:${INK}; }
        .el-export-btn { transition: border-color .12s, color .12s; }
        .el-export-btn:hover { border-color: ${BORDER_STRONG}; color: ${INK}; }
        .el-ref-source:hover { color: ${INK_SOFT}; text-decoration: underline; }
        .el-connector { transition: opacity .15s, stroke-width .15s; }
        .el-card { border-radius:6px; padding:11px 12px; transition:box-shadow .12s; }
        .el-card:hover { box-shadow:0 2px 6px rgba(0,0,0,0.07); }
        @keyframes el-pulse { 0% { box-shadow: 0 0 0 0 rgba(217,164,6,0.55); } 70% { box-shadow: 0 0 0 9px rgba(217,164,6,0); } 100% { box-shadow: 0 0 0 0 rgba(217,164,6,0); } }
        .el-card-pulse { animation: el-pulse 1s ease-out 2; }
        .el-type-select { transition: border-color .12s, background-color .12s; }
        .el-node:hover .el-type-select { border-color: ${BORDER}; background: #fff; }
        .el-type-select:focus { outline: none; border-color: ${ACCENT.signal}; background: #fff; }
        .el-type-chevron { opacity: 0; transition: opacity .12s; pointer-events: none; }
        .el-node:hover .el-type-chevron, .el-type-select:focus ~ .el-type-chevron { opacity: 1; }
        .el-side-field { border:none; border-bottom:1px solid transparent; transition: border-color .12s; }
        .el-side-field:focus-within { border-bottom-color: ${BORDER_STRONG}; }
        .el-select:hover { border-color: ${BORDER_STRONG}; }
        .el-select:focus { outline: none; border-color: ${INK_SOFT}; }
      `}</style>

      <div
        ref={boardRef}
        style={{ position: "relative", backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: "10px", overflowX: "auto", overflowY: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <div className="el-board">
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
            <defs>
              <marker id="cap" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M1 1 L8 5 L1 9" fill="none" stroke="context-stroke" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {connections.map((c) => {
              const s = pos[c.from], t = pos[c.to];
              if (!s || !t) return null;
              const isBeingDragged = pending && pending.rewireId === c.id;
              const color = ACCENT[kindOf(c.from)] || INK_FAINT;
              const d = pathFor(s.right, s.cy, t.left, t.cy);
              const active = pending || hoverId == null || (connectedIds.has(c.from) && connectedIds.has(c.to));
              const isHovered = hoverConnId === c.id;
              const strokeOpacity = isBeingDragged ? 0 : isHovered ? 1 : pending || hoverId == null ? 0.55 : active ? 0.95 : 0.08;
              const strokeW = isHovered ? "3" : !pending && hoverId != null && active ? "2.25" : "1.5";
              return (
                <g key={c.id}>
                  <path className="el-connector" d={d} fill="none" stroke={color} strokeWidth={strokeW} opacity={strokeOpacity} markerEnd="url(#cap)" />
                  <path d={d} fill="none" stroke="transparent" strokeWidth="16"
                    style={{ pointerEvents: "stroke", cursor: "grab", touchAction: "none" }}
                    onMouseEnter={() => setHoverConnId(c.id)}
                    onMouseLeave={() => setHoverConnId((h) => (h === c.id ? null : h))}
                    onPointerDown={startRewire(c)}
                    onPointerMove={moveConnect}
                    onPointerUp={endConnect}
                    onPointerCancel={endConnect}>
                    <title>Drag to another card to reconnect, or drop on empty space to remove</title>
                  </path>
                </g>
              );
            })}
            {pending && pos[pending.from] && (() => {
              const snap = pending.over != null && pos[pending.over];
              const isDeleteIntent = pending.rewireId != null && !snap;
              const c = isDeleteIntent ? "#D64545" : ACCENT[pending.kind];
              const tx = snap ? pos[pending.over].left : pending.x;
              const ty = snap ? pos[pending.over].cy : pending.y;
              return (
                <path d={pathFor(pos[pending.from].right, pos[pending.from].cy, tx, ty)} fill="none" stroke={c}
                  strokeWidth={snap ? "2.5" : "1.5"} strokeDasharray={snap ? "none" : "4 4"} markerEnd={snap ? "url(#cap)" : "none"} opacity={snap ? 1 : (isDeleteIntent ? 0.85 : 0.7)} />
              );
            })()}
          </svg>

          {/* SIGNAL */}
          <Column kind="signal" title="Signal" count={signals.length} onAdd={addSignal}>
            {signals.map((s, idx) => renderSignalCard(s, idx))}
          </Column>

          {/* INSIGHT */}
          <Column kind="insight" title="Insight" count={insights.length} onAdd={addInsight}>
            {insights.map((n, idx) => renderInsightCard(n, idx))}
          </Column>

          {/* ACTION */}
          <Column kind="action" title="Action" count={actions.length} onAdd={addAction}>
            {actions.map((a, idx) => (
              <div key={a.id} className="el-node" style={{ opacity: nodeOpacity(a.id) }} {...hoverProps(a.id)}>
                {renderOrder(a.id, idx, actions.length, moveAction)}
                <div ref={setRef(a.id)} data-node-id={a.id} data-node-kind="action" className={cardClass(a.id)} style={{ ...cardStyle("action"), ...targetStyle(a.id) }}>
                  <div style={eyebrow}>If we</div>
                  <textarea className="el-edit" rows={2} value={a.ifWe} onChange={(e) => patchAction(a.id, { ifWe: e.target.value })} placeholder="…do this" style={{ ...editArea, marginTop: "2px", marginBottom: "8px" }} />
                  <div style={eyebrow}>Then</div>
                  <textarea className="el-edit" rows={2} value={a.then} onChange={(e) => patchAction(a.id, { then: e.target.value })} placeholder="…this happens" style={{ ...editArea, marginTop: "2px", marginBottom: "8px" }} />
                  <div style={eyebrow}>Expected</div>
                  <textarea className="el-edit" rows={2} value={a.expected} onChange={(e) => patchAction(a.id, { expected: e.target.value })} placeholder="…measurable outcome" style={{ ...editArea, marginTop: "2px" }} />
                </div>
                {renderHandle(a.id, "action", connections.some((c) => c.from === a.id))}
                {renderDelete(a.id, "action")}
              </div>
            ))}
          </Column>

          {/* RESULT */}
          <Column kind="result" title="Result" count={results.length} last onAdd={addResult}>
            {results.map((r, idx) => (
              <div key={r.id} className="el-node" style={{ opacity: nodeOpacity(r.id) }} {...hoverProps(r.id)}>
                {renderOrder(r.id, idx, results.length, moveResult)}
                <div ref={setRef(r.id)} data-node-id={r.id} data-node-kind="result" className={cardClass(r.id)} style={{ ...cardStyle("result"), ...targetStyle(r.id) }}>
                  <div style={eyebrow}>Result</div>
                  <textarea className="el-edit" rows={2} value={r.text} onChange={(e) => patchResult(r.id, { text: e.target.value })} placeholder="What actually happened?" style={{ ...editArea, marginTop: "2px" }} />
                </div>
                {renderDelete(r.id, "result")}
              </div>
            ))}
          </Column>

          {/* SIDEBAR — full height */}
          <div style={{
            alignSelf: "stretch", height: "100%", minHeight: 0, overflowY: "auto",
            position: "sticky", right: 0, zIndex: 6,
            backgroundColor: BG_SIDEBAR, borderLeft: `1px solid ${BORDER}`, boxShadow: "-6px 0 12px rgba(0,0,0,0.04)",
            padding: "18px 20px", display: "flex", flexDirection: "column", gap: "22px",
          }}>
            <button
              className="el-export-btn"
              onClick={handleExport}
              title="Download this board as a JSON file"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", alignSelf: "flex-start",
                fontFamily: font, fontWeight: 500, fontSize: "12px", color: INK_SOFT,
                background: "#fff", border: `1px solid ${BORDER}`, borderRadius: "6px",
                padding: "6px 10px", cursor: "pointer",
              }}
            >
              <Download size={12} /> Export JSON
            </button>
            <div>
              <div style={eyebrow}>Name</div>
              <div className="el-side-field" style={{ marginTop: "8px" }}>
                <input className="el-edit" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Untitled board" style={{ ...editArea, fontWeight: 600, fontSize: "15px" }} />
              </div>
            </div>
            <div style={{ height: "1px", backgroundColor: BORDER }} />
            <div>
              <div style={eyebrow}>Goal</div>
              <div className="el-side-field" style={{ marginTop: "8px" }}>
                <textarea className="el-edit" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)}
                  placeholder="What are we trying to achieve?" style={{ ...editArea, fontWeight: 500, fontSize: "14px" }} />
              </div>
            </div>
            <div style={{ height: "1px", backgroundColor: BORDER }} />
            <div>
              <div style={eyebrow}>Target</div>
              <div className="el-side-field" style={{ marginTop: "8px" }}>
                <textarea className="el-edit" rows={3} value={target} onChange={(e) => setTarget(e.target.value)}
                  placeholder="How will we measure it?" style={{ ...editArea, fontWeight: 500, fontSize: "14px" }} />
              </div>
            </div>
            <div style={{ height: "1px", backgroundColor: BORDER }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <div style={eyebrow}>Status</div>
                <div style={{ position: "relative", marginTop: "8px" }}>
                  <select className="el-select" value={status} onChange={(e) => setStatus(e.target.value)} style={sidebarSelectStyle(STATUS_COLOR[status])}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
                </div>
              </div>
              <div>
                <div style={eyebrow}>Impact</div>
                <div style={{ position: "relative", marginTop: "8px" }}>
                  <select className="el-select" value={impact} onChange={(e) => setImpact(e.target.value)} style={sidebarSelectStyle(IMPACT_COLOR[impact])}>
                    {IMPACT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
                </div>
              </div>
            </div>
            <div style={{ height: "1px", backgroundColor: BORDER }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <div style={eyebrow}>Method</div>
                <div style={{ position: "relative", marginTop: "8px" }}>
                  <select className="el-select" value={method} onChange={(e) => setMethod(e.target.value)} style={sidebarSelectStyle()}>
                    <option value="">Method</option>
                    {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
                </div>
              </div>
              <div>
                <div style={eyebrow}>Author</div>
                <div className="el-side-field" style={{ marginTop: "8px" }}>
                  <input className="el-edit" value={author} onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Who ran this?" style={{ ...editArea, fontWeight: 500, fontSize: "14px" }} />
                </div>
              </div>
            </div>
            <div style={{ height: "1px", backgroundColor: BORDER }} />
            <div>
              <div style={eyebrow}>Description</div>
              <div className="el-side-field" style={{ marginTop: "8px" }}>
                <textarea className="el-edit" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add context, links, or notes…" style={editArea} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
