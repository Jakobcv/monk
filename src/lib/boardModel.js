import { STATUS_OPTIONS, IMPACT_OPTIONS, METHOD_OPTIONS } from "./theme";

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
    goal: "", target: "", status: "Not started", impact: "Medium", method: "", author: "", description: "",
    signals: [], insights: [], actions: [], results: [], connections: [],
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
    method: "Interview",
    author: "",
    description: "",
    signals: [
      { id: e1, type: "Metric", text: "70% of users try the feature 1–2 times before abandoning it." },
      { id: e2, type: "Interview", text: "3 users couldn't find the apply button when finishing, and got frustrated." },
      { id: genId(), type: "Support", text: 'Tickets mentioning "apply button" rose 20% last month.' },
    ],
    insights: [{ id: p1, text: "Users abandon the feature because they can't find the apply button." }],
    actions: [
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

const asString = (v, fallback = "") => (typeof v === "string" ? v : fallback);
const asArray = (v) => (Array.isArray(v) ? v : []);
const withId = (item) => ({ ...item, id: typeof item?.id === "number" ? item.id : genId() });

// Builds a board from a parsed JSON file — typically one this app exported itself, but
// treated as untrusted/possibly hand-edited: every field is coerced to a safe shape rather
// than trusted as-is, and a fresh board id is always assigned (never reuse the file's id,
// so importing a board twice — or one already open elsewhere — can't collide).
export function boardFromImport(data) {
  if (!data || typeof data !== "object") throw new Error("Not a valid board file");
  const now = Date.now();
  return {
    id: genBoardId(),
    createdAt: now,
    updatedAt: now,
    name: asString(data.name, "Imported board"),
    goal: asString(data.goal),
    target: asString(data.target),
    status: STATUS_OPTIONS.includes(data.status) ? data.status : "Not started",
    impact: IMPACT_OPTIONS.includes(data.impact) ? data.impact : "Medium",
    method: METHOD_OPTIONS.includes(data.method) ? data.method : "",
    author: asString(data.author),
    description: asString(data.description),
    signals: asArray(data.signals).map(withId),
    insights: asArray(data.insights).map(withId),
    actions: asArray(data.actions).map(withId),
    results: asArray(data.results).map(withId),
    connections: asArray(data.connections)
      .filter((c) => typeof c?.from === "number" && typeof c?.to === "number")
      .map(withId),
  };
}

export const KIND_ARRAY_KEY = { signal: "signals", insight: "insights", action: "actions", result: "results" };

// A card is either locally authored, or a live reference to a card of the same kind living
// in another board (has `ref: { boardId, itemId }` instead of its own content). Resolved at
// render time — never copied — so edits to the source propagate everywhere it's cited, and
// a deleted source just resolves to null rather than leaving stale text behind.
export function resolveRef(boards, kind, ref) {
  const arrayKey = KIND_ARRAY_KEY[kind];
  const board = (boards || []).find((b) => b.id === ref.boardId);
  const item = board?.[arrayKey]?.find((x) => x.id === ref.itemId);
  return item ? { board, item } : null;
}

export function bumpNextId(boards) {
  let max = 999;
  for (const board of boards || []) {
    for (const list of [board.signals, board.insights, board.actions, board.results, board.connections]) {
      for (const item of list || []) if (item.id > max) max = item.id;
    }
  }
  nextId = max + 1;
}
