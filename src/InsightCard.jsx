import { Trash2 } from "lucide-react";
import { BORDER_STRONG } from "./lib/theme";
import { cardSurface } from "./ui/cardStyles";
import IconButton from "./ui/IconButton";
import InsightCardBody from "./InsightCardBody";

// The tinted shell an insight sits in — everywhere except the Discovery board itself, for the
// same reason SignalCard makes that exception for Signal: a board's card also carries the
// connection handle, reorder arrows and graph-position ref every *other* card kind on that
// board shares (see Board.jsx's renderDelete/renderOrder/renderHandle), so pulling just
// insight's case out here would fragment board-wide chrome instead of consolidating it.
//
// `header`/`footer` are slots for a whole extra line; `metaExtra` (narrower, more commonly
// wanted) appends into the fields' own row — see InsightCardBody. Omit `onDelete` for an
// insight that hasn't been saved yet (the "New insight" form).
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
          style={{
            position: "absolute", top: "-7px", right: "-7px",
            width: "16px", height: "16px", borderRadius: "50%",
            border: `1px solid ${BORDER_STRONG}`, background: "#fff",
            "--hit": "24px", // same corner geometry as SignalCard — capped by the 12px grid gap
          }}
        >
          <Trash2 size={9} />
        </IconButton>
      )}
    </div>
  );
}
