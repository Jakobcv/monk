import { useMemo, useState, useEffect } from "react";
import { Search as SearchIcon, X, Link2, ArrowLeft, Star, Plus, Lightbulb } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BORDER_STRONG, ACCENT, ACTIVITY, DANGER, CITED, SIZE, WEIGHT, SPACE, RADIUS, withAlpha } from "./lib/theme";
import { blankSignal, signalsForActivity, isSignalUnlinked } from "./lib/signalModel";
import { blankInsight } from "./lib/insightModel";
import { pageHeading, meta } from "./ui/text";
import SignalCard from "./SignalCard";
import InsightCard from "./InsightCard";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Field from "./ui/Field";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";

// per-type: which array on a board holds these cards, and which of the card's fields to
// search against (Action has three text fields, everything else has just `text`). Signal and
// Insight are both handled separately below — their content lives in global lists now
// (`signals`/`insights`), not on any one board.
const TYPE_DEFS = [
  { kind: "action", label: "Action", arrayKey: "actions", fields: (x) => [x.ifWe, x.then, x.expected] },
  { kind: "result", label: "Result", arrayKey: "results", fields: (x) => [x.text] },
];
// Signal and Insight attach to a spec via `onLinkSignal`/`onLinkInsight` (there's no source
// board/card to point at — just the record's own global id) rather than `onAttach`, but show
// the same affordance.
const ATTACHABLE_KINDS = new Set([...TYPE_DEFS.map((d) => d.kind), "signal", "insight"]);
const RECENT_LIMIT = 20;

// The filter row's pills: same shape six times over, differing only in which color carries the
// active state — a card kind's accent, or one of the three "lens" colors (unlinked/cited/activity).
function Pill({ color, active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="btn btn--sm"
      style={{
        borderRadius: RADIUS.pill,
        border: `1px solid ${active ? withAlpha(color, "60") : BORDER_STRONG}`,
        background: active ? withAlpha(color, "12") : "#fff",
        color: active ? color : INK_SOFT,
      }}
    >
      {children}
    </button>
  );
}

const Dot = ({ color }) => (
  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
);

