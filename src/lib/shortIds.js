// Short IDs — the handle a person can say and type for an initiative, spec or research plan, beside
// the UUID that remains its identity (folder name, `id`, every pointer). Every rule about them is
// here so the app and the MONK.md text describe one format.
//
// - A letter for the kind and a number: I-3 is an initiative, S-14 a spec, R-2 a research plan.
//   Nothing in an ID comes from a title, so renaming a record can never make its ID wrong.
// - Each kind is numbered on its own, across the whole workspace.
// - A record stores its ID (`shortId`). It's given once and never rewritten: renaming it, moving a
//   spec to another initiative, or deleting its initiative leaves it as it was.
// - The next number for a kind is one more than the highest ever used for it, counting deleted
//   records (the retired list), so a number is never handed out twice — except by two branches at
//   once, which is what duplicateIds is for.

export const KIND_LETTER = { initiative: "I", spec: "S", plan: "R" };
const KIND_OF_LETTER = { I: "initiative", S: "spec", R: "plan" };
const ID_PATTERN = /^([ISR])-([1-9]\d*)$/;

// "S-14" → { kind: "spec", n: 14 }. Anything else is null.
export function parseShortId(id) {
  const m = typeof id === "string" ? ID_PATTERN.exec(id) : null;
  return m ? { kind: KIND_OF_LETTER[m[1]], n: Number(m[2]) } : null;
}

export const formatShortId = (kind, n) => `${KIND_LETTER[kind]}-${n}`;

// One more than the highest number used for this kind by any record or retired ID.
export function nextNumber(ids, kind) {
  let max = 0;
  for (const id of ids) {
    const p = parseShortId(id);
    if (p && p.kind === kind && p.n > max) max = p.n;
  }
  return max + 1;
}

const byAge = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id));

const usedIds = ({ initiatives = [], specs = [], researchPlans = [], retired = [] }) => [
  ...initiatives.map((i) => i.shortId), ...specs.map((s) => s.shortId), ...researchPlans.map((p) => p.shortId), ...retired,
].filter(Boolean);

// Fills in every missing ID, oldest record first, so the same files give the same IDs on every
// machine. Only ever adds: an ID that's there, valid or not, is left alone. Returns the same arrays
// (by identity) when there was nothing to do, so it's safe to run after every change.
export function assignShortIds({ initiatives = [], specs = [], researchPlans = [], retired = [] }) {
  const lists = { initiative: initiatives, spec: specs, plan: researchPlans };
  const ids = usedIds({ initiatives, specs, researchPlans, retired });
  const given = new Map();
  for (const [kind, list] of Object.entries(lists)) {
    for (const record of list.filter((r) => !r.shortId).sort(byAge)) {
      const shortId = formatShortId(kind, nextNumber(ids, kind));
      ids.push(shortId);
      given.set(record.id, shortId);
    }
  }
  if (!given.size) return { initiatives, specs, researchPlans, changed: false };
  const fill = (r) => (given.has(r.id) && !r.shortId ? { ...r, shortId: given.get(r.id) } : r);
  return { initiatives: initiatives.map(fill), specs: specs.map(fill), researchPlans: researchPlans.map(fill), changed: true };
}

// The ids of every record whose short ID another record also has — what a merge of two branches
// that both created the next spec leaves behind.
export function duplicateIds({ initiatives = [], specs = [], researchPlans = [] }) {
  const owners = new Map();
  for (const r of [...initiatives, ...specs, ...researchPlans]) {
    if (!r.shortId) continue;
    if (!owners.has(r.shortId)) owners.set(r.shortId, []);
    owners.get(r.shortId).push(r.id);
  }
  return new Set([...owners.values()].filter((list) => list.length > 1).flat());
}

// The next free ID for a record giving up one it shares (the duplicate's fix).
export function freshShortId(kind, workspace) {
  return formatShortId(kind, nextNumber(usedIds(workspace), kind));
}
