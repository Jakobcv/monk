import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ChevronDown, FileOutput, Check } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BG_SIDEBAR, SIZE, WEIGHT, MOTION, SPEC_STATUS_OPTIONS, SPEC_STATUS_COLOR } from "./lib/theme";
import { eyebrow, editArea, pageTitleInput } from "./ui/text";
import { buildSpecBrief } from "./lib/buildBrief";
import { useCopy } from "./lib/useCopy";
import ChecklistEditor from "./ChecklistEditor";
import AutoTextarea from "./ui/AutoTextarea";
import SwapIcon from "./ui/SwapIcon";
import MarkdownEditor from "./MarkdownEditor";
import Board from "./Board";
import Breadcrumbs from "./Breadcrumbs";

// The active-tab marker is a single sliding bar (see the tablist below), not a per-tab
// border — so a tab is just its label. Colour + hover live in .spec-tab (index.css).
const tabLinkStyle = {
  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui,
  padding: "8px 2px", textDecoration: "none",
};

// Discovery / Design / Plan mirror the shape of the work itself — research, then solution,
// then execution — with Overview as the always-there summary tying them together.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "discovery", label: "Discovery" },
  { key: "design", label: "Design" },
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
      backgroundColor: BG_SIDEBAR, borderLeft: `1px solid ${BORDER}`, boxShadow: "-6px 0 12px rgba(0,0,0,0.04)",
      padding: "20px 18px", display: "flex", flexDirection: "column", gap: "18px",
    }}>
      <div>
        <div style={eyebrow}>Status</div>
        <div className="select-wrap" style={{ marginTop: "8px" }}>
          <select className="select" style={{ color: SPEC_STATUS_COLOR[status] }} value={status} onChange={(e) => onStatusChange(e.target.value)}>
            {SPEC_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={12} className="select-chevron" />
        </div>
      </div>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <div>
        <div style={eyebrow}>Initiative</div>
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
        <div style={eyebrow}>Owner</div>
        <div style={{ marginTop: "8px" }}>
          <input value={owner} onChange={(e) => onOwnerChange(e.target.value)} placeholder="Unassigned" style={editArea} />
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
// a `flex:1` area where each tab panel owns its own sizing. Discovery needs a different shape
// than the other three: Overview/Design/Plan are a narrow, page-scrolling reading column
// (maxWidth 760px); Board is a full-width canvas that manages its own internal scrolling and
// wants to fill whatever height it's given, not sit inside a taller scrollable page.
export default function SpecPage({
  spec, boards, signals, insights, activities, sections, initiatives, onChange, activeTab, tabHref, onOpenBoard,
  onUpdateSignal, onCreateSignal, onUpdateInsight, onCreateInsight, onToast, highlightCardId, breadcrumbs,
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
      { title, problem, goals, nonGoals, openQuestions, acceptanceCriteria, design, plan },
      sections,
      initiative
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
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled spec"
              style={{ ...pageTitleInput, flex: 1 }}
            />
            <button
              className="btn btn--sm btn--subtle"
              onClick={startBuild}
              title="Copy the build brief (Standards, Product Knowledge, and this spec) to the clipboard for an agent"
              style={{ flexShrink: 0, marginTop: "10px", color: briefCopied ? SPEC_STATUS_COLOR.shipped : INK_SOFT }}
            >
              <SwapIcon active={briefCopied} activeIcon={Check} inactiveIcon={FileOutput} size={13} />
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

        {/* The `hidden` attribute must be the only thing controlling display on each of these —
            an inline `display` would win over the browser's default `[hidden]{display:none}` rule
            and the panel would never actually hide. */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div hidden={activeTab !== "overview"} style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "24px 40px 32px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={eyebrow}>Problem</div>
                <AutoTextarea className="prose-field" minRows={2} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="The problem this solves…" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={eyebrow}>Goals</div>
                <AutoTextarea className="prose-field" minRows={2} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Success looks like…" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={eyebrow}>Non-goals</div>
                <AutoTextarea className="prose-field" minRows={2} value={nonGoals} onChange={(e) => setNonGoals(e.target.value)} placeholder="Explicitly out of scope…" />
              </div>

              <div style={{ height: "1px", backgroundColor: BORDER }} />

              <ChecklistEditor label="Open questions" items={openQuestions} onChange={setOpenQuestions} />
              <ChecklistEditor label="Acceptance criteria" items={acceptanceCriteria} onChange={setAcceptanceCriteria} />
            </div>
          </div>

          <div hidden={activeTab !== "discovery"} style={{ height: "100%", boxSizing: "border-box", padding: "12px" }}>
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
          </div>

          <div hidden={activeTab !== "design"} style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "24px 40px 32px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto" }}>
              <MarkdownEditor value={spec.design} onChange={setDesign} placeholder="Design notes in Markdown…" />
            </div>
          </div>

          <div hidden={activeTab !== "plan"} style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "24px 40px 32px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto" }}>
              <MarkdownEditor value={spec.plan} onChange={setPlan} placeholder="The plan, in Markdown…" />
            </div>
          </div>
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
