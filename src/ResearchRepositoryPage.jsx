import { useMemo, useState, useEffect } from "react";
import { Search as SearchIcon, X, ArrowLeft, Star, Plus, Lightbulb } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BORDER_STRONG, ACCENT, RESEARCH_PLAN, DANGER, CITED, SIZE, WEIGHT, SPACE, RADIUS, PAGE, withAlpha } from "./lib/theme";
import { blankSignal, isSignalUnlinked } from "./lib/signalModel";
import { RESEARCH_PLAN_STATUS_COLOR, answeredCount } from "./lib/researchPlanModel";
import { blankInsight } from "./lib/insightModel";
import { Meta, PageHeading } from "./ui/text";
import SignalCard from "./SignalCard";
import InsightCard from "./InsightCard";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Field from "./ui/Field";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";
import DialogActions from "./ui/DialogActions";
import Page from "./ui/Page";

// per-type: which array on a board holds these cards, and which of the card's fields to
// search against (Action has three text fields, everything else has just `text`). Signal and
// Insight are both handled separately below — their content lives in global lists now
// (`signals`/`insights`), not on any one board.
const TYPE_DEFS = [
  { kind: "action", label: "Action", arrayKey: "actions", fields: (x) => [x.ifWe, x.then, x.expected] },
  { kind: "result", label: "Result", arrayKey: "results", fields: (x) => [x.text] },
];
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

