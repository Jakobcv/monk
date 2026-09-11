import { useState } from "react";
import { Plus, FlaskConical } from "lucide-react";
import { SIZE, SPACE } from "./lib/theme";
import { editArea, meta } from "./ui/text";
import { metaInputStyle } from "./ui/cardStyles";
import AutoTextarea from "./ui/AutoTextarea";

// Same shape as App.jsx's hrefActivity — a plain hash link, so the card needs no routing prop
// threaded through every page that renders one.
const activityHref = (id) => "#/activity/" + encodeURIComponent(id);

// The editable innards of a signal card, shared by the Discovery board, the Activity page and
// Research Repository (via SignalCard.jsx), so a signal looks and behaves the same wherever you
// meet it. Only the *chrome* differs: the board wraps this in graph furniture (a connection
// handle, reorder arrows, node dimming), the others don't.
//
// The observation is the point of a signal, so the card is almost entirely that text. What's
// left beneath it is deliberately small:
//   - an activity-sourced signal shows just a small icon that opens that activity (its name is
//     the tooltip) — the activity already records when it happened and where its notes live,
//     so the card doesn't repeat any of it. `activityLink={false}` hides the icon where it
//     would only point back at the page you're already on (the Activity page itself).
//   - a loose signal keeps its date, plus a "+ Activity" that only appears while you're
//     looking at the card (the .reveal/.reveal-group pair used for a card's corner delete).
// Link and Author still exist on the record (markdown.js round-trips them) but aren't shown.
//
// `after` appends extra content to this same row (Research Repository uses it for "linked in N
// specs" / "Attach to spec" — cross-spec facts about the signal rather than fields of it).
export default function SignalCardBody({ signal, activities, onChange, autoFocus = false, missing = false, activityLink = true, after }) {
  // Declared before the `missing` early return: React requires every hook on every render.
  const [picking, setPicking] = useState(false);

  if (missing) {
    return (
      <div style={{ fontStyle: "italic", fontSize: SIZE.ui, color: meta.color }}>
        Signal no longer exists.
      </div>
    );
  }

  const activityId = signal.source?.type === "activity" ? signal.source.activityId : null;
  const activity = activityId ? (activities || []).find((a) => a.id === activityId) : null;
  const dateValue = signal.date ? new Date(signal.date).toISOString().slice(0, 10) : "";

  const showActivityIcon = activity && activityLink;
  const showRow = showActivityIcon || !activityId || after;

  return (
    <>
      <AutoTextarea
        className="el-edit" minRows={2} autoFocus={autoFocus}
        value={signal.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="What you observed…"
        style={editArea}
      />

      {showRow && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: SPACE.lg, rowGap: SPACE.xs, marginTop: SPACE.base }}>
          {showActivityIcon && (
            <a
              className="icon-btn"
              href={activityHref(activity.id)}
              title={`From activity: ${activity.name || "Untitled activity"}`}
              aria-label={`Open activity ${activity.name || "Untitled activity"}`}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "22px", height: "22px", margin: "-3px", color: metaInputStyle.color,
                "--hit": "28px",
              }}
            >
              <FlaskConical size={16} />
            </a>
          )}

          {!activityId && (
            picking ? (
              <select
                autoFocus
                className="el-meta-input"
                value=""
                onChange={(e) => { setPicking(false); onChange({ source: { type: "activity", activityId: e.target.value } }); }}
                onBlur={() => setPicking(false)}
                style={{ ...metaInputStyle, ...compactField, cursor: "pointer", minWidth: "120px" }}
              >
                <option value="" disabled>Pick an activity…</option>
                {(activities || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name || "Untitled activity"}</option>
                ))}
              </select>
            ) : (
              <AddField label="Activity" onClick={() => setPicking(true)} />
            )
          )}

          {!activityId && (
            <input
              className="el-meta-input" type="date" value={dateValue}
              onChange={(e) => onChange({ date: e.target.value ? new Date(e.target.value).getTime() : Date.now() })}
              style={{ ...metaInputStyle, ...compactField }}
            />
          )}

          {after}
        </div>
      )}
    </>
  );
}

// Sized like `meta` (11px) but NOT colored like it — INK_FAINT is ~2.4:1 against plain white
// already, below WCAG's 3:1 floor even for large text, and a signal card's tint only pulls
// that further down. metaInputStyle's own INK_SOFT (~4.5:1) is what actually stays legible on
// a tinted surface, so only the size comes from `meta` here.
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
      <Plus size={11} /> {label}
    </button>
  );
}
