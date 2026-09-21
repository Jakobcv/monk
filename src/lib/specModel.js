import { genEntityId } from "./boardModel.js";

// `design` and `plan` are always-present tabs on a spec, not optional linked documents — plain
// markdown strings (no separate id/title/timestamps of their own), stored as sibling files
// (design.md/plan.md) purely for on-disk scannability. See storage.js.
export function blankSpec(title = "Untitled spec", initiativeId = null) {
  const now = Date.now();
  return {
    id: genEntityId(), title, status: "draft", owner: "", initiativeId, createdAt: now, updatedAt: now,
    // The research plans behind this spec (researchPlanModel.js) — pointers, never copies.
    researchPlanIds: [],
    // Reference material behind the spec — document pointers and uploaded files (sourceModel.js).
    sources: [],
    problem: "", goals: "", nonGoals: "",
    // Sections of spec.md the app doesn't show, kept as raw markdown (see markdown.js).
    extraSections: "",
    openQuestions: [], acceptanceCriteria: [],
    design: "", plan: "",
  };
}
