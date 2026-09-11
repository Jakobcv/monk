import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, BG, BG_SIDEBAR, DANGER, SIZE, WEIGHT, RADIUS, MOTION } from "./lib/theme";
import { editArea } from "./ui/text";
import { cornerBadge } from "./ui/cardStyles";
import { genEntityId } from "./lib/boardModel";
import { TIERS } from "./lib/designModel";
import { insertAt } from "./lib/arrays";
import { useConnectGesture } from "./canvas/useConnectGesture";
import { useRects } from "./canvas/useRects";
import AutoTextarea from "./ui/AutoTextarea";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

// A spec's flow map: a story map where rows are its use cases (which live only here — the Design
// tab just links in) and columns are stages you name. Steps sit in a cell; connectors go
// from any step to any other and can carry a label for a branch. Data lives in `flow` (see
// lib/flowModel.js); `onChange` takes an updater, `(prev) => next`.
//
// Connecting and rewiring come from the shared canvas engine (src/canvas/useConnectGesture) —
// the Discovery board's gestures: drag from a step's handle onto another step, or tap the handle
// and then pick one; drag a connector to move its arrow end, or drop it on nothing to remove it.
//
// Connector readability, per graph-drawing research (crossings hurt most, then high curvature)
// and swimlane practice (flow left→right, no top/bottom attachments):
//   1. Orthogonal, gutter-only routing: out of a step's right edge, into the target's left edge,
//      travelling only along column and row boundaries — never behind a step.
//   2. Distinct ports and lanes: connectors on one side of a step spread out, ordered by their far
//      end; connectors sharing a gutter run in parallel lanes.
//   3. Focus on demand instead of colour-coding: one quiet grey at rest; hovering a step brings its
//      whole upstream/downstream path forward in ink, hovering a use case its row's connectors.
// Loop-backs are dashed; a label sits on its connector's longest straight run.

const HEADER_W = 220;
const LINE = "#A9A9A5";
const LANE = 6;
const CORNER = 6;

