import { genEntityId } from "./boardModel.js";
import { blankFlow } from "./flowModel.js";

// `design` and `plan` are always-present tabs on a spec, not optional linked documents — plain
// markdown strings (no separate id/title/timestamps of their own), stored as sibling files
// (design.md/plan.md) purely for on-disk scannability. `flow` is the spec's use cases and flow
// map (flow.md, see flowModel.js). See storage.js.
export function blankSpec(title = "Untitled spec", initiativeId = null) {
  const now = Date.now();
  return {
    id: genEntityId(), title, status: "draft", owner: "", initiativeId, createdAt: now, updatedAt: now,
    problem: "", goals: "", nonGoals: "",
    openQuestions: [], acceptanceCriteria: [],
    design: "", plan: "", flow: blankFlow(),
  };
}
