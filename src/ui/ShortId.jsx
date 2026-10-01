import { AlertTriangle, Check, Copy } from "lucide-react";
import { useCopy } from "../lib/useCopy";

// A spec's, research plan's or initiative's short ID (lib/shortIds.js), set in tabular figures and
// never translated. `shared` marks one a merge left on two records: a warning icon and a tooltip,
// and words for a screen reader, so the mark is never colour alone.
const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function ShortId({ value, shared = false, className }) {
  if (!value) return null;
  return (
    <span className={cx("short-id", shared && "short-id--shared", className)} translate="no" title={shared ? "Another record has this ID" : undefined}>
      {shared && <AlertTriangle size={11} aria-hidden="true" />}
      {value}
      {shared && <span className="visually-hidden"> (another record has this ID)</span>}
    </span>
  );
}

// The ID in a page's eyebrow, as a button that copies it. "Copied" is announced politely.
export function CopyShortId({ value, shared = false }) {
  const [copied, copy] = useCopy();
  if (!value) return null;
  // The live region sits beside the button, not in it: the button's aria-label would hide it.
  return (
    <>
      <button type="button" className={cx("short-id short-id--copy", shared && "short-id--shared")} onClick={() => copy(value)} aria-label={`Copy ID ${value}`} title={shared ? "Another record has this ID — copy" : "Copy ID"} translate="no">
        {shared && <AlertTriangle size={11} aria-hidden="true" />}
        {value}
        {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      </button>
      <span className="visually-hidden" aria-live="polite">{copied ? `Copied ${value}` : ""}</span>
    </>
  );
}

// What follows the kind in a record page's eyebrow (ui/PaperFrame's `idSlot`): the copyable ID,
// and when a merge left it on two records, the one action that resolves it from this side.
export function IdSlot({ value, shared = false, onNewId }) {
  if (!value) return null;
  return (
    <>
      <span aria-hidden="true">·</span>
      <CopyShortId value={value} shared={shared} />
      {shared && onNewId && (
        <button type="button" className="btn btn--sm btn--subtle id-fix" onClick={onNewId}>Give it a new ID</button>
      )}
    </>
  );
}
