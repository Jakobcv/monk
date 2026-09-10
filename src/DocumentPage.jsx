import { useState, useRef, useEffect } from "react";
import { FileText } from "lucide-react";
import { BORDER, SPACE, INK_SOFT } from "./lib/theme";
import { pageTitleInput } from "./ui/text";
import { documentToMarkdown } from "./lib/markdown";
import CrepeEditor from "./CrepeEditor";

// The `document` prop only seeds local state on mount — the parent remounts this component (via
// `key={document.id}`) whenever the open document changes, same pattern as Board.jsx. Destructured
// as `doc` so it doesn't shadow the global `window.document` (openRawMarkdown below doesn't
// currently need it, but the shadowing footgun isn't worth leaving in place regardless).
export default function DocumentPage({ document: doc, onChange }) {
  const [title, setTitle] = useState(doc.title);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ title });
  }, [title]);

  // Opens the exact bytes this document is saved to disk as (same `documentToMarkdown` call
  // storage.js uses) in a new tab, as plain text. There's no way to do better than that from a
  // browser: the File System Access API this app is built on deliberately never exposes a real
  // OS path or a way to hand a file to the OS's default app or file explorer — those are
  // security boundaries in the API itself, not a gap here. `{ ...doc, title }` rather than just
  // `doc` so a title you're still mid-typing (local state, not yet flushed to the prop) shows up
  // correctly rather than one keystroke stale.
  const openRawMarkdown = () => {
    const blob = new Blob([documentToMarkdown({ ...doc, title })], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", overflowAnchor: "none", scrollbarGutter: "stable", padding: "32px 40px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: SPACE.base, marginBottom: SPACE.md }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled document"
            style={{ ...pageTitleInput, flex: 1 }}
          />
          <button
            className="btn btn--sm btn--subtle"
            onClick={openRawMarkdown}
            title="Open this document's raw markdown file in a new tab"
            style={{ flexShrink: 0, marginTop: "6px", color: INK_SOFT }}
          >
            <FileText size={13} /> View .md
          </button>
        </div>
        <div style={{ height: "1px", backgroundColor: BORDER, marginBottom: "18px" }} />
        <CrepeEditor value={doc.body} onChange={(body) => onChange({ body })} />
      </div>
    </div>
  );
}
