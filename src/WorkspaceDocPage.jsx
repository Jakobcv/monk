import { useState } from "react";
import { Copy, Check, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import { BORDER, SPACE, INK, INK_SOFT, SIZE, ACCENT } from "./lib/theme";
import { Meta, PageHeading } from "./ui/text";
import { useCopy } from "./lib/useCopy";
import { parseDesignSystem } from "./lib/designSystemModel";
import { parseWritingGuide, matchesDefault } from "./lib/writingGuideModel";
import MarkdownEditor from "./MarkdownEditor";
import DesignSystemEditor from "./DesignSystemEditor";
import WritingGuideEditor from "./WritingGuideEditor";
import Button from "./ui/Button";
import SwapIcon from "./ui/SwapIcon";
import Page from "./ui/Page";

// A workspace document's page (see lib/workspaceDocs.js) — DESIGN.md and WRITING.md. Two states,
// because a file can be missing: with no file, an explanation and a button that creates it; with
// one, the document on a sheet of paper, the way a spec's writing tabs are. A `seeded` document
// (WRITING.md) is written when the folder is attached, so its empty state is only ever seen in a
// workspace where someone deleted the file outside the app.
//
// A format with a structured editor (`doc.editor`) opens in it, with a switch to the raw markdown
// beside it — the escape hatch for anything the editor doesn't do, and the view a file lands in
// when it uses something the editor can't represent without rewriting it.
// `sections: true` puts the editor on the sheet's own rhythm (.paper-sheet--sections, the 32px
// between two sections every other sheet uses) rather than leaving it to space itself. The design
// system's editor spaces its own groups with rules, so it opts out.
const STRUCTURED = {
  "design-system": { parse: parseDesignSystem, Editor: DesignSystemEditor },
  "writing-guide": { parse: parseWritingGuide, Editor: WritingGuideEditor, sections: true },
};

export default function WorkspaceDocPage({ doc, text, onCreate, onChange, onRemove, onToast }) {
  return typeof text === "string"
    ? <Editor doc={doc} text={text} onChange={onChange} onRemove={onRemove} onToast={onToast} />
    : <NotCreated doc={doc} onCreate={onCreate} />;
}

function FormatLink({ doc, children = `About the ${doc.file} format` }) {
  if (!doc.formatUrl) return null;
  return (
    <a href={doc.formatUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: SPACE.xs, color: INK_SOFT, fontSize: SIZE.sm }}>
      {children} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function NotCreated({ doc, onCreate }) {
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try { await onCreate(); } finally { setBusy(false); }
  };
  return (
    <Page>
      <div style={{ maxWidth: "560px", margin: "40px auto 0" }}>
        <Meta translate="no">{doc.file}</Meta>
        <PageHeading style={{ margin: `${SPACE.xs} 0 ${SPACE.md}` }}>{doc.label}</PageHeading>
        <p style={{ color: INK, fontSize: SIZE.body, lineHeight: 1.55, margin: `0 0 ${SPACE.base}` }}>{doc.summary}</p>
        <p style={{ color: INK_SOFT, fontSize: SIZE.body, lineHeight: 1.55, margin: `0 0 ${SPACE.lg}` }}>
          {doc.seeded
            ? `This workspace doesn't have one — Monk writes it when a folder is attached, so it was
               deleted since. Creating it writes the default back; it's yours to edit from there.`
            : `This workspace doesn't have one yet. Creating it writes an empty file in the right
               format — every section, no values chosen — and an empty section sets no rules until
               you write something in it.`}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexWrap: "wrap" }}>
          <Button variant="primary" size="md" onClick={create} disabled={busy}>
            {busy ? "Creating…" : `Create ${doc.file}`}
          </Button>
          <FormatLink doc={doc} />
        </div>
      </div>
    </Page>
  );
}