// Research Repository is a global surface for *finding and reading* research across every
// research plan's board — boards aren't managed here (that happens on a plan's Analysis tab), so
// this page is search + recent feeds, PLUS the place to create Signals, Insights and Research plans
// (see signalModel.js / insightModel.js / researchPlanModel.js).
// `boards` are board-shaped objects, each carrying its plan's `title` (a board has no name of its
// own — see App.jsx); `boardCardHref(boardId, cardId)` opens a card on its plan's Analysis tab.
export default function ResearchRepositoryPage({
  boards, signals, insights, researchPlans = [],
  initialQuery = "", initialKind = "all", onNavigate,
  boardCardHref, researchPlanHref,
  onCreateSignal, onCreateInsight, onCreateResearchPlan,
  onUpdateSignal, onDeleteSignal,
  onUpdateInsight, onDeleteInsight,
}) {
  // Seeded from the URL (see App.jsx's hrefResearch / useRoute) so a filtered view is
  // linkable and survives a refresh; changes are mirrored back with replaceState.
  const [query, setQuery] = useState(initialQuery);
  const [activeKind, setActiveKind] = useState(initialKind || "all");
  const [activated, setActivated] = useState(!!initialQuery || (initialKind && initialKind !== "all"));

  useEffect(() => {
    onNavigate?.(query.trim(), activeKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeKind]);
  // Non-null while its create form is open — the draft itself, built off blankSignal()/
  // blankInsight() the moment the form opens so it always starts with fresh id/timestamps.
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
  // Research Repository doesn't repeat that in a label — and it adds nothing else either: no
  // list of the specs it's in and no attach action, so the card is exactly its Discovery-board
  // twin. The repository is about the signal itself; linking happens from a spec's board.
  //
  // One tradeoff of matching the board exactly: the observation is a live textarea now, not
  // rendered text, so a search match can no longer highlight the matching substring inside it
  // the way every other card kind still does.
  //
  // The one place it departs from the board is height: here every card is the same height, its
  // text clamped to four lines with an ellipsis (`fixedHeight`, see SignalCard), because this is
  // a list you scan. Clicking into the text still edits it in place.
  //
  // `selectable` turns on the selection checkbox (see SignalCard's `onToggleSelect`) — only the
  // Signals section's own grid passes it; search results and every other list stay plain, since
  // "select some of these to form an insight" only makes sense while browsing signals as signals,
  // not while looking at a mixed list of every card kind.
  const renderSignalRow = (m, { selectable = false } = {}) => {
    const sig = signals.find((s) => s.id === m.signalId);
    if (!sig) return null;
    return (
      <SignalCard
        key={m.key}
        signal={sig}
        onChange={(patch) => onUpdateSignal(sig.id, patch)}
        onDelete={() => onDeleteSignal(sig.id)}
        fixedHeight
        selected={selectable && selectedSignalIds.has(sig.id)}
        onToggleSelect={selectable ? () => toggleSignalSelected(sig.id) : undefined}
      />
    );
  };

  // An insight, wherever it shows up in Research Repository — same treatment as
  // renderSignalRow above, now that Insight has been promoted to the same global-record,
  // only-ever-linked pattern (see insightModel.js).
  const renderInsightRow = (m) => {
    const ins = insights.find((i) => i.id === m.insightId);
    if (!ins) return null;
    return (
      <InsightCard
        key={m.key}
        insight={ins}
        signals={signals}
        onChange={(patch) => onUpdateInsight(ins.id, patch)}
        onDelete={() => onDeleteInsight(ins.id)}
      />
    );
  };

  // A research plan, on the landing list or in results: click through to its own page, where it's
  // written and its questions get answered.
  const renderPlanRow = (plan, key = plan.id) => {
    const signalTotal = (plan.board?.signals || []).length;
    const activityTotal = (plan.activities || []).length;
    const total = (plan.researchQuestions || []).length;
    return (
      <Card key={key} as="a" href={researchPlanHref(plan.id)} interactive>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginBottom: SPACE.sm, flexWrap: "wrap" }}>
          <Dot color={RESEARCH_PLAN} />
          <Meta style={{ fontWeight: WEIGHT.semibold, color: RESEARCH_PLAN }}>Research plan</Meta>
          <Meta style={{ fontWeight: WEIGHT.semibold, color: RESEARCH_PLAN_STATUS_COLOR[plan.status] || INK_FAINT }}>{plan.status}</Meta>
          {total > 0 && <Meta style={{ fontVariantNumeric: "tabular-nums" }}>{answeredCount(plan)} of {total} question{total === 1 ? "" : "s"} answered</Meta>}
          <Meta style={{ fontVariantNumeric: "tabular-nums" }}>
            {signalTotal} signal{signalTotal === 1 ? "" : "s"} · {activityTotal} activit{activityTotal === 1 ? "y" : "ies"}
          </Meta>
        </div>
        <div style={{ fontFamily: font, fontSize: SIZE.body, color: INK, lineHeight: 1.5 }}>{highlight(plan.title || "Untitled research plan", q)}</div>
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
            out.push({ key: `${board.id}:${item.id}`, boardId: board.id, cardId: item.id, boardTitle: board.title || "Untitled research plan", kind: def.kind, label: def.label, text, citationCount: count });
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

    if (activeKind === "researchPlan" || activeKind === "all") {
      for (const plan of researchPlans) {
        const text = plan.title || "";
        if (q && ![text, plan.problem, ...(plan.researchQuestions || []).map((x) => x.text)].some((f) => (f || "").toLowerCase().includes(ql))) continue;
        out.push({ key: `researchPlan:${plan.id}`, kind: "researchPlan", label: "Research plan", text, planId: plan.id, updatedAt: plan.updatedAt || 0 });
      }
      if (activeKind === "researchPlan") {
        if (!q) out.sort((a, b) => b.updatedAt - a.updatedAt);
        return out;
      }
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
          out.push({ key: `${board.id}:${item.id}`, boardId: board.id, cardId: item.id, boardTitle: board.title || "Untitled research plan", kind: def.kind, label: def.label, text, specUpdatedAt: board.updatedAt || 0 });
        }
      }
    }
    if (!q) out.sort((a, b) => (b.specUpdatedAt ?? b.updatedAt ?? 0) - (a.specUpdatedAt ?? a.updatedAt ?? 0)); // browsing: most recently active first
    return out;
  }, [activated, q, activeKind, boards, signals, insights, researchPlans]);

  // Research plans first on the landing view: a study is planned before its signals come in.
  const sortedPlans = useMemo(
    () => [...researchPlans].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [researchPlans]
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
    <Page>
      <div style={{ maxWidth: PAGE.wide, margin: "0 auto" }}>
        <div style={{ height: SPACE["3xl"], marginBottom: SPACE.sm }}>
          <Button
            variant="subtle"
            onClick={backToRecent}
            style={{ visibility: activated ? "visible" : "hidden", color: INK, fontSize: SIZE.ui, marginLeft: "-6px" }}
          >
            <ArrowLeft size={16} /> Back
          </Button>
        </div>
        <div style={{ position: "relative", marginBottom: SPACE["3xl"] }}>
          <SearchIcon size={16} style={{ position: "absolute", left: SPACE.lg, top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
          <Field
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActivated(true); }}
            onFocus={() => setActivated(true)}
            placeholder="Search research…"
            style={{ width: "100%", fontSize: SIZE.md, borderRadius: RADIUS.sm, padding: `10px 36px` }}
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

        {/* Research plans, signals and insights are each created from their own section on the
            landing page below, with a button beside the heading. */}

        {activated && (
        <div className="enter-up" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: SPACE.base, marginBottom: SPACE["3xl"] }}>
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
          <Pill color={RESEARCH_PLAN} active={activeKind === "researchPlan"} onClick={() => setActiveKind("researchPlan")}>
            <Dot color={RESEARCH_PLAN} /> Research plan
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
                      ? "No cards yet — add some to a research plan's Analysis board first."
                      : activeKind === "signal"
                        ? "No signals yet — create one above."
                        : activeKind === "insight"
                          ? "No insights yet — create one above."
                          : activeKind === "researchPlan"
                            ? "No research plans yet — start one from the Research plans list."
                            : `No ${TYPE_DEFS.find((d) => d.kind === activeKind)?.label.toLowerCase()} cards yet.`}
            </EmptyState>
          ) : (
            <div className="enter-up">
              <Meta as="div" style={{ fontSize: SIZE.sm, marginBottom: SPACE.base }}>
                {matches.length} result{matches.length === 1 ? "" : "s"}
              </Meta>
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.base }}>
                {matches.map((m) => (
                  m.kind === "signal" ? renderSignalRow(m) :
                  m.kind === "insight" ? renderInsightRow(m) :
                  m.kind === "researchPlan" ? (() => { const plan = researchPlans.find((p) => p.id === m.planId); return plan ? renderPlanRow(plan, m.key) : null; })() : (
                  <Card
                    key={m.key}
                    as="a"
                    href={boardCardHref(m.boardId, m.cardId)}
                    interactive
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginBottom: SPACE.sm }}>
                      <Dot color={ACCENT[m.kind]} />
                      <Meta style={{ fontWeight: WEIGHT.semibold, color: ACCENT[m.kind] }}>{m.label}</Meta>
                      <Meta>in {m.boardTitle}</Meta>
                      {m.citationCount != null && (
                        <Meta style={{ display: "flex", alignItems: "center", gap: SPACE.sm, fontWeight: WEIGHT.semibold, color: CITED }}>
                          <Star size={10} fill={CITED} /> {m.citationCount} citation{m.citationCount === 1 ? "" : "s"}
                        </Meta>
                      )}
                    </div>
                    <div style={{ fontFamily: font, fontSize: SIZE.body, color: INK, lineHeight: 1.5 }}>
                      {highlight(m.text, q)}
                    </div>
                  </Card>
                  )
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="enter-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg }}>
              <PageHeading>Research plans</PageHeading>
              <Button onClick={onCreateResearchPlan}>
                <Plus size={16} /> New research plan
              </Button>
            </div>

            {sortedPlans.length === 0 ? (
              <EmptyState compact style={{ paddingBottom: SPACE["4xl"] }}>
                No research plans yet — start one to decide what a study has to find out before the signals come in.
              </EmptyState>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, marginBottom: SPACE["4xl"] }}>
                {sortedPlans.map((p) => renderPlanRow(p))}
              </div>
            )}

            <div style={{ height: "1px", backgroundColor: BORDER, marginBottom: SPACE["4xl"] }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg, gap: SPACE.base, flexWrap: "wrap" }}>
              <PageHeading>Signals</PageHeading>
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
                    onChange={(patch) => setNewSignal((s) => ({ ...s, ...patch }))}
                  />
                  <DialogActions onCancel={closeSignalForm} onSave={saveSignalForm} />
                </div>
              </Modal>
            )}

            {sortedSignals.length === 0 ? (
              <EmptyState compact style={{ paddingBottom: SPACE["4xl"] }}>No signals yet — add one above.</EmptyState>
            ) : (
              // Same grid an activity's own "Linked signals" section already uses — a signal
              // should look like a signal wherever you meet it, landing page included.
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE.lg, marginBottom: SPACE["4xl"] }}>
                {sortedSignals.map((m) => renderSignalRow(m, { selectable: true }))}
              </div>
            )}

            <div style={{ height: "1px", backgroundColor: BORDER, marginBottom: SPACE["4xl"] }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg }}>
              <PageHeading>Insights</PageHeading>
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
                  <DialogActions onCancel={closeInsightForm} onSave={saveInsightForm} />
                </div>
              </Modal>
            )}

            {sortedInsights.length === 0 ? (
              <EmptyState compact icon={Lightbulb} style={{ paddingBottom: SPACE["4xl"] }}>No insights yet — add one above.</EmptyState>
            ) : (
              // Same grid the Signals section above uses.
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE.lg, marginBottom: SPACE["4xl"] }}>
                {sortedInsights.map((m) => renderInsightRow(m))}
              </div>
            )}

          </div>
        )}
      </div>
    </Page>
  );
}
