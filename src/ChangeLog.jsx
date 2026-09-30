import { Eyebrow } from "./ui/text";
import LiveMarkdown from "./ui/LiveMarkdown";

const KIND = {
  criterion: "Acceptance criterion",
  question: "Open question",
  decision: "Decision",
  nonGoals: "Non-goals",
};
const ACTION = { added: "added", removed: "removed", edited: "reworded" };

// Locale-aware, and a day-and-time rather than "3 hours ago": a log is read long after it's
// written, and a relative time stops meaning anything once it's copied anywhere.
const WHEN = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const when = (at) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : WHEN.format(d);
};

// One wording in an entry, with a label that says which it is — before and after are told apart by
// the word, not only by the ink.
function Wording({ label, text, tone }) {
  return (
    <div className={`change-log__wording change-log__wording--${tone}`}>
      <span className="change-log__label">{label}</span>
      <span className="change-log__text">{text}</span>
    </div>
  );
}

// A spec's change log (lib/changeLog.js) at the foot of its Overview: newest first, each entry
// saying what changed and how, when, the wording either side of it, and why. The app writes the
// entries; a person can only add or change an entry's reason, because a log that can be rewritten
// from the page it records isn't a record. Not shown at all while the log is empty.
export default function ChangeLog({ changes, onReasonChange }) {
  if (!changes.length) return null;
  const newestFirst = changes.map((c, i) => ({ c, i })).reverse();
  return (
    <section className="paper-section change-log" aria-labelledby="change-log-heading">
      <Eyebrow as="h2" id="change-log-heading">Changes</Eyebrow>
      <ol className="change-log__list">
        {newestFirst.map(({ c, i }) => (
          <li key={i} className="change-log__entry">
            <div className="change-log__head">
              <span className="change-log__what">{KIND[c.kind]} {ACTION[c.action]}</span>
              {c.at && <time className="change-log__when" dateTime={c.at}>{when(c.at)}</time>}
            </div>
            {c.action === "edited" && (
              <>
                <Wording label="Before" text={c.before} tone="before" />
                <Wording label="After" text={c.after} tone="after" />
              </>
            )}
            {c.action === "added" && <Wording label="Added" text={c.after} tone="after" />}
            {c.action === "removed" && <Wording label="Removed" text={c.before} tone="before" />}
            <LiveMarkdown
              singleLine
              className="prose-field change-log__reason"
              value={c.reason || ""}
              onChange={(v) => onReasonChange(i, v)}
              placeholder="Why it changed…"
              ariaLabel={`Reason: ${KIND[c.kind]} ${ACTION[c.action]}`}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
