import { genEntityId } from "./boardModel.js";
import { parseDesign, serializeDesign, TIERS } from "./designModel.js";

// A spec's flow map (flow.md): its use cases are the rows, stages you name are the columns, steps
// sit in one use case's row and one stage's column, and links go from step to step — forward,
// within a stage, or back to an earlier one — optionally labelled with the branch condition.
//
//   useCases: [{ id, tier: 0|1|2, text }]      tier 0 = Primary, 1 = Secondary, 2 = Tertiary
//   stages:   [{ id, name }]
//   steps:    [{ id, useCase, stage, text }]
//   links:    [{ id, from, to, label }]
//
// Use cases live here, and only here — rows need stable ids to hang steps off, which a plain
// design.md list line doesn't have. They're created and edited on the flow map; the Design tab
// just links to it.

export function blankFlow() {
  return { useCases: [], stages: [], steps: [], links: [] };
}

const str = (v) => (typeof v === "string" ? v : "");
const arr = (v) => (Array.isArray(v) ? v : []);

// A flow map with no stages opens with a few already in place, so you can start placing steps
// straight away instead of building columns first. They're ordinary stages — rename or remove them.
export const DEFAULT_STAGE_NAMES = ["Start", "Explore", "Act", "Finish"];

export function withDefaultStages(flow) {
  if (flow.stages.length) return flow;
  return { ...flow, stages: DEFAULT_STAGE_NAMES.map((name) => ({ id: genEntityId(), name })) };
}

// Whatever was on disk, in the exact shape above. A step whose use case or stage is gone, or a link
// whose ends are, can't be placed or drawn — it's dropped rather than left to break the map.
export function normalizeFlow(raw) {
  const f = raw && typeof raw === "object" ? raw : {};
  const useCases = arr(f.useCases).filter((u) => u && u.id != null)
    .map((u) => ({ id: String(u.id), tier: [0, 1, 2].includes(u.tier) ? u.tier : 1, text: str(u.text) }));
  const stages = arr(f.stages).filter((s) => s && s.id != null).map((s) => ({ id: String(s.id), name: str(s.name) }));
  const ucIds = new Set(useCases.map((u) => u.id)), stageIds = new Set(stages.map((s) => s.id));
  const steps = arr(f.steps).filter((s) => s && s.id != null && ucIds.has(s.useCase) && stageIds.has(s.stage))
    .map((s) => ({ id: String(s.id), useCase: s.useCase, stage: s.stage, text: str(s.text) }));
  const stepIds = new Set(steps.map((s) => s.id));
  const links = arr(f.links).filter((l) => l && l.id != null && stepIds.has(l.from) && stepIds.has(l.to) && l.from !== l.to)
    .map((l) => ({ id: String(l.id), from: l.from, to: l.to, label: str(l.label) }));
  return { useCases, stages, steps, links };
}

// Use cases used to live in design.md (`## Use cases`, each with an optional inline
// "Flow: a → b → c"). Any still there move into the flow on load: each becomes a use case, its
// inline flow becomes steps chained across "Step 1…n" stages (created as needed), and design.md
// comes back without the section. Nothing is dropped. With nothing to move, both are returned
// untouched — the design text isn't even re-serialized.
export function migrateUseCases(flow, designMd) {
  const d = parseDesign(designMd);
  if (!d.useCases.length) return { flow, design: designMd, migrated: false };
  const next = { useCases: [...flow.useCases], stages: [...flow.stages], steps: [...flow.steps], links: [...flow.links] };
  const stageAt = (i) => {
    while (next.stages.length <= i) next.stages.push({ id: genEntityId(), name: `Step ${next.stages.length + 1}` });
    return next.stages[i].id;
  };
  for (const uc of d.useCases) {
    const u = { id: genEntityId(), tier: uc.tier, text: uc.text };
    next.useCases.push(u);
    const names = (uc.flow || "").split(/\s*(?:→|->)\s*/).map((s) => s.trim()).filter(Boolean);
    let prev = null;
    names.forEach((name, i) => {
      const step = { id: genEntityId(), useCase: u.id, stage: stageAt(i), text: name };
      next.steps.push(step);
      if (prev) next.links.push({ id: genEntityId(), from: prev, to: step.id, label: "" });
      prev = step.id;
    });
  }
  return { flow: next, design: serializeDesign(d), migrated: true };
}

// The flow as readable text: use cases in priority order, each step under its stage with where it
// leads. flow.md's body (regenerated on every save, never parsed) and the build brief both use it.
//
//   - **Primary:** Export every signal behind one insight
//     - Discover: Open insight → Pick format; Export disabled _(no linked signals)_
//     - Export: Preview the doc → Copy link; Pick format (back) _(change format)_
//
// A target in another use case's row says whose; "(back)" marks a return to an earlier stage.
export function flowOutline(flow) {
  const stageIdx = new Map(flow.stages.map((s, i) => [s.id, i]));
  const stageName = (id) => {
    const i = stageIdx.get(id);
    return flow.stages[i]?.name.trim() || `Stage ${i + 1}`;
  };
  const stepById = new Map(flow.steps.map((s) => [s.id, s]));
  const ucById = new Map(flow.useCases.map((u) => [u.id, u]));
  const stepName = (s) => s.text.trim() || "(untitled step)";
  const byPriority = flow.useCases.map((u, i) => ({ u, i })).sort((a, b) => a.u.tier - b.u.tier || a.i - b.i).map((x) => x.u);

  return byPriority.map((u) => {
    const mine = flow.steps.map((s, i) => ({ s, i })).filter((x) => x.s.useCase === u.id)
      .sort((a, b) => stageIdx.get(a.s.stage) - stageIdx.get(b.s.stage) || a.i - b.i).map((x) => x.s);
    const lines = [`- **${TIERS[u.tier] || TIERS[1]}:** ${u.text.trim() || "(untitled use case)"}`];
    for (const s of mine) {
      const outs = flow.links.filter((l) => l.from === s.id).map((l) => {
        const t = stepById.get(l.to);
        if (!t) return null;
        const where = t.useCase !== s.useCase ? ` (${TIERS[ucById.get(t.useCase)?.tier] || "other"} use case)` : "";
        const back = stageIdx.get(t.stage) < stageIdx.get(s.stage) ? " (back)" : "";
        const label = l.label.trim() ? ` _(${l.label.trim()})_` : "";
        return `${stepName(t)}${where}${back}${label}`;
      }).filter(Boolean);
      lines.push(`  - ${stageName(s.stage)}: ${stepName(s)}${outs.length ? ` → ${outs.join("; ")}` : ""}`);
    }
    return lines.join("\n");
  }).join("\n");
}
