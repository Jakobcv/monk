import { useState, useRef, useEffect } from "react";
import { ArrowDown, ChevronDown, ClipboardCheck, FileText, Plus, X } from "lucide-react";
import { INK, INK_FAINT, SIZE, SPACE, SPEC_STATUS_OPTIONS, SPEC_STATUS_COLOR } from "./lib/theme";
import { RESEARCH_PLAN_STATUS_COLOR } from "./lib/researchPlanModel";
import { Dot, Eyebrow, Meta } from "./ui/text";
import ChecklistEditor from "./ChecklistEditor";
import PlanTab from "./PlanTab";
import LiveMarkdown from "./ui/LiveMarkdown";
import DesignTab from "./DesignTab";
import Page from "./ui/Page";
import PaperFrame from "./ui/PaperFrame";
import IconButton from "./ui/IconButton";
import PaperButton from "./ui/PaperButton";
import LinkPicker from "./ui/LinkPicker";
import SideRail, { SideRailSection, SideRailDivider } from "./ui/SideRail";
import SourcesList from "./ui/SourcesList";
import ChangeLog from "./ChangeLog";
import { commitmentsOf } from "./lib/changeLog";
import { parseDesign } from "./lib/designModel";
import { useChangeRecorder } from "./lib/useChangeRecorder";

// Solution / Plan mirror the shape of the work itself — what you're going to build, then execution —
// with Overview as the always-there summary tying them together. The research behind the spec lives
// in research plans, linked from Overview; the board that used to be a Discovery tab here is a
// research plan's Analysis tab now.
//
// Solution's key stays "design": it's the URL segment (#/spec/<id>/design). The key is the storage
// name and the label is what you call it.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "design", label: "Solution" },
  { key: "plan", label: "Plan" },
];

const planTitle = (p) => p.title || "Untitled research plan";

