import { useEffect, useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { font, INK, INK_FAINT, SIZE, WEIGHT, SPACE } from "./lib/theme";
import { eyebrow } from "./ui/text";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

// Enter/exit timings are mirrored in index.css (@keyframes cl-row-in / cl-row-out).
const ENTER_MS = 220;
const EXIT_MS = 140;

const rowInput = {
  flex: 1, border: "none", borderBottom: "1px solid transparent", outline: "none", background: "none",
  fontFamily: font, fontWeight: WEIGHT.normal, fontSize: SIZE.ui, color: INK, padding: "2px 0",
};

// Shared by Spec's Open Questions and Acceptance Criteria — no checklist UI exists elsewhere
// in the app yet, this is new. `items` is [{text, checked}], fully controlled by the parent.
//
// Per-row identity (needed so React animates the right node on add/remove) is assigned here
// and never persisted — the parent still stores plain {text, checked}. SpecPage remounts this
// editor per spec via key={spec.id}, so a local id can't outlive the spec it belongs to, and
// within one mount the list only ever changes through the add / remove / patch handlers below.
export default function ChecklistEditor({ label, items, onChange }) {
  const idState = useRef();
  if (!idState.current) {
    let seq = 0;
    idState.current = { ids: items.map(() => seq++), next: () => seq++ };
  }
  const ids = idState.current.ids;

  // Latest items/onChange for the deferred removal, so a fade-out in flight never
  // clobbers an edit the user makes to another row while it runs.
  const latest = useRef({ items, onChange });
  useEffect(() => { latest.current = { items, onChange }; });

  const [entering, setEntering] = useState(() => new Set());
  const [exiting, setExiting] = useState(() => new Set());
  const focusId = useRef(null);

  const patch = (idx, fields) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...fields } : it)));

  const add = () => {
    const id = idState.current.next();
    idState.current.ids = [...ids, id];
    focusId.current = id;
    setEntering((p) => new Set(p).add(id));
    setTimeout(() => setEntering((p) => { const n = new Set(p); n.delete(id); return n; }), ENTER_MS);
    onChange([...items, { text: "", checked: false }]);
  };

  const remove = (id) => {
    setExiting((p) => {
      if (p.has(id)) return p;
      return new Set(p).add(id);
    });
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
      <div style={eyebrow}>{label}</div>
      <div style={{ marginTop: SPACE.base, display: "flex", flexDirection: "column", gap: SPACE.sm }}>
        {items.map((item, idx) => {
          const id = ids[idx];
          const cls = "cl-row"
            + (entering.has(id) ? " cl-row--enter" : "")
            + (exiting.has(id) ? " cl-row--exit" : "");
          return (
            <div key={id} className={cls} style={{ display: "flex", alignItems: "center", gap: SPACE.base }}>
              <label className="cl-check">
                <input
                  type="checkbox"
                  checked={!!item.checked}
                  onChange={(e) => patch(idx, { checked: e.target.checked })}
                />
                <span className="cl-check__box" aria-hidden="true">
                  <Check size={12} strokeWidth={3.5} />
                </span>
              </label>
              <input
                ref={(el) => { if (el && focusId.current === id) { el.focus(); focusId.current = null; } }}
                value={item.text}
                onChange={(e) => patch(idx, { text: e.target.value })}
                placeholder="…"
                style={{ ...rowInput, textDecoration: item.checked ? "line-through" : "none", color: item.checked ? INK_FAINT : INK }}
              />
              <IconButton onClick={() => remove(id)} title="Remove" danger style={{ flexShrink: 0 }}>
                <X size={13} />
              </IconButton>
            </div>
          );
        })}
      </div>
      <Button variant="subtle" onClick={add} style={{ marginTop: SPACE.md, marginLeft: "-6px" }}>
        <Plus size={12} /> Add
      </Button>
    </div>
  );
}
