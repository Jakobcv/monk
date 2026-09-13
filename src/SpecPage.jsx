import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ChevronDown, FileOutput, Check } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BG_APP, SIZE, WEIGHT, MOTION, SPEC_STATUS_OPTIONS, SPEC_STATUS_COLOR } from "./lib/theme";
import { Eyebrow, PageTitle } from "./ui/text";
import { buildSpecBrief } from "./lib/buildBrief";
import { useCopy } from "./lib/useCopy";
import ChecklistEditor from "./ChecklistEditor";
import SwapIcon from "./ui/SwapIcon";
import PlanTab from "./PlanTab";
import LiveMarkdown from "./ui/LiveMarkdown";
import DesignTab from "./DesignTab";
import Board from "./Board";
import Breadcrumbs from "./Breadcrumbs";
import Page from "./ui/Page";

// The active-tab marker is a single sliding bar (see the tablist below), not a per-tab
// border — so a tab is just its label. Colour + hover live in .spec-tab (index.css).
const tabLinkStyle = {
  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui,
  padding: "8px 2px", textDecoration: "none",
};

// Discovery / Solution / Plan mirror the shape of the work itself — research, then what you're
// going to build, then execution — with Overview as the always-there summary tying them together.
//
// Solution's key stays "design": it's the URL segment (#/spec/<id>/design) and it names the file
// the tab reads and writes (design.md). Renaming those would mean migrating every folder on disk
// for a label change, so the key is the storage name and the label is what you call it.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "discovery", label: "Discovery" },
  { key: "design", label: "Solution" },
  { key: "plan", label: "Plan" },
];

