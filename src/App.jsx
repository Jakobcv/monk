import { useState, useRef, useEffect, useMemo } from "react";
import { FolderOpen, RefreshCw, FileText } from "lucide-react";
import { loadWorkspace, saveWorkspace, watchWorkspace, canWatchWorkspace, entityIdsFor, ensureAgentGuides, addAgentSection, createWorkspaceDoc, removeWorkspaceDoc } from "./lib/storage";
import { WORKSPACE_DOCS, workspaceDocById } from "./lib/workspaceDocs";
import { blankBoard, bumpNextId } from "./lib/boardModel";
import { blankSection, blankDocument, ensureFixedSections, isFixedSection } from "./lib/documentModel";
import { blankSpec } from "./lib/specModel";
import { blankActivity } from "./lib/signalModel";
import { blankInitiative, specsForInitiative } from "./lib/initiativeModel";
import { mockWorkspace } from "./lib/mockWorkspace";
import { fsAccessSupported, getStoredHandle, pickFolder, tryReuseHandle, reconnectHandle } from "./lib/fsPersistence";
import { font, INK, INK_SOFT, SIZE, WEIGHT, SPACE } from "./lib/theme";
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
import ActivityPage from "./ActivityPage";
import DesignTab from "./DesignTab";
import Board from "./Board";
import Page from "./ui/Page";
import { SAMPLE_DESIGN_MD } from "./lib/sampleDesign";

const DOC_PREFIX = "#/doc/";
const RESEARCH_ROUTE = "#/research";
const SPECS_ROUTE = "#/specs";
const SPEC_PREFIX = "#/spec/";
const INITIATIVE_PREFIX = "#/initiative/";
const ACTIVITY_PREFIX = "#/activity/";
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
const hrefSpecDiscovery = (id, cardId) => SPEC_PREFIX + encodeURIComponent(id) + "/discovery" + (cardId != null ? "/" + encodeURIComponent(cardId) : "");
const hrefInitiative = (id) => INITIATIVE_PREFIX + encodeURIComponent(id);
const hrefActivity = (id) => ACTIVITY_PREFIX + encodeURIComponent(id);
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

const goToStart = () => { window.location.hash = hrefStart(); };
const goToDocument = (sectionId, docId) => { window.location.hash = hrefDocument(sectionId, docId); };
const goToResearch = () => { window.location.hash = RESEARCH_ROUTE; };
const goToSpecs = () => { window.location.hash = hrefSpecs(); };
const goToSpec = (id) => { window.location.hash = hrefSpec(id); };
const goToSpecDiscovery = (id, cardId) => { window.location.hash = hrefSpecDiscovery(id, cardId); };
const goToInitiative = (id) => { window.location.hash = hrefInitiative(id); };
const goToActivity = (id) => { window.location.hash = hrefActivity(id); };

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
    const [idRaw, sub, cardIdRaw] = hash.slice(SPEC_PREFIX.length).split("/");
    return {
      name: sub === "design" ? "specDesign" : sub === "plan" ? "specPlan" : sub === "discovery" ? "specDiscovery" : "spec",
      id: decodeURIComponent(idRaw),
      cardId: parseCardId(cardIdRaw),
    };
  }
  if (hash.startsWith(INITIATIVE_PREFIX)) {
    return { name: "initiative", id: decodeURIComponent(hash.slice(INITIATIVE_PREFIX.length)) };
  }
  if (hash.startsWith(ACTIVITY_PREFIX)) {
    return { name: "activity", id: decodeURIComponent(hash.slice(ACTIVITY_PREFIX.length)) };
  }
  if (hash.startsWith(WORKSPACE_DOC_PREFIX)) {
    return { name: "workspaceDoc", id: decodeURIComponent(hash.slice(WORKSPACE_DOC_PREFIX.length)) };
  }
  if (hash === "#/workspace-doc-preview") {
    return { name: "workspaceDocPreview" };
  }
  if (hash === "#/research-preview") {
    return { name: "researchPreview" };
  }
  if (hash === "#/home-preview") {
    return { name: "homePreview" };
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
    { text: "Markdown only, or is PDF worth the weight?", checked: true },
  ],
  acceptanceCriteria: [
    { text: "Export is reachable from the insight card without opening it", checked: true },
    { text: "The copied text pastes cleanly into Notion, Slack and a Google Doc", checked: true },
    { text: "Every quoted signal carries its activity and date", checked: false },
    { text: "The whole flow is operable from the keyboard", checked: false },
  ],
  board: blankBoard(),
  design: SAMPLE_DESIGN_MD,
  plan: `# Plan

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
  useEffect(() => { window.__spec = spec; }, [spec]);
  const noop = () => {};
  return (
    <SpecPage
      key="preview"
      spec={spec}
      onChange={(patch) => setSpec((prev) => ({ ...prev, ...patch }))}
      activeTab={tab}
      tabHref={(t) => `#/spec-preview/${t}`}
      breadcrumbs={[{ label: "product-research", icon: FolderOpen }, { label: "Specs" }, { label: spec.title }]}
      initiatives={[{ id: "ini-preview", title: "Evidence anywhere" }]}
      boards={[]} signals={[]} insights={[]} activities={[]} sections={[]}
      onOpenBoard={noop} onUpdateSignal={noop} onCreateSignal={noop}
      onUpdateInsight={noop} onCreateInsight={noop}
      onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
      highlightCardId={null}
    />
  );
}

