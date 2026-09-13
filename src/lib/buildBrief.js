// Assembles a spec into a single hand-off document for an agent to execute — not a summary for
// a human to skim. See documentModel.js's FIXED_SECTIONS comment: Standards and Product
// Knowledge exist specifically to feed this. The two get different framing on purpose:
//   - Standards is a constraint set, not context — design system, accessibility, house rules.
//     Pass/fail, like a linter the agent can't turn off.
//   - Product Knowledge is judgment context — vision, prior decisions, what's known about
//     users. It resolves gaps the spec doesn't cover; it never overrides something the spec
//     explicitly decided.
// Non-goals gets called out as binding, not a nice-to-have paragraph, because an agent
// executing unsupervised will happily expand scope unless something explicit fences it off —
// a human reader fills gaps with restraint by default; an agent doesn't. Any Open Question
// still unresolved gets surfaced as a stop condition, not folded into the background: silently
// picking an answer and moving on is the one thing this brief explicitly rules out.
import { parseDesign, designSections } from "./designModel.js";
import { designSystemForBrief } from "./designSystem.js";

// Each Design section tells the agent how to treat it — what to build, goals it can solve its own
// way, limits it can't cross, material to consult. This is what lets a spec state intent rather
// than pixel instructions without the agent guessing where its latitude ends.
const DESIGN_FRAMING = {
  solution: "What to build. The sections below qualify this one; where they're silent, this is the brief.",
  artefacts: "Consult these — they are the reference for what is described above.",
  principles: "Intent — optimise for these. How to achieve them is your call.",
  constraints: "Binding. Do not violate any of these; if one can't be met, stop and flag it.",
  decisions: "Settled. Do not reverse one without flagging it.",
  notes: "Background.",
};

function renderDesign(md) {
  const sections = designSections(parseDesign(md));
  if (!sections.length) return "_(not written)_";
  return sections.map((s) => `#### ${s.title}\n_${DESIGN_FRAMING[s.key]}_\n\n${s.body}`).join("\n\n");
}

const sectionDocs = (sections, id) => (sections || []).find((s) => s.id === id)?.documents || [];

function renderDocs(docs) {
  if (!docs.length) return "_None yet._";
  return docs
    .map((d) => `#### ${d.title || "Untitled document"}\n\n${(d.body || "").trim() || "_(empty)_"}`)
    .join("\n\n");
}

function renderChecklist(items, emptyText) {
  const list = (items || []).filter((it) => (it.text || "").trim());
  if (!list.length) return emptyText;
  return list.map((it) => `- [${it.checked ? "x" : " "}] ${it.text}`).join("\n");
}

// Answered questions, each with its answer under it. These aren't background: an answer is a
// decision the build has to follow, and without this the brief said "None outstanding" and the
// answers themselves never reached the agent.
function renderResolved(items) {
  return items
    .map((q) => {
      const answer = (q.resolution || "").trim();
      return `- ${q.text.trim()}` + (answer ? `\n  - Resolution: ${answer}` : "");
    })
    .join("\n");
}

