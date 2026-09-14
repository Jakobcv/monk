import { useRef } from "react";
import LiveMarkdown from "./ui/LiveMarkdown";
import { font, INK_FAINT, BORDER, SIZE, SPACE } from "./lib/theme";

// A Markdown editor that formats as you type (ui/LiveMarkdown.jsx) — no toolbar, and the value is
// still the raw markdown string: `onChange` gets the new string directly. It grows with its content;
// `minHeight` sets the floor — "60vh" for a full document (DocumentPage), 0 for a short blurb (an
// initiative's description). A small syntax legend sits underneath unless `hint={false}`.
// The reading scale on a spec's paper comes from the surface, not from a prop: the editor carries
// .edit-area, and `.paper-sheet .edit-area` sizes it (see index.css). `fill` makes the editor take
// all the height its parent will give it rather than only as much as it has written in it, which is
// what turns a sheet of paper into one: the legend drops to the foot of the page instead of floating
// under the first paragraph, and the blank space between the two is a click target that puts the
// caret at the end of the document — the way clicking below the last line of a page does everywhere
// else.
const mono = "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace";

const LEGEND = [
  ["# ", "heading"],
  ["**bold**", ""],
  ["_italic_", ""],
  ["- ", "list"],
  ["1. ", "numbered"],
  ["> ", "quote"],
  ["`code`", ""],
  ["[text](url)", "link"],
];

export default function MarkdownEditor({ value, onChange, minHeight = "60vh", hint = true, fill = false, placeholder = "Write in Markdown…" }) {
  const editorRef = useRef(null);
  // Only a click on the blank space itself counts — anything with its own target (the editor, the
  // legend) is left alone — and preventDefault keeps the mousedown from immediately blurring the
  // editor it just focused.
  const focusEnd = (e) => {
    if (!fill || e.target !== e.currentTarget) return;
    e.preventDefault();
    editorRef.current?.focusEnd();
  };
  return (
    <div
      onMouseDown={focusEnd}
      style={fill ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, cursor: "text" } : undefined}
    >
      <LiveMarkdown
        ref={editorRef}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        className="edit-area"
        // In fill mode the legend is pushed to the foot with an auto margin, which collapses to 0
        // once the writing reaches it — this keeps a gap between the last line and the legend's rule.
        style={{ padding: "4px 0", minHeight, marginBottom: fill && hint ? SPACE.lg : 0 }}
      />
      {hint && (
        <div style={{
          marginTop: fill ? "auto" : SPACE.lg, paddingTop: SPACE.base, borderTop: `1px solid ${BORDER}`,
          display: "flex", flexWrap: "wrap", columnGap: SPACE.lg, rowGap: SPACE.xs,
          fontSize: SIZE.xs, color: INK_FAINT,
        }}>
          {LEGEND.map(([token, label]) => (
            <span key={token} style={{ fontFamily: mono }}>
              {token}
              {label && <span style={{ fontFamily: font, marginLeft: "4px" }}>{label}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
