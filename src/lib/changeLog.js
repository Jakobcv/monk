// A spec's change log: the record of how its commitments moved once it stopped being a draft.
// Commitments are the four things a build is held to — acceptance criteria, open questions,
// decisions (solution.md) and the non-goals — and nothing else: prose is rewritten freely and
// isn't logged. Stored as `changes` in spec.md's frontmatter, oldest first:
//
//   { at, kind, action, before?, after?, reason? }
//
//   kind     "criterion" | "question" | "decision" | "nonGoals"
//   action   "added" | "removed" | "edited"
//   before   the wording before (edited, removed)
//   after    the wording after (edited, added)
//   reason   why, added by a person afterwards or by the agent that made the change
//
// The app writes an entry for each change a person makes in it (SpecPage records them). An agent
// that changes a commitment on disk writes its own, in the same shape; the app never adds one for
// an edit that arrived from disk.

export const CHANGE_KINDS = ["criterion", "question", "decision", "nonGoals"];
const ACTIONS = ["added", "removed", "edited"];

// Whatever came off disk, as entries: objects with a known kind and action, string fields only.
export function changesFrom(list) {
  return (Array.isArray(list) ? list : [])
    .filter((c) => c && typeof c === "object" && CHANGE_KINDS.includes(c.kind) && ACTIONS.includes(c.action))
    .map((c) => {
      const entry = { at: typeof c.at === "string" ? c.at : "", kind: c.kind, action: c.action };
      for (const f of ["before", "after", "reason"]) if (typeof c[f] === "string") entry[f] = c[f];
      return entry;
    });
}

// Two wordings are the same commitment when they differ only in whitespace — a stray space or a
// re-wrapped line changes nothing anyone is held to.
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// The longest common subsequence of two lists of normalised texts, as index pairs. Lists here are
// a spec's worth of criteria, so the quadratic table is nothing.
function lcsPairs(a, b) {
  const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

// How one list of commitments became another. Items have no ids, so they're matched by text: the
// wordings both lists share, in order, anchor the match, and what's left between two anchors is
// paired off as edits, with any surplus on one side added or removed. An item that was only moved
// shows up as a removal and an addition of the same words, and cancels out — order isn't a
// commitment. Empty items are ignored: a row just added and not yet written isn't a commitment.
export function diffList(kind, before, after) {
  const b = before.map(norm).filter(Boolean);
  const a = after.map(norm).filter(Boolean);
  const out = [];
  let bi = 0, ai = 0;
  for (const [pb, pa] of [...lcsPairs(b, a), [b.length, a.length]]) {
    const gb = b.slice(bi, pb);
    const ga = a.slice(ai, pa);
    const n = Math.min(gb.length, ga.length);
    for (let k = 0; k < n; k++) out.push({ kind, action: "edited", before: gb[k], after: ga[k] });
    for (const x of gb.slice(n)) out.push({ kind, action: "removed", before: x });
    for (const x of ga.slice(n)) out.push({ kind, action: "added", after: x });
    bi = pb + 1;
    ai = pa + 1;
  }
  // A move: the same words removed in one place and added in another.
  const removed = out.filter((e) => e.action === "removed");
  const added = out.filter((e) => e.action === "added");
  const dropped = new Set();
  for (const r of removed) {
    const match = added.find((x) => !dropped.has(x) && x.after === r.before);
    if (match) { dropped.add(r); dropped.add(match); }
  }
  // A move and a rewording in the same edit can leave the anchors choosing the other items, so the
  // rewording surfaces as a removal and an addition. When the two wordings are clearly the same
  // item — half their words in common — they're one edit, entered where the removal was.
  for (const r of removed) {
    if (dropped.has(r)) continue;
    const match = added.find((x) => !dropped.has(x) && similarity(r.before, x.after) >= 0.5);
    if (!match) continue;
    dropped.add(match);
    r.action = "edited";
    r.after = match.after;
  }
  return out.filter((e) => !dropped.has(e));
}

// Shared words over all words, ignoring case and punctuation: 1 for the same wording, 0 for none.
function similarity(x, y) {
  const words = (s) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const a = words(x), b = words(y);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

// A spec's commitments, as the recorder compares them: plain text only, so checking a criterion
// off or answering a question — verification, and an answer kept in its own field — isn't a change.
export const commitmentsOf = ({ acceptanceCriteria, openQuestions, decisions, nonGoals }) => ({
  criterion: (acceptanceCriteria || []).map((c) => c.text || ""),
  question: (openQuestions || []).map((q) => q.text || ""),
  decision: decisions || [],
  nonGoals: nonGoals || "",
});

// Every change between two snapshots of a spec's commitments, stamped with `at`. The non-goals are
// one prose field, so an edit to them is one entry holding the whole text before and after.
export function diffCommitments(before, after, at) {
  const entries = [
    ...diffList("criterion", before.criterion, after.criterion),
    ...diffList("question", before.question, after.question),
    ...diffList("decision", before.decision, after.decision),
  ];
  if (norm(before.nonGoals) !== norm(after.nonGoals)) {
    entries.push({ kind: "nonGoals", action: "edited", before: before.nonGoals.trim(), after: after.nonGoals.trim() });
  }
  return entries.map((e) => ({ at, ...e }));
}
