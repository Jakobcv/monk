import { useState, useRef, useEffect } from "react";
import { ChevronDown, FolderGit2, Plus, Trash2, X } from "lucide-react";
import { INK, INK_FAINT, BORDER, SIZE, SPACE, SPEC_STATUS_OPTIONS, SPEC_STATUS_COLOR } from "./lib/theme";
import { INITIATIVE_STATUS_OPTIONS } from "./lib/initiativeModel";
import { RESEARCH_PLAN_STATUS_COLOR } from "./lib/researchPlanModel";
import { Dot, Eyebrow, Meta } from "./ui/text";
import ChecklistEditor from "./ChecklistEditor";
import OutcomesEditor from "./OutcomesEditor";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import LiveMarkdown from "./ui/LiveMarkdown";
import Page from "./ui/Page";
import PaperButton from "./ui/PaperButton";
import PaperFrame from "./ui/PaperFrame";
import SideRail, { SideRailSection, SideRailDivider, SideRailFoot } from "./ui/SideRail";
import SourcesList from "./ui/SourcesList";

const specTitle = (s) => s.title || "Untitled spec";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// How far the initiative's specs have got: a bar with one segment per spec in status order, and
// the same counts in words so the bar is never the only way to read it.
function Progress({ specs, openQuestions }) {
  const counts = SPEC_STATUS_OPTIONS.map((s) => [s, specs.filter((x) => x.status === s).length]);
  const shipped = specs.filter((s) => s.status === "shipped").length;
  const unresolved = openQuestions.filter((q) => !q.checked && (q.text || "").trim()).length;
  return (
    <>
      {specs.length === 0 ? (
        <Meta as="div" style={{ fontSize: SIZE.sm, lineHeight: 1.5 }}>No specs yet.</Meta>
      ) : (
        <>
          <div style={{ fontSize: SIZE.ui, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {shipped} of {plural(specs.length, "spec")} shipped
          </div>
          <div className="rollup-bar" aria-hidden="true">
            {counts.flatMap(([s, n]) => Array.from({ length: n }, (_, i) => (
              <span key={`${s}${i}`} style={{ backgroundColor: s === "draft" ? BORDER : SPEC_STATUS_COLOR[s] }} />
            )))}
          </div>
          <Meta as="div" style={{ fontSize: SIZE.sm, fontVariantNumeric: "tabular-nums" }}>
            {counts.filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(" · ")}
          </Meta>
        </>
      )}
      <Meta as="div" style={{ fontSize: SIZE.sm, marginTop: SPACE.md, color: unresolved ? INK : INK_FAINT }}>
        {unresolved ? `${plural(unresolved, "open question")} holding its specs` : "No open questions"}
      </Meta>
    </>
  );
}

// The layer above specs — an epic to their tickets — on the same paper frame as a spec and a
// research plan (ui/PaperFrame), told apart by structure rather than decoration: there are no tabs,
// because an initiative is one sheet, the sheet ends in the specs it holds, and the rail rolls those
// specs up instead of describing a single piece of work. PageKind names it outright.
//
// `initiative` only seeds local state on mount (parent remounts via `key`, same as SpecPage /
// ResearchPlanPage). `specs` and `researchPlans` arrive already filtered to this initiative (see
// specsForInitiative / researchPlansForInitiative in App.jsx).
//
// Assigning an *existing* loose spec or plan happens from its own page, not here. Here you either
// create a spec already in the initiative or detach one that's in it.
export default function InitiativePage({
  initiative, specs, specHref, researchPlans = [], researchPlanHref,
  onChange, onDelete, onCreateSpec, onDetachSpec, breadcrumbs,
  sections, docHref, onUploadSourceFile, onRemoveSourceFile, onOpenSourceFile,
}) {
  const [title, setTitle] = useState(initiative.title);
  const [status, setStatus] = useState(initiative.status);
  const [description, setDescription] = useState(initiative.description || "");
  const [outcomes, setOutcomes] = useState(initiative.outcomes || []);
  const [openQuestions, setOpenQuestions] = useState(initiative.openQuestions || []);
  const [sources, setSources] = useState(initiative.sources || []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ title, status, description, outcomes, openQuestions, sources });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, status, description, outcomes, openQuestions, sources]);

  const sorted = [...specs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const rail = (
    <SideRail>
      <SideRailSection label="Status">
        <div className="select-wrap">
          <select className="select" aria-label="Status" style={{ color: SPEC_STATUS_COLOR[status] || INK }} value={status} onChange={(e) => setStatus(e.target.value)}>
            {INITIATIVE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={12} className="select-chevron" />
        </div>
      </SideRailSection>

      <SideRailDivider />

      <SideRailSection label="Progress">
        <Progress specs={specs} openQuestions={openQuestions} />
      </SideRailSection>

      <SideRailDivider />

      <SideRailSection label={`Research plans (${researchPlans.length})`}>
        {researchPlans.length === 0 ? (
          <Meta as="div" style={{ fontSize: SIZE.sm, lineHeight: 1.5 }}>
            None yet. A research plan joins an initiative from its own page.
          </Meta>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            {researchPlans.map((p) => (
              <a key={p.id} className="rail-link" href={researchPlanHref(p.id)} title={p.title || "Untitled research plan"}>
                <Dot color={RESEARCH_PLAN_STATUS_COLOR[p.status] || INK_FAINT} />
                <span>{p.title || "Untitled research plan"}</span>
              </a>
            ))}
          </div>
        )}
      </SideRailSection>

      <SideRailFoot>
        <Button variant="danger" onClick={onDelete} style={{ marginLeft: `-${SPACE.md}` }}>
          <Trash2 size={16} /> Delete initiative
        </Button>
      </SideRailFoot>
    </SideRail>
  );

  return (
    <PaperFrame
      breadcrumbs={breadcrumbs}
      kindIcon={FolderGit2} kind="Initiative"
      title={title} onTitleChange={(e) => setTitle(e.target.value)} titlePlaceholder="Untitled initiative"
      rail={rail}
    >
      <Page ground="reading">
        <div className="paper-sheet paper-sheet--sections">
          {/* Context shared by every spec under this initiative, which an agent building any of
              them reads alongside the spec. */}
          <div className="paper-section">
            <Eyebrow>Description</Eyebrow>
            <LiveMarkdown className="prose-field" minLines={2} value={description} onChange={setDescription} placeholder="Context every spec in this initiative should carry…" ariaLabel="Description" />
          </div>

          <OutcomesEditor items={outcomes} onChange={setOutcomes} />

          <div className="paper-rule" />

          {/* The questions that span several specs and belong to none of them. An unchecked one
              holds up every spec in the initiative. */}
          <ChecklistEditor paper resolutions label="Open questions" items={openQuestions} onChange={setOpenQuestions} />

          <div className="paper-rule" />

          <div>
            <Eyebrow>Specs in this initiative ({specs.length})</Eyebrow>
            <div style={{ marginTop: SPACE.base, display: "flex", flexDirection: "column" }}>
              {specs.length === 0 && (
                <p className="paper-hint" style={{ marginBottom: SPACE.sm }}>
                  No specs yet — start one here, or assign an existing spec from its own page.
                </p>
              )}
              {sorted.map((s) => (
                <div key={s.id} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.sm, minWidth: 0 }}>
                  <a className="paper-link-row" href={specHref(s.id)} style={{ flex: 1 }}>
                    <Dot color={SPEC_STATUS_COLOR[s.status] || INK_FAINT} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{specTitle(s)}</span>
                    <Meta style={{ fontSize: SIZE.ui, flexShrink: 0 }}>{s.status}</Meta>
                  </a>
                  <IconButton
                    className="reveal"
                    onClick={() => onDetachSpec(s.id)}
                    title="Remove from this initiative (keeps the spec)"
                    aria-label={`Remove ${specTitle(s)} from this initiative`}
                    style={{ "--hit-w": "34px", "--hit-h": "28px" }}
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              ))}
            </div>
            <div style={{ marginTop: SPACE.xs }}>
              <PaperButton icon={Plus} onClick={onCreateSpec}>New spec</PaperButton>
            </div>
          </div>

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
    </PaperFrame>
  );
}
