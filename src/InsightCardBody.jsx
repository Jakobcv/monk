import { SIZE, SPACE, BG_HOVER, RADIUS } from "./lib/theme";
import { editArea, meta } from "./ui/text";
import AutoTextarea from "./ui/AutoTextarea";

// The editable innards of an insight card, shared by a spec's Discovery board and Research
// Repository — mirrors SignalCardBody's role for Signal, now that Insight has been promoted to
// the same global-record, only-ever-linked pattern (see insightModel.js).
//
// `sources` — the signals this insight was formed from, chosen once by selecting them in
// Research Repository's Signals section and choosing "Form insight from selection" — render as
// small read-only chips beneath the text. There's no editor for this list; it's a record of how
// the insight came to be, not a field you come back and revise.
//
// `after` appends extra content to that same row (Research Repository uses it for "linked in
// N specs" / "Attach to spec", same as SignalCardBody's `after`).
export default function InsightCardBody({ insight, signals, onChange, autoFocus = false, missing = false, after }) {
  if (missing) {
    return (
      <div style={{ fontStyle: "italic", fontSize: SIZE.ui, color: meta.color }}>
        Insight no longer exists.
      </div>
    );
  }

  const sourceSignals = (insight.sources || []).map((id) => (signals || []).find((s) => s.id === id)).filter(Boolean);

  return (
    <>
      <AutoTextarea
        className="el-edit" minRows={2} autoFocus={autoFocus}
        value={insight.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="The insight…"
        style={editArea}
      />

      {(sourceSignals.length > 0 || after) && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: SPACE.sm, rowGap: SPACE.xs, marginTop: SPACE.base }}>
          {sourceSignals.map((sig) => (
            <span
              key={sig.id} title={sig.text}
              style={{
                fontFamily: meta.fontFamily, fontSize: meta.fontSize, color: meta.color,
                background: BG_HOVER, borderRadius: RADIUS.xs, padding: "2px 6px", maxWidth: "160px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {sig.text ? sig.text.slice(0, 40) : "(empty signal)"}
            </span>
          ))}
          {after}
        </div>
      )}
    </>
  );
}
