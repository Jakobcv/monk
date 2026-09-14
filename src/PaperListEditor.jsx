import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { SPACE } from "./lib/theme";
import { Eyebrow, Meta } from "./ui/text";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";
import LiveMarkdown from "./ui/LiveMarkdown";

// Enter/exit timings are mirrored in index.css (@keyframes cl-row-in / cl-row-out).
const ENTER_MS = 220;
const EXIT_MS = 140;

const oneLine = (s) => s.replace(/\r?\n/g, " ");

// A list of plain one-line entries on paper — a research plan's activities. ChecklistEditor's rows
// with nothing to tick: a bullet in the gutter, the text, a remove ×. `items` is an array of strings,
// fully controlled by the parent; row identity for the enter/exit animation is local, as in
// ChecklistEditor, and the parent remounts this per record.
export default function PaperListEditor({ label, items, onChange, addLabel = "Add", placeholder = "…", summary = "" }) {
  const idState = useRef();
  if (!idState.current) {
    let seq = 0;
    idState.current = { ids: items.map(() => seq++), next: () => seq++ };
  }
  const ids = idState.current.ids;

  const latest = useRef({ items, onChange });
  useEffect(() => { latest.current = { items, onChange }; });

  const [entering, setEntering] = useState(() => new Set());
  const [exiting, setExiting] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);

  const add = () => {
    const id = idState.current.next();
    idState.current.ids = [...ids, id];
    setFocusId(id);
    setEntering((p) => new Set(p).add(id));
    setTimeout(() => setEntering((p) => { const n = new Set(p); n.delete(id); return n; }), ENTER_MS);
    onChange([...items, ""]);
  };

  const remove = (id) => {
    setExiting((p) => (p.has(id) ? p : new Set(p).add(id)));
    setTimeout(() => {
      const at = idState.current.ids.indexOf(id);
      if (at !== -1) {
        idState.current.ids = idState.current.ids.filter((x) => x !== id);
        latest.current.onChange(latest.current.items.filter((_, i) => i !== at));
      }
      setExiting((p) => { const n = new Set(p); n.delete(id); return n; });
    }, EXIT_MS);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.lg }}>
        <Eyebrow>{label}</Eyebrow>
        {summary && <Meta style={{ fontVariantNumeric: "tabular-nums" }}>{summary}</Meta>}
      </div>
      <div className="cl-rows" style={{ marginTop: SPACE.base }}>
        {items.map((item, idx) => {
          const id = ids[idx];
          const cls = "cl-row reveal-group"
            + (entering.has(id) ? " cl-row--enter" : "")
            + (exiting.has(id) ? " cl-row--exit" : "");
          return (
            <div key={id} className={cls} style={{ display: "flex", alignItems: "flex-start", gap: SPACE.base }}>
              <span className="cl-check paper-list__bullet" aria-hidden="true">
                <span className="paper-list__dot" />
              </span>
              <div className="cl-body">
                <LiveMarkdown
                  singleLine
                  autoFocus={focusId === id}
                  value={item}
                  onChange={(v) => onChange(items.map((it, i) => (i === idx ? oneLine(v) : it)))}
                  placeholder={placeholder}
                  ariaLabel={label}
                  className="cl-input"
                />
              </div>
              <div className="cl-row__side">
                <IconButton className="reveal" onClick={() => remove(id)} title="Remove" aria-label={`Remove from ${label}`} danger style={{ "--hit-w": "34px", "--hit-h": "28px" }}>
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "2px" }}>
        <PaperButton icon={Plus} onClick={add}>{addLabel}</PaperButton>
      </div>
    </div>
  );
}
