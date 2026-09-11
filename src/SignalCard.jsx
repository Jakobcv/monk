import { Trash2, Check } from "lucide-react";
import { BORDER_STRONG, ACCENT } from "./lib/theme";
import { cardSurface } from "./ui/cardStyles";
import IconButton from "./ui/IconButton";
import SignalCardBody from "./SignalCardBody";

// The tinted shell a signal sits in — everywhere except the Discovery board itself. That's a
// deliberate exception, not an oversight: a board's card also carries the connection handle,
// reorder arrows, and graph-position ref that every *other* card kind on that board shares too
// (see Board.jsx's renderDelete/renderOrder/renderHandle, generic across signal/insight/action/
// result), so pulling just its signal case out here would fragment board-wide chrome instead of
// consolidating it. The tint and fields still can't drift between the two, though — both read
// from the same `cardSurface("signal")` token and the same SignalCardBody.
//
// `header`/`footer` are slots for a caller that needs a whole extra line above or below the
// fields. `metaExtra` is narrower and more commonly what's wanted: extra items appended into
// the fields' own metadata row (see SignalCardBody) — Research Repository's "linked in N specs"
// and "Attach to spec" are facts about the signal, not fields of it, so they read better beside
// Source/Date/Author than as a separate row competing for space.
// Omit `onDelete` for a signal that hasn't been saved yet (the "New signal" form) — there's
// nothing to delete, so no corner button renders.
//
// `onToggleSelect` turns on a selection checkbox in the opposite corner — Research Repository's
// Signals section uses this for "select some signals, form an insight from them", the only
// place selection makes sense. Unlike the delete button, this doesn't hide until hover: once a
// card is selected that has to stay visible, not disappear the moment the mouse leaves.
export default function SignalCard({
  signal, activities, onChange, onDelete, deleteTitle = "Delete this signal everywhere",
  autoFocus = false, missing = false, selected = false, onToggleSelect, header, footer, metaExtra, activityLink, style,
}) {
  return (
    <div className="reveal-group" style={{ position: "relative", ...style }}>
      <div
        className="el-card signal-card"
        style={{
          ...cardSurface("signal"),
          ...(selected ? { boxShadow: `0 0 0 2px ${ACCENT.signal}` } : {}),
        }}
      >
        {header}
        <SignalCardBody
          signal={signal} activities={activities} onChange={onChange}
          autoFocus={autoFocus} missing={missing} after={metaExtra} activityLink={activityLink}
        />
        {footer}
      </div>

      {onToggleSelect && (
        <button
          onClick={onToggleSelect}
          title={selected ? "Remove from selection" : "Select this signal"}
          className={selected ? undefined : "reveal"}
          style={{
            position: "absolute", top: "-7px", left: "-7px",
            width: "22px", height: "22px", borderRadius: "6px",
            border: `1px solid ${selected ? ACCENT.signal : BORDER_STRONG}`,
            background: selected ? ACCENT.signal : "#fff",
            color: "#fff", cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4,
          }}
        >
          {selected && <Check size={16} strokeWidth={3} />}
        </button>
      )}

      {onDelete && (
        <IconButton
          className="reveal" danger
          onClick={onDelete}
          title={deleteTitle}
          style={{
            position: "absolute", top: "-7px", right: "-7px",
            width: "22px", height: "22px", borderRadius: "50%",
            border: `1px solid ${BORDER_STRONG}`, background: "#fff",
            // Hangs 7px off the card corner, and the grid leaves 12px between cards — so the
            // neighbour's edge is only ~13px from this button's centre. 24px is the largest
            // target that doesn't reach onto the card next door.
            "--hit": "26px",
          }}
        >
          <Trash2 size={16} />
        </IconButton>
      )}
    </div>
  );
}
