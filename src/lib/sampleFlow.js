// Sample flow for the DEV-only #/flow-preview route — the bulk-export spec's use cases, stages,
// steps and links, in the exact shape lib/flowModel.js normalizes to.
export const SAMPLE_FLOW = {
  useCases: [
    { id: "r1", tier: 0, text: "Export every signal behind one insight as a shareable doc" },
    { id: "r2", tier: 1, text: "Export a filtered set of signals from Research Repository" },
    { id: "r3", tier: 2, text: "Re-export after edits without redoing the selection" },
  ],
  stages: [
    { id: "c1", name: "Discover" },
    { id: "c2", name: "Choose" },
    { id: "c3", name: "Export" },
    { id: "c4", name: "Share" },
  ],
  steps: [
    { id: "a", useCase: "r1", stage: "c1", text: "Open insight" },
    { id: "b", useCase: "r1", stage: "c2", text: "Pick format" },
    { id: "x", useCase: "r1", stage: "c2", text: "Export disabled — explain why" },
    { id: "c", useCase: "r1", stage: "c3", text: "Preview the doc" },
    { id: "d", useCase: "r1", stage: "c4", text: "Copy link" },
    { id: "e", useCase: "r2", stage: "c1", text: "Filter the repository" },
    { id: "f", useCase: "r2", stage: "c2", text: "Select signals" },
    { id: "g", useCase: "r3", stage: "c2", text: "Reopen last export" },
    { id: "h", useCase: "r3", stage: "c3", text: "Re-export" },
  ],
  links: [
    { id: "l1", from: "a", to: "b", label: "" },
    { id: "l2", from: "a", to: "x", label: "no linked signals" },
    { id: "l3", from: "b", to: "c", label: "" },
    { id: "l4", from: "c", to: "d", label: "" },
    { id: "l5", from: "c", to: "b", label: "change format" },
    { id: "l6", from: "e", to: "f", label: "" },
    { id: "l7", from: "f", to: "b", label: "" },
    { id: "l8", from: "g", to: "h", label: "" },
    { id: "l9", from: "h", to: "d", label: "" },
  ],
};
