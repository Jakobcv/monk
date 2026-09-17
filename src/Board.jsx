import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Plus, Link2, ChevronUp, ChevronDown, ArrowUpRight, X } from "lucide-react";
import { genId, resolveRef } from "./lib/boardModel";
import { blankSignal } from "./lib/signalModel";
import { blankInsight } from "./lib/insightModel";
import { blankSpec } from "./lib/specModel";
import { insertAt } from "./lib/arrays";
import { useDismiss } from "./lib/useDismiss";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BG_HOVER, ACCENT, SPEC_STATUS_COLOR, SIZE, WEIGHT, SPACE, RADIUS, MOTION } from "./lib/theme";
import { Dot, Eyebrow, Meta } from "./ui/text";
import { cardSurface, cornerBadge } from "./ui/cardStyles";
import SignalCardBody from "./SignalCardBody";
import InsightCardBody from "./InsightCardBody";
import IconButton from "./ui/IconButton";
import LinkPicker from "./ui/LinkPicker";
import { useConnectGesture } from "./canvas/useConnectGesture";
import { useRects } from "./canvas/useRects";

const ALLOWED = { signal: "insight", insight: "action", action: "result" };

const orderBtnStyle = (disabled) => ({
  width: "20px", height: "20px", borderRadius: RADIUS.xs, border: `1px solid ${BORDER}`, background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", color: INK_SOFT, padding: 0,
  opacity: disabled ? 0.3 : 1, cursor: disabled ? "default" : "pointer",
});

// `+` always creates a new card directly. Signal/Insight/Spec columns also pass `onConnect` — a
// second, quieter icon button that opens the link-an-existing picker (Action has nothing
// existing to link to, so it gets the `+` alone).
function ColumnHeader({ kind, title, count, onAdd, addProps, onConnect, connectProps }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginBottom: SPACE.xs }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT[kind], flexShrink: 0 }} />
      <span style={{ fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.sm, color: INK }}>{title}</span>
      {/* tabular-nums: this count changes as cards are added, linked and unlinked, and
          proportional digits shift the buttons beside it on every change. */}
      <span style={{ fontFamily: font, fontWeight: WEIGHT.normal, fontSize: SIZE.sm, color: INK_FAINT, fontVariantNumeric: "tabular-nums" }}>{count}</span>
      {/* --hit-w is capped to the 2px gap between this pair: 24px buttons 2px apart are 26px
          centre to centre, so anything wider would put one button's target on top of the
          other's. Vertically the header row is clear, so height takes what it can. */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "2px" }}>
        {onConnect && (
          <IconButton onClick={onConnect} title={`Link an existing ${title.toLowerCase()}`} style={{ color: INK_SOFT, "--hit-w": "26px", "--hit-h": "30px" }} {...connectProps}>
            <Link2 size={16} />
          </IconButton>
        )}
        <IconButton onClick={onAdd} title={`New ${title.toLowerCase()}`} style={{ color: INK_SOFT, "--hit-w": "26px", "--hit-h": "30px" }} {...addProps}>
          <Plus size={16} />
        </IconButton>
      </div>
    </div>
  );
}

function Column({ kind, title, count, children, last, onAdd, addProps, onConnect, connectProps }) {
  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto", borderRight: last ? "none" : `1px solid ${BORDER}`, padding: `${SPACE.xl} ${SPACE["3xl"]}`, display: "flex", flexDirection: "column", gap: SPACE.base, minWidth: 0 }}>
      <ColumnHeader kind={kind} title={title} count={count} onAdd={onAdd} addProps={addProps} onConnect={onConnect} connectProps={connectProps} />
      {children}
    </div>
  );
}

