import { genEntityId } from "./boardModel.js";

// A signal is a global, workspace-wide record — an observation — created from Research Repository
// or on a research plan's board, and *linked* (never copied) onto as many plans' boards as make
// sense. Which study it belongs to isn't stored on the signal: it's the boards linking it.
//
// Older workspaces pointed a signal at an activity (`source`). Activities were folded into research
// plans, and migrateActivities.js rewrites those on load.
export function blankSignal() {
  const now = Date.now();
  return {
    id: genEntityId(), text: "",
    date: now, link: "", author: "", createdAt: now, updatedAt: now,
  };
}

// How many research plan boards this signal is currently linked into.
export function signalBoardCount(boards, signalId) {
  return (boards || []).reduce((n, b) => n + ((b.signals || []).some((s) => s.id === signalId) ? 1 : 0), 0);
}

// True if, across every board this signal appears on (including zero), none of those
// instances has an outgoing connection to an insight — preserves the pre-global-signal
// "not yet tied to an insight" meaning of "unlinked" under multi-board linking.
export function isSignalUnlinked(boards, signalId) {
  return !(boards || []).some((b) => (b.connections || []).some((c) => c.from === signalId));
}