// A persistent per-spec sidebar for metadata that applies across every tab, not just Overview —
// Status, Owner, and which Initiative this spec belongs to. Keeping this out of the header (where
// a Status dropdown used to sit right under the title) is what lets the header collapse to a
// single compact row. Sits on the right, tinted and shadowed so it reads as a distinct panel
// rather than another column of the page (the shadow falls left/into the page, hence the
// negative x-offset).
function SpecSidebar({ status, onStatusChange, owner, onOwnerChange, initiativeId, onInitiativeChange, initiatives }) {
  return (
    <div style={{
      width: "220px", flexShrink: 0, height: "100%", overflowY: "auto", boxSizing: "border-box",
      backgroundColor: BG_APP, borderLeft: `1px solid ${BORDER}`, boxShadow: "-6px 0 12px rgba(0,0,0,0.04)",
      padding: "20px 18px", display: "flex", flexDirection: "column", gap: "18px",
    }}>
      <div>
        <Eyebrow>Status</Eyebrow>
        <div className="select-wrap" style={{ marginTop: "8px" }}>
          <select className="select" style={{ color: SPEC_STATUS_COLOR[status] }} value={status} onChange={(e) => onStatusChange(e.target.value)}>
            {SPEC_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={12} className="select-chevron" />
        </div>
      </div>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <div>
        <Eyebrow>Initiative</Eyebrow>
        <div className="select-wrap" style={{ marginTop: "8px" }}>
          <select
            className="select"
            style={{ color: initiativeId ? INK : INK_FAINT }}
            value={initiativeId || ""}
            onChange={(e) => onInitiativeChange(e.target.value || null)}
          >
            <option value="">None</option>
            {(initiatives || []).map((i) => (
              <option key={i.id} value={i.id}>{i.title || "Untitled initiative"}</option>
            ))}
          </select>
          <ChevronDown size={12} className="select-chevron" />
        </div>
      </div>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <div>
        <Eyebrow>Owner</Eyebrow>
        <div style={{ marginTop: "8px" }}>
          <input value={owner} onChange={(e) => onOwnerChange(e.target.value)} placeholder="Unassigned" className="edit-area" />
        </div>
      </div>
    </div>
  );
}

// `spec` only seeds local state on mount — the parent remounts this component (via
// `key={spec.id}`) whenever the open spec changes, same pattern as Board.jsx/DocumentPage.jsx.
// All four tabs stay mounted at once (toggled with the `hidden` attribute, not a conditional
// render) so switching tabs is instant — re-mounting Crepe (or the whole Board canvas) on every
// click would be a visible stutter, and it would also mean losing whichever tab isn't showing.
//
// Layout: a persistent right sidebar (SpecSidebar, below) holds cross-tab metadata; the main pane
// has its own header — breadcrumbs, then a left-aligned title, then a full-width tab bar — above
// a `flex:1` area where each tab panel owns its own sizing. The two kinds of tab want opposite
// shapes: Overview/Design/Plan are where you *write*, so they're a sheet of paper centred on a
// grey desk (<Page ground="reading"> + .paper-sheet) at their own larger type scale (PAPER in
// lib/theme.js); Discovery is a canvas that manages its own scrolling and wants to fill whatever
// height it's given edge to edge, not sit inside a taller page.
export default function SpecPage({
  spec, boards, signals, insights, activities, sections, initiatives, onChange, activeTab, tabHref, onOpenBoard,
  onUpdateSignal, onCreateSignal, onUpdateInsight, onCreateInsight, onToast, highlightCardId, breadcrumbs,
  designSystem = "",
}) {
  const [title, setTitle] = useState(spec.title);
  const [status, setStatus] = useState(spec.status);
  const [owner, setOwner] = useState(spec.owner);
  const [initiativeId, setInitiativeId] = useState(spec.initiativeId || null);
  const [problem, setProblem] = useState(spec.problem);
  const [goals, setGoals] = useState(spec.goals);
  const [nonGoals, setNonGoals] = useState(spec.nonGoals);
  const [openQuestions, setOpenQuestions] = useState(spec.openQuestions);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(spec.acceptanceCriteria);
  const [board, setBoard] = useState(spec.board);
  const [design, setDesign] = useState(spec.design);
  const [plan, setPlan] = useState(spec.plan);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ title, status, owner, initiativeId, problem, goals, nonGoals, openQuestions, acceptanceCriteria, board, design, plan });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, status, owner, initiativeId, problem, goals, nonGoals, openQuestions, acceptanceCriteria, board, design, plan]);

  // Assembles Standards + Product Knowledge + (if the spec is under an initiative) that
  // initiative's shared context + this spec's own content into one hand-off document (see
  // lib/buildBrief.js) and copies it to the clipboard, ready to paste into an agent. If the
  // clipboard write is refused, useCopy falls back to opening it in a new tab.
  const [briefCopied, copyBrief] = useCopy();
  const startBuild = () => {
    const initiative = initiativeId ? (initiatives || []).find((i) => i.id === initiativeId) : null;
    copyBrief(buildSpecBrief(
      { title, problem, goals, nonGoals, openQuestions, acceptanceCriteria, design, plan, extraSections: spec.extraSections },
      sections,
      initiative,
      designSystem
    ));
  };

  // The active-tab underline is one bar that slides/resizes between tabs rather than a
  // border toggling per tab. Its geometry is measured from the active <a>; the first
  // measurement is applied without a transition (via a double render before paint) so it
  // doesn't slide in from the left on mount.
  const tabRefs = useRef([]);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[TABS.findIndex((t) => t.key === activeTab)];
      if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab]);

  return (
    <div style={{ height: "100%", display: "flex" }}>
      <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Breadcrumbs items={breadcrumbs} />

        <div style={{ padding: "20px 40px 0", boxSizing: "border-box", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <PageTitle
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled spec"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn--sm btn--subtle"
              onClick={startBuild}
              title="Copy the build brief (Standards, Product Knowledge, and this spec) to the clipboard for an agent"
              style={{ flexShrink: 0, marginTop: "10px", color: briefCopied ? SPEC_STATUS_COLOR.shipped : INK_SOFT }}
            >
              <SwapIcon active={briefCopied} activeIcon={Check} inactiveIcon={FileOutput} size={16} />
              {briefCopied ? "Brief copied" : "Start build"}
            </button>
          </div>

          <div role="tablist" style={{ position: "relative", display: "flex", gap: "18px", borderBottom: `1px solid ${BORDER}`, marginTop: "18px" }}>
            {TABS.map((t, i) => (
              <a
                key={t.key}
                ref={(el) => (tabRefs.current[i] = el)}
                className="spec-tab"
                href={tabHref(t.key)}
                role="tab"
                aria-selected={activeTab === t.key}
                style={tabLinkStyle}
              >
                {t.label}
              </a>
            ))}
            <span
              aria-hidden="true"
              style={{
                position: "absolute", left: 0, bottom: "-1px", height: "2px",
                width: `${underline.width}px`, transform: `translateX(${underline.left}px)`,
                backgroundColor: INK, borderRadius: "1px",
                transition: `transform ${MOTION.base} ${MOTION.ease}, width ${MOTION.base} ${MOTION.ease}`,
              }}
            />
          </div>
        </div>

        {/* `hidden` is what toggles these. It only wins because index.css states
            `[hidden]{display:none!important}` — the UA's own rule loses to .page--reading's
            `display:flex`, and would lose to an inline `display` too. */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <Page ground="reading" hidden={activeTab !== "overview"}>
            <div className="paper-sheet" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Eyebrow>Problem</Eyebrow>
                <LiveMarkdown className="prose-field" minLines={2} value={problem} onChange={setProblem} placeholder="The problem this solves…" ariaLabel="Problem" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Eyebrow>Goals</Eyebrow>
                <LiveMarkdown className="prose-field" minLines={2} value={goals} onChange={setGoals} placeholder="Success looks like…" ariaLabel="Goals" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Eyebrow>Non-goals</Eyebrow>
                <LiveMarkdown className="prose-field" minLines={2} value={nonGoals} onChange={setNonGoals} placeholder="Explicitly out of scope…" ariaLabel="Non-goals" />
              </div>

              <div style={{ height: "1px", backgroundColor: BORDER }} />

              <ChecklistEditor paper resolutions label="Open questions" items={openQuestions} onChange={setOpenQuestions} />
              <ChecklistEditor paper label="Acceptance criteria" items={acceptanceCriteria} onChange={setAcceptanceCriteria} />
            </div>
          </Page>

          <Page bleed hidden={activeTab !== "discovery"}>
            {/* Bumping `updatedAt` here (not just on the spec — see the effect below) is what
                makes "recently touched" mean anything: it's this timestamp Research
                Repository's "Recent insights" sorts by, and until now nothing ever set it
                past board creation, so every board looked equally (un)recent forever. */}
            <Board
              board={board}
              onChange={(patch) => setBoard((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }))}
              allBoards={boards}
              onOpenBoard={onOpenBoard}
              signals={signals}
              insights={insights}
              activities={activities}
              onUpdateSignal={onUpdateSignal}
              onCreateSignal={onCreateSignal}
              onUpdateInsight={onUpdateInsight}
              onCreateInsight={onCreateInsight}
              onToast={onToast}
              highlightCardId={activeTab === "discovery" ? highlightCardId : null}
            />
          </Page>

          <Page ground="reading" hidden={activeTab !== "design"}>
            <div className="paper-sheet">
              <DesignTab value={spec.design} onChange={setDesign} onToast={onToast} />
            </div>
          </Page>

          {/* The Plan: the work as tasks with a state each, then the approach, which still takes
              the rest of the sheet (see PlanTab). Stored as one plan.md, like the Solution tab's
              solution.md. */}
          <Page ground="reading" hidden={activeTab !== "plan"}>
            <div className="paper-sheet" style={{ display: "flex", flexDirection: "column" }}>
              <PlanTab value={spec.plan} onChange={setPlan} />
            </div>
          </Page>
        </div>
      </div>

      <SpecSidebar
        status={status} onStatusChange={setStatus}
        owner={owner} onOwnerChange={setOwner}
        initiativeId={initiativeId} onInitiativeChange={setInitiativeId} initiatives={initiatives}
      />
    </div>
  );
}
