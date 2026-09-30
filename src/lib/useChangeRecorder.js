import { useEffect, useRef } from "react";
import { diffCommitments } from "./changeLog.js";

// Records the changes a person makes to a spec's commitments while its page is open (see
// changeLog.js for what counts). SpecPage sends a snapshot of every field on every keystroke, so
// the recorder works in bursts: the commitments as they stood when a burst began are kept, every
// edit restarts an idle timer, and once the spec has gone `idleMs` without an edit — or the page
// is left — the burst is closed and diffed into entries. Rewording a criterion over several
// seconds is then one entry, holding the wording from before the first keystroke and after the
// last.
//
// A draft is still being written, so nothing is recorded while the spec is one: the starting point
// just follows the edits, and the log begins from wherever the spec stood when it left draft.
//
// Edits that arrive from disk never pass through here: App remounts SpecPage when the file changes
// (its key carries the file's revision), and a remount starts from the file as it now is.
export function useChangeRecorder({ status, commitments, onEntries, idleMs = 3000 }) {
  const settled = useRef(commitments);
  const latest = useRef({ commitments, onEntries });
  const timer = useRef(null);
  const key = JSON.stringify(commitments);

  useEffect(() => { latest.current = { commitments, onEntries }; });

  const flush = (unmounting) => {
    clearTimeout(timer.current);
    timer.current = null;
    const now = latest.current.commitments;
    const entries = diffCommitments(settled.current, now, new Date().toISOString());
    settled.current = now;
    if (entries.length) latest.current.onEntries(entries, { unmounting });
  };

  useEffect(() => {
    if (status === "draft") {
      // An edit made while the spec was still active is recorded before the log stops.
      if (timer.current) flush(false);
      settled.current = commitments;
      return;
    }
    if (JSON.stringify(settled.current) === key) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(false), idleMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, status]);

  // Leaving the page closes whatever burst is open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) flush(true); }, []);
}
