import { useEffect, useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { INK, INK_FAINT, SPACE } from "./lib/theme";
import { Eyebrow } from "./ui/text";
import Button from "./ui/Button";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";
import AutoTextarea from "./ui/AutoTextarea";

// Enter/exit timings are mirrored in index.css (@keyframes cl-row-in / cl-row-out).
const ENTER_MS = 220;
const EXIT_MS = 140;

// The row's text and the rhythm of the rows live in .cl-input / .cl-rows (index.css), where the
// paper surface can step both up without this component being told where it is. All `paper` still
// decides is which add control to render, which is structural rather than typographic.

// Shared by Spec's Open Questions and Acceptance Criteria, and an Initiative's Open Questions.
// `items` is [{text, checked, resolution?}], fully controlled by the parent.
//
// `resolutions` (open questions only): a checked item gets a quieter field under it for the answer.
// The question stays the question — answers used to get pasted onto the end of it, which made the
// row unreadable and kept them out of the brief. It stays visible once written, even if unchecked
// again, and the key is removed from the item while it's empty so files don't fill with "".
//
// Each row's text is a one-item-per-row textarea rather than an input, so a long item wraps onto
// the next line instead of scrolling out of sight. It is still a single line of data: Enter
// doesn't insert a newline and pasted newlines become spaces, because every consumer (the brief's
// `- [ ] text`, the frontmatter) reads an item as one line.
//
// Per-row identity (needed so React animates the right node on add/remove) is assigned here
// and never persisted — the parent still stores plain {text, checked}. Its page remounts this
// editor per spec or initiative via its key, so a local id can't outlive the record it belongs to, and
// within one mount the list only ever changes through the add / remove / patch handlers below.
// Every consumer reads an item as one line, so Enter never starts a second one.
const noEnter = (e) => { if (e.key === "Enter") e.preventDefault(); };
const oneLine = (s) => s.replace(/\r?\n/g, " ");

export default function ChecklistEditor({ label, items, onChange, paper = false, resolutions = false }) {
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
  const patchResolution = (idx, value) =>
    onChange(items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, resolution: oneLine(value) };
      if (!next.resolution) delete next.resolution;
      return next;
    }));

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
      <Eyebrow>{label}</Eyebrow>
      <div className="cl-rows" style={{ marginTop: SPACE.base }}>
        {items.map((item, idx) => {
          const id = ids[idx];
          // reveal-group: the remove × stays out of the way until you're on the row, the same
          // way Design's rows behave — a always-there column of ×s down the right of a page reads
          // as part of the writing, and there are more rows here than anywhere else in the app.
          // (.reveal also answers :focus-within, so tabbing to the row still surfaces it.)
          const cls = "cl-row reveal-group"
            + (entering.has(id) ? " cl-row--enter" : "")
            + (exiting.has(id) ? " cl-row--exit" : "");
          return (
            // flex-start, so on a wrapped row the checkbox and × stay beside its first line.
            <div key={id} className={cls} style={{ display: "flex", alignItems: "flex-start", gap: SPACE.base }}>
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
              <div className="cl-body">
                <AutoTextarea
                  ref={(el) => { if (el && focusId.current === id) { el.focus(); focusId.current = null; } }}
                  minRows={1}
                  value={item.text}
                  onChange={(e) => patch(idx, { text: oneLine(e.target.value) })}
                  onKeyDown={noEnter}
                  placeholder="…"
                  aria-label={label}
                  className="cl-input"
                  style={{ textDecoration: item.checked ? "line-through" : "none", color: item.checked ? INK_FAINT : INK }}
                />
                {resolutions && (item.checked || item.resolution) && (
                  <AutoTextarea
                    minRows={1}
                    value={item.resolution || ""}
                    onChange={(e) => patchResolution(idx, e.target.value)}
                    onKeyDown={noEnter}
                    placeholder="Resolution…"
                    aria-label={`${label}: resolution`}
                    className="cl-resolution"
                  />
                )}
              </div>
              {/* Bounded by the text 8px to its left and the next row 4px below — a square 40px
                  target would cover both. Held to the height of the first line (.cl-row__side). */}
              <div className="cl-row__side">
                <IconButton className="reveal" onClick={() => remove(id)} title="Remove" danger style={{ "--hit-w": "34px", "--hit-h": "28px" }}>
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>
      {/* On paper the add control is a row of the list itself (ui/PaperButton); off it, the
          app's ordinary ghost button. */}
      <div style={{ marginTop: paper ? "2px" : SPACE.md }}>
        {paper ? (
          <PaperButton icon={Plus} onClick={add}>Add</PaperButton>
        ) : (
          <Button variant="subtle" onClick={add} style={{ marginLeft: "-6px" }}>
            <Plus size={16} /> Add
          </Button>
        )}
      </div>
    </div>
  );
}
