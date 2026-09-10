import { useState, useRef, useLayoutEffect, useEffect, useReducer, useMemo, useCallback } from "react";
import { Plus, Link2, ChevronUp, ChevronDown, ArrowUpRight } from "lucide-react";
import { genId, resolveRef } from "./lib/boardModel";
import { blankSignal } from "./lib/signalModel";
import { blankInsight } from "./lib/insightModel";
import { insertAt } from "./lib/arrays";
import { useDismiss } from "./lib/useDismiss";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BORDER_STRONG, BG_SIDEBAR, BG_HOVER, ACCENT, SIZE, WEIGHT, SPACE, RADIUS, MOTION } from "./lib/theme";
import { eyebrow, editArea } from "./ui/text";
import { cardSurface } from "./ui/cardStyles";
import SignalCardBody from "./SignalCardBody";
import InsightCardBody from "./InsightCardBody";
import IconButton from "./ui/IconButton";

const ALLOWED = { signal: "insight", insight: "action", action: "result" };

const orderBtnStyle = (disabled) => ({
  width: "16px", height: "16px", borderRadius: RADIUS.xs, border: `1px solid ${BORDER}`, background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", color: INK_SOFT, padding: 0,
  opacity: disabled ? 0.3 : 1, cursor: disabled ? "default" : "pointer",
});

// `+` always creates a new card directly. Signal/Insight columns also pass `onConnect` — a
// second, quieter icon button that opens the link-an-existing picker (Action/Result have
// nothing to link to, so they get the `+` alone).
function ColumnHeader({ kind, title, count, onAdd, addProps, onConnect, connectProps }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: SPACE.xs }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT[kind], flexShrink: 0 }} />
      <span style={{ fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.sm, color: INK }}>{title}</span>
      <span style={{ fontFamily: font, fontWeight: WEIGHT.normal, fontSize: SIZE.sm, color: INK_FAINT }}>{count}</span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "2px" }}>
        {onConnect && (
          <IconButton onClick={onConnect} title={`Link an existing ${title.toLowerCase()}`} style={{ color: INK_SOFT }} {...connectProps}>
            <Link2 size={13} />
          </IconButton>
        )}
        <IconButton onClick={onAdd} title={`New ${title.toLowerCase()}`} style={{ color: INK_SOFT }} {...addProps}>
          <Plus size={13} />
        </IconButton>
      </div>
    </div>
  );
}

function Column({ kind, title, count, children, last, onAdd, addProps, onConnect, connectProps }) {
  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto", borderRight: last ? "none" : `1px solid ${BORDER}`, padding: "18px 26px", display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
      <ColumnHeader kind={kind} title={title} count={count} onAdd={onAdd} addProps={addProps} onConnect={onConnect} connectProps={connectProps} />
      {children}
    </div>
  );
}

