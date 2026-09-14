import { useEffect, useRef, useState } from "react";
import { Plus, Target, X } from "lucide-react";
import { SPACE } from "./lib/theme";
import { blankOutcome } from "./lib/initiativeModel";
import { Eyebrow } from "./ui/text";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";
import LiveMarkdown from "./ui/LiveMarkdown";

// Enter/exit timings are mirrored in index.css (@keyframes cl-row-in / cl-row-out).
const ENTER_MS = 220;
const EXIT_MS = 140;

const oneLine = (s) => s.replace(/\r?\n/g, " ");

// One of the small number fields under an outcome. `size` is what sizes it where CSS
// field-sizing isn't supported.
function MetaField({ value, onChange, placeholder, label, className = "" }) {
  return (
    <input
      className={`outcome-field ${className}`}
      value={value}
      onChange={(e) => onChange(oneLine(e.target.value))}
      placeholder={placeholder}
      aria-label={label}
      size={Math.max((value || placeholder).length, 3)}
      spellCheck={false}
    />
  );
}

// An initiative's outcomes (see initiativeModel.js) on paper: PaperListEditor's rows, with a
// target in the gutter, the change itself as the line, and under it what's measured and
// baseline → target, now. Every number is optional and free text. `items` is fully controlled by
// the parent; row identity for the animation is local, and the parent remounts this per record.
export default function OutcomesEditor({ items, onChange }) {
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
    onChange([...items, blankOutcome()]);
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

  const set = (idx, field) => (v) => onChange(items.map((o, i) => (i === idx ? { ...o, [field]: v } : o)));

  return (
    <div>
      <Eyebrow>Outcomes</Eyebrow>
      {items.length === 0 && (
        <p className="paper-hint" style={{ marginTop: SPACE.base }}>
          The change this work should cause — in what customers do, or in value to the business — and how you'll know it moved.
        </p>
      )}
      <div className="cl-rows" style={{ marginTop: SPACE.base }}>
        {items.map((o, idx) => {
          const id = ids[idx];
          const cls = "cl-row reveal-group"
            + (entering.has(id) ? " cl-row--enter" : "")
            + (exiting.has(id) ? " cl-row--exit" : "");
          return (
            <div key={id} className={cls} style={{ display: "flex", alignItems: "flex-start", gap: SPACE.base }}>
              <span className="cl-check outcome-marker" aria-hidden="true">
                <Target size={14} />
              </span>
              <div className="cl-body">
                <LiveMarkdown
                  singleLine
                  autoFocus={focusId === id}
                  value={o.text}
                  onChange={(v) => set(idx, "text")(oneLine(v))}
                  placeholder="A change in behaviour or value…"
                  ariaLabel="Outcome"
                  className="cl-input"
                />
                <div className="outcome-meta">
                  <span className="outcome-group">
                    <MetaField value={o.metric} onChange={set(idx, "metric")} placeholder="What's measured" label="Metric" />
                  </span>
                  <span className="outcome-group">
                    <MetaField value={o.baseline} onChange={set(idx, "baseline")} placeholder="baseline" label="Baseline" />
                    <span className="outcome-quiet" aria-hidden="true">→</span>
                    <MetaField value={o.target} onChange={set(idx, "target")} placeholder="target" label="Target" className="outcome-field--target" />
                  </span>
                  <span className="outcome-group">
                    <span className="outcome-quiet">now</span>
                    <MetaField value={o.current} onChange={set(idx, "current")} placeholder="—" label="Current value" />
                  </span>
                </div>
              </div>
              <div className="cl-row__side">
                <IconButton className="reveal" onClick={() => remove(id)} title="Remove" aria-label="Remove outcome" danger style={{ "--hit-w": "34px", "--hit-h": "28px" }}>
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "2px" }}>
        <PaperButton icon={Plus} onClick={add}>Add outcome</PaperButton>
      </div>
    </div>
  );
}
