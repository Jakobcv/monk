import { useState, useRef, useEffect } from "react";
import { ChevronDown, FileOutput } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BG_SIDEBAR, SIZE, WEIGHT, RADIUS, MOTION, SPEC_STATUS_OPTIONS, SPEC_STATUS_COLOR } from "./lib/theme";
import { eyebrow, editArea, pageTitleInput } from "./ui/text";
import { buildSpecBrief } from "./lib/buildBrief";
import ChecklistEditor from "./ChecklistEditor";
import CrepeEditor from "./CrepeEditor";
import Board from "./Board";
import Breadcrumbs from "./Breadcrumbs";

const selectStyle = (color) => ({
  appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
  border: `1px solid ${BORDER}`, background: "#fff", borderRadius: RADIUS.sm,
  padding: "6px 26px 6px 9px", boxSizing: "border-box", width: "100%",
  fontFamily: font, fontWeight: WEIGHT.medium, fontSize: SIZE.ui, color: color || INK, cursor: "pointer",
});
const tabButtonStyle = (active) => ({
  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui, cursor: "pointer",
  padding: "8px 2px", border: "none", borderBottom: `2px solid ${active ? INK : "transparent"}`,
  background: "none", color: active ? INK : INK_SOFT,
  transition: `color ${MOTION.fast} ${MOTION.ease}, border-color ${MOTION.fast} ${MOTION.ease}`,
});

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
        <div style={{ position: "relative", marginTop: "8px" }}>
          <select value={status} onChange={(e) => onStatusChange(e.target.value)} style={selectStyle(SPEC_STATUS_COLOR[status])}>
            {SPEC_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
        </div>
      </div>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <div>
        <div style={eyebrow}>Initiative</div>
        <div style={{ position: "relative", marginTop: "8px" }}>
          <select
            value={initiativeId || ""}
            onChange={(e) => onInitiativeChange(e.target.value || null)}
            style={selectStyle(initiativeId ? INK : INK_FAINT)}
          >
            <option value="">None</option>
            {(initiatives || []).map((i) => (
              <option key={i.id} value={i.id}>{i.title || "Untitled initiative"}</option>
            ))}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: INK_FAINT, pointerEvents: "none" }} />
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
  spec, boards, signals, insights, activities, sections, initiatives, onChange, activeTab, onSelectTab, onOpenBoard,
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
  // lib/buildBrief.js) and opens it as plain text in a new tab — same "can't launch a real
  // editor from a browser sandbox" constraint DocumentPage's "View .md" already works within,
  // so the same workaround: a Blob URL, not a real file path.
  const startBuild = () => {
    const initiative = initiativeId ? (initiatives || []).find((i) => i.id === initiativeId) : null;
    const brief = buildSpecBrief(
      { title, problem, goals, nonGoals, openQuestions, acceptanceCriteria, design, plan },
      sections,
      initiative
    );
    const blob = new Blob([brief], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

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
              title="Assemble Standards, Product Knowledge, and this spec into one hand-off document for an agent"
              style={{ flexShrink: 0, marginTop: "10px", color: INK_SOFT }}
            >
              <FileOutput size={13} /> Start build
            </button>
          </div>

          <div style={{ display: "flex", gap: "18px", borderBottom: `1px solid ${BORDER}`, marginTop: "18px" }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => onSelectTab(t.key)} style={tabButtonStyle(activeTab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* The `hidden` attribute must be the only thing controlling display on each of these —
            an inline `display` would win over the browser's default `[hidden]{display:none}` rule
            and the panel would never actually hide. */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div hidden={activeTab !== "overview"} style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "24px 40px 32px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
              <div>
                <div style={eyebrow}>Problem</div>
                <textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="The problem this solves…" style={{ ...editArea, marginTop: "8px" }} />
              </div>
              <div>
                <div style={eyebrow}>Goals</div>
                <textarea rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Success looks like…" style={{ ...editArea, marginTop: "8px" }} />
              </div>
              <div>
                <div style={eyebrow}>Non-goals</div>
                <textarea rows={2} value={nonGoals} onChange={(e) => setNonGoals(e.target.value)} placeholder="Explicitly out of scope…" style={{ ...editArea, marginTop: "8px" }} />
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
              <CrepeEditor value={spec.design} onChange={setDesign} />
            </div>
          </div>

          <div hidden={activeTab !== "plan"} style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "24px 40px 32px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto" }}>
              <CrepeEditor value={spec.plan} onChange={setPlan} />
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