// The first sentence of a Result, as plain text: its opening paragraph, markdown taken out, cut at
// the first full stop. WRITING.md has a Result open on what changed for the people using the
// product, so this is usually the one line worth reading before deciding to read the rest. A Result
// that opens straight into its "How we know:" list has no such line, and gets none.
function resultLead(md) {
  const first = md.trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
  const plain = first.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/(\*\*|__|`|~~)/g, "").replace(/(^|\s)_(\S.*?\S|\S)_(?=\s|[.,;:!?]|$)/g, "$1$2");
  const sentence = /^.*?[.!?](?=\s|$)/.exec(plain)?.[0] ?? plain;
  return /:\s*$/.test(sentence) || /^\s*[-*+]\s/.test(first) ? "" : sentence;
}

// A spec with a Result says so above every one of its pages, and links to it. The Result is the
// part a person deciding "did this ship?" reads first, and it sits halfway down the Solution tab,
// under the Solution and the Sketches — a banner is what makes it findable from Overview or Plan
// without knowing where it lives. It's on the desk above the sheet, not on the sheet: it's a way
// to the writing, not part of it.
//
// The link is a real one (#/spec/<id>/design/result), so it can be opened in a new tab or shared,
// and landing on it scrolls to the Result (SpecPage's effect below). Clicking it again when the URL
// already says /result changes nothing the router can see, so that click scrolls directly.
function ResultBanner({ result, href, onJump }) {
  const lead = resultLead(result);
  const onClick = (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.location.hash === href) {
      e.preventDefault();
      onJump();
    }
  };
  return (
    <div className="result-banner">
      <span className="result-banner__icon" aria-hidden="true">
        <ClipboardCheck size={20} />
      </span>
      <div className="result-banner__text">
        <p className="result-banner__label">This spec has a Result</p>
        {lead && <p className="result-banner__lead">{lead}</p>}
      </div>
      <a className="result-banner__link" href={href} onClick={onClick}>
        Read the Result <ArrowDown size={15} aria-hidden="true" />
      </a>
    </div>
  );
}

// A persistent per-spec sidebar for metadata that applies across every tab, not just Overview —
// Status, Owner, and which Initiative this spec belongs to. The panel itself is ui/SideRail, shared
// with the research plan page.
function SpecSidebar({ status, onStatusChange, owner, onOwnerChange, initiativeId, onInitiativeChange, initiatives }) {
  return (
    <SideRail>
      <SideRailSection label="Status">
        <div className="select-wrap">
          <select className="select" aria-label="Status" style={{ color: SPEC_STATUS_COLOR[status] }} value={status} onChange={(e) => onStatusChange(e.target.value)}>
            {SPEC_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
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
            onChange={(e) => onInitiativeChange(e.target.value || null)}
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

      <SideRailSection label="Owner">
        <input value={owner} onChange={(e) => onOwnerChange(e.target.value)} placeholder="Unassigned" aria-label="Owner" className="edit-area" />
      </SideRailSection>
    </SideRail>
  );
}

// The research this spec is built on, as a list on the Overview sheet: linked plans as rows that open
// the plan, a remove × on each, and a row that links another (or starts a new one). Linked from here
// rather than from the plan, because a spec is where the decision to rely on a piece of research is
// made. A pointer to a plan that has since been deleted isn't shown, and is dropped the next time
// the list changes.
function ResearchPlansList({ researchPlans, ids, onChange, researchPlanHref, onCreateResearchPlan }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef(null);
  const linked = ids.map((id) => researchPlans.find((p) => p.id === id)).filter(Boolean);
  const link = (id) => { if (!ids.includes(id)) onChange([...linked.map((p) => p.id), id]); };

  return (
    <div>
      <Eyebrow>Research plans</Eyebrow>
      <div style={{ marginTop: SPACE.base, display: "flex", flexDirection: "column" }}>
        {linked.length === 0 && (
          <p className="paper-hint" style={{ marginBottom: SPACE.sm }}>
            No research linked yet. Link the plans this spec is built on, so their questions and evidence are one click away.
          </p>
        )}
        {linked.map((p) => (
          <div key={p.id} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.sm, minWidth: 0 }}>
            <a className="paper-link-row" href={researchPlanHref(p.id)} style={{ flex: 1 }}>
              <Dot color={RESEARCH_PLAN_STATUS_COLOR[p.status] || INK_FAINT} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{planTitle(p)}</span>
              <Meta style={{ fontSize: SIZE.ui, flexShrink: 0 }}>{p.status}</Meta>
            </a>
            <IconButton
              className="reveal"
              onClick={() => onChange(linked.map((x) => x.id).filter((x) => x !== p.id))}
              title="Unlink from this spec (keeps the plan)"
              aria-label={`Unlink ${planTitle(p)}`}
              style={{ "--hit-w": "34px", "--hit-h": "28px" }}
            >
              <X size={16} />
            </IconButton>
          </div>
        ))}
      </div>
      <div style={{ marginTop: SPACE.xs }}>
        <PaperButton
          icon={Plus}
          data-dismiss-ignore
          aria-expanded={pickerOpen}
          onClick={(e) => { anchorRef.current = e.currentTarget; setPickerOpen((open) => !open); }}
        >
          Link research plan
        </PaperButton>
      </div>
      {pickerOpen && (
        <LinkPicker
          anchorRef={anchorRef}
          align="left"
          onClose={() => setPickerOpen(false)}
          label="Link a research plan"
          placeholder="Search research plans…"
          emptyText="No other research plans."
          items={researchPlans.filter((p) => !ids.includes(p.id)).map((p) => ({ id: p.id, label: planTitle(p), meta: p.status }))}
          onPick={link}
          action={{ label: "New research plan", onClick: () => link(onCreateResearchPlan({ navigate: false })) }}
        />
      )}
    </div>
  );
}

// `spec` only seeds local state on mount — the parent remounts this component (via
// `key={spec.id}`) whenever the open spec changes, same pattern as DocumentPage.jsx.
// All tabs stay mounted at once (toggled with the `hidden` attribute, not a conditional render) so
// switching tabs is instant and none of them loses its state.
//
// Layout is ui/PaperFrame — breadcrumbs, kind, title and tab bar, then the tab's body, with the
// metadata rail (SpecSidebar, above) beside it. Each tab is a sheet of paper centred on the desk
// (<Page ground="reading"> + .paper-sheet) at its own larger type scale (PAPER in lib/theme.js).
//
// Research plans live in App's state, not here: linking one only edits this spec's
// `researchPlanIds`, and handing an open question to a plan goes through `onAddResearchQuestion`
// (or `onCreateResearchPlan`, which returns the new plan's id).
export default function SpecPage({
  spec, initiatives, onChange, activeTab, section = null, resultHref, tabHref, onToast, breadcrumbs,
  researchPlans = [], researchPlanHref, onCreateResearchPlan, onAddResearchQuestion,
  sections, docHref, onUploadSourceFile, onRemoveSourceFile, onOpenSourceFile,
  onUploadSketch, onReadSketch,
}) {
  const [title, setTitle] = useState(spec.title);
  const [status, setStatus] = useState(spec.status);
  const [owner, setOwner] = useState(spec.owner);
  const [initiativeId, setInitiativeId] = useState(spec.initiativeId || null);
  const [researchPlanIds, setResearchPlanIds] = useState(spec.researchPlanIds || []);
  const [problem, setProblem] = useState(spec.problem);
  const [goals, setGoals] = useState(spec.goals);
  const [nonGoals, setNonGoals] = useState(spec.nonGoals);
  const [openQuestions, setOpenQuestions] = useState(spec.openQuestions);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(spec.acceptanceCriteria);
  const [sources, setSources] = useState(spec.sources || []);
  const [design, setDesign] = useState(spec.design);
  const [plan, setPlan] = useState(spec.plan);
  const [changes, setChanges] = useState(spec.changes || []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ title, status, owner, initiativeId, researchPlanIds, problem, goals, nonGoals, openQuestions, acceptanceCriteria, sources, design, plan, changes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, status, owner, initiativeId, researchPlanIds, problem, goals, nonGoals, openQuestions, acceptanceCriteria, sources, design, plan, changes]);

  // Every edit to a commitment on an active or shipped spec is logged (lib/changeLog.js). A burst
  // closed while the page is open lands in state like any other edit; one closed by leaving the
  // page goes straight to the parent, since this page's state is on its way out.
  const changesRef = useRef(changes);
  useEffect(() => { changesRef.current = changes; });
  useChangeRecorder({
    status,
    commitments: commitmentsOf({ acceptanceCriteria, openQuestions, decisions: parseDesign(design).decisions, nonGoals }),
    onEntries: (entries, { unmounting }) => {
      if (unmounting) onChange({ changes: [...changesRef.current, ...entries] });
      else setChanges((prev) => [...prev, ...entries]);
    },
  });
  const setReason = (i, reason) => setChanges((prev) => prev.map((c, j) => (j === i ? { ...c, reason } : c)));

  // Landing on #/spec/<id>/design/result — from the banner, a shared link, or a reload — scrolls the
  // Solution tab to the Result. `jump` is the banner clicked again while the URL already says so.
  // Focus goes to the section before the scroll, as the section map does it (ui/SectionMap.jsx):
  // moving focus would cancel a smooth scroll already under way, and tabbing on should carry on
  // from the Result rather than from the banner.
  const result = parseDesign(design).result.trim();
  const resultRef = useRef(null);
  const [jump, setJump] = useState(0);
  useEffect(() => {
    if (activeTab !== "design" || section !== "result") return;
    // A frame's wait: the tab has only just stopped being `hidden`, and nothing can scroll into
    // view before it has a layout.
    const frame = requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, section, jump]);
  const banner = result && resultHref
    ? <ResultBanner result={result} href={resultHref} onJump={() => setJump((n) => n + 1)} />
    : null;

  // An open question handed to a research plan. The picker hangs off the row's button; the plans
  // already linked to this spec come first, since that's almost always where the question goes.
  // Handing it on links the plan to the spec too, if it wasn't already. The open question stays:
  // it's still open on the spec until the research answers it.
  const [promoteIdx, setPromoteIdx] = useState(null);
  const promoteRef = useRef(null);
  const promotedText = promoteIdx != null ? (openQuestions[promoteIdx]?.text || "").trim() : "";
  const promote = (planId) => {
    if (!promotedText) return;
    let id = planId;
    if (id) {
      onAddResearchQuestion(id, promotedText);
    } else {
      id = onCreateResearchPlan({ navigate: false, questions: [promotedText] });
      onToast?.("Started a research plan with this question");
    }
    setResearchPlanIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const promoteItems = [...researchPlans]
    .sort((a, b) => Number(researchPlanIds.includes(b.id)) - Number(researchPlanIds.includes(a.id)))
    .map((p) => ({ id: p.id, label: planTitle(p), meta: researchPlanIds.includes(p.id) ? `${p.status} · linked to this spec` : p.status }));

  return (
    <PaperFrame
      breadcrumbs={breadcrumbs}
      kindIcon={FileText} kind="Spec"
      title={title} onTitleChange={(e) => setTitle(e.target.value)} titlePlaceholder="Untitled spec"
      tabs={TABS} activeTab={activeTab} tabHref={tabHref}
      rail={(
        <SpecSidebar
          status={status} onStatusChange={setStatus}
          owner={owner} onOwnerChange={setOwner}
          initiativeId={initiativeId} onInitiativeChange={setInitiativeId} initiatives={initiatives}
        />
      )}
    >
      {/* `hidden` is what toggles these. It only wins because index.css states
          `[hidden]{display:none!important}` — the UA's own rule loses to .page--reading's
          `display:flex`, and would lose to an inline `display` too. */}
      <Page ground="reading" hidden={activeTab !== "overview"}>
        {banner}
        <div className="paper-sheet paper-sheet--sections">
          <div className="paper-section">
            <Eyebrow>Problem</Eyebrow>
            <LiveMarkdown className="prose-field" minLines={2} value={problem} onChange={setProblem} placeholder="The problem this solves…" ariaLabel="Problem" />
          </div>
          <div className="paper-section">
            <Eyebrow>Goals</Eyebrow>
            <LiveMarkdown className="prose-field" minLines={2} value={goals} onChange={setGoals} placeholder="Success looks like…" ariaLabel="Goals" />
          </div>
          <div className="paper-section">
            <Eyebrow>Non-goals</Eyebrow>
            <LiveMarkdown className="prose-field" minLines={2} value={nonGoals} onChange={setNonGoals} placeholder="Explicitly out of scope…" ariaLabel="Non-goals" />
          </div>

          <ResearchPlansList
            researchPlans={researchPlans}
            ids={researchPlanIds}
            onChange={setResearchPlanIds}
            researchPlanHref={researchPlanHref}
            onCreateResearchPlan={onCreateResearchPlan}
          />

          <div className="paper-rule" />

          <ChecklistEditor
            paper resolutions label="Open questions" items={openQuestions} onChange={setOpenQuestions}
            onPromote={onAddResearchQuestion ? (idx, button) => {
              if (promoteIdx === idx) { setPromoteIdx(null); return; }
              promoteRef.current = button;
              setPromoteIdx(idx);
            } : null}
          />
          <ChecklistEditor paper label="Acceptance criteria" items={acceptanceCriteria} onChange={setAcceptanceCriteria} />

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

          {changes.length > 0 && <div className="paper-rule" />}
          <ChangeLog changes={changes} onReasonChange={setReason} />
        </div>
      </Page>

      {promoteIdx != null && openQuestions[promoteIdx] && (
        <LinkPicker
          anchorRef={promoteRef}
          onClose={() => setPromoteIdx(null)}
          label="Add to a research plan"
          placeholder="Search research plans…"
          emptyText={promotedText ? "No research plans yet." : "Write the question first."}
          items={promotedText ? promoteItems : []}
          onPick={promote}
          action={promotedText ? { label: "New research plan", onClick: () => promote(null) } : null}
        />
      )}

      <Page ground="reading" hidden={activeTab !== "design"}>
        {banner}
        <div className="paper-sheet">
          <DesignTab
            value={spec.design} status={status} onChange={setDesign} onToast={onToast} resultRef={resultRef}
            onUploadSketch={onUploadSketch} onReadSketch={onReadSketch}
          />
        </div>
      </Page>

      {/* The Plan: the work as tasks with a state each, then the approach, which still takes
          the rest of the sheet (see PlanTab). Stored as one plan.md, like the Solution tab's
          solution.md. */}
      <Page ground="reading" hidden={activeTab !== "plan"}>
        {banner}
        <div className="paper-sheet" style={{ display: "flex", flexDirection: "column" }}>
          <PlanTab value={spec.plan} onChange={setPlan} />
        </div>
      </Page>
    </PaperFrame>
  );
}
