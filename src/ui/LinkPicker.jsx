import { useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, SIZE, SPACE, RADIUS } from "../lib/theme";
import { useDismiss } from "../lib/useDismiss";

const WIDTH = 280;
// Room the popover needs below its anchor before it opens upwards instead: the search field,
// the 160px list and an action row.
const ROOM_BELOW = 260;

// A floating search-and-pick list for linking one record to another — an insight to a research
// question, a research plan to a spec. The same surface a Discovery board uses to link a signal
// (Board.jsx), as one component: `fixed`, so a scrolling column can't clip it, positioned off the
// control that opened it, and closed by Escape, an outside press, scroll or resize (useDismiss).
//
// Render it only while open. The control that opens it should carry `data-dismiss-ignore`, or the
// press that toggles it closed would also count as an outside press and reopen it.
//
// `items` are [{ id, label, meta? }] — already filtered to what can be linked. `action` is an
// optional { label, onClick } row at the foot, for "create a new one and link it".
export default function LinkPicker({
  anchorRef, onClose, items, onPick, placeholder = "Search…", emptyText = "Nothing to link.",
  label = "Link", action = null, align = "right",
}) {
  const ref = useRef(null);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.round(Math.max(8, Math.min(align === "left" ? r.left : r.right - WIDTH, window.innerWidth - WIDTH - 8)));
    setPos(r.bottom + ROOM_BELOW > window.innerHeight && r.top > ROOM_BELOW
      ? { bottom: Math.round(window.innerHeight - r.top + 6), left }
      : { top: Math.round(r.bottom + 6), left });
  }, [anchorRef, align]);

  useDismiss(true, ref, onClose);

  const ql = query.trim().toLowerCase();
  const matches = items.filter((it) => !ql || (it.label || "").toLowerCase().includes(ql)).slice(0, 30);
  const pick = (id) => { onPick(id); onClose(); };

  if (!pos) return null;
  return (
    <div ref={ref} role="dialog" aria-label={label} className="popover enter-up" style={{ ...pos, width: WIDTH }}>
      <input
        autoFocus
        className="field"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); pick(matches[0].id); } }}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, "")}
        style={{ width: "100%", marginBottom: SPACE.md }}
      />
      {matches.length === 0 ? (
        <div style={{ fontFamily: font, fontSize: SIZE.sm, color: INK_FAINT, padding: "4px 2px" }}>
          {ql ? "No matches." : emptyText}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, maxHeight: "160px", overflowY: "auto" }}>
          {matches.map((it) => (
            <button
              key={it.id}
              type="button"
              className="pick-row"
              onClick={() => pick(it.id)}
              title={it.label}
              style={{ textAlign: "left", fontFamily: font, fontSize: SIZE.sm, color: INK, background: "none", border: "none", borderRadius: RADIUS.sm, padding: "5px 6px", cursor: "pointer" }}
            >
              <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {it.label || "Untitled"}
              </span>
              {it.meta && <span style={{ display: "block", fontSize: SIZE.xs, color: INK_FAINT, marginTop: "1px" }}>{it.meta}</span>}
            </button>
          ))}
        </div>
      )}
      {action && (
        <button
          type="button"
          className="pick-row"
          onClick={() => { action.onClick(); onClose(); }}
          style={{ display: "flex", alignItems: "center", gap: SPACE.sm, width: "100%", marginTop: SPACE.sm, textAlign: "left", fontFamily: font, fontSize: SIZE.sm, color: INK_SOFT, background: "none", border: "none", borderRadius: RADIUS.sm, padding: "5px 6px", cursor: "pointer" }}
        >
          <Plus size={14} /> {action.label}
        </button>
      )}
    </div>
  );
}
