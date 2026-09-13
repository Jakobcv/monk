import { entityIdsFor } from "./storage.js";
import { workspaceDocByFile } from "./workspaceDocs.js";

// What a reload from disk actually touched, in terms a person recognises. The watcher reports
// paths (`<uuid>/spec.md`, `signals/<uuid>.md`), which say nothing on their own; each one is
// matched to the record it belongs to in the freshly loaded workspace, so the log can say
// "Spec · Bulk export" and link to it. A path whose record is no longer there was deleted.
//
// Returns [{ path, kind, id, title, removed }]. `kind` is null for a path that belongs to no
// record (a stray .md at the root) — the log shows just the path for those.

const clip = (text, n = 70) => {
  const t = (text || "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

const FLAT = {
  signals: { kind: "signal", title: (r) => clip(r.text) || "Empty signal" },
  insights: { kind: "insight", title: (r) => clip(r.text) || "Empty insight" },
  activities: { kind: "activity", title: (r) => r.name || "Untitled activity" },
  initiatives: { kind: "initiative", title: (r) => r.title || "Untitled initiative" },
};

export function describeChange(path, record) {
  const [head] = path.split("/");
  const [id] = entityIdsFor([path]);
  if (!id) return { path, kind: null, id: null, title: null, removed: false };
  const find = (list) => (list || []).find((x) => x.id === id);

  if (FLAT[head]) {
    const entity = find(record[head]);
    return { path, kind: FLAT[head].kind, id, title: entity ? FLAT[head].title(entity) : null, removed: !entity };
  }
  const doc = workspaceDocByFile(head);
  if (doc && doc.id === id) {
    const exists = typeof record.docs?.[doc.id] === "string";
    return { path, kind: "workspaceDoc", id, title: doc.label, removed: !exists };
  }
  const spec = find(record.specs);
  if (spec) return { path, kind: "spec", id, title: spec.title || "Untitled spec", removed: false };
  const section = find(record.sections);
  if (section) return { path, kind: "section", id, title: section.name || "Untitled section", removed: false };
  // A top-level folder that no longer loads as anything: a spec or section that was deleted.
  return { path, kind: null, id, title: null, removed: true };
}

export function describeChanges(paths, record) {
  return [...new Set(paths)].sort().map((p) => describeChange(p, record));
}