// The workspace document page with no folder behind it (#/workspace-doc-preview): starts with no
// file, so both states — the Create button and the editor — can be looked at. The text lands on
// window.__workspaceDoc after every change.
function WorkspaceDocPreviewDemo() {
  const doc = WORKSPACE_DOCS[0];
  const [text, setText] = useState(null);
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
      boards={ws.specs.map((s) => ({ ...s.board, specTitle: s.title }))}
      specs={ws.specs} signals={ws.signals} insights={ws.insights} activities={ws.activities}
      initialQuery="" initialKind="all" onNavigate={noop}
      activityHref={hrefActivity} specDiscoveryHref={hrefSpecDiscovery}
      onCreateSignal={noop} onCreateActivity={noop} onCreateInsight={noop}
      onUpdateSignal={updateSignal} onDeleteSignal={noop} onUpdateInsight={noop} onDeleteInsight={noop}
    />
  );
}

function ConnectScreen({ title, message, buttonLabel, onClick }) {
  return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="enter-up" style={{ maxWidth: "380px", textAlign: "center" }}>
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
  const [dirHandle, setDirHandle] = useState(null);
  const [pendingHandle, setPendingHandle] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  // Workspace documents by id (lib/workspaceDocs.js) — DESIGN.md today. `null` or absent means the
  // file doesn't exist; a string, even an empty one, means it does.
  const [workspaceDocs, setWorkspaceDocs] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [sections, setSections] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [signals, setSignals] = useState([]);
  const [insights, setInsights] = useState([]);
  const [activities, setActivities] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  // Deletes happen immediately and report themselves here, with one chance to reverse — rather
  // than interrupting with a confirm dialog before every one. See ui/Toast.jsx.
  const [toast, setToast] = useState(null);
  const skipNextSaveRef = useRef(true);
  const route = useRoute();

  // on mount: reuse a previously-granted folder silently if permission is still live,
  // otherwise ask for a click — showDirectoryPicker/requestPermission both require one
  useEffect(() => {
    if (!fsAccessSupported) { setPhase("unsupported"); return; }
    (async () => {
      const stored = await getStoredHandle();
      if (!stored) { setPhase("needsConnect"); return; }
      if (await tryReuseHandle(stored)) {
        setDirHandle(stored);
        setPhase("loading");
      } else {
        setPendingHandle(stored);
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
        bumpNextId(record.specs.map((s) => s.board));
        setSections(ensureFixedSections(record.sections));
        setSpecs(record.specs);
        setSignals(record.signals);
        setInsights(record.insights);
        setActivities(record.activities);
        setInitiatives(record.initiatives);
        setWorkspaceDocs(record.docs || {});
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

  const workspace = useMemo(() => ({ sections, specs, signals, insights, activities, initiatives, docs: workspaceDocs }), [sections, specs, signals, insights, activities, initiatives, workspaceDocs]);

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
      if (!(await reconnectHandle(dirHandle))) { setSaveStatus("error"); return; }
      const conflicts = await saveWorkspace(dirHandle, workspace, { hold: staleId ? [staleId] : [] });
      setSaveStatus(conflicts.length ? "conflict" : "saved");
    } catch (err) {
      console.error("Failed to save the research folder:", err);
      setSaveStatus("error");
    }
  };

  const handleConnect = async () => {
    try {
      const handle = await pickFolder();
      setDirHandle(handle);
      setPhase("loading");
    } catch {
      // user cancelled the picker — stay on the connect screen
    }
  };
  const handleReconnect = async () => {
    if (await reconnectHandle(pendingHandle)) {
      setDirHandle(pendingHandle);
      setPhase("loading");
    }
  };
  const handleChangeFolder = async () => {
    try {
      const handle = await pickFolder();
      skipNextSaveRef.current = true; // skip the redundant re-save right after this fresh load
      setSections([]);
      setSpecs([]);
      setSignals([]);
      setInsights([]);
      setActivities([]);
      setInitiatives([]);
      setWorkspaceDocs({});
      setDirHandle(handle);
      setPhase("loading");
      goToStart();
    } catch {
      // user cancelled the picker — stay right where we are
    }
  };

  const showToast = (message, onUndo) => setToast({ id: Date.now(), message, onUndo });
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


  // On attach: make sure an agent landing here cold finds the schema (MONK.md) and a briefing.
  // Where the folder already has an AGENTS.md or CLAUDE.md of its own we write nothing and ask
  // instead — see ensureAgentGuides. A "no" is remembered per folder, so it is a question, not a
  // recurring prompt.
  const [agentGuide, setAgentGuide] = useState(null);
  const declinedKey = dirHandle ? `monk:agents-declined:${dirHandle.name}` : null;

  useEffect(() => {
    if (phase !== "ready" || !dirHandle) return;
    let cancelled = false;
    ensureAgentGuides(dirHandle)
      .then((result) => {
        if (cancelled || result.created || result.linked || !result.existing) return;
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
          bumpNextId(record.specs.map((s) => s.board));
          setSections(ensureFixedSections(record.sections));
          setSpecs(record.specs);
          setSignals(record.signals);
          setInsights(record.insights);
          setActivities(record.activities);
          setInitiatives(record.initiatives);
          setWorkspaceDocs(record.docs || {});
          setSaveStatus("saved");

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
          showToast(changed.length === 1 ? "Updated from disk" : `Updated ${changed.length} files from disk`);
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
      const result = await createWorkspaceDoc(dirHandle, id, content ?? doc.template({ workspaceName: dirHandle.name }));
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

  const isSpecRoute = route.name === "spec" || route.name === "specDesign" || route.name === "specPlan" || route.name === "specDiscovery";

  const createSpec = (initiativeId = null) => {
    const spec = blankSpec("Untitled spec", initiativeId);
    spec.board = blankBoard(spec.id);
    setSpecs((prev) => [...prev, spec]);
    goToSpec(spec.id);
  };
  const updateSpec = (id, patch) =>
    setSpecs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
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
  // flow as createActivity/createSpec.
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

    setInitiatives((prev) => prev.filter((i) => i.id !== id));
    setSpecs((prev) => prev.map((s) => (s.initiativeId === id ? { ...s, initiativeId: null, updatedAt: Date.now() } : s)));
    if (route.name === "initiative" && route.id === id) goToSpecs();

    const kept = detachedIds.length ? ` — ${detachedIds.length} spec${detachedIds.length === 1 ? "" : "s"} kept` : "";
    showToast(`Deleted "${initiative.title || "Untitled initiative"}"${kept}`, () => {
      setInitiatives((prev) => insertAt(prev, index, initiative));
      setSpecs((prev) => prev.map((s) => (detachedIds.includes(s.id) ? { ...s, initiativeId: id } : s)));
    });
  };
  // Signals and Activities are global, workspace-wide records (see signalModel.js) — created
  // only from Research Repository, then linked (never copied) into any number of specs'
  // Discovery boards. `signal` here already arrives as a complete object (Research Repository
  // builds it off blankSignal() plus its form fields); an activity has no form at all — same
  // flow as createSpec, it's created blank and you land straight on its own page to fill in.
  const createSignal = (signal) => setSignals((prev) => [...prev, signal]);
  const createActivity = () => {
    const activity = blankActivity();
    setActivities((prev) => [...prev, activity]);
    goToActivity(activity.id);
  };
  const updateSignal = (id, patch) =>
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
  const deleteSignal = (id) => {
    const index = signals.findIndex((s) => s.id === id);
    const signal = signals[index];
    if (!signal) return;
    // A signal can be linked into many boards, each at its own position and wired to its own
    // insights. Undo has to put all of that back, so capture it before anything is removed.
    const links = specs
      .filter((s) => (s.board.signals || []).some((x) => x.id === id))
      .map((s) => ({
        specId: s.id,
        index: s.board.signals.findIndex((x) => x.id === id),
        connections: (s.board.connections || []).filter((c) => c.from === id || c.to === id),
      }));

    setSignals((prev) => prev.filter((s) => s.id !== id));
    // strip the pointer (and any connections touching it) from every board it was linked into
    setSpecs((prev) => prev.map((s) => (
      (s.board.signals || []).some((x) => x.id === id)
        ? {
            ...s,
            board: {
              ...s.board,
              signals: s.board.signals.filter((x) => x.id !== id),
              connections: s.board.connections.filter((c) => c.from !== id && c.to !== id),
              updatedAt: Date.now(),
            },
            updatedAt: Date.now(),
          }
        : s
    )));

    const where = links.length ? ` and unlinked it from ${links.length} spec${links.length === 1 ? "" : "s"}` : "";
    showToast(`Deleted signal${where}`, () => {
      setSignals((prev) => insertAt(prev, index, signal));
      setSpecs((prev) => prev.map((s) => {
        const link = links.find((l) => l.specId === s.id);
        if (!link) return s;
        return {
          ...s,
          board: {
            ...s.board,
            signals: insertAt(s.board.signals, link.index, { id }),
            connections: [...s.board.connections, ...link.connections],
            updatedAt: Date.now(),
          },
        };
      }));
    });
  };
  const updateActivity = (id, patch) =>
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)));
  const deleteActivity = (id) => {
    const index = activities.findIndex((a) => a.id === id);
    const activity = activities[index];
    if (!activity) return;
    // the signals about to be detached — undo re-points exactly these back at the activity
    const detachedIds = signals
      .filter((s) => s.source?.type === "activity" && s.source.activityId === id)
      .map((s) => s.id);

    setActivities((prev) => prev.filter((a) => a.id !== id));
    // Detach rather than delete — the signals it collected still stand on their own, just with
    // no source (there's no free-text fallback to preserve the activity's name into anymore —
    // see signalModel.js — so this is the same "no source" state a signal never tied to an
    // activity in the first place would have).
    setSignals((prev) => prev.map((s) => (
      s.source?.type === "activity" && s.source.activityId === id ? { ...s, source: null, updatedAt: Date.now() } : s
    )));
    if (route.name === "activity" && route.id === id) goToResearch();

    const kept = detachedIds.length ? ` — ${detachedIds.length} signal${detachedIds.length === 1 ? "" : "s"} kept` : "";
    showToast(`Deleted "${activity.name || "Untitled activity"}"${kept}`, () => {
      setActivities((prev) => insertAt(prev, index, activity));
      setSignals((prev) => prev.map((s) => (
        detachedIds.includes(s.id) ? { ...s, source: { type: "activity", activityId: id } } : s
      )));
    });
  };

  // Insights are global, workspace-wide records too now (see insightModel.js) — created (or
  // drawn out of signals) from Research Repository's discovery canvas, then linked into any
  // number of specs' Discovery boards. Structurally identical to the signal handlers above;
  // the one difference is what deletion means: a signal detaches from a deleted activity and
  // survives, but an insight really is gone when deleted — there's no coarser record above it
  // to fall back to, only the boards it was linked into (which just lose the pointer).
  const createInsight = (insight) => setInsights((prev) => [...prev, insight]);
  const updateInsight = (id, patch) =>
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)));
  const deleteInsight = (id) => {
    const index = insights.findIndex((i) => i.id === id);
    const insight = insights[index];
    if (!insight) return;
    const links = specs
      .filter((s) => (s.board.insights || []).some((x) => x.id === id))
      .map((s) => ({
        specId: s.id,
        index: s.board.insights.findIndex((x) => x.id === id),
        connections: (s.board.connections || []).filter((c) => c.from === id || c.to === id),
      }));

    setInsights((prev) => prev.filter((i) => i.id !== id));
    setSpecs((prev) => prev.map((s) => (
      (s.board.insights || []).some((x) => x.id === id)
        ? {
            ...s,
            board: {
              ...s.board,
              insights: s.board.insights.filter((x) => x.id !== id),
              connections: s.board.connections.filter((c) => c.from !== id && c.to !== id),
              updatedAt: Date.now(),
            },
            updatedAt: Date.now(),
          }
        : s
    )));

    const where = links.length ? ` and unlinked it from ${links.length} spec${links.length === 1 ? "" : "s"}` : "";
    showToast(`Deleted insight${where}`, () => {
      setInsights((prev) => insertAt(prev, index, insight));
      setSpecs((prev) => prev.map((s) => {
        const link = links.find((l) => l.specId === s.id);
        if (!link) return s;
        return {
          ...s,
          board: {
            ...s.board,
            insights: insertAt(s.board.insights, link.index, { id }),
            connections: [...s.board.connections, ...link.connections],
            updatedAt: Date.now(),
          },
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
  const activeActivity = route.name === "activity" ? activities.find((a) => a.id === route.id) : null;
  const activeWorkspaceDoc = route.name === "workspaceDoc" ? workspaceDocById(route.id) : null;
  const activeSpecTab = route.name === "specDesign" ? "design" : route.name === "specPlan" ? "plan" : route.name === "specDiscovery" ? "discovery" : "overview";
  // Boards are never their own top-level thing anymore — this is the flat, board-shaped view
  // every cross-spec reference (`resolveRef`) and the Research Repository search need, each
  // one labeled with the spec that owns it since a board carries no name of its own.
  const allBoards = useMemo(() => specs.map((s) => ({ ...s.board, specTitle: s.title })), [specs]);

  // Which fixed sidebar entry reads as "active" — a spec doesn't have its own nav row, so it
  // highlights the section it belongs under. An activity is reached through Research
  // Repository the same way, so it highlights that instead. The Home landing matches neither,
  // so nothing lights up there — it's not "inside" Research Repository or Specs.
  const activeView = route.name === "doc" ? { type: "doc", sectionId: route.sectionId, docId: route.docId }
    : (route.name === "specs" || isSpecRoute || route.name === "initiative") ? { type: "specs" }
    : (route.name === "research" || route.name === "activity") ? { type: "research" }
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
    : kind === "activity" ? hrefActivity(id)
    : RESEARCH_ROUTE
  );

  const folderCrumb = {
    label: dirHandle?.name || "Research folder",
    onClick: handleChangeFolder,
    icon: FolderOpen,
    title: "Switch to a different research folder",
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
    : route.name === "activity"
    ? [folderCrumb, { label: "Research Repository", href: RESEARCH_ROUTE }, { label: activeActivity ? (activeActivity.name || "Untitled activity") : "Activity not found" }]
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
    || (activeActivity && activeActivity.id)
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
      : route.name === "activity" ? (activeActivity ? (activeActivity.name || "Untitled activity") : "Activity not found")
      : route.name === "specs" ? "Specs"
      : route.name === "research" ? "Research Repository"
      : route.name === "workspaceDoc" ? (activeWorkspaceDoc ? activeWorkspaceDoc.label : "Not found")
      : "";
    document.title = name ? `${name} · Monk` : "Monk";
  }, [route, isSpecRoute, activeDocument, activeSpec, activeInitiative, activeActivity, activeWorkspaceDoc]);

  // Dev-only: the start page populated with mock data, no folder needed.
  if (import.meta.env.DEV && route.name === "homePreview") {
    const mock = mockWorkspace(1);
    return (
      <div style={{ fontFamily: font, height: "100dvh", overflowY: "auto" }}>
        <Home {...mock} recentHref={(kind, id) => recentHref(kind, id)} folderName="product-research" onChangeFolder={() => {}} />
      </div>
    );
  }

  // The real Solution tab on sample content, framed in a stand-in spec header so it reads in
  // context — the sandboxed preview can't open a workspace folder. Every edit's serialized
  // design.md lands on window.__designMd for inspection.
  // The real Discovery board on sample data — the sandboxed preview can't open a workspace
  // folder. Picks the sample spec with the most connections, so the connect/rewire gestures
  // (src/canvas) actually have something to exercise.
  if (import.meta.env.DEV && route.name === "boardPreview") {
    const mock = mockWorkspace(1);
    const spec = [...mock.specs].sort((a, b) => b.board.connections.length - a.board.connections.length)[0];
    return (
      <Page bleed style={{ fontFamily: font, height: "100dvh" }}>
        <Board
          board={spec.board}
          onChange={(b) => { window.__board = b; }}
          allBoards={mock.specs.map((s) => ({ ...s.board, specTitle: s.title }))}
          onOpenBoard={() => {}}
          signals={mock.signals} insights={mock.insights} activities={mock.activities}
          onUpdateSignal={() => {}} onCreateSignal={() => {}} onUpdateInsight={() => {}} onCreateInsight={() => {}}
          onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
          highlightCardId={route.cardId}
        />
      </Page>
    );
  }

  if (import.meta.env.DEV && route.name === "researchPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <ResearchPreviewDemo />
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "workspaceDocPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh" }}>
        <WorkspaceDocPreviewDemo />
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
            {["Overview", "Discovery", "Solution", "Plan"].map((t) => (
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
    return <ConnectScreen title="Monk" message="Checking for a connected folder…" />;
  }
  if (phase === "needsConnect") {
    return (
      <ConnectScreen
        title="Connect your research folder"
        message="Pick a folder — ideally one inside your project's repo — where every spec is saved as plain markdown files you can read, grep, and commit like any other file."
        buttonLabel="Connect folder"
        onClick={handleConnect}
      />
    );
  }
  if (phase === "needsReconnect") {
    return (
      <ConnectScreen
        title="Reconnect your research folder"
        message="Permission to read and write your research folder needs to be re-granted after a browser restart."
        buttonLabel="Reconnect folder"
        onClick={handleReconnect}
      />
    );
  }
  if (phase === "loading") {
    return <ConnectScreen title="Monk" message="Loading your research folder…" />;
  }
  if (phase === "loadFailed") {
    return (
      <ConnectScreen
        title="Couldn't read your research folder"
        message={`Nothing has been changed on disk. ${loadError ? loadError.message : ""}`.trim()}
        buttonLabel="Try again"
        onClick={() => { setLoadError(null); setPhase("loading"); }}
      />
    );
  }

  return (
    <div style={{ fontFamily: font, height: "100dvh", display: "flex", flexDirection: "column" }}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header saveStatus={saveStatus} onRetrySave={retrySave} onChangeFolder={handleChangeFolder} />

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
          {!((isSpecRoute && activeSpec) || (route.name === "activity" && activeActivity) || (route.name === "initiative" && activeInitiative)) && breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
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
                  boards={allBoards}
                  signals={signals}
                  insights={insights}
                  activities={activities}
                  sections={sections}
                  initiatives={initiatives}
                  onCreateSignal={createSignal}
                  onCreateInsight={createInsight}
                  onChange={(patch) => updateSpec(activeSpec.id, patch)}
                  activeTab={activeSpecTab}
                  tabHref={(tab) => (
                    tab === "design" ? hrefSpecDesign(activeSpec.id) :
                    tab === "plan" ? hrefSpecPlan(activeSpec.id) :
                    tab === "discovery" ? hrefSpecDiscovery(activeSpec.id) :
                    hrefSpec(activeSpec.id)
                  )}
                  highlightCardId={route.cardId}
                  onOpenBoard={(specId) => goToSpecDiscovery(specId)}
                  onUpdateSignal={updateSignal}
                  onUpdateInsight={updateInsight}
                  onToast={showToast}
                  designSystem={workspaceDocs["design-system"] || ""}
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
                specs={specs}
                signals={signals}
                insights={insights}
                activities={activities}
                initialQuery={route.q}
                initialKind={route.kind}
                onNavigate={(q, kind) => window.history.replaceState(null, "", hrefResearch(q, kind))}
                activityHref={hrefActivity}
                specDiscoveryHref={hrefSpecDiscovery}
                onCreateSignal={createSignal}
                onCreateActivity={createActivity}
                onCreateInsight={createInsight}
                onUpdateSignal={updateSignal}
                onDeleteSignal={deleteSignal}
                onUpdateInsight={updateInsight}
                onDeleteInsight={deleteInsight}
              />
            ) : route.name === "activity" ? (
              !activeActivity ? (
                <NotFoundMessage text="Activity not found." backLabel="Back to research repository" backHref={RESEARCH_ROUTE} />
              ) : (
                <ActivityPage
                  key={revKey(activeActivity.id)}
                  activity={activeActivity}
                  signals={signals}
                  activities={activities}
                  onChange={(patch) => updateActivity(activeActivity.id, patch)}
                  onDelete={() => deleteActivity(activeActivity.id)}
                  onCreateSignal={createSignal}
                  onUpdateSignal={updateSignal}
                  onDeleteSignal={deleteSignal}
                  breadcrumbs={breadcrumbs}
                />
              )
            ) : (
              <Home
                signals={signals}
                insights={insights}
                activities={activities}
                specs={specs}
                initiatives={initiatives}
                onCreateSpec={createSpec}
                recentHref={recentHref}
                folderName={dirHandle?.name}
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