export function buildSpecBrief(spec, sections, initiative, designSystem = "") {
  const standards = sectionDocs(sections, "standards");
  const productKnowledge = sectionDocs(sections, "product-knowledge");
  const title = spec.title || "Untitled spec";
  const isUnresolved = (q) => !q.checked && (q.text || "").trim();
  const unresolved = (spec.openQuestions || []).filter(isUnresolved);
  const initiativeUnresolved = initiative ? (initiative.openQuestions || []).filter(isUnresolved) : [];
  const isResolved = (q) => q.checked && (q.text || "").trim();
  const resolved = (spec.openQuestions || []).filter(isResolved);
  const initiativeResolved = initiative ? (initiative.openQuestions || []).filter(isResolved) : [];
  const initiativeLabel = `_From the initiative "${initiative?.title || "Untitled initiative"}":_`;

  const lines = [
    `# Build brief: ${title}`,
    "",
    "This is a hand-off for an agent to execute, assembled from Monk. Standards below are",
    "constraints, not suggestions — satisfy them whether or not the spec repeats them. If",
    "anything under Open Questions is still unresolved, stop and ask (or make a documented,",
    "flagged assumption) rather than deciding silently.",
    "",
    "## Standards",
    "_Contracts to build to — accessibility and any other house rules below. Non-negotiable._",
    "",
    renderDocs(standards),
    "",
    "## Product knowledge",
    "_Background and prior decisions. Resolves gaps the spec below doesn't cover — never overrides something the spec explicitly decided._",
    "",
    renderDocs(productKnowledge),
    "",
  ];

  // The workspace's design system, if one has been written. It goes with Standards rather than
  // with context because it is the same kind of thing — a contract, in a format an agent can read
  // literally (github.com/google-labs-code/design.md) — and it belongs above the spec because it
  // is true of everything built here, not just this feature. Guidance comments and unwritten
  // sections are stripped first (see designSystem.js), so a skeleton nobody has filled in yet adds
  // nothing rather than a contract made of placeholders.
  const design = designSystemForBrief(designSystem);
  if (design) {
    lines.push(
      "## Design system",
      "_The visual language for everything in this product: tokens first, then the reasoning. Use these values rather than inventing your own, and where a component is specified, match it._",
      "",
      design.trim(),
      "",
    );
  }

  if (initiative) {
    lines.push(
      "## Initiative",
      `_This spec is one of several under an initiative. The following is shared context for all of them — broader than this spec, narrower than the product-wide knowledge above._`,
      "",
      `### ${initiative.title || "Untitled initiative"}`,
      (initiative.description || "").trim() || "_(no description written)_",
      ""
    );
  }

  lines.push(
    `## Spec: ${title}`,
    "",
    "### Problem",
    (spec.problem || "").trim() || "_(not written)_",
    "",
    "### Goals",
    (spec.goals || "").trim() || "_(not written)_",
    "",
    "### Non-goals",
    "_Scope fence — treat as binding, not optional._",
    "",
    (spec.nonGoals || "").trim() || "_(not written)_",
    "",
  );

  // Sections of spec.md the app doesn't show (see markdown.js), a level down so they sit under the spec.
  const extra = (spec.extraSections || "").trim();
  if (extra) lines.push(extra.replace(/^##(?=\s)/gm, "###"), "");

  lines.push("### Open questions");

  // The initiative's own unresolved questions hold this spec up just as much as its own do, so
  // they sit in the same stop list rather than back in the Initiative context section.
  if (unresolved.length || initiativeUnresolved.length) {
    lines.push("**Unresolved — stop and ask, or make a documented, flagged assumption. Do not decide silently:**", "");
    if (unresolved.length) lines.push(renderChecklist(unresolved, ""));
    if (initiativeUnresolved.length) {
      if (unresolved.length) lines.push("");
      lines.push(initiativeLabel, "");
      lines.push(renderChecklist(initiativeUnresolved, ""));
    }
  } else {
    lines.push("_None outstanding._");
  }

  if (resolved.length || initiativeResolved.length) {
    lines.push("", "**Resolved — settled; build to these answers:**", "");
    if (resolved.length) lines.push(renderResolved(resolved));
    if (initiativeResolved.length) {
      if (resolved.length) lines.push("");
      lines.push(initiativeLabel, "", renderResolved(initiativeResolved));
    }
  }

  lines.push(
    "",
    "### Design",
    renderDesign(spec.design),
    "",
    "### Plan",
    (spec.plan || "").trim() || "_(not written)_",
    "",
    "### Acceptance criteria",
    "_The exit condition — build until every box below can be checked._",
    "",
    renderChecklist(spec.acceptanceCriteria, "_None written yet._"),
    ""
  );

  return lines.join("\n");
}