// `text` only seeds local state on mount — the parent remounts this (via its `key`) when the file
// changes on disk, same as every other detail page, which is what lets the "changed on disk while
// you were editing" notice hold your text rather than replacing it under the cursor.
function Editor({ doc, text, onChange, onRemove, onToast }) {
  const structured = STRUCTURED[doc.editor] || null;
  const [value, setValue] = useState(text);
  const [initial] = useState(() => (structured ? structured.parse(text) : null));
  const [mode, setMode] = useState(initial?.ok ? "structured" : "markdown");
  // Why the structured view isn't available for what's in the file right now, if it isn't.
  const [problem, setProblem] = useState(initial && !initial.ok ? initial.reason : null);
  // Bumped each time the structured view is (re)opened, so it re-reads the current text — anything
  // typed in the markdown view in between included.
  const [structuredRun, setStructuredRun] = useState(0);
  const [copied, copy] = useCopy();

  const change = (next) => { setValue(next); onChange(next); };
  // Text arriving from somewhere other than the editor in front of you (Restore default, its
  // Undo). The structured view seeds its state at mount, so it is remounted to re-read this.
  const applyText = (next) => { change(next); setStructuredRun((n) => n + 1); };
  const restoreDefault = () => {
    const previous = value;
    applyText(doc.template({}));
    onToast?.(`Restored the default ${doc.file}`, () => applyText(previous));
  };
  const openStructured = () => {
    const parsed = structured.parse(value);
    if (!parsed.ok) { setProblem(parsed.reason); return; }
    setProblem(null);
    setStructuredRun((n) => n + 1);
    setMode("structured");
  };

  const StructuredEditor = structured?.Editor;
  const showStructured = mode === "structured" && StructuredEditor;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Wraps rather than squeezing: on a narrow pane the controls drop below the title. */}
      <div style={{ padding: "20px 40px 14px", boxSizing: "border-box", flexShrink: 0, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: SPACE.base }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <Meta as="div" style={{ display: "flex", alignItems: "center", gap: SPACE.base }}>
              <span translate="no">{doc.file}</span>
              <FormatLink doc={doc}>Format</FormatLink>
            </Meta>
            <PageHeading style={{ margin: `${SPACE.xs} 0 0` }}>{doc.label}</PageHeading>
          </div>

          {structured && (
            <div role="group" aria-label="View" className="view-switch">
              <button type="button" aria-pressed={mode === "structured"} onClick={openStructured}>Editor</button>
              <button type="button" aria-pressed={mode === "markdown"} onClick={() => setMode("markdown")}>Markdown</button>
            </div>
          )}
          <button
            className="btn btn--sm btn--subtle"
            onClick={() => copy(value)}
            title={`Copy ${doc.file} to the clipboard`}
            style={{ flexShrink: 0, color: copied ? ACCENT.action : INK_SOFT }}
          >
            <SwapIcon active={copied} activeIcon={Check} inactiveIcon={Copy} size={16} />
            {copied ? "Copied" : "Copy .md"}
          </button>
          {/* A seeded file is written again the next time this folder is attached, so removing it
              isn't a thing to offer; what you actually want from that button is the text back. */}
          {doc.seeded ? (
            <button
              className="btn btn--sm btn--subtle"
              onClick={restoreDefault}
              disabled={matchesDefault(value, doc.template({}))}
              title={`Replace ${doc.file} with the guide Monk ships`}
              style={{ flexShrink: 0, color: INK_SOFT }}
            >
              <RotateCcw size={16} /> Restore default
            </button>
          ) : (
            <button
              className="btn btn--sm btn--subtle"
              onClick={onRemove}
              title={`Delete ${doc.file} from this workspace`}
              style={{ flexShrink: 0, color: INK_SOFT }}
            >
              <Trash2 size={16} /> Remove
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <Page ground="reading" style={{ overflowAnchor: "none" }}>
          <div
            className={`paper-sheet${showStructured && structured.sections ? " paper-sheet--sections" : ""}`}
            style={showStructured ? undefined : { display: "flex", flexDirection: "column", gap: SPACE.xl }}
          >
            {problem && (
              <p className="ds-note" role="status">
                The editor can't show this file without rewriting part of it — it uses {problem}.
                Edit it here as Markdown, or change that and switch back.
              </p>
            )}
            {showStructured
              ? <StructuredEditor key={structuredRun} value={value} onChange={change} onToast={onToast} />
              : <MarkdownEditor fill value={value} onChange={change} minHeight={0} placeholder={`Write ${doc.file} in Markdown…`} />}
          </div>
        </Page>
      </div>
    </div>
  );
}
