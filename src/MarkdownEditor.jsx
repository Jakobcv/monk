import AutoTextarea from "./ui/AutoTextarea";
import { editArea } from "./ui/text";
import { font, INK_FAINT, BORDER, SIZE, SPACE } from "./lib/theme";

// A plain raw-Markdown editor — no WYSIWYG, no toolbar. `value` is the markdown string and
// `onChange` gets the new string directly (same contract the old CrepeEditor exposed, so the
// call sites didn't move). It auto-grows to its content; `minHeight` sets the floor — "60vh"
// for a full document (DocumentPage, a spec's Design/Plan), "0" for a short blurb (an
// initiative's description). A small syntax legend sits underneath unless `hint={false}`.
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

export default function MarkdownEditor({ value, onChange, minHeight = "60vh", hint = true, placeholder = "Write in Markdown…" }) {
  return (
    <div>
      <AutoTextarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        minRows={1}
        placeholder={placeholder}
        style={{ ...editArea, padding: "4px 0", minHeight }}
      />
      {hint && (
        <div style={{
          marginTop: SPACE.lg, paddingTop: SPACE.base, borderTop: `1px solid ${BORDER}`,
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