// Surfaces carry the structure so that lines can mean one thing — a connector. The frame (stage
// headers, use-case column) sits on the app's chrome surface, like the sidebar; each use case's row
// is a lane on a slightly deeper work surface, alternating so neighbouring lanes separate without
// a rule between them; steps are white and lifted off it. No grid lines inside the lanes: stages
// read from their header and from how steps line up beneath it.
const FRAME = BG_SIDEBAR;
const LANES = ["#F6F6F3", "#F1F1EE"];
const laneOf = (rowIndex) => LANES[rowIndex % 2];
const frameCell = { background: FRAME, borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` };

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

function labelAt(pts) {
  let best = null, len = -1;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (l > len) { len = l; best = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 }; }
  }
  return best;
}

// Connector geometry for the current layout. `rects` holds step rects (by step id) and the stage
// and use-case boundaries (`col:<id>`, `row:<id>`) — the gutters connectors may travel along.
function computeRoutes(flow, rects) {
  const cp = {};
  for (const s of flow.steps) if (rects[s.id]) cp[s.id] = rects[s.id];
  const colIdx = Object.fromEntries(flow.stages.map((c, i) => [c.id, i]));
  const rowIdx = Object.fromEntries(flow.useCases.map((r, i) => [r.id, i]));
  const step = Object.fromEntries(flow.steps.map((s) => [s.id, s]));
  const col = (id) => rects[`col:${id}`];
  const row = (id) => rects[`row:${id}`];
  const links = flow.links.filter((l) =>
    cp[l.from] && cp[l.to] && col(step[l.from]?.stage) && col(step[l.to]?.stage) && row(step[l.from]?.useCase));

  // Ports: spread a step side's connectors along it, ordered by where their other end sits.
  const port = {};
  const spread = (byStep, key, otherEnd) => {
    for (const [id, list] of Object.entries(byStep)) {
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
    const a = step[l.from], b = step[l.to];
    const sc = colIdx[a.stage], tc = colIdx[b.stage], sr = rowIdx[a.useCase], tr = rowIdx[b.useCase];
    const sy = port[`${l.id}:out`], ty = port[`${l.id}:in`];
    const gx1 = col(a.stage).right, gx2 = col(b.stage).left;
    // A detour travels just inside the source lane's own padding (9px in from its edge) rather than
    // on the boundary itself: it reads as belonging to that lane, and the first lane's top edge is
    // under the sticky stage header, which would otherwise hide the line and its label.
    const hy = tr > sr ? row(a.useCase).bottom - 9 : row(a.useCase).top + 9;
    const r = { l, sx: cp[l.from].right, tx: cp[l.to].left, sy, ty, back: tc < sc, v1: null, h: null, v2: { x: gx2, span: 0 } };
    if (tc === sc + 1) {
      // next stage: one elbow in the gutter between them
    } else if (tc > sc && !blocked(gx1, gx2, sy, [l.from, l.to])) {
      // skipping stages with a clear run at the port's height: straight across
    } else {
      r.v1 = { x: gx1 };
      r.h = { y: hy };
    }
    r.v2.span = Math.min(r.h ? r.h.y : sy, ty);
    if (r.v1) { r.v1.span = Math.min(sy, hy); r.h.span = Math.min(gx1, gx2); }
    return r;
  });

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

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function FlowMap({ flow, onChange, onToast }) {
  const gridRef = useRef(null);
  const { setRef, rects } = useRects(gridRef);
  const [selLink, setSelLink] = useState(null);
  const [hoverStep, setHoverStep] = useState(null);
  const [hoverRow, setHoverRow] = useState(null);
  const [fresh, setFresh] = useState(null);

  const set = (key, fn) => onChange((p) => ({ ...p, [key]: fn(p[key]) }));
  const patch = (key, id, fields) => set(key, (xs) => xs.map((x) => (x.id === id ? { ...x, ...fields } : x)));
  const hasLink = (ls, from, to, except) => ls.some((l) => l.id !== except && l.from === from && l.to === to);

  const addUseCase = () => { const id = genEntityId(); setFresh(id); set("useCases", (xs) => [...xs, { id, tier: xs.length ? 1 : 0, text: "" }]); };
  const addStage = () => { const id = genEntityId(); setFresh(id); set("stages", (xs) => [...xs, { id, name: "" }]); };
  const addStep = (useCase, stage) => { const id = genEntityId(); setFresh(id); set("steps", (xs) => [...xs, { id, useCase, stage, text: "" }]); };

  // Removals report through the app's Undo toast. Anything that takes steps with it takes their
  // connectors too, and Undo puts every piece back.
  const removeLink = (id) => {
    const index = flow.links.findIndex((l) => l.id === id);
    const link = flow.links[index];
    if (!link) return;
    set("links", (ls) => ls.filter((l) => l.id !== id));
    setSelLink(null);
    onToast?.("Removed connection", () => set("links", (ls) => insertAt(ls, index, link)));
  };
  const removeSteps = (stepIds, owner) => {
    const ids = new Set(stepIds);
    const steps = flow.steps.filter((s) => ids.has(s.id));
    const links = flow.links.filter((l) => ids.has(l.from) || ids.has(l.to));
    onChange((p) => ({
      ...p,
      ...(owner ? { [owner.key]: p[owner.key].filter((x) => x.id !== owner.item.id) } : {}),
      steps: p.steps.filter((s) => !ids.has(s.id)),
      links: p.links.filter((l) => !ids.has(l.from) && !ids.has(l.to)),
    }));
    return { steps, links };
  };
  const removeStep = (id) => {
    const index = flow.steps.findIndex((s) => s.id === id);
    const item = flow.steps[index];
    if (!item) return;
    const { links } = removeSteps([id]);
    if (!item.text.trim() && !links.length) return;
    onToast?.(`Removed step${links.length ? ` and ${plural(links.length, "connection")}` : ""}`, () =>
      onChange((p) => ({ ...p, steps: insertAt(p.steps, index, item), links: [...p.links, ...links] })));
  };
  const removeOwner = (key, id, noun, name) => {
    const index = flow[key].findIndex((x) => x.id === id);
    const item = flow[key][index];
    if (!item) return;
    const field = key === "stages" ? "stage" : "useCase";
    const { steps, links } = removeSteps(flow.steps.filter((s) => s[field] === id).map((s) => s.id), { key, item });
    if (!name(item).trim() && !steps.length) return;
    onToast?.(`Removed ${noun}${steps.length ? ` and ${plural(steps.length, "step")}` : ""}`, () =>
      onChange((p) => ({ ...p, [key]: insertAt(p[key], index, item), steps: [...p.steps, ...steps], links: [...p.links, ...links] })));
  };
  const removeStage = (id) => removeOwner("stages", id, "stage", (s) => s.name);
  const removeUseCase = (id) => removeOwner("useCases", id, "use case", (u) => u.text);

  const { pending, connectFrom, setConnectFrom, completeConnect, handleProps, linkProps } = useConnectGesture({
    containerRef: gridRef,
    canTarget: () => true, // any step to any other; the engine already excludes the source itself
    onConnect: (from, to) => set("links", (ls) => (hasLink(ls, from, to) ? ls : [...ls, { id: genEntityId(), from, to, label: "" }])),
    onRewire: (id, from, to) => {
      if (to == null) removeLink(id);
      else set("links", (ls) => (hasLink(ls, from, to, id) ? ls : ls.map((l) => (l.id === id ? { ...l, to } : l))));
    },
    onTapLink: (id) => { setConnectFrom(null); setSelLink((s) => (s === id ? null : id)); },
  });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelLink(null);
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
      if ((e.key === "Delete" || e.key === "Backspace") && selLink && !typing) removeLink(selLink);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const routes = computeRoutes(flow, rects);

  // Focus: a hovered step's whole path (upstream and downstream), a hovered use case's connectors,
  // or the selected connector. Everything else dims. Paused while connecting.
  const focus = (() => {
    if (connectFrom != null || pending) return null;
    if (hoverStep) {
      const onPath = new Set([hoverStep]);
      for (const forward of [true, false]) {
        const queue = [hoverStep], seen = new Set([hoverStep]);
        while (queue.length) {
          const at = queue.shift();
          for (const l of flow.links) {
            const [from, to] = forward ? [l.from, l.to] : [l.to, l.from];
            if (from === at && !seen.has(to)) { seen.add(to); queue.push(to); onPath.add(to); }
          }
        }
      }
      return { steps: onPath, links: new Set(flow.links.filter((l) => onPath.has(l.from) && onPath.has(l.to)).map((l) => l.id)) };
    }
    if (hoverRow) {
      const inRow = new Set(flow.steps.filter((s) => s.useCase === hoverRow).map((s) => s.id));
      const ls = flow.links.filter((l) => inRow.has(l.from) || inRow.has(l.to));
      return { steps: new Set([...inRow, ...ls.flatMap((l) => [l.from, l.to])]), links: new Set(ls.map((l) => l.id)) };
    }
    if (selLink) {
      const l = flow.links.find((x) => x.id === selLink);
      return l ? { steps: new Set([l.from, l.to]), links: new Set([l.id]) } : null;
    }
    return null;
  })();
  const stepDim = (id) => focus && !focus.steps.has(id);
  const linkOn = (id) => !focus || focus.links.has(id);

  const cols = `${HEADER_W}px repeat(${flow.stages.length}, minmax(200px, 1fr)) ${flow.stages.length ? "52px" : "auto"}`;
  const fade = `opacity ${MOTION.base} ${MOTION.ease}`;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) setSelLink(null); }}
      style={{ position: "relative", height: "100%", backgroundColor: LANES[0], border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "auto", fontFamily: font }}
    >
      <style>{`
        .fm-cell .fm-add { opacity: 0; transition: opacity 120ms ease; }
        .fm-cell:hover .fm-add, .fm-cell:focus-within .fm-add { opacity: 1; }
        .fm-head:hover .fm-head-x, .fm-head:focus-within .fm-head-x { opacity: 1; }
        .fm-head-x { opacity: 0; transition: opacity 120ms ease; }
        .fm-link { transition: stroke ${MOTION.base} ${MOTION.ease}, stroke-width ${MOTION.fast} ${MOTION.ease}, opacity ${MOTION.base} ${MOTION.ease}; }
        .fm-connecting .fm-card:not(.fm-source):hover { outline: 2px solid ${INK_SOFT}; outline-offset: 2px; cursor: crosshair; }
        .fm-dragging, .fm-dragging * { user-select: none; -webkit-user-select: none; cursor: grabbing !important; }
        /* Steps: white, lifted off the lane by an edge shadow rather than outlined by a border. */
        .fm-card { box-shadow: var(--edge-raised); }
        .fm-card:hover { box-shadow: var(--edge-lifted); }
      `}</style>

      {connectFrom != null && (
        <div style={{ position: "sticky", top: 0, left: 0, zIndex: 6, display: "flex", justifyContent: "center", pointerEvents: "none", height: 0 }}>
          <div style={{ marginTop: "8px", padding: "4px 10px", borderRadius: RADIUS.pill, background: INK, color: "#fff", fontSize: SIZE.xs, fontWeight: WEIGHT.medium, boxShadow: "var(--edge-float)", whiteSpace: "nowrap", height: "fit-content" }}>
            Click a step to connect · Esc to cancel
          </div>
        </div>
      )}

      <div
        ref={gridRef}
        className={[connectFrom != null && "fm-connecting", pending?.moved && "fm-dragging"].filter(Boolean).join(" ") || undefined}
        style={{ position: "relative", display: "grid", gridTemplateColumns: cols, minWidth: "min-content" }}
      >
        {/* Stage header row */}
        {/* The header row stays put while you scroll down, the use-case column while you scroll
            across — so a step always has its stage and use case in view. */}
        <div style={{ ...frameCell, position: "sticky", left: 0, top: 0, zIndex: 6, padding: "14px 16px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: SIZE.micro, fontWeight: WEIGHT.semibold, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_SOFT }}>Use cases</span>
        </div>
        {flow.stages.map((c) => (
          <div key={c.id} ref={setRef(`col:${c.id}`)} className="fm-head" style={{ ...frameCell, position: "sticky", top: 0, zIndex: 5, padding: "12px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              autoFocus={fresh === c.id}
              value={c.name} onChange={(e) => patch("stages", c.id, { name: e.target.value })}
              placeholder="Stage name" aria-label="Stage name"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: font, fontSize: SIZE.sm, fontWeight: WEIGHT.semibold, color: INK, padding: "2px 0" }}
            />
            <IconButton className="fm-head-x" title="Remove stage (and its steps)" onClick={() => removeStage(c.id)} style={{ color: INK_SOFT, "--hit": "28px" }}>
              <X size={14} />
            </IconButton>
          </div>
        ))}
        <div style={{ background: FRAME, borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", padding: flow.stages.length ? 0 : "0 12px" }}>
          {flow.stages.length ? (
            <IconButton title="Add a stage" onClick={addStage} style={{ color: INK_SOFT, "--hit": "32px" }}><Plus size={16} /></IconButton>
          ) : (
            <Button variant="subtle" onClick={addStage}><Plus size={16} /> Add a stage</Button>
          )}
        </div>

        {/* One row per use case */}
        {flow.useCases.map((r, ri) => (
          <div key={r.id} style={{ display: "contents" }}>
            <div
              ref={setRef(`row:${r.id}`)}
              className="fm-head"
              onMouseEnter={() => setHoverRow(r.id)} onMouseLeave={() => setHoverRow((h) => (h === r.id ? null : h))}
              style={{ ...frameCell, position: "sticky", left: 0, zIndex: 4, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <select
                  className="design-select" aria-label="Priority" value={r.tier}
                  onChange={(e) => patch("useCases", r.id, { tier: Number(e.target.value) })}
                  style={{ fontFamily: font, fontSize: SIZE.xs, lineHeight: 1.5, padding: 0, color: r.tier === 0 ? INK : INK_SOFT, fontWeight: r.tier === 0 ? WEIGHT.semibold : WEIGHT.normal, width: "fit-content" }}
                >
                  {TIERS.map((t, n) => <option key={t} value={n}>{t}</option>)}
                </select>
                <IconButton className="fm-head-x" title="Remove use case (and its steps)" onClick={() => removeUseCase(r.id)} style={{ color: INK_SOFT, margin: "-4px -6px -4px 0", "--hit": "28px" }}>
                  <X size={14} />
                </IconButton>
              </div>
              <AutoTextarea
                className="el-edit" minRows={1} autoFocus={fresh === r.id}
                value={r.text} onChange={(e) => patch("useCases", r.id, { text: e.target.value })}
                placeholder="A use case…" aria-label={`Use case ${ri + 1}`}
                style={{ ...editArea, fontSize: SIZE.ui, color: r.tier === 0 ? INK : INK_SOFT }}
              />
            </div>
            {flow.stages.map((c) => {
              const here = flow.steps.filter((k) => k.useCase === r.id && k.stage === c.id);
              return (
                <div key={c.id} className="fm-cell" style={{ background: laneOf(ri), padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px", minHeight: "88px" }}>
                  {here.map((k) => {
                    const isSource = connectFrom === k.id || pending?.from === k.id;
                    const canPick = connectFrom != null && connectFrom !== k.id;
                    return (
                      <div
                        key={k.id} className="reveal-group"
                        onMouseEnter={() => setHoverStep(k.id)} onMouseLeave={() => setHoverStep((h) => (h === k.id ? null : h))}
                        style={{ position: "relative", zIndex: 2, opacity: stepDim(k.id) ? 0.4 : 1, transition: fade }}
                      >
                        <div
                          ref={setRef(k.id)}
                          data-node-id={k.id}
                          className={`el-card fm-card${connectFrom === k.id ? " fm-source" : ""}`}
                          onClickCapture={canPick ? (e) => { e.preventDefault(); e.stopPropagation(); completeConnect(k.id); } : undefined}
                          style={{
                            background: BG,
                            outline: connectFrom === k.id ? `2px solid ${INK}` : pending?.over === k.id ? `2px solid ${INK_SOFT}` : undefined,
                            outlineOffset: "2px",
                          }}
                        >
                          <AutoTextarea
                            className="el-edit" minRows={1} autoFocus={fresh === k.id}
                            value={k.text} onChange={(e) => patch("steps", k.id, { text: e.target.value })}
                            placeholder="A step…" aria-label="Step" style={editArea}
                          />
                        </div>
                        {/* Keyboard route to finish click-connect (mouse users can click the step). */}
                        {canPick && (
                          <button
                            type="button" onClick={() => completeConnect(k.id)} aria-label="Connect to the armed step"
                            style={{ position: "absolute", left: "-9px", top: "-9px", zIndex: 5, fontFamily: font, fontSize: SIZE.micro, fontWeight: WEIGHT.semibold, color: "#fff", background: INK_SOFT, border: "none", borderRadius: RADIUS.xs, padding: "3px 6px", cursor: "pointer" }}
                          >
                            Connect
                          </button>
                        )}
                        {connectFrom == null && (
                          <button
                            type="button"
                            className="reveal"
                            title="Drag to another step to connect — or click, then pick one"
                            aria-label="Connect to another step"
                            {...handleProps(k.id)}
                            style={{
                              position: "absolute", right: "-6px", top: "50%", transform: "translateY(-50%)",
                              width: "12px", height: "12px", borderRadius: "50%", border: `2px solid ${INK_SOFT}`,
                              background: isSource ? INK_SOFT : "#fff", padding: 0, cursor: "grab", zIndex: 3, touchAction: "none",
                              // Stay visible (and keep the captured pointer) while its own drag is in flight.
                              ...(isSource ? { opacity: 1, pointerEvents: "auto" } : {}),
                            }}
                          />
                        )}
                        <IconButton className="reveal" title="Remove step" onClick={() => removeStep(k.id)} style={{ ...cornerBadge, right: "-7px" }}>
                          <X size={12} />
                        </IconButton>
                      </div>
                    );
                  })}
                  <button
                    className="fm-add btn btn--subtle" onClick={() => addStep(r.id, c.id)} aria-label="Add a step here"
                    style={{ alignSelf: "flex-start", fontSize: SIZE.xs, padding: "2px 6px", margin: "-2px -6px", color: INK_SOFT, gap: "3px" }}
                  >
                    <Plus size={12} /> Step
                  </button>
                </div>
              );
            })}
            <div style={{ background: laneOf(ri) }} />
          </div>
        ))}

        {/* Add a use case */}
        <div style={{ position: "sticky", left: 0, zIndex: 4, background: FRAME, padding: "10px", borderRight: `1px solid ${BORDER}` }}>
          <button className="btn btn--sm btn--subtle" onClick={addUseCase} style={{ color: INK_SOFT }}>
            <Plus size={16} /> Use case
          </button>
        </div>
        <div style={{ gridColumn: `span ${flow.stages.length + 1}` }} />

        {/* Connectors — above the cell backgrounds, below the steps (z 2) */}
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
                  stroke={lit ? INK : LINE} strokeWidth={lit ? 2 : 1.5}
                  // Hidden while its own end is being dragged — the preview stands in for it.
                  opacity={pending?.rewireId === l.id ? 0 : on ? 1 : 0.15}
                  strokeDasharray={back ? "5 4" : undefined} markerEnd="url(#fm-cap)"
                />
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth="14"
                  role="button" tabIndex={0}
                  aria-label="Connection — Enter to label, Delete to remove, or drag it to another step"
                  style={{ pointerEvents: "stroke", cursor: pending?.rewireId === l.id ? "grabbing" : "grab", touchAction: "none", outline: "none" }}
                  {...linkProps(l)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelLink(l.id); }
                    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); removeLink(l.id); }
                  }}
                >
                  <title>Click to label or remove · drag to reconnect</title>
                </path>
              </g>
            );
          })}
          {/* Drag preview: dashed while free, solid with an arrowhead once it snaps onto a step.
              Red while a dragged connector is over nothing — releasing there removes it. */}
          {pending?.moved && rects[pending.from] && (() => {
            const s = rects[pending.from];
            const t = pending.over != null && rects[pending.over];
            const deleting = pending.rewireId != null && !t;
            const x2 = t ? t.left : pending.x, y2 = t ? t.cy : pending.y;
            const mx = (s.right + x2) / 2;
            const d = roundedPath([{ x: s.right, y: s.cy }, { x: mx, y: s.cy }, { x: mx, y: y2 }, { x: x2, y: y2 }]);
            return (
              <path d={d} fill="none" stroke={deleting ? DANGER : INK} strokeWidth={t ? 2 : 1.5} strokeDasharray={t ? undefined : "4 4"}
                markerEnd={t ? "url(#fm-cap)" : undefined} opacity={t ? 1 : deleting ? 0.85 : 0.7} style={{ pointerEvents: "none" }} />
            );
          })()}
        </svg>

        {/* Connector labels — shown when a link has one, or while it's selected (to add one) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
          {routes.map(({ link: l, at }) => {
            const sel = selLink === l.id;
            if ((!l.label && !sel) || !at || pending?.rewireId === l.id) return null;
            return (
              <div key={l.id} style={{ position: "absolute", left: at.x, top: at.y, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: "2px", pointerEvents: "auto", opacity: linkOn(l.id) ? 1 : 0.25, transition: fade }}>
                <input
                  autoFocus={sel && !l.label}
                  value={l.label} onChange={(e) => patch("links", l.id, { label: e.target.value })}
                  onFocus={() => setSelLink(l.id)}
                  placeholder="Label…" aria-label="Connector label"
                  style={{
                    fieldSizing: "content", minWidth: "44px", fontFamily: font, fontSize: SIZE.xs, fontStyle: "italic",
                    color: sel ? INK : INK_SOFT, background: BG, border: `1px solid ${sel ? INK_SOFT : BORDER}`,
                    borderRadius: RADIUS.pill, padding: "1px 8px", outline: "none", textAlign: "center",
                  }}
                />
                {sel && (
                  <IconButton danger title="Remove connection" onClick={() => removeLink(l.id)} style={{ ...cornerBadge, position: "static", "--hit": "26px" }}>
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
