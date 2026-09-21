import { useRef, useState } from "react";
import { File as FileIcon, Plus, X } from "lucide-react";
import { INK_FAINT, SIZE, SPACE } from "../lib/theme";
import { Eyebrow, Meta } from "./text";
import PaperButton from "./PaperButton";
import IconButton from "./IconButton";
import LinkPicker from "./LinkPicker";
import { documentIndex, resolveDocumentSource, documentSource, fileSource } from "../lib/sourceModel";

const fsOpenSupported = typeof window !== "undefined" && "showOpenFilePicker" in window;

// Reference material behind a spec, research plan or initiative: pointers to documents already
// in the workspace, and files uploaded straight into the record's own sources/ folder (see
// storage.js uploadSourceFile). Same shape as SpecPage's ResearchPlansList — linked rows with a
// remove ×, and a "+ Add source" opener — with uploading offered as the picker's secondary action
// rather than a second control, the way LinkPicker's "New research plan" row already works.
//
// A document source whose doc (or section) has since been deleted isn't shown, same rule
// ResearchPlansList uses for a deleted plan — it stays in the stored list until the next edit
// drops it, rather than being cleaned up behind your back.
//
// `onUploadFile(file)` writes the picked file into the record's sources folder and resolves to
// the name it was saved under (deduped if one was already there) — this list only stores that
// name, never the bytes. `onRemoveFile`/`onOpenFile` take that same name.
export default function SourcesList({ sources, onChange, sections, docHref, onUploadFile, onRemoveFile, onOpenFile }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef(null);

  const items = sources || [];
  const resolved = items
    .map((s, i) => (s.kind === "document" ? { ...s, i, resolved: resolveDocumentSource(sections, s) } : { ...s, i }))
    .filter((s) => s.kind !== "document" || s.resolved);

  const removeAt = (i) => {
    const item = items[i];
    onChange(items.filter((_, j) => j !== i));
    if (item.kind === "file") onRemoveFile?.(item.name);
  };

  const docKey = (sectionId, docId) => `${sectionId}::${docId}`;
  const linkedDocKeys = new Set(items.filter((s) => s.kind === "document").map((s) => docKey(s.sectionId, s.docId)));
  const link = (key) => {
    if (linkedDocKeys.has(key)) return;
    const [sectionId, docId] = key.split("::");
    onChange([...items, documentSource(sectionId, docId)]);
  };
  const pickerItems = documentIndex(sections)
    .filter((d) => !linkedDocKeys.has(docKey(d.sectionId, d.docId)))
    .map((d) => ({ id: docKey(d.sectionId, d.docId), label: d.title || "Untitled document", meta: d.sectionName }));

  const upload = async () => {
    if (!onUploadFile) return;
    try {
      let file;
      if (fsOpenSupported) {
        const [handle] = await window.showOpenFilePicker({ multiple: false });
        file = await handle.getFile();
      } else {
        file = await pickFileViaInput();
      }
      if (!file) return;
      const name = await onUploadFile(file);
      onChange([...items, fileSource(name)]);
    } catch (err) {
      if (err?.name !== "AbortError") console.error("Couldn't upload the file:", err);
    }
  };

  return (
    <div>
      <Eyebrow>Sources</Eyebrow>
      <div style={{ marginTop: SPACE.base, display: "flex", flexDirection: "column" }}>
        {resolved.length === 0 && (
          <p className="paper-hint" style={{ marginBottom: SPACE.sm }}>
            No sources yet. Link a document already in the workspace, or upload a file, to ground this in what's already known.
          </p>
        )}
        {resolved.map((s) => (s.kind === "document" ? (
          <div key={`doc:${s.i}`} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.sm, minWidth: 0 }}>
            <a className="paper-link-row" href={docHref(s.sectionId, s.docId)} style={{ flex: 1 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.resolved.doc.title || "Untitled document"}
              </span>
              <Meta style={{ fontSize: SIZE.ui, flexShrink: 0 }}>{s.resolved.section.name}</Meta>
            </a>
            <IconButton
              className="reveal" onClick={() => removeAt(s.i)} title="Remove source"
              aria-label={`Remove ${s.resolved.doc.title || "document"}`} style={{ "--hit-w": "34px", "--hit-h": "28px" }}
            >
              <X size={16} />
            </IconButton>
          </div>
        ) : (
          <div key={`file:${s.i}`} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.sm, minWidth: 0 }}>
            <button
              type="button" className="paper-link-row" onClick={() => onOpenFile?.(s.name)}
              style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
            >
              <FileIcon size={14} color={INK_FAINT} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
            </button>
            <IconButton
              className="reveal" onClick={() => removeAt(s.i)} title="Remove source"
              aria-label={`Remove ${s.name}`} style={{ "--hit-w": "34px", "--hit-h": "28px" }}
            >
              <X size={16} />
            </IconButton>
          </div>
        )))}
      </div>
      <div style={{ marginTop: SPACE.xs }}>
        <PaperButton
          icon={Plus}
          data-dismiss-ignore
          aria-expanded={pickerOpen}
          onClick={(e) => { anchorRef.current = e.currentTarget; setPickerOpen((open) => !open); }}
        >
          Add source
        </PaperButton>
      </div>
      {pickerOpen && (
        <LinkPicker
          anchorRef={anchorRef}
          align="left"
          onClose={() => setPickerOpen(false)}
          label="Link a document"
          placeholder="Search documents…"
          emptyText="No other documents."
          items={pickerItems}
          onPick={link}
          action={onUploadFile ? { label: "Upload a file", onClick: upload } : null}
        />
      )}
    </div>
  );
}

// Browsers without showOpenFilePicker (Firefox, Safari) fall back to a plain file input, created
// fresh each time — nothing to mount, no ref to manage between uploads.
function pickFileViaInput() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