function highlight(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "transparent", color: "inherit", fontWeight: 700, padding: 0 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// Research Repository is a global surface for *finding and reading* insights across every
// spec's Discovery board — boards are no longer created or managed here (that happens on the
// spec itself), so this page is search + a recent-insights feed, PLUS the authoritative place
// to create and manage Signals and Activities (see signalModel.js): both are global, workspace-
// wide records, only ever *linked* into a spec's Discovery board rather than owned by one.
// `boards` are board-shaped objects, each carrying `specTitle` (a board has no name of its own
// — see App.jsx).
export default function ResearchRepositoryPage({
  boards, specs, signals, insights, activities, onAttach,
  initialQuery = "", initialKind = "all", onNavigate,
  specDiscoveryHref, activityHref,
  onCreateSignal, onCreateActivity, onCreateInsight,
  onUpdateSignal, onDeleteSignal, onLinkSignal,
  onUpdateInsight, onDeleteInsight, onLinkInsight,
}) {
  // Seeded from the URL (see App.jsx's hrefResearch / useRoute) so a filtered view is
  // linkable and survives a refresh; changes are mirrored back with replaceState.
  const [query, setQuery] = useState(initialQuery);
  const [activeKind, setActiveKind] = useState(initialKind || "all");
  const [activated, setActivated] = useState(!!initialQuery || (initialKind && initialKind !== "all"));
  const [attachOpenKey, setAttachOpenKey] = useState(null);

  useEffect(() => {
    onNavigate?.(query.trim(), activeKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeKind]);
  // Non-null while its create form is open — the draft itself, built off blankSignal()/
  // blankInsight() the moment the form opens so it always starts with fresh id/timestamps. An
  // activity has no form here at all — creating one (see the button below) jumps straight to
  // its own page, same flow as creating a spec.
  const [newSignal, setNewSignal] = useState(null);
  const [newInsight, setNewInsight] = useState(null);
  // Which signals are checked in the Signals section, waiting to be turned into an insight —
  // see toggleSignalSelected/formInsightFromSelection below. Cleared on save, cancel, or once
  // used (a selection is a transient "working set", not something worth persisting).
  const [selectedSignalIds, setSelectedSignalIds] = useState(() => new Set());

  const openSignalForm = () => setNewSignal(blankSignal());
  const closeSignalForm = () => setNewSignal(null);
  const saveSignalForm = () => { onCreateSignal(newSignal); closeSignalForm(); };

  const openInsightForm = () => setNewInsight(blankInsight());
  const closeInsightForm = () => setNewInsight(null);
  const saveInsightForm = () => { onCreateInsight(newInsight); closeInsightForm(); };

  const toggleSignalSelected = (id) => setSelectedSignalIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // The whole point of selecting signals: skip the blank form and open one already carrying
  // them as its `sources` — you're synthesizing from evidence you already picked, not starting
  // from nothing and remembering to attach it after.
  const formInsightFromSelection = () => {
    setNewInsight(blankInsight([...selectedSignalIds]));
    setSelectedSignalIds(new Set());
  };

  const handleAttach = (m, destSpecId) => {
    if (m.kind === "signal") onLinkSignal(destSpecId, m.signalId);
    else if (m.kind === "insight") onLinkInsight(destSpecId, m.insightId);
    else onAttach(m.kind, m.boardId, m.cardId, destSpecId);
    setAttachOpenKey(null);
  };

  const backToRecent = () => {
    setActivated(false);
    setQuery("");
    setActiveKind("all");
  };

  const q = query.trim();

  // A signal, wherever it shows up in Research Repository (search results, or the landing
  // page's own Signals section): the same tinted card as a spec's Discovery board, always
  // open and editable — not a collapsed preview you click into, via the shared SignalCard.
  // The card's own tint and left border already say "this is a signal" at a glance, so
  // Research Repository doesn't repeat that in a label — it only adds the two things a
  // cross-spec view actually needs beyond that, and folds them into the fields' own metadata
  // row via `metaExtra` rather than giving them a line (or two) of their own: which boards
  // it's linked into (nothing shown at all when it isn't — "not linked to any spec" is the
  // default state, not news), and a way to link it into another one.
  //
  // One tradeoff of matching the board exactly: the observation is a live textarea now, not
  // rendered text, so a search match can no longer highlight the matching substring inside it
  // the way every other card kind still does.
  //
  // `selectable` turns on the selection checkbox (see SignalCard's `onToggleSelect`) — only the
  // Signals section's own grid passes it; search results and every other list stay plain, since
  // "select some of these to form an insight" only makes sense while browsing signals as signals,
  // not while looking at a mixed list of every card kind.
  const renderSignalRow = (m, { selectable = false } = {}) => {
    const sig = signals.find((s) => s.id === m.signalId);
    if (!sig) return null;
    const linkedBoards = boards.filter((b) => (b.signals || []).some((x) => x.id === m.signalId));
    return (
      <SignalCard
        key={m.key}
        signal={sig}
        activities={activities}
        onChange={(patch) => onUpdateSignal(sig.id, patch)}
        onDelete={() => onDeleteSignal(sig.id)}
        selected={selectable && selectedSignalIds.has(sig.id)}
        onToggleSelect={selectable ? () => toggleSignalSelected(sig.id) : undefined}
        metaExtra={
          <>
            {linkedBoards.map((b) => (
              <a key={b.id} className="btn btn--sm btn--subtle" href={specDiscoveryHref(b.id, sig.id)} style={{ textDecoration: "none" }}>
                Open in {b.specTitle || "Untitled spec"}
              </a>
            ))}
            {attachOpenKey === m.key ? (
              <Field
                as="select" autoFocus defaultValue=""
                onChange={(e) => { if (e.target.value) handleAttach(m, e.target.value); }}
                onBlur={() => setAttachOpenKey(null)}
                style={{ cursor: "pointer" }}
              >
                <option value="" disabled>Attach to…</option>
                {specs.filter((s) => !linkedBoards.some((b) => b.id === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.title || "Untitled spec"}</option>
                ))}
              </Field>
            ) : (
              <Button className="reveal" variant="subtle" onClick={() => setAttachOpenKey(m.key)}>
                <Link2 size={16} /> Attach to spec
              </Button>
            )}
          </>
        }
      />
    );
  };

  // An insight, wherever it shows up in Research Repository — same treatment as
  // renderSignalRow above, now that Insight has been promoted to the same global-record,
  // only-ever-linked pattern (see insightModel.js).
  const renderInsightRow = (m) => {
    const ins = insights.find((i) => i.id === m.insightId);
    if (!ins) return null;
    const linkedBoards = boards.filter((b) => (b.insights || []).some((x) => x.id === m.insightId));
    return (
      <InsightCard
        key={m.key}
        insight={ins}
        signals={signals}
        onChange={(patch) => onUpdateInsight(ins.id, patch)}
        onDelete={() => onDeleteInsight(ins.id)}
        metaExtra={
          <>
            {linkedBoards.map((b) => (
              <a key={b.id} className="btn btn--sm btn--subtle" href={specDiscoveryHref(b.id, ins.id)} style={{ textDecoration: "none" }}>
                Open in {b.specTitle || "Untitled spec"}
              </a>
            ))}
            {attachOpenKey === m.key ? (
              <Field
                as="select" autoFocus defaultValue=""
                onChange={(e) => { if (e.target.value) handleAttach(m, e.target.value); }}
                onBlur={() => setAttachOpenKey(null)}
                style={{ cursor: "pointer" }}
              >
                <option value="" disabled>Attach to…</option>
                {specs.filter((s) => !linkedBoards.some((b) => b.id === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.title || "Untitled spec"}</option>
                ))}
              </Field>
            ) : (
              <Button className="reveal" variant="subtle" onClick={() => setAttachOpenKey(m.key)}>
                <Link2 size={16} /> Attach to spec
              </Button>
            )}
          </>
        }
      />
    );
  };

  // An activity search result: click to open its own page (same flow as clicking a spec) —
  // that's where Name/Method/Link get edited and linked signals get managed.
  const renderActivityRow = (m) => {
    const act = activities.find((a) => a.id === m.activityId);
    if (!act) return null;
    const linked = signalsForActivity(signals, act.id);
    return (
      <Card key={m.key} as="a" href={activityHref(act.id)} interactive style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: SPACE.sm, flexWrap: "wrap" }}>
          <Dot color={ACTIVITY} />
          <span style={{ ...meta, fontWeight: WEIGHT.semibold, color: ACTIVITY }}>Activity</span>
          {act.method && <span style={meta}>{act.method}</span>}
          {act.author && <span style={meta}>by {act.author}</span>}
          {act.date && <span style={meta}>{new Date(act.date).toLocaleDateString()}</span>}
          <span style={meta}>{linked.length} signal{linked.length === 1 ? "" : "s"}</span>
        </div>
        <div style={{ fontFamily: font, fontSize: SIZE.body, color: INK, lineHeight: 1.5 }}>{highlight(act.name || "Untitled activity", q)}</div>
      </Card>
    );
  };

  const matches = useMemo(() => {
    if (!activated) return [];
    const ql = q.toLowerCase();
    const out = [];

    if (activeKind === "cited") {
      // count how many reference cards point at each original, across every board
      const counts = new Map(); // `${boardId}:${itemId}` -> count
      for (const board of boards) {
        for (const def of TYPE_DEFS) {
          for (const item of board[def.arrayKey] || []) {
            if (!item.ref) continue;
            const refKey = `${item.ref.boardId}:${item.ref.itemId}`;
            counts.set(refKey, (counts.get(refKey) || 0) + 1);
          }
        }
      }
      for (const board of boards) {
        for (const def of TYPE_DEFS) {
          for (const item of board[def.arrayKey] || []) {
            if (item.ref) continue; // only originals can be cited, not references themselves
            const count = counts.get(`${board.id}:${item.id}`) || 0;
            if (count === 0) continue;
            const text = def.fields(item).filter(Boolean)[0] || "";
            if (q && !text.toLowerCase().includes(ql)) continue;
            out.push({ key: `${board.id}:${item.id}`, boardId: board.id, cardId: item.id, specTitle: board.specTitle || "Untitled spec", kind: def.kind, label: def.label, text, citationCount: count });
          }
        }
      }
      out.sort((a, b) => b.citationCount - a.citationCount); // ranked by citations, always — not by recency
      return out;
    }

    if (activeKind === "unlinked") {
      // "unlinked" only ever meant signals — not yet tied to an insight anywhere they're
      // linked (including nowhere at all). Scoped to the global list now, not one board.
      for (const sig of signals) {
        if (!isSignalUnlinked(boards, sig.id)) continue;
        const text = sig.text || "";
        if (q && !text.toLowerCase().includes(ql)) continue;
        out.push({ key: `signal:${sig.id}`, kind: "signal", label: "Signal", text, signalId: sig.id, updatedAt: sig.updatedAt || 0 });
      }
      if (!q) out.sort((a, b) => b.updatedAt - a.updatedAt);
      return out;
    }

    if (activeKind === "activity") {
      for (const act of activities) {
        const name = act.name || "";
        if (q && !name.toLowerCase().includes(ql)) continue;
        out.push({ key: `activity:${act.id}`, kind: "activity", label: "Activity", text: name, activityId: act.id, updatedAt: act.updatedAt || 0 });
      }
      if (!q) out.sort((a, b) => b.updatedAt - a.updatedAt);
      return out;
    }

    if (activeKind === "all" || activeKind === "signal") {
      for (const sig of signals) {
        const text = sig.text || "";
        if (q && !text.toLowerCase().includes(ql)) continue;
        out.push({ key: `signal:${sig.id}`, kind: "signal", label: "Signal", text, signalId: sig.id, updatedAt: sig.updatedAt || 0 });
      }
    }

    if (activeKind === "all" || activeKind === "insight") {
      for (const ins of insights) {
        const text = ins.text || "";
        if (q && !text.toLowerCase().includes(ql)) continue;
        out.push({ key: `insight:${ins.id}`, kind: "insight", label: "Insight", text, insightId: ins.id, updatedAt: ins.updatedAt || 0 });
      }
    }

    for (const board of boards) {
      for (const def of TYPE_DEFS) {
        if (activeKind !== "all" && def.kind !== activeKind) continue;
        for (const item of board[def.arrayKey] || []) {
          if (item.ref) continue; // reference cards carry no local text of their own
          let text;
          if (q) {
            text = def.fields(item).filter(Boolean).find((f) => f.toLowerCase().includes(ql));
            if (!text) continue;
          } else {
            text = def.fields(item).filter(Boolean)[0] || "";
          }
          out.push({ key: `${board.id}:${item.id}`, boardId: board.id, cardId: item.id, specTitle: board.specTitle || "Untitled spec", kind: def.kind, label: def.label, text, specUpdatedAt: board.updatedAt || 0 });
        }
      }
    }
    if (!q) out.sort((a, b) => (b.specUpdatedAt ?? b.updatedAt ?? 0) - (a.specUpdatedAt ?? a.updatedAt ?? 0)); // browsing: most recently active first
    return out;
  }, [activated, q, activeKind, boards, signals, insights, activities]);

  // Landing view also gets a plain directory of every activity, most recently touched first —
  // there's no search needed to just see what research efforts exist.
  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [activities]
  );

  // ...and, the same way, every signal — most recently touched first. Without this, a signal
  // you'd just created (via "New signal" right above) was invisible until you switched into
  // search and picked the Signal filter; landing here showed everything *except* the thing you
  // just made. Shaped exactly like the `matches` entries for kind "signal" so renderSignalRow
  // needs no changes to render either one.
  const sortedSignals = useMemo(
    () => [...signals]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, RECENT_LIMIT)
      .map((sig) => ({ key: `signal:${sig.id}`, kind: "signal", signalId: sig.id, text: sig.text || "" })),
    [signals]
  );

  // ...and, the same way again, every insight — most recently touched first. Insight is a
  // global record too now (see insightModel.js), so this replaces what used to be a scan of
  // every board's local `insights` array.
  const sortedInsights = useMemo(
    () => [...insights]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, RECENT_LIMIT)
      .map((ins) => ({ key: `insight:${ins.id}`, kind: "insight", insightId: ins.id, text: ins.text || "" })),
    [insights]
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "32px 40px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <div style={{ height: "20px", marginBottom: "10px" }}>
          <Button
            variant="subtle"
            onClick={backToRecent}
            style={{ visibility: activated ? "visible" : "hidden", color: INK, fontSize: SIZE.ui, marginLeft: "-6px" }}
          >
            <ArrowLeft size={16} /> Back
          </Button>
        </div>
        <div style={{ position: "relative", marginBottom: "14px" }}>
          <SearchIcon size={16} style={{ position: "absolute", left: SPACE.lg, top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
          <Field
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActivated(true); }}
            onFocus={() => setActivated(true)}
            placeholder="Search research…"
            style={{ width: "100%", fontSize: SIZE.md, borderRadius: RADIUS.md, padding: "10px 36px" }}
          />
          {q && (
            <button
              className="icon-btn"
              onClick={() => setQuery("")}
              title="Clear"
              // Sits on top of the search input, which is itself interactive — 32px gives a
              // comfortable target while leaving most of the field clickable for the caret.
              style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", "--hit": "32px" }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Signal and Insight are each created from their own section on the landing page below
            (a "+" beside the heading, same spot ActivityPage's "Linked signals" uses) — there's
            no landing section for Activity to attach that pattern to, so it keeps its own
            top-level button; clicking it jumps straight to a blank activity page. */}
        <div style={{ display: "flex", gap: SPACE.base, marginBottom: "18px" }}>
          <Button onClick={onCreateActivity} style={{ color: INK, padding: "7px 12px" }}>
            <Plus size={16} /> New activity
          </Button>
        </div>

        {activated && (
        <div className="enter-up" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: SPACE.base, marginBottom: "26px" }}>
          <Pill color={INK} active={activeKind === "all"} onClick={() => setActiveKind("all")}>
            <span style={{ color: activeKind === "all" ? "#fff" : INK_SOFT }}>All</span>
          </Pill>
          <Pill color={ACCENT.signal} active={activeKind === "signal"} onClick={() => setActiveKind("signal")}>
            <Dot color={ACCENT.signal} /> Signal
          </Pill>
          <Pill color={ACCENT.insight} active={activeKind === "insight"} onClick={() => setActiveKind("insight")}>
            <Dot color={ACCENT.insight} /> Insight
          </Pill>
          {TYPE_DEFS.map((def) => (
            <Pill key={def.kind} color={ACCENT[def.kind]} active={activeKind === def.kind} onClick={() => setActiveKind(def.kind)}>
              <Dot color={ACCENT[def.kind]} /> {def.label}
            </Pill>
          ))}
          <Pill
            color={DANGER} active={activeKind === "unlinked"} onClick={() => setActiveKind("unlinked")}
            title="Signals not yet connected to any insight — easy to misread out of context"
          >
            <Dot color={DANGER} /> Unlinked
          </Pill>
          <Pill
            color={CITED} active={activeKind === "cited"} onClick={() => setActiveKind("cited")}
            title="Cards referenced by the most other specs — likely authoritative findings"
          >
            <Star size={11} fill={activeKind === "cited" ? CITED : "none"} /> Most cited
          </Pill>
          <Pill color={ACTIVITY} active={activeKind === "activity"} onClick={() => setActiveKind("activity")}>
            <Dot color={ACTIVITY} /> Activity
          </Pill>
        </div>
        )}

        {activated ? (
          matches.length === 0 ? (
            <EmptyState className="enter-up" icon={SearchIcon}>
              {q
                ? `No matches for "${q}".`
                : activeKind === "unlinked"
                  ? "Every signal is linked to an insight — nothing to flag."
                  : activeKind === "cited"
                    ? "No cards have been cited elsewhere yet."
                    : activeKind === "all"
                      ? "No cards yet — add some to a spec's Discovery board first."
                      : activeKind === "signal"
                        ? "No signals yet — create one above."
                        : activeKind === "insight"
                          ? "No insights yet — create one above."
                          : activeKind === "activity"
                            ? "No activities yet — create one above."
                            : `No ${TYPE_DEFS.find((d) => d.kind === activeKind)?.label.toLowerCase()} cards yet.`}
            </EmptyState>
          ) : (
            <div className="enter-up">
              <div style={{ ...meta, fontSize: SIZE.sm, marginBottom: "10px" }}>
                {matches.length} result{matches.length === 1 ? "" : "s"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.base }}>
                {matches.map((m) => (
                  m.kind === "signal" ? renderSignalRow(m) :
                  m.kind === "insight" ? renderInsightRow(m) :
                  m.kind === "activity" ? renderActivityRow(m) : (
                  <Card
                    key={m.key}
                    as="a"
                    href={specDiscoveryHref(m.boardId, m.cardId)}
                    interactive
                    className="reveal-group"
                    style={{ padding: "10px 14px" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: SPACE.sm }}>
                      <Dot color={ACCENT[m.kind]} />
                      <span style={{ ...meta, fontWeight: WEIGHT.semibold, color: ACCENT[m.kind] }}>{m.label}</span>
                      <span style={meta}>in {m.specTitle}</span>
                      {m.citationCount != null && (
                        <span style={{ ...meta, display: "flex", alignItems: "center", gap: "3px", fontWeight: WEIGHT.semibold, color: CITED }}>
                          <Star size={10} fill={CITED} /> {m.citationCount} citation{m.citationCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: font, fontSize: SIZE.body, color: INK, lineHeight: 1.5 }}>
                      {highlight(m.text, q)}
                    </div>
                    {ATTACHABLE_KINDS.has(m.kind) && (
                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ marginTop: SPACE.base }}>
                        {attachOpenKey === m.key ? (
                          <Field
                            as="select" autoFocus defaultValue=""
                            onChange={(e) => { if (e.target.value) handleAttach(m, e.target.value); }}
                            onBlur={() => setAttachOpenKey(null)}
                            style={{ cursor: "pointer" }}
                          >
                            <option value="" disabled>Attach to…</option>
                            {boards.filter((b) => b.id !== m.boardId).map((b) => (
                              <option key={b.id} value={b.id}>{b.specTitle || "Untitled spec"}</option>
                            ))}
                          </Field>
                        ) : (
                          <Button className="reveal" onClick={() => setAttachOpenKey(m.key)}>
                            <Link2 size={16} /> Attach to spec
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                  )
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="enter-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg, gap: SPACE.base, flexWrap: "wrap" }}>
              <h1 style={pageHeading}>Signals</h1>
              <div style={{ display: "flex", gap: SPACE.base }}>
                {/* Only appears once you've actually checked something — this is how synthesis
                    starts: pick some signals, then form the insight they add up to, right from
                    the list you're already reading rather than a separate canvas or mode. */}
                {selectedSignalIds.size > 0 && (
                  <Button variant="primary" onClick={formInsightFromSelection}>
                    Form insight from {selectedSignalIds.size} signal{selectedSignalIds.size === 1 ? "" : "s"}
                  </Button>
                )}
                <Button onClick={openSignalForm}>
                  <Plus size={16} /> Add signal
                </Button>
              </div>
            </div>

            {newSignal && (
              // Cmd/Ctrl+Enter saves — the form is mostly a textarea, so plain Enter has to
              // stay available for typing. Modal owns Escape-to-close.
              <Modal title="New signal" onClose={closeSignalForm}>
                <div onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveSignalForm(); } }}>
                  {/* The same tinted card it'll be once saved, so you're composing the thing
                      itself rather than filling in a form that turns into it. No `onDelete`:
                      there's nothing to delete yet. */}
                  <SignalCard
                    autoFocus
                    signal={newSignal}
                    activities={activities}
                    onChange={(patch) => setNewSignal((s) => ({ ...s, ...patch }))}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.base, marginTop: SPACE.lg }}>
                    <span style={{ ...meta, fontSize: SIZE.xs }}>⌘↵ to save · Esc to cancel</span>
                    <div style={{ display: "flex", gap: SPACE.base }}>
                      <Button onClick={closeSignalForm} style={{ padding: "6px 14px" }}>Cancel</Button>
                      <Button variant="primary" onClick={saveSignalForm} style={{ padding: "6px 14px" }}>Save</Button>
                    </div>
                  </div>
                </div>
              </Modal>
            )}

            {sortedSignals.length === 0 ? (
              <EmptyState compact style={{ paddingBottom: "30px" }}>No signals yet — add one above.</EmptyState>
            ) : (
              // Same grid an activity's own "Linked signals" section already uses — a signal
              // should look like a signal wherever you meet it, landing page included.
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE.lg, marginBottom: "30px" }}>
                {sortedSignals.map((m) => renderSignalRow(m, { selectable: true }))}
              </div>
            )}

            <div style={{ height: "1px", backgroundColor: BORDER, marginBottom: "30px" }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg }}>
              <h1 style={pageHeading}>Insights</h1>
              <Button onClick={openInsightForm}>
                <Plus size={16} /> Add insight
              </Button>
            </div>

            {newInsight && (
              <Modal
                title={newInsight.sources?.length
                  ? `New insight from ${newInsight.sources.length} signal${newInsight.sources.length === 1 ? "" : "s"}`
                  : "New insight"}
                onClose={closeInsightForm}
              >
                <div onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveInsightForm(); } }}>
                  <InsightCard
                    autoFocus
                    insight={newInsight}
                    signals={signals}
                    onChange={(patch) => setNewInsight((i) => ({ ...i, ...patch }))}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACE.base, marginTop: SPACE.lg }}>
                    <span style={{ ...meta, fontSize: SIZE.xs }}>⌘↵ to save · Esc to cancel</span>
                    <div style={{ display: "flex", gap: SPACE.base }}>
                      <Button onClick={closeInsightForm} style={{ padding: "6px 14px" }}>Cancel</Button>
                      <Button variant="primary" onClick={saveInsightForm} style={{ padding: "6px 14px" }}>Save</Button>
                    </div>
                  </div>
                </div>
              </Modal>
            )}

            {sortedInsights.length === 0 ? (
              <EmptyState compact icon={Lightbulb} style={{ paddingBottom: "30px" }}>No insights yet — add one above.</EmptyState>
            ) : (
              // Same grid the Signals section above uses.
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE.lg, marginBottom: "30px" }}>
                {sortedInsights.map((m) => renderInsightRow(m))}
              </div>
            )}

            <div style={{ height: "1px", backgroundColor: BORDER, marginBottom: "30px" }} />

            <h1 style={{ ...pageHeading, marginBottom: SPACE.lg }}>Activities</h1>

            {sortedActivities.length === 0 ? (
              <EmptyState compact style={{ paddingBottom: "30px" }}>No activities yet — create one above.</EmptyState>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.base, marginBottom: "30px" }}>
                {sortedActivities.map((a) => {
                  const linked = signalsForActivity(signals, a.id);
                  return (
                    <Card key={a.id} as="a" href={activityHref(a.id)} interactive style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: SPACE.sm, flexWrap: "wrap" }}>
                        <Dot color={ACTIVITY} />
                        <span style={{ ...meta, fontWeight: WEIGHT.semibold, color: ACTIVITY }}>Activity</span>
                        {a.method && <span style={meta}>{a.method}</span>}
                        {a.author && <span style={meta}>by {a.author}</span>}
                        {a.date && <span style={meta}>{new Date(a.date).toLocaleDateString()}</span>}
                        <span style={meta}>{linked.length} signal{linked.length === 1 ? "" : "s"}</span>
                      </div>
                      <div style={{ fontFamily: font, fontSize: SIZE.body, color: INK, lineHeight: 1.5 }}>{a.name || "Untitled activity"}</div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
