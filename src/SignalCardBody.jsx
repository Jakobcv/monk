import { useState, useRef } from "react";
import { Calendar } from "lucide-react";
import { INK_FAINT, SIZE, SPACE } from "./lib/theme";
import { metaInputStyle } from "./ui/cardStyles";
import AutoTextarea from "./ui/AutoTextarea";

// The editable innards of a signal card, shared by a research plan's board and Research Repository
// (via SignalCard.jsx), so a signal looks and behaves the same wherever you meet it. Only the
// *chrome* differs: the board wraps this in graph furniture (a connection handle, reorder arrows,
// node dimming), the repository doesn't.
//
// The observation is the point of a signal, so the card is almost entirely that text, with its date
// beneath. Which study it belongs to isn't a field of the signal — it's the boards it sits on — so
// the card doesn't carry it. Link and Author still exist on the record (markdown.js round-trips
// them) but aren't shown.
//
// `after` appends extra content to this same row (Research Repository uses it for cross-board facts
// about the signal rather than fields of it).
//
// `clamp` is for a card of fixed height (SignalCard's `fixedHeight`). A textarea can't show an
// ellipsis, so the text reads as a clamped preview — a native button, so Tab and Enter reach it
// with no hand-built key handling — and becomes the real textarea when activated, scrolling
// inside the same height rather than growing the card. Leaving the field puts the preview back.
export default function SignalCardBody({ signal, onChange, autoFocus = false, missing = false, after, clamp = false }) {
  // Declared before the `missing` early return: React requires every hook on every render.
  const [editing, setEditing] = useState(false);

  if (missing) {
    return (
      <div style={{ fontStyle: "italic", fontSize: SIZE.ui, color: INK_FAINT }}>
        Signal no longer exists.
      </div>
    );
  }

  return (
    <>
      {clamp ? (
        <div className="signal-card__text">
          {editing ? (
            <textarea
              className="el-edit edit-area signal-card__editor" autoFocus
              value={signal.text}
              onChange={(e) => onChange({ text: e.target.value })}
              // Caret at the end: the click that opened this landed on the preview, not on a
              // position in this field, so there is no "where you clicked" to honour.
              onFocus={(e) => { const end = e.target.value.length; e.target.setSelectionRange(end, end); }}
              onBlur={() => setEditing(false)}
              placeholder="What you observed…"
            />
          ) : (
            <button type="button" className="edit-area signal-card__preview" onClick={() => setEditing(true)}>
              {signal.text || <span style={{ color: INK_FAINT }}>What you observed…</span>}
            </button>
          )}
        </div>
      ) : (
        <AutoTextarea
          className="el-edit edit-area" minRows={2} autoFocus={autoFocus}
          value={signal.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="What you observed…"
        />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: SPACE.lg, rowGap: SPACE.xs, marginTop: SPACE.base }}>
        <DateField value={signal.date} onChange={(date) => onChange({ date })} />
        {after}
      </div>
    </>
  );
}

// Sized like `meta` (11px) but NOT colored like it — INK_FAINT is ~2.4:1 against plain white
// already, below WCAG's 3:1 floor even for large text, and a signal card's tint only pulls
// that further down. metaInputStyle's own INK_SOFT (~4.5:1) is what actually stays legible on
// a tinted surface, so only the size is shared.
const compactField = { width: "auto", margin: 0, padding: "1px 4px", fontSize: SIZE.xs };

// The date as a small button — "11 Sep 2026" with the calendar icon right beside it — that opens
// the browser's own picker. Not a styled <input type="date">: Chrome gives that a fixed
// intrinsic width it won't give up (field-sizing doesn't apply), and its internal layout can't
// be reliably restyled, so the native icon ended up stranded far from a short date. The real
// input stays underneath, invisible, purely to host the picker (and anchor where it opens).
function DateField({ value, onChange }) {
  const inputRef = useRef(null);
  const label = value
    ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "Add date";
  const openPicker = () => {
    try { inputRef.current.showPicker(); } catch { inputRef.current.focus(); }
  };
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className="el-meta-input"
        onClick={openPicker}
        aria-label={value ? `Date: ${label}. Change date` : "Add date"}
        style={{ ...metaInputStyle, ...compactField, display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
      >
        {label}
        <Calendar size={12} aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value ? new Date(value).toISOString().slice(0, 10) : ""}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).getTime() : Date.now())}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, pointerEvents: "none", border: 0, padding: 0, margin: 0 }}
      />
    </span>
  );
}
