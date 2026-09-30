import { useState, useRef, useEffect } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { INK_SOFT, ACCENT } from "./lib/theme";
import { PageTitle } from "./ui/text";
import { documentToMarkdown } from "./lib/markdown";
import { useCopy } from "./lib/useCopy";
import MarkdownEditor from "./MarkdownEditor";
import SwapIcon from "./ui/SwapIcon";
import Page from "./ui/Page";

// A Product Knowledge / Standards document: a sheet of paper on the reading desk, the same surface
// as a spec's writing tabs, with the title set on the sheet above the writing. It used to be a
// 13.5px column straight on the ground, 760px wide — about 120 characters to a line, twice what a
// reader can track — with a Markdown reference card beside it. The sheet sets it at the reading
// scale, and the one-line legend at the foot of the page (MarkdownEditor `fill`) replaces the card.
//
// The `document` prop only seeds local state on mount — the parent remounts this component (via
// `key={document.id}`) whenever the open document changes, same pattern as Board.jsx. Destructured
// as `doc` so it doesn't shadow the global `window.document`.
export default function DocumentPage({ document: doc, onChange }) {
  const [title, setTitle] = useState(doc.title);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ title });
  }, [title]);

  // The exact bytes this document is saved to disk as (same `documentToMarkdown` call storage.js
  // uses). `{ ...doc, title }` rather than just `doc` so a title you're still mid-typing (local
  // state, not yet flushed to the prop) shows up correctly rather than one keystroke stale.
  const rawMarkdown = () => documentToMarkdown({ ...doc, title });

  const [copied, copyMd] = useCopy();

  // Opens the raw markdown in a new tab. There's no way to do better from a browser: the File
  // System Access API this app is built on deliberately never exposes a real OS path or a way
  // to hand a file to the OS's default app — those are security boundaries in the API, not a
  // gap here.
  const openRawMarkdown = () => {
    const url = URL.createObjectURL(new Blob([rawMarkdown()], { type: "text/plain;charset=utf-8" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <Page ground="reading" style={{ overflowAnchor: "none" }}>
      <div className="doc-actions">
        <button
          className="btn btn--sm btn--subtle"
          onClick={() => copyMd(rawMarkdown())}
          title="Copy this document's raw markdown to the clipboard"
          style={{ color: copied ? ACCENT.action : INK_SOFT }}
        >
          <SwapIcon active={copied} activeIcon={Check} inactiveIcon={Copy} size={16} />
          {copied ? "Copied" : "Copy .md"}
        </button>
        <button
          className="btn btn--sm btn--subtle"
          onClick={openRawMarkdown}
          title="Open this document's raw markdown file in a new tab"
          style={{ color: INK_SOFT }}
        >
          <FileText size={16} /> View .md
        </button>
      </div>
      <div className="paper-sheet doc-sheet">
        <PageTitle
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled document"
          aria-label="Title"
        />
        <MarkdownEditor fill minHeight={0} value={doc.body} onChange={(body) => onChange({ body })} placeholder="Start writing…" />
      </div>
    </Page>
  );
}
