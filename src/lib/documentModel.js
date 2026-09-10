import { genEntityId } from "./boardModel.js";

export function blankSection(name = "Untitled section") {
  const now = Date.now();
  return { id: genEntityId(), name, createdAt: now, updatedAt: now, documents: [] };
}

// Two sections are fixed — always present, un-renameable, un-deletable — because what belongs
// in them is a matter of purpose, not user choice:
//   - Product Knowledge: the team's shared memory. What the product is for, what's been
//     decided, what's known about users — queryable, and what a feature spec's own intent
//     draws on and feeds back into.
//   - Standards: contracts agents build to (design system, accessibility, etc.), sitting
//     alongside the acceptance criteria a spec itself carries.
// A fixed id (not genEntityId()) so the same folder is recognized across every workspace this
// app ever connects to, rather than being minted fresh (and therefore duplicated) each time.
export const FIXED_SECTIONS = [
  { id: "product-knowledge", name: "Product Knowledge" },
  { id: "standards", name: "Standards" },
];

export const isFixedSection = (id) => FIXED_SECTIONS.some((f) => f.id === id);

function blankFixedSection(def) {
  const now = Date.now();
  return { id: def.id, name: def.name, createdAt: now, updatedAt: now, documents: [] };
}

// Guarantees both fixed sections exist in a loaded (or freshly-started) `sections` list —
// synthesizing whichever are missing (a brand-new workspace, or one connected before this
// feature existed) rather than requiring a migration step. Existing ones are left untouched.
export function ensureFixedSections(sections) {
  const existingIds = new Set((sections || []).map((s) => s.id));
  const missing = FIXED_SECTIONS.filter((f) => !existingIds.has(f.id)).map(blankFixedSection);
  return missing.length ? [...missing, ...(sections || [])] : (sections || []);
}

export function blankDocument(title = "Untitled document") {
  const now = Date.now();
  return { id: genEntityId(), title, body: "", createdAt: now, updatedAt: now };
}
