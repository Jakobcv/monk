// Card ids only need to be unique within their own board, but we hand out a single
// monotonic counter across the whole workspace anyway — simplest way to guarantee no
// collisions if boards are ever merged or cards moved between them later.
let nextId = 1000;
export const genId = () => nextId++;

// Shared id generator for any top-level entity that needs a filesystem-safe, effectively-unique
// id — boards, and (see documentModel.js) sections and documents too.
export const genEntityId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// A board is always owned by exactly one research plan — `id` is the owning plan's id (a ref's
// `boardId` therefore means "which plan's board"), not a fresh id of its own. Pure canvas +
// connections; no name/status/etc. — that metadata lives on the owning plan instead.
export function blankBoard(id) {
  const now = Date.now();
  return {
    id, createdAt: now, updatedAt: now,
    signals: [], insights: [], actions: [], results: [], connections: [],
  };
}

export const KIND_ARRAY_KEY = { signal: "signals", insight: "insights", action: "actions", result: "results" };

// An action card is either locally authored, or a live reference to an action living on another
// board (has `ref: { boardId, itemId }` instead of its own content). Resolved at render time —
// never copied — so edits to the source propagate everywhere it's cited, and a deleted source
// just resolves to null rather than leaving stale text behind. Result cards don't need this: a
// result is a pointer to a spec (a global record already shareable across boards), so pointing
// two boards at the same spec needs no `ref` indirection.
export function resolveRef(boards, kind, ref) {
  const arrayKey = KIND_ARRAY_KEY[kind];
  const board = (boards || []).find((b) => b.id === ref.boardId);
  const item = board?.[arrayKey]?.find((x) => x.id === ref.itemId);
  return item ? { board, item } : null;
}

export function bumpNextId(boards) {
  let max = 999;
  for (const board of boards || []) {
    // board.signals/board.insights entries both carry a *global* entity's own (string) id now
    // — a separate id space from this numeric counter, so they're excluded here (see
    // signalModel.js / insightModel.js).
    for (const list of [board.actions, board.results, board.connections]) {
      for (const item of list || []) if (typeof item.id === "number" && item.id > max) max = item.id;
    }
  }
  nextId = max + 1;
}
