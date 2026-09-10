import { useState } from "react";
import { Plus, Link2, X } from "lucide-react";
import { SIZE, SPACE } from "./lib/theme";
import { editArea, meta } from "./ui/text";
import { metaInputStyle } from "./ui/cardStyles";
import AutoTextarea from "./ui/AutoTextarea";

// The editable innards of a signal card, shared by the Discovery board, the Activity page and
// Research Repository (via SignalCard.jsx), so a signal looks and behaves the same wherever you
// meet it. Only the *chrome* differs: the board wraps this in graph furniture (a connection
// handle, reorder arrows, node dimming), the others don't.
//
// The observation is the point of a signal; everything else is a single quiet line beneath it,
// not a stacked mini-form. Two rules keep that line from turning back into one:
//   - a field with nothing in it doesn't render at all — an empty bordered "Link" input just
//     to say "there's no link" is worse than not mentioning it — and shows up instead as a
//     small "+ Link"/"+ Author" that only appears while you're actually looking at the card
//     (the .reveal/.reveal-group pair already used for a card's corner delete elsewhere).
//   - once you add one, it stays visible for the rest of the session even if you clear it back
//     to empty, so the field you're mid-typing-into doesn't disappear out from under you.
// Date and Link drop out entirely when the signal came from an activity: that activity already
// records when it happened and links to its own notes, so asking again per signal is duplicate
// entry — there's no "+" for those two in that case, not even a hidden one. Activity itself is
// optional the same way Link/Author are — "+ Activity" when there isn't one, a plain select (no
// "Other"/free-text alternative — see signalModel.js) once there is, with its own small "×" to
// let go of it again.
//
// `after` appends extra content to this same wrapping row (Research Repository uses it for
// "linked in N specs" / "Attach to spec" — cross-spec facts that are metadata about the signal,
// not fields of it, so they belong beside Date/Author rather than on a line of their own).
export default function SignalCardBody({ signal, activities, onChange, autoFocus = false, missing = false, after }) {
  // These only ever flip true by clicking "+ …" — starting them from the current value would
  // autofocus a field that already had content the moment the card first renders. Declared
  // before the `missing` early return below: React requires every hook to run on every render,
  // and a missing signal still renders this component (just its fallback message).
  const [linkOpen, setLinkOpen] = useState(false);
  const [authorOpen, setAuthorOpen] = useState(false);

  if (missing) {
    return (
      <div style={{ fontStyle: "italic", fontSize: SIZE.ui, color: meta.color }}>
        Signal no longer exists.
      </div>
    );
  }

  const fromActivity = signal.source?.type === "activity";
  const dateValue = signal.date ? new Date(signal.date).toISOString().slice(0, 10) : "";

  const hasLink = !!signal.link;
  const hasAuthor = !!signal.author;

  const showLink = !fromActivity && (hasLink || linkOpen);
  const showAuthor = hasAuthor || authorOpen;

  return (
    <>
      <AutoTextarea
        className="el-edit" minRows={2} autoFocus={autoFocus}
        value={signal.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="What you observed…"
        style={editArea}
      />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: SPACE.lg, rowGap: SPACE.xs, marginTop: SPACE.base }}>
        {fromActivity ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: SPACE.xs }}>
            <select
              className="el-meta-input"
              value={signal.source.activityId || ""}
              onChange={(e) => onChange({ source: { type: "activity", activityId: e.target.value } })}
              style={{ ...metaInputStyle, ...compactField, cursor: "pointer", minWidth: "120px" }}
            >
              <option value="" disabled>Pick an activity…</option>
              {(activities || []).map((a) => (
                <option key={a.id} value={a.id}>{a.name || "Untitled activity"}</option>
              ))}
            </select>
            <button
              onClick={() => onChange({ source: null })}
              title="Remove activity"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "14px", height: "14px", color: metaInputStyle.color,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <X size={10} />
            </button>
          </span>
        ) : (
          <AddField label="Activity" onClick={() => onChange({ source: { type: "activity", activityId: "" } })} />
        )}

        {!fromActivity && (
          <input
            className="el-meta-input" type="date" value={dateValue}
            onChange={(e) => onChange({ date: e.target.value ? new Date(e.target.value).getTime() : Date.now() })}
            style={{ ...metaInputStyle, ...compactField }}
          />
        )}

        {showLink ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: SPACE.xs }}>
            <Link2 size={11} style={{ color: metaInputStyle.color, flexShrink: 0 }} />
            <input
              className="el-meta-input" value={signal.link} onChange={(e) => onChange({ link: e.target.value })}
              onBlur={() => { if (!signal.link) setLinkOpen(false); }}
              autoFocus={linkOpen && !hasLink}
              placeholder="Link" style={{ ...metaInputStyle, ...compactField, minWidth: "110px" }}
            />
          </span>
        ) : (
          !fromActivity && <AddField label="Link" onClick={() => setLinkOpen(true)} />
        )}

        {showAuthor ? (
          <input
            className="el-meta-input" value={signal.author} onChange={(e) => onChange({ author: e.target.value })}
            onBlur={() => { if (!signal.author) setAuthorOpen(false); }}
            autoFocus={authorOpen && !hasAuthor}
            placeholder="Author" style={{ ...metaInputStyle, ...compactField, minWidth: "100px" }}
          />
        ) : (
          <AddField label="Author" onClick={() => setAuthorOpen(true)} />
        )}

        {after}
      </div>
    </>
  );
}

// Sized like `meta` (11px) but NOT colored like it — INK_FAINT is ~2.4:1 against plain white
// already, below WCAG's 3:1 floor even for large text, and a signal card's tint only pulls
// that further down. metaInputStyle's own INK_SOFT (~4.5:1) is what actually stays legible on
// a tinted surface, so only the size comes from `meta` here — inheriting its color too would
// silently override that back down to the same too-faint grey.
const compactField = { width: "auto", margin: 0, padding: "1px 4px", fontSize: meta.fontSize };

// Hidden until the card is hovered — there's nothing to add yet, so nothing to show until
// you're actually looking. `.reveal` / `.reveal-group` are the same pair the card's own
// corner-delete button uses (see SignalCard.jsx).
function AddField({ label, onClick }) {
  return (
    <button
      className="reveal"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: "3px",
        fontFamily: meta.fontFamily, fontSize: meta.fontSize, color: metaInputStyle.color,
        background: "none", border: "none", cursor: "pointer", padding: "1px 4px", margin: "-1px -4px",
      }}
    >
      <Plus size={9} /> {label}
    </button>
  );
}
