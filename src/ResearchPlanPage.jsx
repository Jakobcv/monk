import { useState, useRef, useEffect } from "react";
import { ChevronDown, FlaskConical, Trash2 } from "lucide-react";
import { INK, INK_FAINT, SIZE, SPACE, SPEC_STATUS_COLOR } from "./lib/theme";
import { RESEARCH_PLAN_STATUS_OPTIONS, RESEARCH_PLAN_STATUS_COLOR, specsForPlan } from "./lib/researchPlanModel";
import { Dot, Eyebrow, Meta } from "./ui/text";
import LiveMarkdown from "./ui/LiveMarkdown";
import Button from "./ui/Button";
import Page from "./ui/Page";
import PaperFrame from "./ui/PaperFrame";
import SideRail, { SideRailSection, SideRailDivider, SideRailFoot } from "./ui/SideRail";
import ResearchQuestionsEditor from "./ResearchQuestionsEditor";
import PaperListEditor from "./PaperListEditor";
import Board from "./Board";
import SourcesList from "./ui/SourcesList";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "analysis", label: "Analysis" },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ProseSection({ label, value, onChange, placeholder, minLines = 2 }) {
  return (
    <div className="paper-section">
      <Eyebrow>{label}</Eyebrow>
      <LiveMarkdown className="prose-field" minLines={minLines} value={value} onChange={onChange} placeholder={placeholder} ariaLabel={label} />
    </div>
  );
}

