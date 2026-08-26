// Card ids only need to be unique within their own board, but we hand out a single
// monotonic counter across the whole workspace anyway — simplest way to guarantee no
// collisions if boards are ever merged or cards moved between them later.
let nextId = 1000;
export const genId = () => nextId++;

const genBoardId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function blankBoard(name = "Untitled board") {
  const now = Date.now();
  return {
    id: genBoardId(), name, createdAt: now, updatedAt: now,
    goal: "", target: "", status: "Not started", impact: "Medium", owner: "", description: "",
    evidence: [], problems: [], ideas: [], results: [], connections: [],
  };
}

export function demoBoard() {
  const now = Date.now();
  const p1 = genId();
  const e1 = genId(), e2 = genId();
  const i1 = genId(), i2 = genId();
  const r1 = genId();
  return {
    id: genBoardId(), name: "Apply flow", createdAt: now, updatedAt: now,
    goal: "Increase satisfaction with the apply flow.",
    target: "Increase task completion by 50%.",
    status: "In progress",
    impact: "High",
    owner: "",
    description: "",
    evidence: [
      { id: e1, type: "Metric", text: "70% of users try the feature 1–2 times before abandoning it." },
      { id: e2, type: "Interview", text: "3 users couldn't find the apply button when finishing, and got frustrated." },
      { id: genId(), type: "Support", text: 'Tickets mentioning "apply button" rose 20% last month.' },
    ],
    problems: [{ id: p1, text: "Users abandon the feature because they can't find the apply button." }],
    ideas: [
      { id: i1, ifWe: "make the apply step automatic", then: "users complete the flow without hunting for a button", expected: "Completion rate climbs above 50% within two weeks." },
      { id: i2, ifWe: "add a progress bar highlighting the next required action", then: "users notice the apply step and complete it", expected: "Drop-off at the apply step falls by half." },
    ],
    results: [{ id: r1, text: "Completion rose from 30% to 61% in two weeks." }],
    connections: [
      { id: genId(), from: e1, to: p1 }, { id: genId(), from: e2, to: p1 },
      { id: genId(), from: p1, to: i1 }, { id: genId(), from: p1, to: i2 },
      { id: genId(), from: i1, to: r1 },
    ],
  };
}

export function bumpNextId(boards) {
  let max = 999;
  for (const board of boards || []) {
    for (const list of [board.evidence, board.problems, board.ideas, board.results, board.connections]) {
      for (const item of list || []) if (item.id > max) max = item.id;
    }
  }
  nextId = max + 1;
}
