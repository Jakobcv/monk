import { useState, useRef, useEffect } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { BORDER, SPACE, INK, INK_SOFT, INK_FAINT, SIZE, ACCENT } from "./lib/theme";
import { pageTitleInput, eyebrow } from "./ui/text";
import { documentToMarkdown } from "./lib/markdown";
import { useCopy } from "./lib/useCopy";
import MarkdownEditor from "./MarkdownEditor";
import Card from "./ui/Card";

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace";

// A slightly fuller cheat-sheet than MarkdownEditor's one-line hint — the document body is
// where someone actually writes prose, so it earns a standing reference in the right margin.
const CHEATS = [
  ["Headings", "# Title\n## Section\n### Sub-section"],
  ["Emphasis", "**bold**\n_italic_"],
  ["Bullet list", "- first point\n- second point"],
  ["Numbered list", "1. step one\n2. step two"],
  ["Link", "[visible text](https://…)"],
  ["Quote / callout", "> Worth pulling out."],
  ["Code", "`inline code`\n\n```\nfenced block\n```"],
  ["Divider", "---"],
];

function MarkdownLegend() {
  return (
    <Card padded style={{ background: "var(--bg-sidebar)" }}>
      <div style={{ ...eyebrow, marginBottom: SPACE.md }}>Markdown reference</div>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}>
        {CHEATS.map(([label, example]) => (
          <div key={label}>
            <div style={{ fontSize: SIZE.micro, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: INK_FAINT, marginBottom: SPACE.xs }}>
              {label}
            </div>
            <pre style={{ margin: 0, fontFamily: MONO, fontSize: SIZE.xs, lineHeight: 1.55, color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {example}
            </pre>
          </div>
        ))}
        <div style={{ fontSize: SIZE.micro, color: INK_FAINT, lineHeight: 1.5, marginTop: SPACE.xs }}>
          Saved as plain Markdown — no preview, what you type is the file.
        </div>
      </div>
    </Card>
  );
}

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
    <div style={{ height: "100%", overflowY: "auto", overflowAnchor: "none", scrollbarGutter: "stable", padding: "32px 40px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: "40px", justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: "100%", maxWidth: "760px", flex: "1 1 480px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: SPACE.base, marginBottom: SPACE.md }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled document"
              style={{ ...pageTitleInput, flex: 1 }}
            />
            <button
              className="btn btn--sm btn--subtle"
              onClick={() => copyMd(rawMarkdown())}
              title="Copy this document's raw markdown to the clipboard"
              style={{ flexShrink: 0, marginTop: "6px", color: copied ? ACCENT.action : INK_SOFT }}
            >
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy .md</>}
            </button>
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
          <MarkdownEditor value={doc.body} onChange={(body) => onChange({ body })} hint={false} placeholder="Write the document in Markdown…" />
        </div>

        <aside style={{ width: "232px", flexShrink: 0, position: "sticky", top: "4px" }}>
          <MarkdownLegend />
        </aside>
      </div>
    </div>
  );
}
