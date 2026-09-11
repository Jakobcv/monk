import { useState, useRef, useEffect, useMemo } from "react";
import { FolderOpen } from "lucide-react";
import { loadWorkspace, saveWorkspace } from "./lib/storage";
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
import Header from "./Header";
import Home from "./Home";
import DashboardPage from "./DashboardPage";
import ResearchRepositoryPage from "./ResearchRepositoryPage";
import Sidebar from "./Sidebar";
import Breadcrumbs from "./Breadcrumbs";
import DocumentPage from "./DocumentPage";
import SpecsPage from "./SpecsPage";
import SpecPage from "./SpecPage";
import InitiativePage from "./InitiativePage";
import ActivityPage from "./ActivityPage";
import DesignTab from "./DesignTab";
import FlowMapMock from "./FlowMapMock";
import { SAMPLE_DESIGN_MD } from "./lib/sampleDesign";

const DOC_PREFIX = "#/doc/";
const RESEARCH_ROUTE = "#/research";
const DASHBOARD_ROUTE = "#/dashboard";
const SPECS_ROUTE = "#/specs";
const SPEC_PREFIX = "#/spec/";
const INITIATIVE_PREFIX = "#/initiative/";
const ACTIVITY_PREFIX = "#/activity/";

// href builders — the single source for every route string. Nav renders these as real
// `<a href>` (so Cmd/Ctrl/middle-click open a new tab); `goTo*` just assigns the same string
// to window.location.hash for the after-an-action programmatic case.
const hrefStart = () => "#";
const hrefDashboard = () => DASHBOARD_ROUTE;
const hrefDocument = (sectionId, docId) => DOC_PREFIX + encodeURIComponent(sectionId) + "/" + encodeURIComponent(docId);
const hrefSpecs = () => SPECS_ROUTE;
const hrefSpec = (id) => SPEC_PREFIX + encodeURIComponent(id);
const hrefSpecDesign = (id) => SPEC_PREFIX + encodeURIComponent(id) + "/design";
const hrefSpecPlan = (id) => SPEC_PREFIX + encodeURIComponent(id) + "/plan";
const hrefSpecDiscovery = (id, cardId) => SPEC_PREFIX + encodeURIComponent(id) + "/discovery" + (cardId != null ? "/" + encodeURIComponent(cardId) : "");
const hrefInitiative = (id) => INITIATIVE_PREFIX + encodeURIComponent(id);
const hrefActivity = (id) => ACTIVITY_PREFIX + encodeURIComponent(id);
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
  if (hash === DASHBOARD_ROUTE) {
    return { name: "dashboard" };
  }
  if (hash === SPECS_ROUTE) {
    return { name: "specs" };
  }
  if (hash.startsWith(SPEC_PREFIX)) {
    const [idRaw, sub, cardIdRaw] = hash.slice(SPEC_PREFIX.length).split("/");
    return {
      name: sub === "design" ? "specDesign" : sub === "plan" ? "specPlan" : sub === "discovery" ? "specDiscovery" : "spec",
      id: decodeURIComponent(idRaw),
      cardId: cardIdRaw ? Number(decodeURIComponent(cardIdRaw)) : null,
    };
  }
  if (hash.startsWith(INITIATIVE_PREFIX)) {
    return { name: "initiative", id: decodeURIComponent(hash.slice(INITIATIVE_PREFIX.length)) };
  }
  if (hash.startsWith(ACTIVITY_PREFIX)) {
    return { name: "activity", id: decodeURIComponent(hash.slice(ACTIVITY_PREFIX.length)) };
  }
  if (hash === "#/dashboard-preview") {
    return { name: "dashboardPreview" };
  }
  if (hash === "#/home-preview") {
    return { name: "homePreview" };
  }
  if (hash === "#/design-preview") {
    return { name: "designPreview" };
  }
  if (hash === "#/flow-preview") {
    return { name: "flowPreview" };
  }
  return { name: "home" };
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
      })
      .catch((err) => {
        console.error("Failed to load the research folder:", err);
      })
      .finally(() => {
        if (cancelled) return;
        setPhase("ready");
      });
    return () => { cancelled = true; };
  }, [phase, dirHandle]);

  const workspace = useMemo(() => ({ sections, specs, signals, insights, activities, initiatives }), [sections, specs, signals, insights, activities, initiatives]);

  // debounced autosave: skip the one save that would otherwise immediately re-write the
  // data we just loaded from disk
  useEffect(() => {
    if (phase !== "ready" || !dirHandle) return;
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    setSaveStatus("saving");
    const t = setTimeout(() => {
      saveWorkspace(dirHandle, workspace).then(
        () => setSaveStatus("saved"),
        (err) => { console.error("Failed to save the research folder:", err); setSaveStatus("error"); }
      );
    }, 700);
    return () => clearTimeout(t);
  }, [phase, dirHandle, workspace]);

  const retrySave = () => {
    setSaveStatus("saving");
    saveWorkspace(dirHandle, workspace).then(
      () => setSaveStatus("saved"),
      (err) => { console.error("Failed to save the research folder:", err); setSaveStatus("error"); }
    );
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
      setDirHandle(handle);
      setPhase("loading");
      goToStart();
    } catch {
      // user cancelled the picker — stay right where we are
    }
  };

  const showToast = (message, onUndo) => setToast({ id: Date.now(), message, onUndo });
  const dismissToast = () => setToast(null);

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
    : route.name === "dashboard" ? { type: "dashboard" }
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
    : route.name === "dashboard"
    ? [folderCrumb, { label: "Dashboard" }]
    : null;

  // Keep the browser tab title current — otherwise every route reads "Monk" and the tab / a
  // shared link / a history entry can't be told apart.
  useEffect(() => {
    const name =
      route.name === "doc" ? (activeDocument ? (activeDocument.title || "Untitled document") : "Document not found")
      : isSpecRoute ? (activeSpec ? (activeSpec.title || "Untitled spec") : "Spec not found")
      : route.name === "initiative" ? (activeInitiative ? (activeInitiative.title || "Untitled initiative") : "Initiative not found")
      : route.name === "activity" ? (activeActivity ? (activeActivity.name || "Untitled activity") : "Activity not found")
      : route.name === "specs" ? "Specs"
      : route.name === "dashboard" ? "Dashboard"
      : route.name === "research" ? "Research Repository"
      : "";
    document.title = name ? `${name} · Monk` : "Monk";
  }, [route, isSpecRoute, activeDocument, activeSpec, activeInitiative, activeActivity]);

  // Dev-only: preview either page populated with mock data, no folder needed.
  if (import.meta.env.DEV && (route.name === "dashboardPreview" || route.name === "homePreview")) {
    const mock = mockWorkspace(1);
    return (
      <div style={{ fontFamily: font, height: "100dvh", overflowY: "auto", background: "var(--bg)" }}>
        {route.name === "homePreview"
          ? <Home {...mock} recentHref={(kind, id) => recentHref(kind, id)} folderName="product-research" onChangeFolder={() => {}} />
          : <DashboardPage {...mock} demo />}
      </div>
    );
  }

  // The real Design tab on sample content, framed in a stand-in spec header so it reads in
  // context — the sandboxed preview can't open a workspace folder. Every edit's serialized
  // design.md lands on window.__designMd for inspection.
  // Flow map exploration — a spec's use cases as rows, named stages as columns. Framed as the
  // page it would be: reached from the Design tab, full-width like Discovery.
  if (import.meta.env.DEV && route.name === "flowPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <div style={{ padding: "14px 40px 0", flexShrink: 0 }}>
          <div style={{ fontSize: SIZE.sm, color: "var(--ink-soft)", display: "flex", gap: "6px" }}>
            <span>Bulk export of evidence</span><span style={{ color: "var(--ink-faint)" }}>›</span>
            <span>Design</span><span style={{ color: "var(--ink-faint)" }}>›</span>
            <span style={{ color: INK }}>Flow map</span>
          </div>
          <div style={{ fontSize: "26px", fontWeight: WEIGHT.semibold, color: INK, letterSpacing: "-0.01em", margin: "14px 0 16px" }}>Flow map</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: "0 12px 12px" }}><FlowMapMock /></div>
      </div>
    );
  }

  if (import.meta.env.DEV && route.name === "designPreview") {
    return (
      <div style={{ fontFamily: font, height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <div style={{ padding: "20px 40px 0", flexShrink: 0 }}>
          <div style={{ fontFamily: font, fontSize: "26px", fontWeight: WEIGHT.semibold, color: INK, letterSpacing: "-0.01em" }}>Bulk export of evidence</div>
          <div style={{ display: "flex", gap: "18px", borderBottom: "1px solid var(--border)", marginTop: "18px" }}>
            {["Overview", "Discovery", "Design", "Plan"].map((t) => (
              <span key={t} style={{ fontSize: SIZE.ui, fontWeight: WEIGHT.semibold, padding: "8px 2px", color: t === "Design" ? INK : "var(--ink-faint)", boxShadow: t === "Design" ? `inset 0 -2px 0 ${INK}` : "none" }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", boxSizing: "border-box", padding: "24px 40px 32px" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <DesignTab
              value={SAMPLE_DESIGN_MD}
              onChange={(md) => { window.__designMd = md; }}
              onToast={(message, onUndo) => { window.__lastToast = { message, onUndo }; }}
            />
          </div>
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

  return (
    <div style={{ fontFamily: font, height: "100dvh", display: "flex", flexDirection: "column" }}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header saveStatus={saveStatus} onRetrySave={retrySave} onChangeFolder={handleChangeFolder} />

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Sidebar
          sections={sections}
          activeView={activeView}
          dashboardHref={hrefDashboard()}
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
          <main id="main" tabIndex={-1} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {isSpecRoute ? (
              !activeSpec ? (
                <NotFoundMessage text="Spec not found." backLabel="Back to specs" backHref={hrefSpecs()} />
              ) : (
                <SpecPage
                  key={activeSpec.id}
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
                  breadcrumbs={breadcrumbs}
                />
              )
            ) : route.name === "doc" ? (
              activeDocument ? (
                <DocumentPage
                  key={activeDocument.id}
                  document={activeDocument}
                  onChange={(patch) => updateDocument(route.sectionId, activeDocument.id, patch)}
                />
              ) : (
                <NotFoundMessage text="Document not found." backLabel="Back to research repository" backHref={RESEARCH_ROUTE} />
              )
            ) : route.name === "dashboard" ? (
              <DashboardPage
                signals={signals}
                insights={insights}
                activities={activities}
                specs={specs}
                initiatives={initiatives}
                sections={sections}
                onCreateSpec={createSpec}
              />
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
                  key={activeInitiative.id}
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
                  key={activeActivity.id}
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