// `board` is only used to seed local state on mount — the parent remounts this component
// (via `key={board.id}`) whenever the active board changes, so local state never needs to
// resync mid-life. Every change is pushed up via `onChange`; the parent owns persistence.
// A board is pure canvas now — no name/goal/status/etc. of its own, that all lives on the
// spec it belongs to (see SpecPage.jsx's Discovery tab).
//
// Signals and Insights are the exception to "a board owns its cards' content": each is a
// global, workspace-wide record (see signalModel.js / insightModel.js) that's only ever
// *linked* here, any number of boards at once — `board.signals`/`board.insights` are therefore
// just lists of pointers (`{id}`, where `id` is the linked record's own id), and
// `signals`/`insights`/`activities` (props) are the full global lists used to resolve and edit
// them. Editing a linked signal or insight's content goes straight through `onUpdateSignal`/
// `onUpdateInsight` (bypassing this component's own onChange/boardState entirely), since that
// edit isn't board-local data — it's shared, and shows up everywhere else the record is linked.
// Action/Result keep authoring their content locally, same as always — planning a spec's
// actions is genuinely per-spec, unlike the discovery work upstream of it.
export default function Board({
  board, onChange, highlightCardId, allBoards, onOpenBoard,
  signals, insights, activities, onUpdateSignal, onCreateSignal, onUpdateInsight, onCreateInsight,
  onToast,
}) {
  const [signalLinks, setSignalLinks] = useState(board.signals);
  const [insightLinks, setInsightLinks] = useState(board.insights);
  const [actions, setActions] = useState(board.actions);
  const [results, setResults] = useState(board.results);
  const [connections, setConnections] = useState(board.connections);

  const boardState = useMemo(
    () => ({ signals: signalLinks, insights: insightLinks, actions, results, connections }),
    [signalLinks, insightLinks, actions, results, connections]
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange(boardState);
  }, [boardState]);

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
    if (signalLinks.some((x) => x.id === id)) return "signal";
    if (insightLinks.some((x) => x.id === id)) return "insight";
    if (actions.some((x) => x.id === id)) return "action";
    if (results.some((x) => x.id === id)) return "result";
    return null;
  };

  const patchAction = (id, patch) => setActions((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const patchResult = (id, patch) => setResults((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Which cards were already here when this board opened. Anything that shows up later is an
  // arrival and animates in — without this, every card on the board would fly in each time you
  // switched to the Discovery tab, which is exactly the sort of animation that wears out fast.
  const [presentOnMount] = useState(
    () => new Set([...board.signals, ...board.insights, ...board.actions, ...board.results].map((x) => x.id))
  );
  const isArrival = (id) => !presentOnMount.has(id);

  // Set only when *this* click created the card, so a freshly added card takes the caret and
  // you can just start typing. Linking an existing signal doesn't steal focus — it already has
  // content, and there's nothing to type.
  const [focusId, setFocusId] = useState(null);

  const addAction = () => { const id = genId(); setActions((p) => [...p, { id, ifWe: "", then: "", expected: "" }]); setFocusId(id); };
  const addResult = () => { const id = genId(); setResults((p) => [...p, { id, text: "" }]); setFocusId(id); };

  // Linking a signal only ever adds/removes a pointer — never its content, which lives in
  // the global `signals` list and is edited via `onUpdateSignal` (see renderSignalCard).
  // The picker floats rather than sitting in the column's flow — in flow it shoved every card
  // down the moment it opened and yanked them back when it closed. It has to be `fixed` (not
  // absolute) because the column it belongs to scrolls, which would otherwise clip it; that
  // means measuring the button it hangs off, and closing on scroll (see useDismiss).
  const [signalPickerOpen, setSignalPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState(null);
  const [signalQuery, setSignalQuery] = useState("");
  const pickerRef = useRef(null);
  const connectSignalBtnRef = useRef(null);
  const closePicker = useCallback(() => { setSignalPickerOpen(false); setSignalQuery(""); }, []);
  useDismiss(signalPickerOpen, pickerRef, closePicker);

  const PICKER_WIDTH = 260;
  const toggleSignalPicker = () => {
    if (signalPickerOpen) { closePicker(); return; }
    const r = connectSignalBtnRef.current?.getBoundingClientRect();
    if (r) {
      setPickerPos({
        top: Math.round(r.bottom + 6),
        // hang from the button's right edge, nudged back on-screen if that would overflow
        left: Math.round(Math.max(8, Math.min(r.right - PICKER_WIDTH, window.innerWidth - PICKER_WIDTH - 8))),
      });
    }
    setSignalPickerOpen(true);
  };
  const linkableSignals = useMemo(() => {
    const ql = signalQuery.trim().toLowerCase();
    return (signals || []).filter((sig) => (
      !signalLinks.some((l) => l.id === sig.id) && (!ql || (sig.text || "").toLowerCase().includes(ql))
    ));
  }, [signals, signalLinks, signalQuery]);
  const linkSignal = (id) => {
    setSignalLinks((p) => (p.some((x) => x.id === id) ? p : [...p, { id }]));
    setSignalPickerOpen(false);
    setSignalQuery("");
  };
  // Creates a brand-new global signal (added to the workspace's `signals` list via
  // onCreateSignal) and links it into this board in the same action — the id is generated
  // here so there's no need to wait on a round-trip through the parent's state to learn it.
  const createAndLinkSignal = () => {
    const sig = blankSignal();
    onCreateSignal(sig);
    linkSignal(sig.id);
    setFocusId(sig.id);
  };

  // Linking an insight is the same pointer-only pattern signals just went through above —
  // an insight is discovery work now (see insightModel.js), only ever authored or connected to
  // signals from Research Repository's discovery canvas; a spec board links to an existing one
  // (or creates a blank one inline, same convenience the signal picker offers).
  const [insightPickerOpen, setInsightPickerOpen] = useState(false);
  const [insightPickerPos, setInsightPickerPos] = useState(null);
  const [insightQuery, setInsightQuery] = useState("");
  const insightPickerRef = useRef(null);
  const connectInsightBtnRef = useRef(null);
  const closeInsightPicker = useCallback(() => { setInsightPickerOpen(false); setInsightQuery(""); }, []);
  useDismiss(insightPickerOpen, insightPickerRef, closeInsightPicker);

  const toggleInsightPicker = () => {
    if (insightPickerOpen) { closeInsightPicker(); return; }
    const r = connectInsightBtnRef.current?.getBoundingClientRect();
    if (r) {
      setInsightPickerPos({
        top: Math.round(r.bottom + 6),
        left: Math.round(Math.max(8, Math.min(r.right - PICKER_WIDTH, window.innerWidth - PICKER_WIDTH - 8))),
      });
    }
    setInsightPickerOpen(true);
  };
  const linkableInsights = useMemo(() => {
    const ql = insightQuery.trim().toLowerCase();
    return (insights || []).filter((ins) => (
      !insightLinks.some((l) => l.id === ins.id) && (!ql || (ins.text || "").toLowerCase().includes(ql))
    ));
  }, [insights, insightLinks, insightQuery]);
  const linkInsight = (id) => {
    setInsightLinks((p) => (p.some((x) => x.id === id) ? p : [...p, { id }]));
    setInsightPickerOpen(false);
    setInsightQuery("");
  };
  const createAndLinkInsight = () => {
    const ins = blankInsight();
    onCreateInsight(ins);
    linkInsight(ins.id);
    setFocusId(ins.id);
  };

  const reorder = (setList) => (id, dir) => setList((prev) => {
    const idx = prev.findIndex((x) => x.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= prev.length) return prev;
    const copy = [...prev];
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    return copy;
  });
  const moveSignal = reorder(setSignalLinks);
  const moveInsight = reorder(setInsightLinks);
  const moveAction = reorder(setActions);
  const moveResult = reorder(setResults);

  // These cards live in this component's own state, so their undo is built here rather than in
  // App — but it reports through the same toast. A card's connections go with it and have to
  // come back with it too, which is the part that would really smart to lose silently.
  const LISTS = { signal: [signalLinks, setSignalLinks], insight: [insightLinks, setInsightLinks], action: [actions, setActions], result: [results, setResults] };

  const deleteCard = (id, kind) => {
    const [list, setList] = LISTS[kind];
    const index = list.findIndex((x) => x.id === id);
    const item = list[index];
    if (!item) return;
    const severed = connections.filter((c) => c.from === id || c.to === id);

    setList((p) => p.filter((x) => x.id !== id));
    setConnections((c) => c.filter((x) => x.from !== id && x.to !== id));
    delete els.current[id];

    const wires = severed.length ? ` and ${severed.length} connection${severed.length === 1 ? "" : "s"}` : "";
    onToast?.(
      kind === "signal" || kind === "insight" ? `Unlinked ${kind} from this board${wires}` : `Deleted ${kind}${wires}`,
      () => {
        setList((p) => insertAt(p, index, item));
        setConnections((c) => [...c, ...severed]);
      }
    );
  };

  const boardPoint = (clientX, clientY) => {
    const b = boardRef.current.getBoundingClientRect();
    return { x: clientX - b.left, y: clientY - b.top };
  };

  // Click / keyboard alternative to the drag-to-connect gesture. `connectFrom` holds the
  // source node while you pick a target: a "Connect" button then shows on every valid target
  // card (see renderConnectTarget). Escape or clicking the same handle again cancels.
  const [connectFrom, setConnectFrom] = useState(null);
  const dragMoved = useRef(false);
  useEffect(() => {
    if (!connectFrom) return;
    const onKey = (e) => { if (e.key === "Escape") setConnectFrom(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectFrom]);

  const beginConnect = (id, kind) => setConnectFrom((cur) => (cur && cur.from === id ? null : { from: id, kind }));
  const completeConnect = (targetId) => {
    if (!connectFrom) return;
    const from = connectFrom.from;
    setConnections((c) => {
      const existing = c.find((x) => x.from === from && x.to === targetId);
      if (existing) return c.filter((x) => x.id !== existing.id); // second pick on the same target toggles it off
      return [...c, { id: genId(), from, to: targetId }];
    });
    setConnectFrom(null);
  };
  const removeConnection = (connId) => setConnections((c) => c.filter((x) => x.id !== connId));

  const startConnect = (id, kind) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMoved.current = false;
    const p = boardPoint(e.clientX, e.clientY);
    setPending({ from: id, kind, x: p.x, y: p.y, over: null });
  };
  const moveConnect = (e) => {
    if (!pending) return;
    dragMoved.current = true;
    const p = boardPoint(e.clientX, e.clientY);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetEl = el && el.closest("[data-node-id]");
    let over = null;
    if (targetEl && targetEl.getAttribute("data-node-kind") === ALLOWED[pending.kind]) {
      // Action/Result ids are still numeric (genId()); Signal/Insight ids are global string
      // UUIDs now (see signalModel.js/insightModel.js). A DOM attribute is always a string, so
      // this re-numifies it only when the id actually is one — blindly calling Number() on a
      // UUID string produces NaN, which silently broke every drag onto a signal or insight
      // target (the connection got created, just pointing at nothing `pos`/state could resolve).
      const raw = targetEl.getAttribute("data-node-id");
      const asNumber = Number(raw);
      over = Number.isNaN(asNumber) ? raw : asNumber;
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
    <div className="el-order reveal" style={{ position: "absolute", left: "-22px", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "2px", zIndex: 4 }}>
      <button disabled={idx === 0} onClick={() => onMove(id, -1)} title="Move up" style={orderBtnStyle(idx === 0)}><ChevronUp size={11} /></button>
      <button disabled={idx === length - 1} onClick={() => onMove(id, 1)} title="Move down" style={orderBtnStyle(idx === length - 1)}><ChevronDown size={11} /></button>
    </div>
  );

  const renderDelete = (id, kind) => (
    <button
      className="el-del reveal"
      onClick={() => deleteCard(id, kind)}
      title={kind === "signal" || kind === "insight" ? "Unlink from this board" : "Delete card"}
      style={{
        position: "absolute", top: "-7px", right: "-7px", width: "16px", height: "16px", borderRadius: "50%",
        border: `1px solid ${BORDER_STRONG}`, background: "#fff", color: INK_SOFT, cursor: "pointer",
        fontSize: SIZE.xs, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, padding: 0,
      }}
    >
      ×
    </button>
  );

  // A tap (pointer down + up with no movement) or Enter/Space enters click-connect mode; an
  // actual drag still works exactly as before. `dragMoved` tells the two apart on pointer-up.
  const handlePointerUp = (id, kind) => () => {
    if (dragMoved.current) { endConnect(); return; }
    setPending(null);
    beginConnect(id, kind);
  };
  const renderHandle = (id, kind, connected) => {
    const arming = connectFrom && connectFrom.from === id;
    return (
      <button
        type="button"
        className="el-handle reveal"
        onPointerDown={startConnect(id, kind)}
        onPointerMove={moveConnect}
        onPointerUp={handlePointerUp(id, kind)}
        onPointerCancel={endConnect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); beginConnect(id, kind); }
        }}
        aria-label={arming ? `Cancel connecting this ${kind}` : `Connect this ${kind} — press Enter, or drag`}
        aria-pressed={arming ? true : undefined}
        title={arming ? "Click a target card, or press Escape" : "Drag or click to connect"}
        style={{
          position: "absolute", right: "-6px", top: "50%", transform: "translateY(-50%)",
          width: "12px", height: "12px", borderRadius: "50%", padding: 0,
          backgroundColor: connected || arming ? ACCENT[kind] : "#fff",
          border: `2px solid ${ACCENT[kind]}`, cursor: "grab", zIndex: 3, touchAction: "none",
          boxShadow: arming ? `0 0 0 3px ${ACCENT[kind]}44` : "none",
        }}
      />
    );
  };

  // Shown on every valid target card while a connect is armed (renderXxxCard passes its id +
  // node-kind). Sits at the card's left edge, mirroring the source handle at the right edge.
  const renderConnectTarget = (targetId, targetKind) => {
    if (!connectFrom || ALLOWED[connectFrom.kind] !== targetKind) return null;
    const already = connections.some((x) => x.from === connectFrom.from && x.to === targetId);
    return (
      <button
        type="button"
        onClick={() => completeConnect(targetId)}
        aria-label={already ? "Disconnect from the armed source" : "Connect to the armed source"}
        title={already ? "Click to disconnect" : "Click to connect"}
        style={{
          position: "absolute", left: "-9px", top: "-9px", zIndex: 5, whiteSpace: "nowrap",
          fontFamily: font, fontSize: SIZE.micro, fontWeight: WEIGHT.semibold,
          color: "#fff", background: already ? INK_FAINT : ACCENT[connectFrom.kind],
          border: "none", borderRadius: RADIUS.xs, padding: "3px 6px", cursor: "pointer",
          boxShadow: `0 1px 4px rgba(0,0,0,0.18)`,
        }}
      >
        {already ? "Disconnect" : "Connect"}
      </button>
    );
  };

  const targetStyle = (id) => {
    const isTarget = pending && pending.over === id;
    if (!isTarget) return {};
    const c = ACCENT[pending.kind];
    return { outline: `2px solid ${c}`, outlineOffset: "2px", boxShadow: `0 4px 14px ${c}33` };
  };

  const cardClass = (id) => (pulseId === id ? "el-card el-card-pulse" : "el-card");

  // `board` here is the *other* spec's board an ref'd card lives in — labeled by that spec's
  // title (boards carry no name of their own), carried alongside the board data by App.jsx
  // when it builds `allBoards`.
  const renderRefSource = (board) => (
    <button
      className="el-ref-source"
      onClick={(e) => { e.stopPropagation(); onOpenBoard?.(board.id); }}
      title={`Open "${board.specTitle || "Untitled spec"}"`}
      style={{
        display: "flex", alignItems: "center", gap: "4px", marginTop: "8px",
        fontFamily: font, fontSize: SIZE.micro, fontWeight: WEIGHT.medium, color: INK_FAINT,
        background: "none", border: "none", cursor: "pointer", padding: 0,
      }}
    >
      <ArrowUpRight size={11} /> {board.specTitle || "Untitled spec"}
    </button>
  );

  // `link.id` is the linked signal's own global id — resolve its content fresh from `signals`
  // every render, exactly like a ref resolves elsewhere, so edits from any other board (or from
  // Research Repository) show up here immediately. Unlike insight/action/result, there's no
  // local-vs-linked branch here: a signal on a board is *always* a link, and it's fully
  // editable right here — `onUpdateSignal` writes straight to the one shared record.

  const renderSignalCard = (link, idx) => {
    const sig = (signals || []).find((x) => x.id === link.id);
    const update = (patch) => onUpdateSignal(link.id, patch);
    return (
      <div key={link.id} className={`el-node reveal-group${isArrival(link.id) ? " enter-up" : ""}`} style={{ opacity: nodeOpacity(link.id) }} {...hoverProps(link.id)}>
        {renderOrder(link.id, idx, signalLinks.length, moveSignal)}
        <div
          ref={setRef(link.id)} data-node-id={link.id} data-node-kind="signal"
          className={`${cardClass(link.id)} signal-card`} style={cardSurface("signal")}
        >
          <SignalCardBody
            signal={sig}
            missing={!sig}
            activities={activities}
            onChange={update}
            autoFocus={focusId === link.id}
          />
        </div>
        {renderHandle(link.id, "signal", connections.some((c) => c.from === link.id))}
        {renderDelete(link.id, "signal")}
      </div>
    );
  };

  // `link.id` is the linked insight's own global id — resolved fresh from `insights` every
  // render, same live-reference behaviour renderSignalCard already has, and for the same
  // reason: it's discovery work now (see insightModel.js), not board-local content, so an edit
  // from any other board (or Research Repository) shows up here immediately.
  const renderInsightCard = (link, idx) => {
    const ins = (insights || []).find((x) => x.id === link.id);
    const update = (patch) => onUpdateInsight(link.id, patch);
    return (
      <div key={link.id} className={`el-node reveal-group${isArrival(link.id) ? " enter-up" : ""}`} style={{ opacity: nodeOpacity(link.id) }} {...hoverProps(link.id)}>
        {renderOrder(link.id, idx, insightLinks.length, moveInsight)}
        <div ref={setRef(link.id)} data-node-id={link.id} data-node-kind="insight" className={cardClass(link.id)} style={{ ...cardSurface("insight"), ...targetStyle(link.id) }}>
          <InsightCardBody
            insight={ins}
            missing={!ins}
            signals={signals}
            onChange={update}
            autoFocus={focusId === link.id}
          />
        </div>
        {renderHandle(link.id, "insight", connections.some((c) => c.from === link.id))}
        {renderConnectTarget(link.id, "insight")}
        {renderDelete(link.id, "insight")}
      </div>
    );
  };

  const renderActionCard = (a, idx) => {
    const ref = a.ref;
    const resolved = ref ? resolveRef(allBoards, "action", ref) : null;
    return (
      <div key={a.id} className={`el-node reveal-group${isArrival(a.id) ? " enter-up" : ""}`} style={{ opacity: nodeOpacity(a.id) }} {...hoverProps(a.id)}>
        {renderOrder(a.id, idx, actions.length, moveAction)}
        {ref ? (
          <div
            ref={setRef(a.id)} data-node-id={a.id} data-node-kind="action"
            className={cardClass(a.id)}
            style={{ ...cardSurface("action"), ...targetStyle(a.id), borderStyle: "dashed" }}
          >
            {resolved ? (
              <>
                <div style={eyebrow}>If we</div>
                <div style={{ ...editArea, marginTop: "2px", marginBottom: "8px" }}>{resolved.item.ifWe}</div>
                <div style={eyebrow}>Then</div>
                <div style={{ ...editArea, marginTop: "2px", marginBottom: "8px" }}>{resolved.item.then}</div>
                <div style={eyebrow}>Expected</div>
                <div style={{ ...editArea, marginTop: "2px" }}>{resolved.item.expected}</div>
                {renderRefSource(resolved.board)}
              </>
            ) : (
              <div style={{ fontFamily: font, fontStyle: "italic", fontSize: SIZE.ui, color: INK_FAINT }}>
                Referenced action no longer exists.
              </div>
            )}
          </div>
        ) : (
          <div ref={setRef(a.id)} data-node-id={a.id} data-node-kind="action" className={cardClass(a.id)} style={{ ...cardSurface("action"), ...targetStyle(a.id) }}>
            <div style={eyebrow}>If we</div>
            <textarea className="el-edit" rows={2} autoFocus={focusId === a.id} value={a.ifWe} onChange={(e) => patchAction(a.id, { ifWe: e.target.value })} placeholder="…do this" style={{ ...editArea, marginTop: "2px", marginBottom: "8px" }} />
            <div style={eyebrow}>Then</div>
            <textarea className="el-edit" rows={2} value={a.then} onChange={(e) => patchAction(a.id, { then: e.target.value })} placeholder="…this happens" style={{ ...editArea, marginTop: "2px", marginBottom: "8px" }} />
            <div style={eyebrow}>Expected</div>
            <textarea className="el-edit" rows={2} value={a.expected} onChange={(e) => patchAction(a.id, { expected: e.target.value })} placeholder="…measurable outcome" style={{ ...editArea, marginTop: "2px" }} />
          </div>
        )}
        {renderHandle(a.id, "action", connections.some((c) => c.from === a.id))}
        {renderConnectTarget(a.id, "action")}
        {renderDelete(a.id, "action")}
      </div>
    );
  };

  const renderResultCard = (r, idx) => {
    const ref = r.ref;
    const resolved = ref ? resolveRef(allBoards, "result", ref) : null;
    return (
      <div key={r.id} className={`el-node reveal-group${isArrival(r.id) ? " enter-up" : ""}`} style={{ opacity: nodeOpacity(r.id) }} {...hoverProps(r.id)}>
        {renderOrder(r.id, idx, results.length, moveResult)}
        {ref ? (
          <div
            ref={setRef(r.id)} data-node-id={r.id} data-node-kind="result"
            className={cardClass(r.id)}
            style={{ ...cardSurface("result"), ...targetStyle(r.id), borderStyle: "dashed" }}
          >
            {resolved ? (
              <>
                <div style={eyebrow}>Result</div>
                <div style={{ ...editArea, marginTop: "2px" }}>{resolved.item.text}</div>
                {renderRefSource(resolved.board)}
              </>
            ) : (
              <div style={{ fontFamily: font, fontStyle: "italic", fontSize: SIZE.ui, color: INK_FAINT }}>
                Referenced result no longer exists.
              </div>
            )}
          </div>
        ) : (
          <div ref={setRef(r.id)} data-node-id={r.id} data-node-kind="result" className={cardClass(r.id)} style={{ ...cardSurface("result"), ...targetStyle(r.id) }}>
            <div style={eyebrow}>Result</div>
            <textarea className="el-edit" rows={2} autoFocus={focusId === r.id} value={r.text} onChange={(e) => patchResult(r.id, { text: e.target.value })} placeholder="What actually happened…" style={{ ...editArea, marginTop: "2px" }} />
          </div>
        )}
        {renderConnectTarget(r.id, "result")}
        {renderDelete(r.id, "result")}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: font, height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Canvas-specific CSS only — the hover-reveal of a card's controls now comes from the
          shared .reveal-group/.reveal pair in index.css, which also makes them keyboard-
          reachable. The handle keeps its own rule because it settles at 0.8, not 1. */}
      {/* Canvas-only CSS. The card surface itself, and a signal card's metadata controls, live
          in index.css instead — a signal card also appears on the Activity page now, and the
          two have to stay identical. */}
      <style>{`
        .el-board { display:grid; grid-template-columns: repeat(4, minmax(220px, 1fr)); grid-template-rows: 1fr; align-items:stretch; position:relative; z-index:1; flex:1; min-height:0; min-width:900px; }
        .el-node { position:relative; transition: opacity ${MOTION.base} ${MOTION.ease}; }
        .el-node:hover .el-handle, .el-node:focus-within .el-handle { opacity:0.8; }
        .el-ref-source:hover { color: ${INK_SOFT}; text-decoration: underline; }
        .el-connector { transition: opacity ${MOTION.base} ${MOTION.ease}, stroke-width ${MOTION.fast} ${MOTION.ease}; }
        @keyframes el-pulse { 0% { box-shadow: 0 0 0 0 rgba(217,164,6,0.55); } 70% { box-shadow: 0 0 0 9px rgba(217,164,6,0); } 100% { box-shadow: 0 0 0 0 rgba(217,164,6,0); } }
        .el-card-pulse { animation: el-pulse 1s ${MOTION.ease} 2; }
        .el-signal-pick { transition: background-color ${MOTION.fast} ${MOTION.ease}; }
        .el-signal-pick:hover { background:${BG_HOVER}; }
        /* While a connector drag is in flight, nothing on the board is selectable — a stray
           text selection under the pointer is never what you meant. */
        .el-dragging, .el-dragging * { user-select: none; -webkit-user-select: none; }
      `}</style>

      <div
        ref={boardRef}
        className={pending ? "el-dragging" : undefined}
        // BG_SIDEBAR, not BG (white) — cards on this canvas are also BG-filled, so a white
        // canvas left them distinguished only by their 1px border + colored left edge. Same
        // fix already applied to the app's page background and, briefly, the discovery canvas;
        // this was the one surface that still had it.
        style={{ position: "relative", backgroundColor: BG_SIDEBAR, border: `1px solid ${BORDER}`, borderRadius: "10px", overflowX: "auto", overflowY: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
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
                    role="button" tabIndex={0}
                    aria-label="Connection — Enter or Delete to remove, or drag to reconnect"
                    style={{ pointerEvents: "stroke", cursor: "pointer", touchAction: "none" }}
                    onMouseEnter={() => setHoverConnId(c.id)}
                    onMouseLeave={() => setHoverConnId((h) => (h === c.id ? null : h))}
                    onFocus={() => setHoverConnId(c.id)}
                    onBlur={() => setHoverConnId((h) => (h === c.id ? null : h))}
                    onPointerDown={startRewire(c)}
                    onPointerMove={moveConnect}
                    onPointerUp={() => { if (!dragMoved.current) removeConnection(c.id); else endConnect(); }}
                    onPointerCancel={endConnect}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " " || e.key === "Delete" || e.key === "Backspace") {
                        e.preventDefault();
                        removeConnection(c.id);
                      }
                    }}>
                    <title>Click or press Delete to remove. Drag to another card to reconnect.</title>
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

          {/* SIGNAL — link an existing global signal, or create a brand-new one right here
              (it's still added to the workspace-wide `signals` list, just linked into this
              board in the same action). Loose or activity-attached signals are otherwise
              created from Research Repository. */}
          <Column
            kind="signal" title="Signal" count={signalLinks.length}
            onAdd={createAndLinkSignal}
            onConnect={toggleSignalPicker}
            connectProps={{ "data-dismiss-ignore": true, ref: connectSignalBtnRef }}
          >
            {signalPickerOpen && pickerPos && (
              <div
                ref={pickerRef}
                className="popover enter-up"
                style={{ top: pickerPos.top, left: pickerPos.left, width: PICKER_WIDTH }}
              >
                <input
                  autoFocus
                  className="field"
                  value={signalQuery}
                  onChange={(e) => setSignalQuery(e.target.value)}
                  placeholder="Search signals…"
                  style={{ width: "100%", marginBottom: SPACE.md }}
                />
                {linkableSignals.length === 0 ? (
                  <div style={{ fontFamily: font, fontSize: SIZE.sm, color: INK_FAINT, padding: "4px 2px" }}>
                    {signalQuery.trim() ? "No matching signals." : "No other signals to link — use + to create one."}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, maxHeight: "160px", overflowY: "auto" }}>
                    {linkableSignals.slice(0, 30).map((sig) => (
                      <button
                        key={sig.id}
                        className="el-signal-pick"
                        onClick={() => linkSignal(sig.id)}
                        style={{ textAlign: "left", fontFamily: font, fontSize: SIZE.sm, color: INK, background: "none", border: "none", borderRadius: RADIUS.xs, padding: "5px 6px", cursor: "pointer" }}
                      >
                        {sig.text ? sig.text.slice(0, 80) : "(empty signal)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {signalLinks.map((s, idx) => renderSignalCard(s, idx))}
          </Column>

          {/* INSIGHT — link an existing global insight, or create a brand-new one right here
              (still added to the workspace-wide `insights` list, just linked into this board in
              the same action). Insights built out of signals belong on Research Repository's
              discovery canvas instead. */}
          <Column
            kind="insight" title="Insight" count={insightLinks.length}
            onAdd={createAndLinkInsight}
            onConnect={toggleInsightPicker}
            connectProps={{ "data-dismiss-ignore": true, ref: connectInsightBtnRef }}
          >
            {insightPickerOpen && insightPickerPos && (
              <div
                ref={insightPickerRef}
                className="popover enter-up"
                style={{ top: insightPickerPos.top, left: insightPickerPos.left, width: PICKER_WIDTH }}
              >
                <input
                  autoFocus
                  className="field"
                  value={insightQuery}
                  onChange={(e) => setInsightQuery(e.target.value)}
                  placeholder="Search insights…"
                  style={{ width: "100%", marginBottom: SPACE.md }}
                />
                {linkableInsights.length === 0 ? (
                  <div style={{ fontFamily: font, fontSize: SIZE.sm, color: INK_FAINT, padding: "4px 2px" }}>
                    {insightQuery.trim() ? "No matching insights." : "No other insights to link — use + to create one."}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, maxHeight: "160px", overflowY: "auto" }}>
                    {linkableInsights.slice(0, 30).map((ins) => (
                      <button
                        key={ins.id}
                        className="el-signal-pick"
                        onClick={() => linkInsight(ins.id)}
                        style={{ textAlign: "left", fontFamily: font, fontSize: SIZE.sm, color: INK, background: "none", border: "none", borderRadius: RADIUS.xs, padding: "5px 6px", cursor: "pointer" }}
                      >
                        {ins.text ? ins.text.slice(0, 80) : "(empty insight)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {insightLinks.map((n, idx) => renderInsightCard(n, idx))}
          </Column>

          {/* ACTION */}
          <Column kind="action" title="Action" count={actions.length} onAdd={addAction}>
            {actions.map((a, idx) => renderActionCard(a, idx))}
          </Column>

          {/* RESULT */}
          <Column kind="result" title="Result" count={results.length} last onAdd={addResult}>
            {results.map((r, idx) => renderResultCard(r, idx))}
          </Column>
        </div>
      </div>
    </div>
  );
}
