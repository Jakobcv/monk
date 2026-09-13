import { useEffect, useRef, useState } from "react";
import { Plus, X, Check, Minus, Ban } from "lucide-react";
import { INK, INK_FAINT, SPACE } from "./lib/theme";
import { Eyebrow, Meta } from "./ui/text";
import Button from "./ui/Button";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";
import LiveMarkdown from "./ui/LiveMarkdown";

// Enter/exit timings are mirrored in index.css (@keyframes cl-row-in / cl-row-out).
const ENTER_MS = 220;
const EXIT_MS = 140;

// The row's text and the rhythm of the rows live in .cl-input / .cl-rows (index.css), where the
// paper surface can step both up without this component being told where it is. All `paper` still
// decides is which add control to render, which is structural rather than typographic.

// Shared by Spec's Open Questions and Acceptance Criteria, an Initiative's Open Questions, and a
// spec's Tasks. `items` is [{text, checked, resolution?}], fully controlled by the parent.
//
// `tasks` (the Plan tab): items are [{text, status, note?}] instead, with status one of to do / in
// progress / done / blocked (lib/planModel.js). The marker is a button that cycles to do → in
// progress → done; blocked is a separate toggle on the row, because it's an exception rather than a
// step, and the marker of a blocked task unblocks it. A task is only its text and state — no note
// field. `summary` is shown beside the heading.
//
// `resolutions` (open questions only): a checked item gets a quieter field under it for the answer.
// The question stays the question — answers used to get pasted onto the end of it, which made the
// row unreadable and kept them out of the brief. It stays visible once written, even if unchecked
// again, and the key is removed from the item while it's empty so files don't fill with "".
//
// Each row's text is a single-line live-markdown field (ui/LiveMarkdown.jsx): a long item wraps onto
// the next line instead of scrolling out of sight, and **bold** or `code` in it formats as you
// type. It is still a single line of data: Enter doesn't insert a newline and pasted newlines
// become spaces, because every consumer (the brief's `- [ ] text`, the frontmatter) reads an item
// as one line.
//
// Per-row identity (needed so React animates the right node on add/remove) is assigned here
// and never persisted — the parent still stores plain {text, checked}. Its page remounts this
// editor per spec or initiative via its key, so a local id can't outlive the record it belongs to, and
// within one mount the list only ever changes through the add / remove / patch handlers below.
// Every consumer reads an item as one line. The field already keeps it to one (`singleLine`); this
// is the same rule applied to the value on its way out.
const oneLine = (s) => s.replace(/\r?\n/g, " ");

// Tasks mode. Blocked isn't in the cycle; its marker unblocks.
const NEXT_STATUS = { todo: "doing", doing: "done", done: "todo", blocked: "todo" };
const STATUS_LABEL = { todo: "to do", doing: "in progress", done: "done", blocked: "blocked" };

export default function ChecklistEditor({ label, items, onChange, paper = false, resolutions = false, tasks = false, summary = "" }) {
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
  // The row just added, which mounts focused. State rather than a ref cleared on first focus: in
  // development React mounts an editor, tears it down and mounts it again, and a flag already
  // cleared by the first mount left the real one unfocused.
  const [focusId, setFocusId] = useState(null);

  const patch = (idx, fields) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...fields } : it)));
  // A resolution (open questions): the key is removed while empty.
  const patchAside = (idx, key, value) =>
    onChange(items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [key]: oneLine(value) };
      if (!next[key]) delete next[key];
      return next;
    }));

  const add = () => {
    const id = idState.current.next();
    idState.current.ids = [...ids, id];
    setFocusId(id);
    setEntering((p) => new Set(p).add(id));
    setTimeout(() => setEntering((p) => { const n = new Set(p); n.delete(id); return n; }), ENTER_MS);
    onChange([...items, tasks ? { text: "", status: "todo" } : { text: "", checked: false }]);
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.lg }}>
        <Eyebrow>{label}</Eyebrow>
        {summary && <Meta style={{ fontVariantNumeric: "tabular-nums" }}>{summary}</Meta>}
      </div>
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
          const status = tasks ? (item.status in NEXT_STATUS ? item.status : "todo") : null;
          const done = tasks ? status === "done" : !!item.checked;
          return (
            // flex-start, so on a wrapped row the checkbox and × stay beside its first line.
            <div key={id} className={cls} style={{ display: "flex", alignItems: "flex-start", gap: SPACE.base }}>
              {tasks ? (
                // A button, so click, Space and Enter all move it on; the label says where it is.
                <button
                  type="button"
                  className={`cl-check cl-task cl-task--${status}`}
                  onClick={() => patch(idx, { status: NEXT_STATUS[status] })}
                  aria-label={`Status: ${STATUS_LABEL[status]}. ${status === "blocked" ? "Unblock" : "Change"}`}
                  title={status === "blocked" ? "Blocked — click to unblock" : `${STATUS_LABEL[status][0].toUpperCase()}${STATUS_LABEL[status].slice(1)} — click to change`}
                >
                  <span className="cl-check__box" aria-hidden="true">
                    {status === "done" && <Check size={12} strokeWidth={3.5} />}
                    {status === "blocked" && <Minus size={12} strokeWidth={3.5} />}
                  </span>
                </button>
              ) : (
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
              )}
              <div className="cl-body">
                {/* Formats its markdown as you type (ui/LiveMarkdown). The strikethrough and faint
                    ink of a checked item are set on the field and carry to the formatted text. */}
                <LiveMarkdown
                  singleLine
                  autoFocus={focusId === id}
                  value={item.text}
                  onChange={(v) => patch(idx, { text: oneLine(v) })}
                  placeholder="…"
                  ariaLabel={label}
                  className="cl-input"
                  style={{ textDecoration: done ? "line-through" : "none", color: done ? INK_FAINT : INK }}
                />
                {resolutions && !tasks && (item.checked || item.resolution) && (
                  <LiveMarkdown
                    singleLine
                    value={item.resolution || ""}
                    onChange={(v) => patchAside(idx, "resolution", v)}
                    placeholder="Resolution…"
                    ariaLabel={`${label}: resolution`}
                    className="cl-resolution"
                  />
                )}
              </div>
              {/* Bounded by the text 8px to its left and the next row 4px below — a square 40px
                  target would cover both. Held to the height of the first line (.cl-row__side). */}
              <div className="cl-row__side">
                {tasks && (
                  <IconButton
                    className="reveal"
                    onClick={() => patch(idx, { status: status === "blocked" ? "todo" : "blocked" })}
                    title={status === "blocked" ? "Unblock" : "Mark blocked"}
                    aria-pressed={status === "blocked"}
                    style={{ "--hit-w": "30px", "--hit-h": "28px" }}
                  >
                    <Ban size={15} />
                  </IconButton>
                )}
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
