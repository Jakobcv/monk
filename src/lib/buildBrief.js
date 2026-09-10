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

export function buildSpecBrief(spec, sections, initiative) {
  const standards = sectionDocs(sections, "standards");
  const productKnowledge = sectionDocs(sections, "product-knowledge");
  const title = spec.title || "Untitled spec";
  const unresolved = (spec.openQuestions || []).filter((q) => !q.checked && (q.text || "").trim());

  const lines = [
    `# Build brief: ${title}`,
    "",
    "This is a hand-off for an agent to execute, assembled from Monk. Standards below are",
    "constraints, not suggestions — satisfy them whether or not the spec repeats them. If",
    "anything under Open Questions is still unresolved, stop and ask (or make a documented,",
    "flagged assumption) rather than deciding silently.",
    "",
    "## Standards",
    "_Contracts to build to — design system, accessibility, and any other house rules below. Non-negotiable._",
    "",
    renderDocs(standards),
    "",
    "## Product knowledge",
    "_Background and prior decisions. Resolves gaps the spec below doesn't cover — never overrides something the spec explicitly decided._",
    "",
    renderDocs(productKnowledge),
    "",
  ];

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
    "### Open questions"
  );

  if (unresolved.length) {
    lines.push("**Unresolved — stop and ask, or make a documented, flagged assumption. Do not decide silently:**", "");
    lines.push(renderChecklist(unresolved, ""));
  } else {
    lines.push("_None outstanding._");
  }

  lines.push(
    "",
    "### Design",
    (spec.design || "").trim() || "_(not written)_",
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
