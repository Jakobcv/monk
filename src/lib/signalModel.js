import { genEntityId } from "./boardModel.js";

// A signal is a global, workspace-wide record now — created from Research Repository, then
// *linked* (never copied) into as many specs' Discovery boards as make sense.
//
// `source` is optional: either `null` (not tied to any research activity) or
// `{ type: "activity", activityId }`. There used to be a third shape — free-text "Other" — but
// it cluttered the card for little benefit (a source you can't actually click through to isn't
// much more useful than no source at all), so it's gone: a signal is either tied to an activity
// or it isn't.
export function blankSignal() {
  const now = Date.now();
  return {
    id: genEntityId(), text: "", source: null,
    date: now, link: "", author: "", createdAt: now, updatedAt: now,
  };
}

// An activity is also global, created only from Research Repository. It carries no list of
// its own signals — "linked signals" is a derived view (see signalsForActivity below), same
// non-duplicating instinct as resolveRef: one source of truth, everything else reads from it.
// Date and Author live here, not on the signals it collects — every signal from one activity
// shares when it happened and who ran it, so a signal sourced from an activity doesn't ask for
// its own Date/Link (see SignalFields.jsx).
export function blankActivity(name = "Untitled activity") {
  const now = Date.now();
  return { id: genEntityId(), name, method: "", link: "", date: now, author: "", createdAt: now, updatedAt: now };
}

// Every signal whose source points back at this activity — computed fresh, never stored, so
// there's nothing to keep in sync when a signal's source changes or the activity is deleted.
export function signalsForActivity(signals, activityId) {
  return (signals || []).filter((s) => s.source?.type === "activity" && s.source.activityId === activityId);
}

// How many of a spec's Discovery boards this signal is currently linked into.
export function signalBoardCount(boards, signalId) {
  return (boards || []).reduce((n, b) => n + ((b.signals || []).some((s) => s.id === signalId) ? 1 : 0), 0);
}

// True if, across every board this signal appears on (including zero), none of those
// instances has an outgoing connection to an insight — preserves the pre-global-signal
// "not yet tied to an insight" meaning of "unlinked" under multi-board linking.
export function isSignalUnlinked(boards, signalId) {
  return !(boards || []).some((b) => (b.connections || []).some((c) => c.from === signalId));
}
