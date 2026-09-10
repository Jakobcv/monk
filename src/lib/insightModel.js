import { genEntityId } from "./boardModel.js";

// An insight is a global, workspace-wide record, mirroring signalModel.js's promotion of
// Signal — created from Research Repository, then *linked* (never copied) into as many specs'
// Discovery boards as make sense.
//
// `sources` (signal ids) is where the insight came from — set once, at creation, by selecting
// signals in Research Repository and choosing "Form insight from selection"; there's no editor
// for it after that, so it stays a fact about how the insight was formed rather than something
// that drifts over time.
export function blankInsight(sources = []) {
  const now = Date.now();
  return { id: genEntityId(), text: "", sources, createdAt: now, updatedAt: now };
}

// How many of a spec's Discovery boards this insight is currently linked into.
export function insightBoardCount(boards, insightId) {
  return (boards || []).reduce((n, b) => n + ((b.insights || []).some((i) => i.id === insightId) ? 1 : 0), 0);
}
