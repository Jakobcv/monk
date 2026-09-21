import { genEntityId } from "./boardModel.js";

// An initiative is the layer above specs — an epic to their tickets. It contains and provides
// shared context for several connected specs: a spec carries an optional `initiativeId`, and
// "the specs under this initiative" is a derived filter (see specsForInitiative), never a
// stored list — same one-source-of-truth instinct as an activity's signals.
//
// `description` is freeform markdown (the rich editor, like a spec's Design/Plan): context every
// member spec is built with — broader than one spec, narrower than product-wide Standards/Knowledge.
//
// `openQuestions` is the same [{text, checked, resolution?}] checklist a spec has — the questions
// that span several specs and don't belong to any one of them. An unresolved one holds up every
// spec in the initiative.
//
// `outcomes` are why the initiative exists: a measurable change in customer behaviour or business
// value the work should produce — [{text, metric, baseline, target, current}], all strings, only
// `text` needed. The numbers are free text ("20%", "9/qtr", "NPS 31"), not parsed. An outcome is
// not an acceptance criterion: shipping every spec doesn't mean it moved.
export function blankInitiative(title = "Untitled initiative") {
  const now = Date.now();
  return {
    id: genEntityId(), title, status: "active", description: "", outcomes: [], openQuestions: [],
    // Reference material behind the initiative — document pointers and uploaded files (sourceModel.js).
    sources: [],
    createdAt: now, updatedAt: now,
  };
}

export const OUTCOME_FIELDS = ["text", "metric", "baseline", "target", "current"];

export const blankOutcome = () => Object.fromEntries(OUTCOME_FIELDS.map((f) => [f, ""]));

// Whatever came off disk, as outcomes: objects only, every field a string.
export function outcomesFrom(list) {
  return (Array.isArray(list) ? list : [])
    .filter((o) => o && typeof o === "object")
    .map((o) => Object.fromEntries(OUTCOME_FIELDS.map((f) => [f, typeof o[f] === "string" ? o[f] : ""])));
}

// Research plans that name this initiative — derived the same way as its specs.
export function researchPlansForInitiative(plans, initiativeId) {
  return (plans || []).filter((p) => p.initiativeId === initiativeId);
}

// Every spec whose `initiativeId` points here — computed fresh, so there's nothing to keep in
// sync when a spec is reassigned or the initiative is deleted.
export function specsForInitiative(specs, initiativeId) {
  return (specs || []).filter((s) => s.initiativeId === initiativeId);
}

export const INITIATIVE_STATUS_OPTIONS = ["active", "paused", "done"];