// `board` is only used to seed local state on mount — the parent remounts this component
// (via `key={board.id}`) whenever the active board changes, so local state never needs to
// resync mid-life. Every change is pushed up via `onChange`; the parent owns persistence.
// A board is pure canvas — no name/status/etc. of its own, that all lives on the research plan it
// belongs to (see ResearchPlanPage.jsx's Analysis tab).
//
// Signals and Insights are the exception to "a board owns its cards' content": each is a
// global, workspace-wide record (see signalModel.js / insightModel.js) that's only ever
// *linked* here, any number of boards at once — `board.signals`/`board.insights` are therefore
// just lists of pointers (`{id}`, where `id` is the linked record's own id), and
// `signals`/`insights` (props) are the full global lists used to resolve and edit
// them. Editing a linked signal or insight's content goes straight through `onUpdateSignal`/
// `onUpdateInsight` (bypassing this component's own onChange/boardState entirely), since that
// edit isn't board-local data — it's shared, and shows up everywhere else the record is linked.
// Action keeps authoring its content locally, same as always — a study's actions are genuinely
// its own. Result is a pointer too, but of a third kind: not a research record like a signal or
// insight, but a spec (specModel.js) — this is where an action's result becomes a spec to build.
// `results` entries are `{id, specId}`; `specs` (prop) is the global list used to resolve them,
// and creating or linking one here also adds this board's id to that spec's own
// `researchPlanIds` (via `onUpdateSpec`), so a spec born on this column shows up on the plan's
// own "Informs" list too, the same field a spec normally sets from its own Overview.
export default function Board({
  board, onChange, highlightCardId, allBoards, onOpenBoard,
  signals, insights, onUpdateSignal, onCreateSignal, onUpdateInsight, onCreateInsight,
  specs, onCreateSpec, onUpdateSpec, specHref,
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
  const { setRef, rects: pos, els } = useRects(boardRef);

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
  }, [highlightCardId, els]);

  const [hoverId, setHoverId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
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

  // A card never dims while it holds focus — you're editing it, and a scroll-into-view on a
  // freshly-created card can drift another card under the pointer, which would otherwise fade
  // the one you're typing in.
  const nodeOpacity = (id) =>
    pending || hoverId == null || id === focusedId ? 1 : connectedIds.has(id) ? 1 : 0.25;
  const hoverProps = (id) => ({
    onMouseEnter: () => setHoverId(id),
    onMouseLeave: () => setHoverId((h) => (h === id ? null : h)),
    onFocus: () => setFocusedId(id),
    onBlur: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setFocusedId((f) => (f === id ? null : f));
    },
  });

  const kindOf = (id) => {
    if (signalLinks.some((x) => x.id === id)) return "signal";
    if (insightLinks.some((x) => x.id === id)) return "insight";
    if (actions.some((x) => x.id === id)) return "action";
    if (results.some((x) => x.id === id)) return "result";
    return null;
  };

  const patchAction = (id, patch) => setActions((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // Which cards were already here when this board opened. Anything that shows up later is an
  // arrival and animates in — without this, every card on the board would fly in each time you
  // switched to the Analysis tab, which is exactly the sort of animation that wears out fast.
  const [presentOnMount] = useState(
    () => new Set([...board.signals, ...board.insights, ...board.actions, ...board.results].map((x) => x.id))
  );
  const isArrival = (id) => !presentOnMount.has(id);

  // Set only when *this* click created the card, so a freshly added card takes the caret and
  // you can just start typing. Linking an existing signal doesn't steal focus — it already has
  // content, and there's nothing to type.
  const [focusId, setFocusId] = useState(null);

  const addAction = () => { const id = genId(); setActions((p) => [...p, { id, ifWe: "", then: "", expected: "" }]); setFocusId(id); };

  // A result card is a pointer to a spec, not authored content — "New" makes a blank spec and
  // links it in the same action (mirrors createAndLinkSignal below), pre-set to say this plan is
  // behind it; "Link" (the picker further down) attaches an already-existing spec instead, and
  // brings its own researchPlanIds up to date if this plan wasn't already on it.
  const createAndLinkSpec = () => {
    const spec = blankSpec("Untitled spec");
    spec.researchPlanIds = [board.id];
    onCreateSpec(spec);
    const id = genId();
    setResults((p) => [...p, { id, specId: spec.id }]);
    setFocusId(id);
  };
  const linkSpec = (specId) => {
    const id = genId();
    setResults((p) => [...p, { id, specId }]);
    const spec = (specs || []).find((s) => s.id === specId);
    if (spec && !(spec.researchPlanIds || []).includes(board.id)) {
      onUpdateSpec(specId, { researchPlanIds: [...(spec.researchPlanIds || []), board.id] });
    }
  };
  const [specPickerOpen, setSpecPickerOpen] = useState(false);
  const connectSpecBtnRef = useRef(null);
  const linkableSpecs = useMemo(() => {
    const linkedIds = new Set(results.map((r) => r.specId));
    return (specs || []).filter((s) => !linkedIds.has(s.id));
  }, [specs, results]);

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

    const wires = severed.length ? ` and ${severed.length} connection${severed.length === 1 ? "" : "s"}` : "";
    const unlinkable = { signal: "signal", insight: "insight", result: "spec" };
    onToast?.(
      unlinkable[kind] ? `Unlinked ${unlinkable[kind]} from this board${wires}` : `Deleted ${kind}${wires}`,
      () => {
        setList((p) => insertAt(p, index, item));
        setConnections((c) => [...c, ...severed]);
      }
    );
  };

  const removeConnection = (connId) => setConnections((c) => c.filter((x) => x.id !== connId));

  // The connect / rewire gestures come from the shared canvas engine (src/canvas/
  // useConnectGesture) — the same one a spec's flow map uses. What's specific to this board is
  // only its rules:
  //   - a signal connects to an insight, an insight to an action, an action to a result (ALLOWED)
  //   - in click-connect mode, picking a target that's already connected toggles it off
  //   - a connector dragged onto a card that already has that connection is dropped, not duplicated;
  //     dragged onto nothing, it's removed
  //   - tapping a connector removes it
  const { pending, connectFrom, completeConnect, handleProps, linkProps } = useConnectGesture({
    containerRef: boardRef,
    canTarget: (from, to) => ALLOWED[kindOf(from)] === kindOf(to),
    onConnect: (from, to, via) => setConnections((c) => {
      const existing = c.find((x) => x.from === from && x.to === to);
      if (existing) return via === "click" ? c.filter((x) => x.id !== existing.id) : c;
      return [...c, { id: genId(), from, to }];
    }),
    onRewire: (id, from, to) => setConnections((c) => {
      const rest = c.filter((x) => x.id !== id);
      if (to == null) return rest;
      if (rest.some((x) => x.from === from && x.to === to)) return rest;
      return [...rest, { id, from, to }];
    }),
    onTapLink: removeConnection,
  });

  const pathFor = (sx, sy, tx, ty) => {
    const off = Math.max(40, Math.abs(tx - sx) / 2);
    return `M ${sx} ${sy} C ${sx + off} ${sy}, ${tx - off} ${ty}, ${tx} ${ty}`;
  };

  const renderOrder = (id, idx, length, onMove) => (
    <div className="el-order reveal" style={{ position: "absolute", left: "-24px", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "2px", zIndex: 4 }}>
      <button disabled={idx === 0} onClick={() => onMove(id, -1)} title="Move up" style={orderBtnStyle(idx === 0)}><ChevronUp size={16} /></button>
      <button disabled={idx === length - 1} onClick={() => onMove(id, 1)} title="Move down" style={orderBtnStyle(idx === length - 1)}><ChevronDown size={16} /></button>
    </div>
  );

  const renderDelete = (id, kind) => (
    <IconButton
      className="el-del reveal"
      onClick={() => deleteCard(id, kind)}
      title={kind === "signal" || kind === "insight" || kind === "result" ? "Unlink from this board" : "Delete card"}
      style={{ ...cornerBadge, right: "-7px" }}
    >
      <X size={12} />
    </IconButton>
  );

  // A tap (pointer down + up with no movement) or Enter/Space enters click-connect mode; an
  // actual drag connects directly. Both come from useConnectGesture's handleProps.
  const renderHandle = (id, kind, connected) => {
    const arming = connectFrom === id;
    return (
      <button
        type="button"
        className="el-handle reveal"
        {...handleProps(id)}
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
    if (connectFrom == null || ALLOWED[kindOf(connectFrom)] !== targetKind) return null;
    const already = connections.some((x) => x.from === connectFrom && x.to === targetId);
    return (
      <button
        type="button"
        onClick={() => completeConnect(targetId)}
        aria-label={already ? "Disconnect from the armed source" : "Connect to the armed source"}
        title={already ? "Click to disconnect" : "Click to connect"}
        style={{
          position: "absolute", left: "-9px", top: "-9px", zIndex: 5, whiteSpace: "nowrap",
          fontFamily: font, fontSize: SIZE.micro, fontWeight: WEIGHT.semibold,
          color: "#fff", background: already ? INK_FAINT : ACCENT[kindOf(connectFrom)],
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
    const c = ACCENT[kindOf(pending.from)];
    return { outline: `2px solid ${c}`, outlineOffset: "2px", boxShadow: `0 4px 14px ${c}33` };
  };

  const cardClass = (id) => (pulseId === id ? "el-card el-card-pulse" : "el-card");

  // `board` here is the *other* research plan's board a ref'd card lives in — labeled by that plan's
  // title (boards carry no name of their own), carried alongside the board data by App.jsx
  // when it builds `allBoards`.
  const renderRefSource = (board) => (
    <button
      className="el-ref-source"
      onClick={(e) => { e.stopPropagation(); onOpenBoard?.(board.id); }}
      title={`Open "${board.title || "Untitled research plan"}"`}
      style={{
        display: "flex", alignItems: "center", gap: "4px", marginTop: "8px",
        fontFamily: font, fontSize: SIZE.micro, fontWeight: WEIGHT.medium, color: INK_FAINT,
        background: "none", border: "none", cursor: "pointer", padding: 0,
      }}
    >
      <ArrowUpRight size={11} /> {board.title || "Untitled research plan"}
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
                <Eyebrow>If we</Eyebrow>
                <div className="edit-area" style={{ marginTop: "2px", marginBottom: "8px" }}>{resolved.item.ifWe}</div>
                <Eyebrow>Then</Eyebrow>
                <div className="edit-area" style={{ marginTop: "2px", marginBottom: "8px" }}>{resolved.item.then}</div>
                <Eyebrow>Expected</Eyebrow>
                <div className="edit-area" style={{ marginTop: "2px" }}>{resolved.item.expected}</div>
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
            <Eyebrow>If we</Eyebrow>
            <textarea className="el-edit edit-area" rows={2} autoFocus={focusId === a.id} value={a.ifWe} onChange={(e) => patchAction(a.id, { ifWe: e.target.value })} placeholder="…do this" style={{ marginTop: "2px", marginBottom: "8px" }} />
            <Eyebrow>Then</Eyebrow>
            <textarea className="el-edit edit-area" rows={2} value={a.then} onChange={(e) => patchAction(a.id, { then: e.target.value })} placeholder="…this happens" style={{ marginTop: "2px", marginBottom: "8px" }} />
            <Eyebrow>Expected</Eyebrow>
            <textarea className="el-edit edit-area" rows={2} value={a.expected} onChange={(e) => patchAction(a.id, { expected: e.target.value })} placeholder="…measurable outcome" style={{ marginTop: "2px" }} />
          </div>
        )}
        {renderHandle(a.id, "action", connections.some((c) => c.from === a.id))}
        {renderConnectTarget(a.id, "action")}
        {renderDelete(a.id, "action")}
      </div>
    );
  };

  // `r.specId` resolves fresh from `specs` every render, same live-reference behaviour a signal
  // or insight link already has: renaming the spec here (or from the spec's own page) shows up
  // everywhere it's linked. A spec is otherwise created from Specs or an Initiative — this is
  // just a second, in-context place to start one, seeded with this plan already behind it.
  const renderResultCard = (r, idx) => {
    const spec = (specs || []).find((s) => s.id === r.specId);
    return (
      <div key={r.id} className={`el-node reveal-group${isArrival(r.id) ? " enter-up" : ""}`} style={{ opacity: nodeOpacity(r.id) }} {...hoverProps(r.id)}>
        {renderOrder(r.id, idx, results.length, moveResult)}
        <div ref={setRef(r.id)} data-node-id={r.id} data-node-kind="result" className={cardClass(r.id)} style={{ ...cardSurface("result"), ...targetStyle(r.id) }}>
          {spec ? (
            <>
              <Eyebrow>Spec</Eyebrow>
              <input
                className="el-edit edit-area"
                autoFocus={focusId === r.id}
                value={spec.title}
                onChange={(e) => onUpdateSpec(spec.id, { title: e.target.value })}
                placeholder="Untitled spec"
                style={{ marginTop: "2px", marginBottom: "8px", fontWeight: WEIGHT.medium }}
              />
              <a
                className="el-ref-source"
                href={specHref(spec.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  fontFamily: font, fontSize: SIZE.micro, fontWeight: WEIGHT.medium, color: INK_FAINT,
                  textDecoration: "none",
                }}
              >
                <ArrowUpRight size={11} /> Open spec
              </a>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs, marginTop: "6px" }}>
                <Dot color={SPEC_STATUS_COLOR[spec.status] || INK_FAINT} />
                <Meta style={{ fontSize: SIZE.ui }}>{spec.status}</Meta>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: font, fontStyle: "italic", fontSize: SIZE.ui, color: INK_FAINT }}>
              Linked spec no longer exists.
            </div>
          )}
        </div>
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
          in index.css instead — a signal card also appears on a research plan's page, and the
          two have to stay identical. */}
      <style>{`
        .el-board { display:grid; grid-template-rows: 1fr; align-items:stretch; position:relative; z-index:1; flex:1; min-height:0; min-width:900px; }
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
        // No fill of its own: this is a framed region of the page, not a surface laid on it.
        // It used to paint BG_APP's grey so the white cards inside had something to separate
        // from — but the page behind it became that same grey, and a panel the colour of its
        // own background is just a border. Inheriting the ground keeps the cards' contrast
        // (white on grey, as everywhere else) and loses the phantom surface; the border and
        // radius still say where the canvas ends.
        style={{ position: "relative", border: `1px solid ${BORDER}`, borderRadius: RADIUS.lg, overflowX: "auto", overflowY: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        {/* A column with no cards yet gives up some of its width to the ones that have them, so an
            empty Action and Result don't leave the signals and insights wrapping every few words. */}
        <div
          className="el-board"
          style={{ gridTemplateColumns: [signalLinks.length, insightLinks.length, actions.length, results.length].map((n) => (n ? "minmax(220px, 1fr)" : "minmax(160px, 0.6fr)")).join(" ") }}
        >
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
                    {...linkProps(c)}
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
              const c = isDeleteIntent ? "#D64545" : ACCENT[kindOf(pending.from)];
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
              board in the same action). Signals are otherwise created from Research
              Repository or a research plan's page. */}
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
                        style={{ textAlign: "left", fontFamily: font, fontSize: SIZE.sm, color: INK, background: "none", border: "none", borderRadius: RADIUS.sm, padding: "5px 6px", cursor: "pointer" }}
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
                        style={{ textAlign: "left", fontFamily: font, fontSize: SIZE.sm, color: INK, background: "none", border: "none", borderRadius: RADIUS.sm, padding: "5px 6px", cursor: "pointer" }}
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

          {/* SPEC (kind stays "result" internally — see the note above the state, and the
              comment on renderResultCard) — create a blank spec and link it here in one action,
              or connect one that already exists. */}
          <Column
            kind="result" title="Spec" count={results.length} last
            onAdd={createAndLinkSpec}
            onConnect={() => setSpecPickerOpen((open) => !open)}
            connectProps={{ "data-dismiss-ignore": true, ref: connectSpecBtnRef }}
          >
            {specPickerOpen && (
              <LinkPicker
                anchorRef={connectSpecBtnRef}
                onClose={() => setSpecPickerOpen(false)}
                label="Link a spec"
                placeholder="Search specs…"
                emptyText="No other specs to link — use + to create one."
                items={linkableSpecs.map((s) => ({ id: s.id, label: s.title || "Untitled spec", meta: s.status }))}
                onPick={linkSpec}
                action={{ label: "New spec", onClick: createAndLinkSpec }}
              />
            )}
            {results.map((r, idx) => renderResultCard(r, idx))}
          </Column>
        </div>
      </div>
    </div>
  );
}
