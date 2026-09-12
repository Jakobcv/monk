import { X, Check } from "lucide-react";
import { BORDER_STRONG, ACCENT } from "./lib/theme";
import { cardSurface, cornerBadge } from "./ui/cardStyles";
import IconButton from "./ui/IconButton";
import SignalCardBody from "./SignalCardBody";

// The shell a signal sits in — everywhere except the Discovery board itself. That's a
// deliberate exception, not an oversight: a board's card also carries the connection handle,
// reorder arrows, and graph-position ref that every *other* card kind on that board shares too
// (see Board.jsx's renderDelete/renderOrder/renderHandle, generic across signal/insight/action/
// result), so pulling just its signal case out here would fragment board-wide chrome instead of
// consolidating it. The card itself still can't drift between the two: both use the same
// `cardSurface("signal")`, the same SignalCardBody, and the same `cornerBadge` corner control.
//
// `header`/`footer` are slots for a caller that needs a whole extra line inside the card.
// `metaExtra` renders *below* the card, outside it — Research Repository's "Open in <spec>" and
// "Attach to spec" are actions on the signal, not part of it, and keeping them outside is what
// lets the card look exactly like its Discovery-board twin.
// Omit `onDelete` for a signal that hasn't been saved yet (the "New signal" form) — there's
// nothing to delete, so no corner button renders.
//
// `onToggleSelect` turns on a selection box in the opposite corner — Research Repository's
// Signals section uses this for "select some signals, form an insight from them", the only
// place selection makes sense. Unlike the delete button, this doesn't hide until hover: once a
// card is selected that has to stay visible, not disappear the moment the mouse leaves.
//
// `fixedHeight` gives every card the same height — four lines of observation, ellipsised, above
// its metadata row — for a list meant to be scanned (Research Repository). Off by default: on a
// board or an activity page a signal is read in full, and the "New signal" dialog is where it is
// being written.
export default function SignalCard({
  signal, activities, onChange, onDelete, deleteTitle = "Delete this signal everywhere",
  autoFocus = false, missing = false, selected = false, onToggleSelect, header, footer, metaExtra, activityLink, style,
  fixedHeight = false,
}) {
  return (
    <div className="reveal-group" style={{ position: "relative", ...style }}>
      <div
        className={fixedHeight ? "el-card signal-card signal-card--fixed" : "el-card signal-card"}
        style={{
          ...cardSurface("signal"),
          ...(selected ? { boxShadow: `0 0 0 2px ${ACCENT.signal}` } : {}),
        }}
      >
        {header}
        <SignalCardBody
          signal={signal} activities={activities} onChange={onChange}
          autoFocus={autoFocus} missing={missing} activityLink={activityLink} after={metaExtra}
          clamp={fixedHeight}
        />
        {footer}
      </div>

      {onToggleSelect && (
        <button
          onClick={onToggleSelect}
          title={selected ? "Remove from selection" : "Select this signal"}
          className={selected ? "icon-btn" : "icon-btn reveal"}
          style={{
            ...cornerBadge, left: "-7px", borderRadius: "4px",
            border: `1px solid ${selected ? ACCENT.signal : BORDER_STRONG}`,
            background: selected ? ACCENT.signal : "#fff", color: "#fff",
          }}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </button>
      )}

      {onDelete && (
        <IconButton
          className="reveal" danger
          onClick={onDelete}
          title={deleteTitle}
          style={{ ...cornerBadge, right: "-7px" }}
        >
          <X size={12} />
        </IconButton>
      )}
    </div>
  );
}
