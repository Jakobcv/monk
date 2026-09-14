// Activities used to be a record of their own: one file per interview, survey or review in
// `activities/`, with signals pointing at them (`source: {type:"activity", activityId}`). They were
// folded into research plans. A plan now lists what was done as plain `activities` strings, and the
// signals it collected are linked onto its board.
//
// This turns a workspace that still has activities into that shape. It's a pure function over
// loaded records (plans already carrying their boards): storage.js runs it on every load, and moves
// the old files out of the way once the result is safely on disk. With no activities and no signal
// carrying a `source` it returns its input untouched, so running it again changes nothing.
//
// - An activity with a `planId` whose plan exists becomes a line in that plan's `activities` (its
//   name, or its method and date when it had none), and its signals are linked onto the plan's board.
// - Any other activity was a small study of its own, so it becomes a research plan with the same
//   id, which keeps old links to it resolvable. Its signals are linked onto that plan's board.
// - `source` is dropped from every signal — it only ever pointed at activities.
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const emptyBoard = (id, at) => ({ id, createdAt: at, updatedAt: at, signals: [], insights: [], actions: [], results: [], connections: [] });

export function migrateActivities({ activities = [], signals = [], researchPlans = [] }) {
  const report = { activities: activities.length, plansCreated: 0, signalsLinked: 0, sourcesDropped: 0 };
  if (!activities.length && !signals.some((s) => s.source != null)) {
    return { signals, researchPlans, retiredActivityIds: [], report };
  }

  const plans = new Map(researchPlans.map((p) => [p.id, { ...p, board: p.board || emptyBoard(p.id, p.createdAt || Date.now()) }]));
  const created = [];
  const target = new Map(); // activity id → plan id

  for (const a of activities) {
    const date = a.date || a.createdAt || Date.now();
    if (a.planId && plans.has(a.planId) && !created.includes(a.planId)) {
      const plan = plans.get(a.planId);
      const name = (a.name || "").trim() || [a.method, day(date)].filter(Boolean).join(" ");
      if (!(plan.activities || []).includes(name)) plans.set(plan.id, { ...plan, activities: [...(plan.activities || []), name] });
      target.set(a.id, plan.id);
      continue;
    }
    // A plan already carrying this id is one an earlier, interrupted migration wrote: reuse it.
    if (!plans.has(a.id)) {
      const hasSignals = signals.some((s) => s.source?.type === "activity" && s.source.activityId === a.id);
      plans.set(a.id, {
        id: a.id,
        title: a.name || "",
        status: hasSignals ? "done" : "planned",
        initiativeId: null,
        problem: "",
        background: "",
        approach: [a.method, a.link ? `Notes: ${a.link}` : ""].filter(Boolean).join("\n\n"),
        participants: "",
        discussionGuide: "",
        researchQuestions: [],
        activities: [],
        extraSections: "",
        board: emptyBoard(a.id, date),
        createdAt: a.createdAt || date,
        updatedAt: a.updatedAt || date,
      });
      created.push(a.id);
    }
    target.set(a.id, a.id);
  }
  report.plansCreated = created.length;

  const nextSignals = signals.map((s) => {
    if (s.source == null) return s;
    const { source, ...rest } = s;
    report.sourcesDropped++;
    const planId = source.type === "activity" ? target.get(source.activityId) : null;
    if (planId) {
      const plan = plans.get(planId);
      if (!plan.board.signals.some((x) => x.id === s.id)) {
        plans.set(planId, { ...plan, board: { ...plan.board, signals: [...plan.board.signals, { id: s.id }] } });
        report.signalsLinked++;
      }
    }
    return rest;
  });

  return {
    signals: nextSignals,
    researchPlans: [...plans.values()],
    retiredActivityIds: activities.map((a) => a.id),
    report,
  };
}