// A research plan (lib/researchPlanModel.js), framed like a spec (ui/PaperFrame): breadcrumbs,
// title, a tab bar, and a side rail for what describes it.
//
// - Overview is the plan itself, on the paper surface the spec's writing tabs use.
// - Analysis is the plan's board (Board.jsx) — where the study's signals are collected, formed into
//   insights and followed through to actions and results. It fills its height edge to edge.
//
// Both tabs stay mounted and are toggled with `hidden`, as on SpecPage, so switching is instant and
// neither loses its state. `plan` only seeds local state on mount — the parent remounts this page via
// its key when the plan changes on disk.
export default function ResearchPlanPage({
  plan, signals, insights, specs, initiatives, boards,
  activeTab = "overview", tabHref, highlightCardId,
  onChange, onDelete, onOpenBoard, onCreateSignal, onUpdateSignal, onCreateInsight, onUpdateInsight, onToast,
  onCreateSpec, onUpdateSpec,
  specHref, insightHref, breadcrumbs,
  sections, docHref, onUploadSourceFile, onRemoveSourceFile, onOpenSourceFile,
}) {
  const [title, setTitle] = useState(plan.title);
  const [status, setStatus] = useState(plan.status);
  const [initiativeId, setInitiativeId] = useState(plan.initiativeId || null);
  const [problem, setProblem] = useState(plan.problem);
  const [background, setBackground] = useState(plan.background);
  const [approach, setApproach] = useState(plan.approach);
  const [participants, setParticipants] = useState(plan.participants);
  const [discussionGuide, setDiscussionGuide] = useState(plan.discussionGuide);
  const [researchQuestions, setResearchQuestions] = useState(plan.researchQuestions || []);
  const [activities, setActivities] = useState(plan.activities || []);
  const [sources, setSources] = useState(plan.sources || []);
  const [board, setBoard] = useState(plan.board);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ title, status, initiativeId, problem, background, approach, participants, discussionGuide, researchQuestions, activities, sources, board });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, status, initiativeId, problem, background, approach, participants, discussionGuide, researchQuestions, activities, sources, board]);

  const informed = specsForPlan(specs, plan.id);
  // The insights on this plan's own board come first when linking one to a question — that's where
  // a study's answers almost always are.
  const onBoard = new Set((board.insights || []).map((x) => x.id));
  const questionInsights = [
    ...(insights || []).filter((i) => onBoard.has(i.id)),
    ...(insights || []).filter((i) => !onBoard.has(i.id)),
  ];

  const rail = (
    <SideRail>
      <SideRailSection label="Status">
        <div className="select-wrap">
          <select className="select" aria-label="Status" style={{ color: RESEARCH_PLAN_STATUS_COLOR[status] || INK }} value={status} onChange={(e) => setStatus(e.target.value)}>
            {RESEARCH_PLAN_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={12} className="select-chevron" />
        </div>
      </SideRailSection>

      <SideRailDivider />

      <SideRailSection label="Initiative">
        <div className="select-wrap">
          <select
            className="select"
            aria-label="Initiative"
            style={{ color: initiativeId ? INK : INK_FAINT }}
            value={initiativeId || ""}
            onChange={(e) => setInitiativeId(e.target.value || null)}
          >
            <option value="">None</option>
            {(initiatives || []).map((i) => (
              <option key={i.id} value={i.id}>{i.title || "Untitled initiative"}</option>
            ))}
          </select>
          <ChevronDown size={12} className="select-chevron" />
        </div>
      </SideRailSection>

      <SideRailDivider />

      {/* Linked from the spec's side, where the decision to lean on this research is made. */}
      <SideRailSection label={`Informs ${plural(informed.length, "spec")}`}>
        {informed.length === 0 ? (
          <Meta as="div" style={{ fontSize: SIZE.sm, lineHeight: 1.5 }}>
            No specs yet. A spec links to this plan from its Overview.
          </Meta>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            {informed.map((s) => (
              <a key={s.id} className="rail-link" href={specHref(s.id)} title={s.title || "Untitled spec"}>
                <Dot color={SPEC_STATUS_COLOR[s.status] || INK_FAINT} />
                <span>{s.title || "Untitled spec"}</span>
              </a>
            ))}
          </div>
        )}
      </SideRailSection>

      <SideRailFoot>
        <Button variant="danger" onClick={onDelete} style={{ marginLeft: `-${SPACE.md}` }}>
          <Trash2 size={16} /> Delete plan
        </Button>
      </SideRailFoot>
    </SideRail>
  );

  return (
    <PaperFrame
      breadcrumbs={breadcrumbs}
      kindIcon={FlaskConical} kind="Research plan"
      title={title} onTitleChange={(e) => setTitle(e.target.value)} titlePlaceholder="Untitled research plan"
      tabs={TABS} activeTab={activeTab} tabHref={tabHref}
      rail={rail}
    >
      {/* `hidden` toggles these; see the note on SpecPage about why that wins over .page's display. */}
      <Page ground="reading" hidden={activeTab !== "overview"}>
        <div className="paper-sheet paper-sheet--sections">
          <ProseSection label="Problem statement" value={problem} onChange={setProblem} placeholder="The decision or problem this research serves…" />
          <ProseSection label="Background" value={background} onChange={setBackground} placeholder="What we already know, and what prompted this study…" />
          <ProseSection label="Approach" value={approach} onChange={setApproach} placeholder="The method, and why it fits the questions…" />
          <ProseSection label="Participants" value={participants} onChange={setParticipants} placeholder="Who we'll recruit, how many, and how we'll find them…" />

          <div className="paper-rule" />

          <ResearchQuestionsEditor
            items={researchQuestions}
            onChange={setResearchQuestions}
            insights={questionInsights}
            insightHref={insightHref}
          />

          <ProseSection
            label="Discussion guide"
            value={discussionGuide}
            onChange={setDiscussionGuide}
            minLines={4}
            placeholder="1. What you'll ask or do in each session, in order…"
          />

          <div className="paper-rule" />

          <PaperListEditor
            label="Activities"
            items={activities}
            onChange={setActivities}
            addLabel="Add activity"
            placeholder="Interview with P3, Survey wave 1…"
          />

          <div className="paper-rule" />

          <SourcesList
            sources={sources}
            onChange={setSources}
            sections={sections}
            docHref={docHref}
            onUploadFile={onUploadSourceFile}
            onRemoveFile={onRemoveSourceFile}
            onOpenFile={onOpenSourceFile}
          />
        </div>
      </Page>

      <Page bleed hidden={activeTab !== "analysis"}>
        <Board
          board={board}
          onChange={(patch) => setBoard((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }))}
          allBoards={boards}
          onOpenBoard={onOpenBoard}
          signals={signals}
          insights={insights}
          onUpdateSignal={onUpdateSignal}
          onCreateSignal={onCreateSignal}
          onUpdateInsight={onUpdateInsight}
          onCreateInsight={onCreateInsight}
          specs={specs}
          onCreateSpec={onCreateSpec}
          onUpdateSpec={onUpdateSpec}
          specHref={specHref}
          onToast={onToast}
          highlightCardId={activeTab === "analysis" ? highlightCardId : null}
        />
      </Page>
    </PaperFrame>
  );
}
