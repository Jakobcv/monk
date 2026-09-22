import { useState, useRef, useEffect, useMemo } from "react";
import { FolderOpen, FolderGit2, RefreshCw, FileText } from "lucide-react";
import { loadWorkspace, saveWorkspace, watchWorkspace, canWatchWorkspace, entityIdsFor, ensureAgentGuides, addAgentSection, createWorkspaceDoc, removeWorkspaceDoc, uploadSourceFile, removeSourceFile, readSourceFile, SKETCHES_DIR } from "./lib/storage";
import { WORKSPACE_DOCS, workspaceDocById } from "./lib/workspaceDocs";
import { bumpNextId } from "./lib/boardModel";
import { blankSection, blankDocument, ensureFixedSections, isFixedSection } from "./lib/documentModel";
import { blankSpec } from "./lib/specModel";
import { blankInitiative, specsForInitiative, researchPlansForInitiative } from "./lib/initiativeModel";
import { blankResearchPlan } from "./lib/researchPlanModel";
import { mockWorkspace } from "./lib/mockWorkspace";
import { fsAccessSupported, getStoredConnection, permissionHandle, pickFolder, tryReuseHandle, reconnectHandle, clearStoredConnection } from "./lib/fsPersistence";
import { describeChanges } from "./lib/diskLog";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BG_HOVER, SIZE, WEIGHT, SPACE, RADIUS, MOTION, withAlpha } from "./lib/theme";
import { insertAt } from "./lib/arrays";
import Button from "./ui/Button";
import Toast from "./ui/Toast";
import Notice from "./ui/Notice";
import Header from "./Header";
import Home from "./Home";
import ResearchRepositoryPage from "./ResearchRepositoryPage";
import Sidebar from "./Sidebar";
import Breadcrumbs from "./Breadcrumbs";
import DocumentPage from "./DocumentPage";
import WorkspaceDocPage from "./WorkspaceDocPage";
import SpecsPage from "./SpecsPage";
import SpecPage from "./SpecPage";
import InitiativePage from "./InitiativePage";
import ResearchPlanPage from "./ResearchPlanPage";
import DesignTab from "./DesignTab";
import Board from "./Board";
import Page from "./ui/Page";
import { SAMPLE_DESIGN_MD } from "./lib/sampleDesign";

const DOC_PREFIX = "#/doc/";
const RESEARCH_ROUTE = "#/research";
const SPECS_ROUTE = "#/specs";
const SPEC_PREFIX = "#/spec/";
const INITIATIVE_PREFIX = "#/initiative/";
// Legacy: activities were folded into research plans. The route is still parsed so an old link can
// be sent on to where its activity went (see the redirect effect in App).
const ACTIVITY_PREFIX = "#/activity/";
const RESEARCH_PLAN_PREFIX = "#/research-plan/";
const WORKSPACE_DOC_PREFIX = "#/workspace/";

// href builders — the single source for every route string. Nav renders these as real
// `<a href>` (so Cmd/Ctrl/middle-click open a new tab); `goTo*` just assigns the same string
// to window.location.hash for the after-an-action programmatic case.
const hrefStart = () => "#";
const hrefDocument = (sectionId, docId) => DOC_PREFIX + encodeURIComponent(sectionId) + "/" + encodeURIComponent(docId);
const hrefSpecs = () => SPECS_ROUTE;
const hrefSpec = (id) => SPEC_PREFIX + encodeURIComponent(id);
const hrefSpecDesign = (id) => SPEC_PREFIX + encodeURIComponent(id) + "/design";

// A card id from a deep link. Signal and insight ids are text (UUIDs); action and result ids are
// numbers — and the board compares ids with ===, so an all-digit id has to come back as a number
// and anything else must stay text. (It used to be Number() for everything, which turned every
// signal/insight id into NaN, so a deep link to one never found its card.)
const parseCardId = (raw) => {
  if (!raw) return null;
  const id = decodeURIComponent(raw);
  return /^\d+$/.test(id) ? Number(id) : id;
};
const hrefSpecPlan = (id) => SPEC_PREFIX + encodeURIComponent(id) + "/plan";
const hrefInitiative = (id) => INITIATIVE_PREFIX + encodeURIComponent(id);
const hrefResearchPlan = (id) => RESEARCH_PLAN_PREFIX + encodeURIComponent(id);
// A research plan's board (its Analysis tab), optionally scrolled to one card.
const hrefResearchPlanAnalysis = (id, cardId) => hrefResearchPlan(id) + "/analysis" + (cardId != null ? "/" + encodeURIComponent(cardId) : "");
const hrefWorkspaceDoc = (id) => WORKSPACE_DOC_PREFIX + encodeURIComponent(id);
// Research Repository keeps its search query + kind filter in the URL so a filtered view is
// linkable and survives a refresh.
const hrefResearch = (q, kind) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kind && kind !== "all") params.set("kind", kind);
  const qs = params.toString();
  return RESEARCH_ROUTE + (qs ? "?" + qs : "");
};
// An insight has no page of its own, so a link to one is the repository searched for its text.
const hrefInsight = (insight) => hrefResearch((insight.text || "").trim().slice(0, 60), "insight");

const goToStart = () => { window.location.hash = hrefStart(); };
const goToDocument = (sectionId, docId) => { window.location.hash = hrefDocument(sectionId, docId); };
const goToResearch = () => { window.location.hash = RESEARCH_ROUTE; };
const goToSpecs = () => { window.location.hash = hrefSpecs(); };
const goToSpec = (id) => { window.location.hash = hrefSpec(id); };
const goToInitiative = (id) => { window.location.hash = hrefInitiative(id); };
const goToResearchPlan = (id) => { window.location.hash = hrefResearchPlan(id); };
const goToResearchPlanAnalysis = (id, cardId) => { window.location.hash = hrefResearchPlanAnalysis(id, cardId); };

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  if (hash.startsWith(DOC_PREFIX)) {
    const [sectionIdRaw, docIdRaw] = hash.slice(DOC_PREFIX.length).split("/");
    return {
      name: "doc",
      sectionId: decodeURIComponent(sectionIdRaw),
      docId: docIdRaw ? decodeURIComponent(docIdRaw) : null,
    };
  }
  if (hash === RESEARCH_ROUTE || hash.startsWith(RESEARCH_ROUTE + "?")) {
    const params = new URLSearchParams(hash.slice(RESEARCH_ROUTE.length).replace(/^\?/, ""));
    return { name: "research", q: params.get("q") || "", kind: params.get("kind") || "all" };
  }
  if (hash === SPECS_ROUTE) {
    return { name: "specs" };
  }
  if (hash.startsWith(SPEC_PREFIX)) {
    // An old #/spec/<id>/discovery link — the board moved to research plans — lands on Overview.
    const [idRaw, sub] = hash.slice(SPEC_PREFIX.length).split("/");
    return {
      name: sub === "design" ? "specDesign" : sub === "plan" ? "specPlan" : "spec",
      id: decodeURIComponent(idRaw),
    };
  }
  if (hash.startsWith(INITIATIVE_PREFIX)) {
    return { name: "initiative", id: decodeURIComponent(hash.slice(INITIATIVE_PREFIX.length)) };
  }
  if (hash.startsWith(ACTIVITY_PREFIX)) {
    return { name: "activity", id: decodeURIComponent(hash.slice(ACTIVITY_PREFIX.length)) };
  }
  if (hash.startsWith(RESEARCH_PLAN_PREFIX)) {
    const [idRaw, sub, cardIdRaw] = hash.slice(RESEARCH_PLAN_PREFIX.length).split("/");
    return {
      name: "researchPlan",
      id: decodeURIComponent(idRaw),
      tab: sub === "analysis" ? "analysis" : "overview",
      cardId: parseCardId(cardIdRaw),
    };
  }
  if (hash.startsWith(WORKSPACE_DOC_PREFIX)) {
    return { name: "workspaceDoc", id: decodeURIComponent(hash.slice(WORKSPACE_DOC_PREFIX.length)) };
  }
  if (hash === "#/workspace-doc-preview" || hash.startsWith("#/workspace-doc-preview/")) {
    return { name: "workspaceDocPreview", id: decodeURIComponent(hash.split("/")[2] || "") };
  }
  if (hash === "#/research-preview") {
    return { name: "researchPreview" };
  }
  if (hash === "#/home-preview") {
    return { name: "homePreview" };
  }
  if (hash === "#/specs-preview") {
    return { name: "specsPreview" };
  }
  if (hash === "#/initiative-preview") {
    return { name: "initiativePreview" };
  }
  if (hash === "#/research-plan-preview" || hash.startsWith("#/research-plan-preview/")) {
    const parts = hash.split("/");
    return { name: "researchPlanPreview", tab: parts[2] === "analysis" ? "analysis" : "overview", cardId: parseCardId(parts[3]) };
  }
  if (hash === "#/disk-log-preview") {
    return { name: "diskLogPreview" };
  }
  if (hash === "#/design-preview") {
    return { name: "designPreview" };
  }
  if (hash === "#/spec-preview" || hash.startsWith("#/spec-preview/")) {
    return { name: "specPreview", tab: hash.split("/")[2] || "overview" };
  }
  if (hash === "#/board-preview" || hash.startsWith("#/board-preview/")) {
    return { name: "boardPreview", cardId: parseCardId(hash.split("/")[2]) };
  }
  return { name: "home" };
}

// The real Solution tab on sample content (#/design-preview). The serialized design.md lands on
// window.__designMd, and the last toast on window.__lastToast, for inspection.
function DesignPreviewDemo() {
  return (
    <DesignTab
      value={SAMPLE_DESIGN_MD}
      onChange={(md) => { window.__designMd = md; }}
      onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
    />
  );
}

