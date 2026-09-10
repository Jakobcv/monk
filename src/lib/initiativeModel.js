import { genEntityId } from "./boardModel.js";

// An initiative is the layer above specs — an epic to their tickets. It contains and provides
// shared context for several connected specs: a spec carries an optional `initiativeId`, and
// "the specs under this initiative" is a derived filter (see specsForInitiative), never a
// stored list — same one-source-of-truth instinct as an activity's signals.
//
// `description` is freeform markdown (the rich editor, like a spec's Design/Plan). It's what
// flows into each member spec's "Start build" brief as an "## Initiative" section (see
// lib/buildBrief.js) — broader than one spec, narrower than product-wide Standards/Knowledge.
export function blankInitiative(title = "Untitled initiative") {
  const now = Date.now();
  return { id: genEntityId(), title, status: "active", description: "", createdAt: now, updatedAt: now };
}

// Every spec whose `initiativeId` points here — computed fresh, so there's nothing to keep in
// sync when a spec is reassigned or the initiative is deleted.
export function specsForInitiative(specs, initiativeId) {
  return (specs || []).filter((s) => s.initiativeId === initiativeId);
}

export const INITIATIVE_STATUS_OPTIONS = ["active", "paused", "done"];
