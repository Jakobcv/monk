import { X } from "lucide-react";
import { cardSurface, cornerBadge } from "./ui/cardStyles";
import IconButton from "./ui/IconButton";
import InsightCardBody from "./InsightCardBody";

// The shell an insight sits in — everywhere except the Discovery board itself, for the
// same reason SignalCard makes that exception for Signal: a board's card also carries the
// connection handle, reorder arrows and graph-position ref every *other* card kind on that
// board shares (see Board.jsx's renderDelete/renderOrder/renderHandle), so pulling just
// insight's case out here would fragment board-wide chrome instead of consolidating it. The card
// itself still matches its board twin: same `cardSurface("insight")`, same InsightCardBody, same
// `cornerBadge` corner control.
//
// `header`/`footer` are slots for a whole extra line inside the card. `metaExtra` appends into
// the body's own metadata row, beside the source-signal chips — same as SignalCard (Research
// Repository puts "Attach to spec" there). Omit `onDelete` for an insight that hasn't been saved
// yet (the "New insight" form).
export default function InsightCard({
  insight, signals, onChange, onDelete, deleteTitle = "Delete this insight everywhere",
  autoFocus = false, missing = false, header, footer, metaExtra, style,
}) {
  return (
    <div className="reveal-group" style={{ position: "relative", ...style }}>
      <div className="el-card" style={cardSurface("insight")}>
        {header}
        <InsightCardBody
          insight={insight} signals={signals} onChange={onChange}
          autoFocus={autoFocus} missing={missing} after={metaExtra}
        />
        {footer}
      </div>

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