// The whole spec page — header, tabs, metadata sidebar and all four panels — on sample content,
// for the DEV-only #/spec-preview route (a sandboxed preview can't open a workspace folder). This
// is where the writing tabs get looked at: Overview, Design and Plan are the app's paper surface,
// and the only way to judge one is next to the chrome that frames it. The spec lands on
// window.__spec after every edit.
const PREVIEW_SPEC = {
  id: "preview",
  title: "Bulk export of evidence",
  status: "active",
  owner: "Jakob",
  initiativeId: "ini-preview",
  researchPlanIds: ["m-plan-1"],
  problem:
    "Teams can read an insight on screen but can't get it anywhere else. When a researcher needs to "
    + "put evidence in front of a stakeholder — a deck, a doc, a ticket — they retype it by hand, and "
    + "the link back to the signals that produced it is lost in the copy.",
  goals:
    "Any insight, with the signals behind it, leaves the app in one gesture and arrives somewhere "
    + "else still readable and still attributed.",
  nonGoals:
    "Scheduled or recurring exports. Anything that needs a server. Export of a whole board — the "
    + "unit is the insight.",
  openQuestions: [
    { text: "Does a shared export need to keep working after the board changes?", checked: false },
    { text: "Markdown only, or is PDF worth the weight?", checked: true, resolution: "Markdown only for v1 — every destination we checked accepts pasted markdown, and PDF would need a renderer we don't have." },
  ],
  acceptanceCriteria: [
    { text: "Export is reachable from the insight card without opening it", checked: true },
    { text: "The copied text pastes cleanly into Notion, Slack and a Google Doc", checked: true },
    { text: "Every quoted signal carries its activity and date", checked: false },
    { text: "The whole flow is operable from the keyboard", checked: false },
  ],
  design: SAMPLE_DESIGN_MD,
  plan: `## Tasks

- [x] Pull the serializer out into \`lib/exportInsight.js\`
- [~] Export dialog with a **live preview**
- [ ] Attribution on every quoted signal
- [!] Download fallback when the clipboard is refused

## Approach

# Plan

## 1. Serializer

Pull the insight-to-markdown shaping out of the card body and into \`lib/exportInsight.js\`, so the dialog and the clipboard path share one implementation and there is exactly one place where the output format is decided.

## 2. The dialog

Reuse \`Modal\` + \`DialogActions\`. Three choices — clipboard, file, plain text — with a live preview of what's about to leave the app, because nobody should have to paste something to find out what it looks like.

## 3. Attribution

Each quoted signal keeps its activity name and date. This is the part that makes an export worth trusting, so it is not optional and not a setting.

## Open risks

- Long signal bodies make the preview unwieldy; may need a collapse at ~6 lines.
- Clipboard permission is refused in some embedded contexts — fall back to a download.
`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

function SpecPreviewDemo({ tab }) {
  const [spec, setSpec] = useState(PREVIEW_SPEC);
  // The sample research plans, so Overview's research plans list and "Add to a research plan" have
  // something to link to. They land on window.__researchPlans.
  const [plans, setPlans] = useState(() => mockWorkspace(1).researchPlans);
  useEffect(() => { window.__spec = spec; window.__researchPlans = plans; }, [spec, plans]);
  return (
    <SpecPage
      key="preview"
      spec={spec}
      researchPlans={plans}
      researchPlanHref={() => "#/research-plan-preview"}
      onCreateResearchPlan={({ questions = [] } = {}) => {
        const created = { ...blankResearchPlan(), researchQuestions: questions.map((text) => ({ text, insightIds: [] })) };
        setPlans((prev) => [...prev, created]);
        return created.id;
      }}
      onAddResearchQuestion={(planId, text) => setPlans((prev) => prev.map((p) => (
        p.id === planId ? { ...p, researchQuestions: [...p.researchQuestions, { text, insightIds: [] }] } : p
      )))}
      onChange={(patch) => setSpec((prev) => ({ ...prev, ...patch }))}
      activeTab={tab}
      tabHref={(t) => `#/spec-preview/${t}`}
      breadcrumbs={[{ label: "product-research", icon: FolderOpen }, { label: "Specs" }, { label: spec.title }]}
      initiatives={[{ id: "ini-preview", title: "Evidence anywhere" }]}
      onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
    />
  );
}

// The workspace document page with no folder behind it (#/workspace-doc-preview): starts with no
// file, so both states — the Create button and the editor — can be looked at. The text lands on
// window.__workspaceDoc after every change.
function WorkspaceDocPreviewDemo({ id }) {
  const doc = workspaceDocById(id) || WORKSPACE_DOCS[0];
  // A seeded document is never absent in a real workspace, so it previews as it is actually met:
  // already written, with the default in it.
  const [text, setText] = useState(() => (doc.seeded ? doc.template({ workspaceName: "product-research" }) : null));
  useEffect(() => { window.__workspaceDoc = text; }, [text]);
  return (
    <WorkspaceDocPage
      doc={doc}
      text={text}
      onCreate={() => setText(doc.template({ workspaceName: "product-research" }))}
      onChange={setText}
      onRemove={() => setText(null)}
      onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
    />
  );
}

// An initiative page on sample content (#/initiative-preview). The initiative lands on
// window.__initiative after every edit.
function InitiativePreviewDemo() {
  const [initiative, setInitiative] = useState(() => ({
    id: "ini-preview",
    title: "Evidence anywhere",
    status: "active",
    description: "Everything we learn should be able to leave the app with its sources attached.",
    outcomes: [
      { text: "Teams take evidence into their own tools instead of screenshotting boards", metric: "Weekly exports per active workspace", baseline: "0.4", target: "3", current: "1.1" },
      { text: "Specs cite the research they're built on", metric: "", baseline: "", target: "", current: "" },
    ],
    openQuestions: [
      { text: "Do exports need to stay live after the board changes, or is a snapshot enough for every spec under this initiative?", checked: false },
      { text: "Markdown only?", checked: true, resolution: "Yes, for every spec in this initiative." },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
  const [specs, setSpecs] = useState(() => [
    { id: "s1", title: "Export dialog", status: "active", updatedAt: 3 },
    { id: "s2", title: "Markdown export with sources", status: "shipped", updatedAt: 2 },
    { id: "s3", title: "Shareable read-only board link", status: "draft", updatedAt: 1 },
  ]);
  useEffect(() => { window.__initiative = initiative; }, [initiative]);
  const noop = () => {};
  return (
    <InitiativePage
      key="ini-preview"
      initiative={initiative}
      specs={specs}
      specHref={() => "#/spec-preview"}
      researchPlans={[{ id: "rp1", title: "Why exports get abandoned", status: "synthesis", initiativeId: "ini-preview" }]}
      researchPlanHref={() => "#/research-plan-preview"}
      onChange={(patch) => setInitiative((prev) => ({ ...prev, ...patch }))}
      onDelete={noop} onCreateSpec={noop}
      onDetachSpec={(id) => setSpecs((prev) => prev.filter((s) => s.id !== id))}
      breadcrumbs={[{ label: "product-research", icon: FolderOpen, onClick: noop }, { label: "Specs", href: "#" }, { label: initiative.title }]}
    />
  );
}

// The header's disk-changes log and the toast that opens it, on made-up changes
// (#/disk-log-preview) — the watcher needs a real folder.
function DiskLogPreviewDemo() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [at] = useState(() => Date.now());
  const log = [
    {
      id: "2", at, files: [
        { path: "3f2a9c1e/spec.md", kind: "spec", id: "s1", title: "Bulk export of evidence", removed: false },
        { path: "3f2a9c1e/plan.md", kind: "spec", id: "s1", title: "Bulk export of evidence", removed: false },
        { path: "signals/8d1b7e40.md", kind: "signal", id: "g1", title: "Three of the five researchers keep a separate spreadsheet of quotes…", removed: false },
        { path: "insights/c0ffee12.md", kind: "insight", id: "i1", title: null, removed: true },
      ],
    },
    { id: "1", at: at - 95000, files: [{ path: "DESIGN.md", kind: "workspaceDoc", id: "design-system", title: "Design system", removed: false }] },
  ];
  return (
    <>
      <Header saveStatus="saved" onRetrySave={() => {}} onChangeFolder={() => {}} diskLog={log} diskLogOpen={open} onDiskLogOpenChange={setOpen} diskLogHref={() => "#/disk-log-preview"} />
      <div style={{ padding: "24px" }}>
        <Button onClick={(e) => setToast({ id: e.timeStamp, message: "Updated 4 files from disk", onUndo: () => setOpen(true), actionLabel: "Show" })}>
          Fire the toast
        </Button>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

// Research Repository on mock data (#/research-preview) — the sandboxed preview can't open a
// workspace folder. One deliberately long signal is added so the fixed-height card's clamp has
// something to clamp. Signal edits land in local state; everything else is inert.
function ResearchPreviewDemo() {
  const [ws, setWs] = useState(() => {
    const mock = mockWorkspace(1);
    const now = Date.now();
    const long = {
      ...mock.signals[0],
      id: "preview-long-signal",
      text: "Three of the five researchers we spoke to keep a separate spreadsheet of quotes, because they don't trust that a signal will still be findable once it has been linked into a spec. Two of them said they re-read the whole board before every planning meeting just to be sure nothing was lost, and one described the search as \"only useful if you already remember the exact wording\".",
      date: now, createdAt: now, updatedAt: now,
    };
    return { ...mock, signals: [long, ...mock.signals] };
  });
  const updateSignal = (id, patch) =>
    setWs((prev) => ({ ...prev, signals: prev.signals.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const noop = () => {};
  return (
    <ResearchRepositoryPage
      boards={ws.researchPlans.map((p) => ({ ...p.board, title: p.title }))}
      signals={ws.signals} insights={ws.insights}
      researchPlans={ws.researchPlans} researchPlanHref={() => "#/research-plan-preview"}
      initialQuery="" initialKind="all" onNavigate={noop}
      boardCardHref={(boardId, cardId) => `#/research-plan-preview/analysis/${encodeURIComponent(cardId)}`}
      onCreateSignal={noop} onCreateInsight={noop} onCreateResearchPlan={noop}
      onUpdateSignal={updateSignal} onDeleteSignal={noop} onUpdateInsight={noop} onDeleteInsight={noop}
    />
  );
}

// The real board on sample data (#/board-preview[/<cardId>]) — the sandboxed preview can't open a
// workspace folder. Picks the sample research plan with the most connections, so the
// connect/rewire gestures (src/canvas) actually have something to exercise. Real local state
// (not no-ops) so the Spec column's create/link/rename round-trip is actually exercisable here.
function BoardPreviewDemo({ cardId }) {
  const [mock, setMock] = useState(() => mockWorkspace(1));
  const plan = useMemo(() => [...mock.researchPlans].sort((a, b) => b.board.connections.length - a.board.connections.length)[0], [mock.researchPlans]);
  const addSpec = (spec) => setMock((prev) => ({ ...prev, specs: [...prev.specs, spec] }));
  const updateSpec = (id, patch) => setMock((prev) => ({ ...prev, specs: prev.specs.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  return (
    <Page bleed style={{ fontFamily: font, height: "100dvh" }}>
      <Board
        key={plan.id}
        board={plan.board}
        onChange={(b) => { window.__board = b; }}
        allBoards={mock.researchPlans.map((p) => ({ ...p.board, title: p.title }))}
        onOpenBoard={() => {}}
        signals={mock.signals} insights={mock.insights}
        onUpdateSignal={() => {}} onCreateSignal={() => {}} onUpdateInsight={() => {}} onCreateInsight={() => {}}
        specs={mock.specs}
        onCreateSpec={addSpec} onUpdateSpec={updateSpec}
        specHref={() => "#/spec-preview"}
        onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
        highlightCardId={cardId}
      />
    </Page>
  );
}

// A research plan on sample data (#/research-plan-preview, #/research-plan-preview/analysis[/<cardId>]):
// both tabs — its questions linked to sample insights and its activities, and its board. Edits land
// in local state; the plan lands on window.__researchPlan.
function ResearchPlanPreviewDemo({ tab, cardId }) {
  const [ws, setWs] = useState(() => mockWorkspace(1));
  const plan = ws.researchPlans[0];
  useEffect(() => { window.__researchPlan = plan; }, [plan]);
  const here = () => "#/research-plan-preview";
  const noop = () => {};
  const update = (key) => (id, patch) => setWs((prev) => ({ ...prev, [key]: prev[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const create = (key) => (record) => setWs((prev) => ({ ...prev, [key]: [...prev[key], record] }));
  return (
    <ResearchPlanPage
      key={plan.id}
      plan={plan}
      signals={ws.signals} insights={ws.insights} specs={ws.specs} initiatives={ws.initiatives}
      boards={ws.researchPlans.map((p) => ({ ...p.board, title: p.title }))}
      activeTab={tab}
      tabHref={(t) => (t === "analysis" ? "#/research-plan-preview/analysis" : "#/research-plan-preview")}
      highlightCardId={cardId}
      onChange={(patch) => setWs((prev) => ({
        ...prev,
        researchPlans: prev.researchPlans.map((p) => (p.id === plan.id ? { ...p, ...patch } : p)),
      }))}
      onDelete={noop} onOpenBoard={noop}
      onCreateSignal={create("signals")} onUpdateSignal={update("signals")}
      onCreateInsight={create("insights")} onUpdateInsight={update("insights")}
      onCreateSpec={create("specs")} onUpdateSpec={update("specs")}
      onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
      specHref={here} insightHref={here}
      breadcrumbs={[{ label: "product-research", icon: FolderOpen }, { label: "Research Repository", href: "#/research-preview" }, { label: plan.title }]}
    />
  );
}

// What a load that moved old-format records into the current shape says about it: activities folded
// into research plans (lib/migrateActivities.js), and spec boards that the next save removes.
const migrationMessage = ({ activities = 0, specBoards = 0 }) => [
  activities ? `Moved ${activities} ${activities === 1 ? "activity" : "activities"} into research plans (originals kept in _migrated-activities/)` : "",
  specBoards ? `Removed ${specBoards} spec board${specBoards === 1 ? "" : "s"} — boards live on research plans now` : "",
].filter(Boolean).join(". ");
const shouldAnnounce = (record) => !!record.migration && (record.migration.activities > 0 || record.migration.specBoards > 0);
const wasMigrated = (record) => !!record.migration
  && (record.migration.activities > 0 || record.migration.sourcesDropped > 0 || record.migration.specBoards > 0);

// A signal or an insight can be linked onto many research plans' boards, each at its own position and
// wired to its own cards. These find, strip and restore those links, so deleting the record — and
// undoing that — touches every board the same way. `kind` is the board's array: "signals" or "insights".
const boardLinks = (plans, kind, id) => plans
  .filter((p) => (p.board?.[kind] || []).some((x) => x.id === id))
  .map((p) => ({
    planId: p.id,
    index: p.board[kind].findIndex((x) => x.id === id),
    connections: (p.board.connections || []).filter((c) => c.from === id || c.to === id),
  }));
const unlinkFromBoards = (plans, kind, id) => plans.map((p) => (
  (p.board?.[kind] || []).some((x) => x.id === id)
    ? {
        ...p,
        board: {
          ...p.board,
          [kind]: p.board[kind].filter((x) => x.id !== id),
          connections: (p.board.connections || []).filter((c) => c.from !== id && c.to !== id),
          updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }
    : p
));
const relinkOnBoards = (plans, kind, id, links) => plans.map((p) => {
  const link = links.find((l) => l.planId === p.id);
  if (!link || !p.board) return p;
  return {
    ...p,
    board: {
      ...p.board,
      [kind]: insertAt(p.board[kind] || [], link.index, { id }),
      connections: [...(p.board.connections || []), ...link.connections],
      updatedAt: Date.now(),
    },
  };
});

function ConnectScreen({ title, message, buttonLabel, onClick, icon: Icon }) {
  return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="enter-up" style={{ maxWidth: "380px", textAlign: "center" }}>
        {Icon && (
          <>
            {/* A slow breathing ring rather than a one-shot animation — this screen can sit
                on-screen for a while (waiting on a permission prompt, say), so it needs to read
                as "quietly alive", not as something that just happened. */}
            <style>{`
              @keyframes connect-icon-ring {
                0%, 100% { box-shadow: 0 0 0 0 ${withAlpha(INK, "00")}; }
                50% { box-shadow: 0 0 0 5px ${withAlpha(INK, "0A")}; }
              }
              .connect-icon-badge { animation: connect-icon-ring 2.6s ${MOTION.ease} infinite; }
            `}</style>
            <div
              className="connect-icon-badge"
              style={{
                width: "52px", height: "52px", margin: `0 auto ${SPACE.lg}`, borderRadius: RADIUS.lg,
                background: BG_HOVER, border: `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon size={22} color={INK_FAINT} strokeWidth={1.5} />
            </div>
          </>
        )}
        <div style={{ fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.lg, color: INK, marginBottom: SPACE.base }}>{title}</div>
        <div style={{ fontFamily: font, fontSize: SIZE.body, color: INK_SOFT, lineHeight: 1.5, marginBottom: buttonLabel ? "18px" : 0 }}>
          {message}
        </div>
        {buttonLabel && (
          <Button variant="primary" size="md" onClick={onClick} style={{ padding: "9px 18px" }}>
            {buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function NotFoundMessage({ text, backLabel, backHref }) {
  return (
    <div style={{ fontFamily: font, textAlign: "center", color: INK_SOFT, fontSize: SIZE.body, padding: "60px 0" }}>
      {text}{" "}
      <a href={backHref} style={{ fontFamily: font, color: INK, textDecoration: "underline" }}>
        {backLabel}
      </a>
    </div>
  );
}

export default function App() {
  // phase: checking -> (needsConnect | needsReconnect | unsupported) -> loading -> ready
  const [phase, setPhase] = useState("checking");
  // `dirHandle` is the workspace (monk/) every storage call works in; `rootHandle` the project it
  // sits in, or null when the connected folder is the workspace itself — see lib/fsPersistence.js.
  const [dirHandle, setDirHandle] = useState(null);
  const [rootHandle, setRootHandle] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  // Workspace documents by id (lib/workspaceDocs.js) — DESIGN.md today. `null` or absent means the
  // file doesn't exist; a string, even an empty one, means it does.
  const [workspaceDocs, setWorkspaceDocs] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [sections, setSections] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [signals, setSignals] = useState([]);
  const [insights, setInsights] = useState([]);
  // Activity files a load migrated in memory, which the next save moves out of the way once what
  // replaced them is on disk (see saveWorkspace).
  const [retiredActivityIds, setRetiredActivityIds] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [researchPlans, setResearchPlans] = useState([]);
  // Deletes happen immediately and report themselves here, with one chance to reverse — rather
  // than interrupting with a confirm dialog before every one. See ui/Toast.jsx.
  const [toast, setToast] = useState(null);
  // Every reload from disk this session, newest first — what the "Updated n files" toast is
  // summarising. See DiskChanges.jsx.
  const [diskLog, setDiskLog] = useState([]);
  const [diskLogOpen, setDiskLogOpen] = useState(false);
  const skipNextSaveRef = useRef(true);
  const route = useRoute();

  // on mount: reuse a previously-granted folder silently if permission is still live,
  // otherwise ask for a click — showDirectoryPicker/requestPermission both require one
  useEffect(() => {
    if (!fsAccessSupported) { setPhase("unsupported"); return; }
    (async () => {
      const stored = await getStoredConnection();
      if (!stored) { setPhase("needsConnect"); return; }
      if (await tryReuseHandle(permissionHandle(stored))) {
        setRootHandle(stored.root);
        setDirHandle(stored.workspace);
        setPhase("loading");
      } else {
        setPendingConnection(stored);
        setPhase("needsReconnect");
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== "loading" || !dirHandle) return;
    let cancelled = false;
    loadWorkspace(dirHandle)
      .then((record) => {
        if (cancelled) return;
        bumpNextId(record.researchPlans.map((p) => p.board));
        setSections(ensureFixedSections(record.sections));
        setSpecs(record.specs);
        setSignals(record.signals);
        setInsights(record.insights);
        setInitiatives(record.initiatives);
        setResearchPlans(record.researchPlans);
        setRetiredActivityIds(record.retiredActivityIds);
        setWorkspaceDocs(record.docs || {});
        // A workspace that still had activities was migrated in memory. Write that now instead of
        // skipping the post-load save as usual — otherwise the old files stay until your first
        // edit, and every reload migrates them again.
        if (wasMigrated(record)) {
          skipNextSaveRef.current = false;
          if (shouldAnnounce(record)) setToast({ id: Date.now(), message: migrationMessage(record.migration) });
        }
        setPhase("ready");
      })
      .catch((err) => {
        // Never fall through to "ready" on a failure. "Ready" means the app is showing what is on
        // disk, and autosave believes it: an empty workspace reached that way reads as "delete
        // everything". A load that did not finish has to be its own dead end, with nothing
        // written until someone retries it.
        if (cancelled) return;
        console.error("Failed to load the research folder:", err);
        setLoadError(err);
        setPhase("loadFailed");
      });
    return () => { cancelled = true; };
  }, [phase, dirHandle]);

  const workspace = useMemo(() => ({ sections, specs, signals, insights, initiatives, researchPlans, retiredActivityIds, docs: workspaceDocs }), [sections, specs, signals, insights, initiatives, researchPlans, retiredActivityIds, workspaceDocs]);

  // The one case where yanking the page out from under someone would be wrong: they are typing
  // into the very thing that just changed. Then we don't remount — we say so and let them choose.
  const [staleId, setStaleId] = useState(null);
  const openEntityRef = useRef(null);

  // debounced autosave: skip the one save that would otherwise immediately re-write the
  // data we just loaded from disk
  useEffect(() => {
    if (phase !== "ready" || !dirHandle) return;
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    setSaveStatus("saving");
    const t = setTimeout(() => {
      // The entity behind an unresolved "changed on disk" notice is not written until you
      // pick a version — see the `hold` note in saveWorkspace.
      saveWorkspace(dirHandle, workspace, { hold: staleId ? [staleId] : [] }).then(
        (conflicts) => {
          setSaveStatus(conflicts.length ? "conflict" : "saved");
          if (conflicts.length) {
            console.warn("Left alone — edited outside the app since we last wrote:", conflicts);
            // The folder is now ahead of what's on screen for those files. Pulling them back in
            // is exactly what the watcher does, and it is about to: the conflicting file differs
            // from the ledger, so it counts as an external change.
          }
        },
        (err) => { console.error("Failed to save the research folder:", err); setSaveStatus("error"); }
      );
    }, 700);
    return () => clearTimeout(t);
  }, [phase, dirHandle, workspace, staleId]);

  // Retrying the write on its own could never fix the thing that actually goes wrong here: the
  // folder permission lapses mid-session — Chrome drops it on its own schedule — and from then on
  // every autosave fails while your edits live only in memory. Reload at that point and they are
  // gone. So Retry re-asks for permission first. It can: this runs from a click, and
  // requestPermission needs exactly that user gesture, which is why it belongs here rather than
  // in the autosave path that has none.
  const retrySave = async () => {
    setSaveStatus("saving");
    try {
      if (!(await reconnectHandle(rootHandle || dirHandle))) { setSaveStatus("error"); return; }
      const conflicts = await saveWorkspace(dirHandle, workspace, { hold: staleId ? [staleId] : [] });
      setSaveStatus(conflicts.length ? "conflict" : "saved");
    } catch (err) {
      console.error("Failed to save the research folder:", err);
      setSaveStatus("error");
    }
  };

  // A cancelled picker throws AbortError, which is just "stay where you are". Anything else — the
  // monk/ folder couldn't be created, say — is worth a line in the console.
  const logPickError = (err) => { if (err?.name !== "AbortError") console.error("Couldn't connect the folder:", err); };

  const handleConnect = async () => {
    try {
      const connection = await pickFolder();
      setRootHandle(connection.root);
      setDirHandle(connection.workspace);
      setPhase("loading");
    } catch (err) {
      logPickError(err); // stay on the connect screen
    }
  };
  const handleReconnect = async () => {
    if (await reconnectHandle(permissionHandle(pendingConnection))) {
      setRootHandle(pendingConnection.root);
      setDirHandle(pendingConnection.workspace);
      setPhase("loading");
    }
  };
  const handleChangeFolder = async () => {
    try {
      const connection = await pickFolder();
      skipNextSaveRef.current = true; // skip the redundant re-save right after this fresh load
      setSections([]);
      setSpecs([]);
      setSignals([]);
      setInsights([]);
      setRetiredActivityIds([]);
      setInitiatives([]);
      setResearchPlans([]);
      setWorkspaceDocs({});
      setDiskLog([]);
      setDiskLogOpen(false);
      setRootHandle(connection.root);
      setDirHandle(connection.workspace);
      setPhase("loading");
      goToStart();
    } catch (err) {
      logPickError(err); // stay right where we are
    }
  };

  // Disconnects the current folder and drops back to the intro screen, rather than
  // immediately prompting for a new one the way handleChangeFolder does. Forgets the stored
  // handle too, so a reload doesn't silently reconnect to the folder just left.
  const handleDetachFolder = async () => {
    await clearStoredConnection();
    skipNextSaveRef.current = true;
    setSections([]);
    setSpecs([]);
    setSignals([]);
    setInsights([]);
    setRetiredActivityIds([]);
    setInitiatives([]);
    setResearchPlans([]);
    setWorkspaceDocs({});
    setDiskLog([]);
    setDiskLogOpen(false);
    setRootHandle(null);
    setDirHandle(null);
    setPendingConnection(null);
    setLoadError(null);
    setPhase("needsConnect");
    goToStart();
  };

  // The project's name — the repo Monk was connected to — or, with no known root, the connected
  // folder's own name.
  const projectName = rootHandle?.name || dirHandle?.name || "";

  const showToast = (message, onUndo, actionLabel) => setToast({ id: Date.now(), message, onUndo, actionLabel });
  const dismissToast = () => setToast(null);

  // A per-entity revision, bumped when that entity's files change on disk.
  //
  // Every detail page copies its fields into local state on mount and is re-seeded only by
  // remounting — that's what lets you type in one without every keystroke round-tripping through
  // the app, and it's also why simply putting fresh data in state leaves an open page showing the
  // old text. The revision rides in the page's `key`, so an entity that changed underneath us
  // remounts and re-reads, and one that didn't is left alone mid-edit.
  const [diskRev, setDiskRev] = useState({});
  const revKey = (id) => `${id}:${diskRev[id] || 0}`;
  const bumpRev = (ids) => setDiskRev((prev) => {
    const next = { ...prev };
    for (const id of ids) next[id] = (next[id] || 0) + 1;
    return next;
  });


  // On attach: make sure an agent landing here cold finds the schema (MONK.md), the writing
  // guide beside it (WRITING.md) and a briefing.
  // Where the folder already has an AGENTS.md or CLAUDE.md of its own we write nothing and ask
  // instead — see ensureAgentGuides. A "no" is remembered per folder, so it is a question, not a
  // recurring prompt.
  const [agentGuide, setAgentGuide] = useState(null);
  // Keyed by project as well: every connected project's workspace is called monk/, so the folder
  // name alone would carry one project's "no" over to the next.
  const declinedKey = dirHandle ? `monk:agents-declined:${rootHandle ? `${rootHandle.name}/` : ""}${dirHandle.name}` : null;

  useEffect(() => {
    if (phase !== "ready" || !dirHandle) return;
    let cancelled = false;
    ensureAgentGuides(dirHandle)
      .then((result) => {
        if (cancelled) return;
        // A seeded document (WRITING.md) may have just been written, after the load that filled
        // this state read the folder without one. Take what it returned rather than waiting for
        // the watcher to report our own write — but never over text already in hand, which came
        // from the file itself and may since have been typed into.
        setWorkspaceDocs((prev) => {
          const pending = Object.entries(result.seeded || {})
            .filter(([id, text]) => typeof text === "string" && typeof prev[id] !== "string");
          return pending.length ? { ...prev, ...Object.fromEntries(pending) } : prev;
        });
        if (result.created || result.linked || !result.existing) return;
        let declined = false;
        try { declined = localStorage.getItem(declinedKey) === "1"; } catch { /* private mode */ }
        if (!declined) setAgentGuide(result.existing);
      })
      .catch((err) => console.error("Couldn't write the agent guides:", err));
    return () => { cancelled = true; };
  }, [phase, dirHandle, declinedKey]);

  const acceptAgentSection = () => {
    const name = agentGuide;
    setAgentGuide(null);
    addAgentSection(dirHandle, name)
      .then(() => showToast(`Added a Monk section to ${name}`))
      .catch((err) => { console.error("Couldn't update " + name + ":", err); showToast(`Couldn't update ${name}`); });
  };

  const declineAgentSection = () => {
    setAgentGuide(null);
    try { localStorage.setItem(declinedKey, "1"); } catch { /* private mode — ask again next time */ }
  };

  // Any navigation retires the cue. The page it was protecting unmounts on the way out and
  // re-seeds from current data on the way back, so by then the offer to load a newer version
  // would be describing something that has already happened. Cleared from the event rather than
  // from an effect on the route: this is a thing that happens *when you navigate*, not a value
  // derived from where you are.
  useEffect(() => {
    const clear = () => setStaleId(null);
    window.addEventListener("hashchange", clear);
    return () => window.removeEventListener("hashchange", clear);
  }, []);


  // Someone else — an agent, an editor, a git checkout — writing into the connected folder.
  // `watchWorkspace` waits for the writing to stop before telling us, so a run that touches six
  // files arrives as one reload rather than six. We re-read the whole workspace rather than
  // patching the changed paths in: loading is what the app already knows how to do, and a burst
  // that adds a spec, edits two others and rewrites a board is one coherent state, not four.
  //
  // `skipNextSaveRef` matters here as much as it does on connect — without it the state we just
  // adopted from disk would immediately be written back over the top of it.
  useEffect(() => {
    if (phase !== "ready" || !dirHandle) return;
    if (!canWatchWorkspace()) {
      // Chromium has FileSystemObserver; other engines that support the File System Access API
      // may not. Everything else still works — the folder just won't refresh on its own.
      console.info("This browser can't watch the research folder; changes made outside the app will appear on reload.");
      return;
    }
    return watchWorkspace(dirHandle, (changed) => {
      loadWorkspace(dirHandle)
        .then((record) => {
          skipNextSaveRef.current = true;
          bumpNextId(record.researchPlans.map((p) => p.board));
          setSections(ensureFixedSections(record.sections));
          setSpecs(record.specs);
          setSignals(record.signals);
          setInsights(record.insights);
          setInitiatives(record.initiatives);
          setResearchPlans(record.researchPlans);
          setRetiredActivityIds(record.retiredActivityIds);
          setWorkspaceDocs(record.docs || {});
          setSaveStatus("saved");
          // An old-format activity that arrived from outside was migrated on this load; write it.
          if (wasMigrated(record)) skipNextSaveRef.current = false;

          const touched = entityIdsFor(changed);
          const open = openEntityRef.current;
          const typingHere = open
            && touched.has(open)
            && document.activeElement
            && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
          if (typingHere) {
            touched.delete(open);
            setStaleId(open);
          }
          bumpRev(touched);
          setDiskLog((prev) => [{ id: `${Date.now()}:${prev.length}`, at: Date.now(), files: describeChanges(changed, record) }, ...prev].slice(0, 50));
          showToast(
            shouldAnnounce(record) ? migrationMessage(record.migration)
              : changed.length === 1 ? "Updated 1 file from disk" : `Updated ${changed.length} files from disk`,
            () => setDiskLogOpen(true),
            "Show",
          );
        })
        .catch((err) => console.error("Failed to re-read the research folder:", err));
    });
  }, [phase, dirHandle]);

  // Workspace documents (DESIGN.md today — see lib/workspaceDocs.js). Creating and removing one are
  // explicit calls into storage, not state changes an autosave infers: a save only ever updates a
  // file that already exists, so neither can happen by accident.
  const createWorkspaceDocument = async (id, content) => {
    const doc = workspaceDocById(id);
    if (!doc || !dirHandle) return;
    try {
      const result = await createWorkspaceDoc(dirHandle, id, content ?? doc.template({ workspaceName: projectName }));
      setWorkspaceDocs((prev) => ({ ...prev, [id]: result.text }));
      bumpRev([id]);
      if (!result.created) showToast(`${doc.file} already existed, so it was opened instead`);
    } catch (err) {
      console.error(`Couldn't create ${doc.file}:`, err);
      showToast(`Couldn't create ${doc.file}`);
    }
  };
  const updateWorkspaceDocument = (id, text) => setWorkspaceDocs((prev) => ({ ...prev, [id]: text }));
  const removeWorkspaceDocument = async (id) => {
    const doc = workspaceDocById(id);
    const text = workspaceDocs[id];
    if (!doc || !dirHandle || typeof text !== "string") return;
    try {
      const result = await removeWorkspaceDoc(dirHandle, id);
      if (result === "conflict") {
        showToast(`${doc.file} changed on disk, so it wasn't removed`);
        return;
      }
      setWorkspaceDocs((prev) => ({ ...prev, [id]: null }));
      // Undo writes back what was on screen, unsaved typing included — and like any create, yields
      // to a file that has appeared in the meantime.
      showToast(`Removed ${doc.file}`, () => createWorkspaceDocument(id, text));
    } catch (err) {
      console.error(`Couldn't remove ${doc.file}:`, err);
      showToast(`Couldn't remove ${doc.file}`);
    }
  };

  const createSection = () => setSections((prev) => [...prev, blankSection()]);
  // Product Knowledge and Standards are fixed — the Sidebar itself doesn't offer rename/delete
  // for them, but these guard here too rather than trusting that alone.
  const renameSection = (id, name) => {
    if (isFixedSection(id)) return;
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name, updatedAt: Date.now() } : s)));
  };
  const deleteSection = (id) => {
    if (isFixedSection(id)) return;
    const index = sections.findIndex((s) => s.id === id);
    const section = sections[index];
    if (!section) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (route.name === "doc" && route.sectionId === id) goToStart();
    const count = section.documents.length;
    showToast(
      `Deleted "${section.name || "Untitled section"}"${count ? ` and ${count} document${count === 1 ? "" : "s"}` : ""}`,
      () => setSections((prev) => insertAt(prev, index, section))
    );
  };
  const createDocument = (sectionId) => {
    const doc = blankDocument();
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, documents: [...s.documents, doc], updatedAt: Date.now() } : s)));
    goToDocument(sectionId, doc.id);
  };
  const updateDocument = (sectionId, docId, patch) =>
    setSections((prev) => prev.map((s) => (
      s.id === sectionId
        ? { ...s, documents: s.documents.map((d) => (d.id === docId ? { ...d, ...patch, updatedAt: Date.now() } : d)) }
        : s
    )));
  const deleteDocument = (sectionId, docId) => {
    const section = sections.find((s) => s.id === sectionId);
    const index = section?.documents.findIndex((d) => d.id === docId) ?? -1;
    const doc = index >= 0 ? section.documents[index] : null;
    if (!doc) return;
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, documents: s.documents.filter((d) => d.id !== docId) } : s)));
    if (route.name === "doc" && route.sectionId === sectionId && route.docId === docId) goToStart();
    showToast(
      `Deleted "${doc.title || "Untitled document"}"`,
      () => setSections((prev) => prev.map((s) => (
        s.id === sectionId ? { ...s, documents: insertAt(s.documents, index, doc) } : s
      )))
    );
  };

  // A source's uploaded file lives on disk under the record's own folder — "<spec-id>/sources/",
  // "research-plans/<id>/sources/" or "initiatives/<id>/sources/" (storage.js). Upload and
  // removal go straight to disk rather than waiting on the debounced autosave (see storage.js
  // uploadSourceFile); only the file's *name* is state (in the record's `sources` list), saved
  // the normal way.
  const sourceBase = (kind, id) => (kind === "spec" ? id : kind === "researchPlan" ? `research-plans/${id}` : `initiatives/${id}`);
  const uploadSource = (kind, id) => async (file) => {
    if (!dirHandle) throw new Error("Not connected to a workspace.");
    return uploadSourceFile(dirHandle, sourceBase(kind, id), file);
  };
  const removeSource = (kind, id) => (name) => {
    if (!dirHandle) return;
    removeSourceFile(dirHandle, sourceBase(kind, id), name).catch((err) => console.error("Couldn't remove source file:", err));
  };
  const openSource = (kind, id) => async (name) => {
    if (!dirHandle) return;
    try {
      const file = await readSourceFile(dirHandle, sourceBase(kind, id), name);
      const url = URL.createObjectURL(file);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Couldn't open source file:", err);
      showToast("Couldn't open that file");
    }
  };

  // A spec's sketches are the same two calls against the spec's own `sketches/` folder. Reading
  // one hands the File straight back rather than making a blob URL here: the Solution tab holds a
  // thumbnail open for as long as it's on screen, so it owns the URL's lifetime (DesignTab
  // useSketchUrl). There's no remove call — taking a sketch off the page leaves its file in the
  // folder so Undo can bring the whole sketch back, not a line pointing at nothing.
  const uploadSketch = (id) => async (file) => {
    if (!dirHandle) throw new Error("Not connected to a workspace.");
    return uploadSourceFile(dirHandle, id, file, SKETCHES_DIR);
  };
  const readSketch = (id) => (name) => {
    if (!dirHandle) return Promise.reject(new Error("Not connected to a workspace."));
    return readSourceFile(dirHandle, id, name, SKETCHES_DIR);
  };

  const isSpecRoute = route.name === "spec" || route.name === "specDesign" || route.name === "specPlan";

  const createSpec = (initiativeId = null) => {
    const spec = blankSpec("Untitled spec", initiativeId);
    setSpecs((prev) => [...prev, spec]);
    goToSpec(spec.id);
  };
  const updateSpec = (id, patch) =>
    setSpecs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
  // A research plan's board can also start a spec (its Analysis tab's Spec column) — created
  // in place there, already carrying the plan in `researchPlanIds`, same "already a complete
  // object" pattern as createSignal/createInsight.
  const addSpec = (spec) => setSpecs((prev) => [...prev, spec]);
  const deleteSpec = (id) => {
    const index = specs.findIndex((s) => s.id === id);
    const spec = specs[index];
    if (!spec) return;
    setSpecs((prev) => prev.filter((s) => s.id !== id));
    if (isSpecRoute && route.id === id) goToSpecs();
    showToast(
      `Deleted "${spec.title || "Untitled spec"}"`,
      () => setSpecs((prev) => insertAt(prev, index, spec))
    );
  };

  // An initiative is the layer above specs (see initiativeModel.js) — an epic to their tickets.
  // A spec carries an optional `initiativeId`; "specs under this initiative" is a derived
  // filter, never a stored list. Created blank and you land straight on its own page, same
  // flow as createSpec.
  const createInitiative = () => {
    const initiative = blankInitiative();
    setInitiatives((prev) => [...prev, initiative]);
    goToInitiative(initiative.id);
  };
  const updateInitiative = (id, patch) =>
    setInitiatives((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)));
  const deleteInitiative = (id) => {
    const index = initiatives.findIndex((i) => i.id === id);
    const initiative = initiatives[index];
    if (!initiative) return;
    // Detach its specs (clear their initiativeId) rather than deleting them — the specs still
    // stand on their own. Undo re-assigns exactly the ones that were detached.
    const detachedIds = specs.filter((s) => s.initiativeId === id).map((s) => s.id);
    // Research plans under it are detached the same way.
    const detachedPlanIds = researchPlans.filter((p) => p.initiativeId === id).map((p) => p.id);

    setInitiatives((prev) => prev.filter((i) => i.id !== id));
    setSpecs((prev) => prev.map((s) => (s.initiativeId === id ? { ...s, initiativeId: null, updatedAt: Date.now() } : s)));
    setResearchPlans((prev) => prev.map((p) => (p.initiativeId === id ? { ...p, initiativeId: null, updatedAt: Date.now() } : p)));
    if (route.name === "initiative" && route.id === id) goToSpecs();

    const kept = detachedIds.length ? ` — ${detachedIds.length} spec${detachedIds.length === 1 ? "" : "s"} kept` : "";
    showToast(`Deleted "${initiative.title || "Untitled initiative"}"${kept}`, () => {
      setInitiatives((prev) => insertAt(prev, index, initiative));
      setSpecs((prev) => prev.map((s) => (detachedIds.includes(s.id) ? { ...s, initiativeId: id } : s)));
      setResearchPlans((prev) => prev.map((p) => (detachedPlanIds.includes(p.id) ? { ...p, initiativeId: id } : p)));
    });
  };

  // A research plan is the study behind a set of signals (see researchPlanModel.js). Created blank
  // and opened, like an initiative — except when it's made from somewhere else (a spec linking a
  // new plan, or handing it an open question), where it's created in place and its id handed back.
  const createResearchPlan = ({ navigate = true, questions = [] } = {}) => {
    const plan = blankResearchPlan();
    plan.researchQuestions = questions.map((text) => ({ text, insightIds: [] }));
    setResearchPlans((prev) => [...prev, plan]);
    if (navigate) goToResearchPlan(plan.id);
    return plan.id;
  };
  const updateResearchPlan = (id, patch) =>
    setResearchPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
  // A spec's open question handed to a plan. Undo takes back exactly the row that was added, found
  // by identity, so anything else written into the plan since is left alone.
  const addResearchQuestion = (planId, text) => {
    const plan = researchPlans.find((p) => p.id === planId);
    if (!plan) return;
    const question = { text, insightIds: [] };
    updateResearchPlan(planId, { researchQuestions: [...(plan.researchQuestions || []), question] });
    showToast(`Added to "${plan.title || "Untitled research plan"}"`, () => setResearchPlans((prev) => prev.map((p) => (
      p.id === planId ? { ...p, researchQuestions: p.researchQuestions.filter((q) => q !== question) } : p
    ))));
  };
  const deleteResearchPlan = (id) => {
    const index = researchPlans.findIndex((p) => p.id === id);
    const plan = researchPlans[index];
    if (!plan) return;
    // Its board goes with it; the signals and insights on the board are global records and stay in
    // the repository. The specs that cite it are detached, and Undo re-attaches exactly those.
    const citingSpecIds = specs.filter((s) => (s.researchPlanIds || []).includes(id)).map((s) => s.id);
    const onBoard = (plan.board?.signals || []).length;

    setResearchPlans((prev) => prev.filter((p) => p.id !== id));
    setSpecs((prev) => prev.map((s) => (
      (s.researchPlanIds || []).includes(id) ? { ...s, researchPlanIds: s.researchPlanIds.filter((x) => x !== id), updatedAt: Date.now() } : s
    )));
    if (route.name === "researchPlan" && route.id === id) goToResearch();

    const kept = onBoard ? ` — its ${onBoard} signal${onBoard === 1 ? "" : "s"} stay in the repository` : "";
    showToast(`Deleted "${plan.title || "Untitled research plan"}"${kept}`, () => {
      setResearchPlans((prev) => insertAt(prev, index, plan));
      setSpecs((prev) => prev.map((s) => (
        citingSpecIds.includes(s.id) && !(s.researchPlanIds || []).includes(id) ? { ...s, researchPlanIds: [...(s.researchPlanIds || []), id] } : s
      )));
    });
  };
  // Signals are global, workspace-wide records (see signalModel.js) — created from Research
  // Repository or on a research plan's board, then linked (never copied) onto any number of plans'
  // boards. `signal` here already arrives as a complete object, built off blankSignal().
  const createSignal = (signal) => setSignals((prev) => [...prev, signal]);
  const updateSignal = (id, patch) =>
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
  const deleteSignal = (id) => {
    const index = signals.findIndex((s) => s.id === id);
    const signal = signals[index];
    if (!signal) return;
    // Captured before anything is removed, so Undo can put each board's link back where it was.
    const links = boardLinks(researchPlans, "signals", id);

    setSignals((prev) => prev.filter((s) => s.id !== id));
    setResearchPlans((prev) => unlinkFromBoards(prev, "signals", id));

    const where = links.length ? ` and unlinked it from ${links.length} research plan${links.length === 1 ? "" : "s"}` : "";
    showToast(`Deleted signal${where}`, () => {
      setSignals((prev) => insertAt(prev, index, signal));
      setResearchPlans((prev) => relinkOnBoards(prev, "signals", id, links));
    });
  };

  // Insights are global, workspace-wide records too (see insightModel.js) — formed from signals in
  // Research Repository or on a plan's board, then linked onto any number of plans' boards.
  // Structurally identical to the signal handlers above, plus the research questions an insight
  // answers, which lose it too.
  const createInsight = (insight) => setInsights((prev) => [...prev, insight]);
  const updateInsight = (id, patch) =>
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)));
  const deleteInsight = (id) => {
    const index = insights.findIndex((i) => i.id === id);
    const insight = insights[index];
    if (!insight) return;
    const links = boardLinks(researchPlans, "insights", id);
    // …and every research question it answers, at its place in that question's list.
    const questionLinks = researchPlans.flatMap((p) => (p.researchQuestions || []).flatMap((q, question) => {
      const at = (q.insightIds || []).indexOf(id);
      return at === -1 ? [] : [{ planId: p.id, question, index: at }];
    }));

    setInsights((prev) => prev.filter((i) => i.id !== id));
    setResearchPlans((prev) => unlinkFromBoards(prev, "insights", id).map((p) => (
      (p.researchQuestions || []).some((q) => (q.insightIds || []).includes(id))
        ? { ...p, researchQuestions: p.researchQuestions.map((q) => ({ ...q, insightIds: (q.insightIds || []).filter((x) => x !== id) })), updatedAt: Date.now() }
        : p
    )));

    const where = links.length ? ` and unlinked it from ${links.length} research plan${links.length === 1 ? "" : "s"}` : "";
    showToast(`Deleted insight${where}`, () => {
      setInsights((prev) => insertAt(prev, index, insight));
      setResearchPlans((prev) => relinkOnBoards(prev, "insights", id, links).map((p) => {
        const mine = questionLinks.filter((l) => l.planId === p.id);
        if (!mine.length) return p;
        return {
          ...p,
          researchQuestions: p.researchQuestions.map((q, question) => {
            const link = mine.find((l) => l.question === question);
            return link && !(q.insightIds || []).includes(id) ? { ...q, insightIds: insertAt(q.insightIds || [], link.index, id) } : q;
          }),
        };
      }));
    });
  };

  const activeSection = route.name === "doc" ? sections.find((s) => s.id === route.sectionId) : null;
  const activeDocument = activeSection ? activeSection.documents.find((d) => d.id === route.docId) : null;
  const activeSpec = isSpecRoute ? specs.find((s) => s.id === route.id) : null;
  const activeInitiative = route.name === "initiative" ? initiatives.find((i) => i.id === route.id) : null;
  // The initiative a spec belongs to (if any) — its title threads into the spec's breadcrumb.
  const specInitiative = activeSpec ? initiatives.find((i) => i.id === activeSpec.initiativeId) : null;
  const activeResearchPlan = route.name === "researchPlan" ? researchPlans.find((p) => p.id === route.id) : null;
  const activeWorkspaceDoc = route.name === "workspaceDoc" ? workspaceDocById(route.id) : null;
  const activeSpecTab = route.name === "specDesign" ? "design" : route.name === "specPlan" ? "plan" : "overview";
  // Boards belong to research plans — this is the flat, board-shaped view every cross-board reference
  // (`resolveRef`) and the Research Repository search need, each one labelled with the plan that owns
  // it since a board carries no name of its own.
  const allBoards = useMemo(() => researchPlans.filter((p) => p.board).map((p) => ({ ...p.board, title: p.title })), [researchPlans]);

  // Which fixed sidebar entry reads as "active" — a spec doesn't have its own nav row, so it
  // highlights the section it belongs under. An activity is reached through Research
  // Repository the same way, so it highlights that instead. The Home landing matches neither,
  // so nothing lights up there — it's not "inside" Research Repository or Specs.
  const activeView = route.name === "doc" ? { type: "doc", sectionId: route.sectionId, docId: route.docId }
    : (route.name === "specs" || isSpecRoute || route.name === "initiative") ? { type: "specs" }
    : (route.name === "research" || route.name === "researchPlan") ? { type: "research" }
    : route.name === "workspaceDoc" ? { type: "workspaceDoc", id: route.id }
    : { type: "home" };

  // Every trail is rooted in the folder the data actually lives in — everything below it is a
  // path *within* that folder, so it belongs at the front. Clicking it re-opens the folder
  // picker (the same thing "Change folder" does in the corner), because the place you're most
  // likely to want to switch folders is while looking at which one you're in.
  // Where a "Recently touched" row on the start page goes. Signals and insights have no page
  // of their own — they're read and edited in the Research Repository — so they land there.
  const recentHref = (kind, id) => (
    kind === "spec" ? hrefSpec(id)
    : kind === "initiative" ? hrefInitiative(id)
    : kind === "researchPlan" ? hrefResearchPlan(id)
    : RESEARCH_ROUTE
  );

  // Where a row in the disk-changes log links. A section has no page of its own (its documents
  // do), so it doesn't link.
  const diskLogHref = (kind, id) => (
    kind === "workspaceDoc" ? hrefWorkspaceDoc(id)
    : kind === "section" ? null
    : recentHref(kind, id)
  );

  // The project comes first: that's the thing you need to recognise. The monk/ folder inside it is
  // the same in every project, so it's only in the tooltip.
  const folderCrumb = {
    label: projectName || "Repository",
    onClick: handleChangeFolder,
    icon: FolderOpen,
    title: rootHandle
      ? `Working in ${rootHandle.name}/${dirHandle?.name} — switch to a different project`
      : "Switch to a different repository",
  };

  // `null` (Home) means no breadcrumb bar at all — it's a standalone landing, not a page you
  // drill into from somewhere else.
  const breadcrumbs = route.name === "doc"
    ? [folderCrumb, { label: activeSection ? (activeSection.name || "Untitled section") : "Section not found" }, { label: activeDocument ? (activeDocument.title || "Untitled document") : "Document not found" }]
    : isSpecRoute
    ? [
        folderCrumb,
        { label: "Specs", href: hrefSpecs() },
        ...(specInitiative ? [{ label: specInitiative.title || "Untitled initiative", href: hrefInitiative(specInitiative.id) }] : []),
        { label: activeSpec ? (activeSpec.title || "Untitled spec") : "Spec not found" },
      ]
    : route.name === "initiative"
    ? [folderCrumb, { label: "Specs", href: hrefSpecs() }, { label: activeInitiative ? (activeInitiative.title || "Untitled initiative") : "Initiative not found" }]
    : route.name === "specs"
    ? [folderCrumb, { label: "Specs" }]
    : route.name === "researchPlan"
    ? [folderCrumb, { label: "Research Repository", href: RESEARCH_ROUTE }, { label: activeResearchPlan ? (activeResearchPlan.title || "Untitled research plan") : "Research plan not found" }]
    : route.name === "research"
    ? [folderCrumb, { label: "Research Repository" }]
    : route.name === "workspaceDoc"
    ? [folderCrumb, { label: activeWorkspaceDoc ? activeWorkspaceDoc.label : "Not found" }]
    : null;

  // Which entity the detail pane is showing, for the watcher — it runs long before these are
  // computed, so it reads them through a ref rather than closing over them. Navigating away
  // retires any "changed on disk" cue with it: the page you were protecting isn't open now, and
  // the reload it was offering already happened for everything else.
  const openEntity = (activeSpec && activeSpec.id)
    || (activeDocument && activeDocument.id)
    || (activeInitiative && activeInitiative.id)
    || (activeResearchPlan && activeResearchPlan.id)
    || (activeWorkspaceDoc && activeWorkspaceDoc.id)
    || null;
  useEffect(() => {
    openEntityRef.current = openEntity;
  }, [openEntity]);

  // Keep the browser tab title current — otherwise every route reads "Monk" and the tab / a
  // shared link / a history entry can't be told apart.
  useEffect(() => {
    const name =
      route.name === "doc" ? (activeDocument ? (activeDocument.title || "Untitled document") : "Document not found")
      : isSpecRoute ? (activeSpec ? (activeSpec.title || "Untitled spec") : "Spec not found")
      : route.name === "initiative" ? (activeInitiative ? (activeInitiative.title || "Untitled initiative") : "Initiative not found")
      : route.name === "researchPlan" ? (activeResearchPlan ? (activeResearchPlan.title || "Untitled research plan") : "Research plan not found")
      : route.name === "specs" ? "Specs"
      : route.name === "research" ? "Research Repository"
      : route.name === "workspaceDoc" ? (activeWorkspaceDoc ? activeWorkspaceDoc.label : "Not found")
      : "";
    document.title = name ? `${name} · Monk` : "Monk";
  }, [route, isSpecRoute, activeDocument, activeSpec, activeInitiative, activeResearchPlan, activeWorkspaceDoc]);

  // Activities were folded into research plans (lib/migrateActivities.js). An old #/activity/<id>
  // link — in a doc, a bookmark, a commit message — lands on the plan that activity became, if it
  // became one, and on the Research Repository otherwise.
  useEffect(() => {
    if (phase !== "ready" || route.name !== "activity") return;
    const plan = researchPlans.find((p) => p.id === route.id);
    window.location.replace(plan ? hrefResearchPlan(plan.id) : RESEARCH_ROUTE);
  }, [phase, route.name, route.id, researchPlans]);

  // Dev-only: the start page populated with mock data, no folder needed.
  if (import.meta.env.DEV && route.name === "homePreview") {
    const mock = mockWorkspace(1);
    return (
      <div style={{ fontFamily: font, height: "100dvh", overflowY: "auto" }}>
        <Home {...mock} recentHref={(kind, id) => recentHref(kind, id)} folderName="product-research" subfolder="monk" onChangeFolder={() => {}} />
      </div>
    );
  }

  // Dev-only: the Specs page on mock data (#/specs-preview), no folder needed.
  if (import.meta.env.DEV && route.name === "specsPreview") {
    const mock = mockWorkspace(1);
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <SpecsPage
          specs={mock.specs} initiatives={mock.initiatives}
          specHref={() => "#/spec-preview"} initiativeHref={() => "#/initiative-preview"}
          onCreate={() => {}} onCreateInitiative={() => {}} onDelete={() => {}}
        />
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "initiativePreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <InitiativePreviewDemo />
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "diskLogPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <DiskLogPreviewDemo />
      </div>
    );
  }

  // The real Solution tab on sample content, framed in a stand-in spec header so it reads in
  // context — the sandboxed preview can't open a workspace folder. Every edit's serialized
  // design.md lands on window.__designMd for inspection.
  // The real board on sample data — the sandboxed preview can't open a workspace folder. Picks the
  // sample research plan with the most connections, so the connect/rewire gestures (src/canvas)
  // actually have something to exercise.
  if (import.meta.env.DEV && route.name === "boardPreview") {
    return <BoardPreviewDemo cardId={route.cardId} />;
  }

  if (import.meta.env.DEV && route.name === "researchPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <ResearchPreviewDemo />
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "researchPlanPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <ResearchPlanPreviewDemo tab={route.tab} cardId={route.cardId} />
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "workspaceDocPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        {/* Keyed: the demo seeds its text from the document it was given, so switching
            documents in the hash has to start it over rather than hand DESIGN.md the text of
            the file you were just looking at. */}
        <WorkspaceDocPreviewDemo key={route.id} id={route.id} />
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "specPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <SpecPreviewDemo tab={route.tab} />
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "designPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 40px 0", flexShrink: 0 }}>
          <div style={{ fontFamily: font, fontSize: "26px", fontWeight: WEIGHT.semibold, color: INK, letterSpacing: "-0.01em" }}>Bulk export of evidence</div>
          <div style={{ display: "flex", gap: "18px", borderBottom: "1px solid var(--border)", marginTop: "18px" }}>
            {["Overview", "Solution", "Plan"].map((t) => (
              <span key={t} style={{ fontSize: SIZE.ui, fontWeight: WEIGHT.semibold, padding: "8px 2px", color: t === "Solution" ? INK : "var(--ink-faint)", boxShadow: t === "Solution" ? `inset 0 -2px 0 ${INK}` : "none" }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Page ground="reading">
            <div className="paper-sheet">
              <DesignPreviewDemo />
            </div>
          </Page>
        </div>
      </div>
    );
  }

  if (phase === "unsupported") {
    return (
      <ConnectScreen
        title="Browser not supported"
        message="Monk stores your research as files in a folder you pick, which needs the File System Access API — available in Chrome, Edge, and other Chromium-based browsers, but not Firefox or Safari."
      />
    );
  }
  if (phase === "checking") {
    return <ConnectScreen title="Monk" message="Checking for a connected repository…" />;
  }
  if (phase === "needsConnect") {
    return (
      <ConnectScreen
        icon={FolderGit2}
        title="Connect your repository"
        message="Pick your project's repo. Monk keeps its files in a monk/ folder inside it — plain markdown you can read, grep, and commit like any other file."
        buttonLabel="Connect folder"
        onClick={handleConnect}
      />
    );
  }
  if (phase === "needsReconnect") {
    return (
      <ConnectScreen
        icon={FolderGit2}
        title="Reconnect your repository"
        message="Permission to read and write your repository needs to be re-granted after a browser restart."
        buttonLabel="Reconnect folder"
        onClick={handleReconnect}
      />
    );
  }
  if (phase === "loading") {
    return <ConnectScreen title="Monk" message="Loading your repository…" />;
  }
  if (phase === "loadFailed") {
    return (
      <ConnectScreen
        title="Couldn't read your repository"
        message={`Nothing has been changed on disk. ${loadError ? loadError.message : ""}`.trim()}
        buttonLabel="Try again"
        onClick={() => { setLoadError(null); setPhase("loading"); }}
      />
    );
  }

  return (
    <div style={{ fontFamily: font, height: "100dvh", display: "flex", flexDirection: "column" }}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header
        saveStatus={saveStatus}
        onRetrySave={retrySave}
        onChangeFolder={handleChangeFolder}
        onDetachFolder={handleDetachFolder}
        diskLog={diskLog}
        diskLogOpen={diskLogOpen}
        onDiskLogOpenChange={setDiskLogOpen}
        diskLogHref={diskLogHref}
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Sidebar
          sections={sections}
          workspaceDocs={WORKSPACE_DOCS.map((d) => ({ id: d.id, label: d.label, href: hrefWorkspaceDoc(d.id), exists: typeof workspaceDocs[d.id] === "string" }))}
          activeView={activeView}
          researchHref={RESEARCH_ROUTE}
          specsHref={hrefSpecs()}
          docHref={hrefDocument}
          onCreateSection={createSection}
          onRenameSection={renameSection}
          onDeleteSection={deleteSection}
          onCreateDocument={createDocument}
          onDeleteDocument={deleteDocument}
        />
        <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* SpecPage builds its own header (breadcrumbs + left-aligned title + full-width tab
              bar) rather than sitting under this generic bar — skip it there to avoid showing
              the same breadcrumb trail twice. `breadcrumbs` is null on the Home landing, which
              has no bar of its own either — it's a standalone page, not one you drill into. */}
          {!((isSpecRoute && activeSpec) || (route.name === "initiative" && activeInitiative) || (route.name === "researchPlan" && activeResearchPlan)) && breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
          {/* The one thing the watcher won't do behind your back. Everything else on disk has
              already been taken; this page was left as it is because you were typing in it. */}
          {staleId && staleId === openEntity && (
            <Notice
              icon={RefreshCw}
              actionLabel="Load the newer version"
              onAction={() => { bumpRev([staleId]); setStaleId(null); }}
              onDismiss={() => setStaleId(null)}
            >
              This changed on disk while you were editing.
            </Notice>
          )}
          {/* Asked once per folder, and only when the folder already has agent guidance of its
              own — which means it is probably a real repo with a real AGENTS.md in it. Declining
              is remembered so it isn't asked again on every launch. */}
          {agentGuide && (
            <Notice
              icon={FileText}
              actionLabel={`Add a section to ${agentGuide}`}
              onAction={acceptAgentSection}
              onDismiss={declineAgentSection}
            >
              This folder already has its own {agentGuide}. Monk can add a section describing the
              workspace so agents know their way around.
            </Notice>
          )}
          <main id="main" tabIndex={-1} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {isSpecRoute ? (
              !activeSpec ? (
                <NotFoundMessage text="Spec not found." backLabel="Back to specs" backHref={hrefSpecs()} />
              ) : (
                <SpecPage
                  key={revKey(activeSpec.id)}
                  spec={activeSpec}
                  initiatives={initiatives}
                  researchPlans={researchPlans}
                  researchPlanHref={hrefResearchPlan}
                  onCreateResearchPlan={createResearchPlan}
                  onAddResearchQuestion={addResearchQuestion}
                  sections={sections}
                  docHref={hrefDocument}
                  onUploadSourceFile={uploadSource("spec", activeSpec.id)}
                  onRemoveSourceFile={removeSource("spec", activeSpec.id)}
                  onOpenSourceFile={openSource("spec", activeSpec.id)}
                  onUploadSketch={uploadSketch(activeSpec.id)}
                  onReadSketch={readSketch(activeSpec.id)}
                  onChange={(patch) => updateSpec(activeSpec.id, patch)}
                  activeTab={activeSpecTab}
                  tabHref={(tab) => (
                    tab === "design" ? hrefSpecDesign(activeSpec.id) :
                    tab === "plan" ? hrefSpecPlan(activeSpec.id) :
                    hrefSpec(activeSpec.id)
                  )}
                  onToast={showToast}
                  breadcrumbs={breadcrumbs}
                />
              )
            ) : route.name === "doc" ? (
              activeDocument ? (
                <DocumentPage
                  key={revKey(activeDocument.id)}
                  document={activeDocument}
                  onChange={(patch) => updateDocument(route.sectionId, activeDocument.id, patch)}
                />
              ) : (
                <NotFoundMessage text="Document not found." backLabel="Back to research repository" backHref={RESEARCH_ROUTE} />
              )
            ) : route.name === "workspaceDoc" ? (
              activeWorkspaceDoc ? (
                <WorkspaceDocPage
                  key={revKey(activeWorkspaceDoc.id)}
                  doc={activeWorkspaceDoc}
                  text={workspaceDocs[activeWorkspaceDoc.id] ?? null}
                  onCreate={() => createWorkspaceDocument(activeWorkspaceDoc.id)}
                  onChange={(text) => updateWorkspaceDocument(activeWorkspaceDoc.id, text)}
                  onRemove={() => removeWorkspaceDocument(activeWorkspaceDoc.id)}
                  onToast={showToast}
                />
              ) : (
                <NotFoundMessage text="Page not found." backLabel="Back to start" backHref={hrefStart()} />
              )
            ) : route.name === "specs" ? (
              <SpecsPage
                specs={specs}
                initiatives={initiatives}
                specHref={hrefSpec}
                initiativeHref={hrefInitiative}
                onCreate={createSpec}
                onCreateInitiative={createInitiative}
                onDelete={deleteSpec}
              />
            ) : route.name === "initiative" ? (
              !activeInitiative ? (
                <NotFoundMessage text="Initiative not found." backLabel="Back to specs" backHref={hrefSpecs()} />
              ) : (
                <InitiativePage
                  key={revKey(activeInitiative.id)}
                  initiative={activeInitiative}
                  specs={specsForInitiative(specs, activeInitiative.id)}
                  specHref={hrefSpec}
                  researchPlans={researchPlansForInitiative(researchPlans, activeInitiative.id)}
                  researchPlanHref={hrefResearchPlan}
                  sections={sections}
                  docHref={hrefDocument}
                  onUploadSourceFile={uploadSource("initiative", activeInitiative.id)}
                  onRemoveSourceFile={removeSource("initiative", activeInitiative.id)}
                  onOpenSourceFile={openSource("initiative", activeInitiative.id)}
                  onChange={(patch) => updateInitiative(activeInitiative.id, patch)}
                  onDelete={() => deleteInitiative(activeInitiative.id)}
                  onCreateSpec={() => createSpec(activeInitiative.id)}
                  onDetachSpec={(specId) => updateSpec(specId, { initiativeId: null })}
                  breadcrumbs={breadcrumbs}
                />
              )
            ) : route.name === "research" ? (
              <ResearchRepositoryPage
                boards={allBoards}
                signals={signals}
                insights={insights}
                initialQuery={route.q}
                initialKind={route.kind}
                onNavigate={(q, kind) => window.history.replaceState(null, "", hrefResearch(q, kind))}
                boardCardHref={hrefResearchPlanAnalysis}
                researchPlans={researchPlans}
                researchPlanHref={hrefResearchPlan}
                onCreateResearchPlan={() => createResearchPlan()}
                onCreateSignal={createSignal}
                onCreateInsight={createInsight}
                onUpdateSignal={updateSignal}
                onDeleteSignal={deleteSignal}
                onUpdateInsight={updateInsight}
                onDeleteInsight={deleteInsight}
              />
            ) : route.name === "researchPlan" ? (
              !activeResearchPlan ? (
                <NotFoundMessage text="Research plan not found." backLabel="Back to research repository" backHref={RESEARCH_ROUTE} />
              ) : (
                <ResearchPlanPage
                  key={revKey(activeResearchPlan.id)}
                  plan={activeResearchPlan}
                  signals={signals}
                  insights={insights}
                  specs={specs}
                  initiatives={initiatives}
                  boards={allBoards}
                  activeTab={route.tab}
                  tabHref={(tab) => (tab === "analysis" ? hrefResearchPlanAnalysis(activeResearchPlan.id) : hrefResearchPlan(activeResearchPlan.id))}
                  highlightCardId={route.cardId}
                  onOpenBoard={(planId) => goToResearchPlanAnalysis(planId)}
                  sections={sections}
                  docHref={hrefDocument}
                  onUploadSourceFile={uploadSource("researchPlan", activeResearchPlan.id)}
                  onRemoveSourceFile={removeSource("researchPlan", activeResearchPlan.id)}
                  onOpenSourceFile={openSource("researchPlan", activeResearchPlan.id)}
                  onChange={(patch) => updateResearchPlan(activeResearchPlan.id, patch)}
                  onDelete={() => deleteResearchPlan(activeResearchPlan.id)}
                  onCreateSignal={createSignal}
                  onUpdateSignal={updateSignal}
                  onCreateInsight={createInsight}
                  onUpdateInsight={updateInsight}
                  onCreateSpec={addSpec}
                  onUpdateSpec={updateSpec}
                  onToast={showToast}
                  specHref={hrefSpec}
                  insightHref={hrefInsight}
                  breadcrumbs={breadcrumbs}
                />
              )
            ) : route.name === "activity" ? (
              // Redirecting — see the effect above.
              null
            ) : (
              <Home
                signals={signals}
                insights={insights}
                specs={specs}
                initiatives={initiatives}
                researchPlans={researchPlans}
                onCreateSpec={createSpec}
                recentHref={recentHref}
                folderName={projectName}
                subfolder={rootHandle ? dirHandle?.name : null}
                onChangeFolder={handleChangeFolder}
              />
            )}
          </main>
        </div>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
