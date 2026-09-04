import { STATUS_OPTIONS, IMPACT_OPTIONS, METHOD_OPTIONS } from "./theme.js";

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
