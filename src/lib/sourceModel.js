// A source is reference material behind a spec, research plan or initiative — either a pointer
// to a document already living in a workspace section (Product Knowledge, Standards, or any
// custom section), or a file uploaded straight into the record's own `sources/` folder on disk
// (see storage.js uploadSourceFile). Distinct from a spec's Artefacts (external links only,
// designModel.js): a source is something that lives in or under this workspace.
//
// { kind: "document", sectionId, docId } | { kind: "file", name }
// Order is display order; there's no separate priority field.

export const documentSource = (sectionId, docId) => ({ kind: "document", sectionId, docId });
export const fileSource = (name) => ({ kind: "file", name });

// Whatever came off disk, as sources: only the two known shapes, everything else dropped.
export function sourcesFrom(list) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && typeof s === "object")
    .map((s) => (s.kind === "document"
      ? { kind: "document", sectionId: String(s.sectionId || ""), docId: String(s.docId || "") }
      : s.kind === "file"
        ? { kind: "file", name: String(s.name || "") }
        : null))
    .filter((s) => s && (s.kind === "document" ? s.sectionId && s.docId : s.name));
}

// Every document in the workspace, flattened with the section it lives in — what a source picker
// searches. Fixed sections (Product Knowledge, Standards) are included like any other.
export function documentIndex(sections) {
  return (sections || []).flatMap((s) => (s.documents || []).map((d) => ({
    sectionId: s.id, sectionName: s.name, docId: d.id, title: d.title,
  })));
}

// A document source resolved against the current sections — null if the doc, or its whole
// section, is gone (deleted since the source was linked).
export function resolveDocumentSource(sections, source) {
  const section = (sections || []).find((s) => s.id === source.sectionId);
  const doc = section?.documents.find((d) => d.id === source.docId);
  return doc ? { section, doc } : null;
}
