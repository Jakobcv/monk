import { migrateActivities } from "./migrateActivities.js";

// A deterministic, plausible workspace for the DEV-only preview routes (#/home-preview,
// #/board-preview, #/research-preview), which can't open a connected folder. Shapes match the
// real models (signalModel/insightModel/specModel/etc.); only the fields those pages read are
// filled in with any care.

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 10); // fixed "today" so buckets are stable
const WINDOW_DAYS = 77;

const METHODS = ["Interview", "Survey", "Usage metrics", "Client call", "Codebase review", "Other"];
const SIGNAL_TEXT = [
  "Users abandon the export dialog when it offers more than three formats.",
  "Three support tickets this week ask for CSV specifically.",
  "Sales demo feedback: \"why are there so many toggles?\"",
  "Onboarding drop-off spikes on the integrations step.",
  "Power users want keyboard shortcuts for column reorder.",
  "Mobile users almost never open the filters panel.",
  "Everyone re-uses one exported file as a template for months.",
  "The empty state gets screenshotted and shared as a bug.",
  "Two enterprise accounts asked for SSO in the same call.",
  "Search feels slow above ~2k rows, per session replays.",
  "People type the project name into search to 'jump' to it.",
  "Nobody noticed the new bulk-action bar in the first week.",
  "Docs traffic to the API page tripled after the changelog post.",
  "A workaround doc is circulating for scheduled exports.",
  "Trial users who invite a teammate convert at 3x.",
  "Support asked for a 'copy as markdown' option twice this month.",
  "Users keep two tabs open to compare filtered views side by side.",
  "The date picker defaults confuse first-time users in tests.",
  "One customer built a Zapier hack to email weekly exports.",
  "Churned account cited 'too many clicks to share' in the exit survey.",
  "Session replay: people hover the column header hoping to sort.",
  "Admins want to lock a default view for their whole team.",
  "Two prospects asked whether we're SOC 2 in the same week.",
  "Users rename exported files to a date — we could do that for them.",
  "The bulk bar is discovered only after someone shift-clicks by accident.",
  "New hires can't tell 'draft' from 'active' at a glance.",
];
const INSIGHT_TEXT = [
  "Format choice is the blocker, not the formats themselves.",
  "Users trust a short curated list more than a complete one.",
  "The integrations step is doing too much at once.",
  "Reorder is a power-user path and should be keyboardable.",
  "Filters need to be discoverable without being in the way.",
  "Export is really a 'save a view' job to be done.",
  "SSO is now table stakes for the enterprise segment.",
  "Perceived search speed matters more than actual latency here.",
  "Collaboration in the first session predicts retention.",
  "Sharing friction is a top churn reason for small teams.",
  "Team-level defaults would remove a whole class of support tickets.",
  "Sorting expectations are set by every other table on the web.",
  "Compliance questions now arrive before the first call.",
  "The status vocabulary needs a visual, not just a label.",
  "People want scheduled exports, and they'll hack around us to get them.",
  "Discoverability of new UI needs an in-context nudge, not a changelog.",
];
const SPEC_TITLES = [
  "Pinned export formats",
  "Keyboard-first column reorder",
  "Integrations onboarding, split",
  "Filter panel discoverability",
  "Saved views",
  "Bulk actions v2",
  "SSO for enterprise",
  "Search performance pass",
  "First-session collaboration nudge",
  "Changelog + API docs linkage",
  "Empty states audit",
];
const INITIATIVES = [
  {
    title: "Export & views overhaul", status: "active",
    outcomes: [
      { text: "Teams take evidence into their own tools instead of screenshotting boards", metric: "Weekly exports per active workspace", baseline: "0.4", target: "3", current: "1.1" },
      { text: "Fewer abandoned exports", metric: "Export dialogs closed without exporting", baseline: "62%", target: "25%", current: "" },
    ],
  },
  { title: "Enterprise readiness", status: "active" },
  { title: "Onboarding funnel", status: "paused" },
];
const OWNERS = ["Priya", "Sam", "Dani", "Lee"];
const RESEARCH_PLANS = [
  {
    title: "Why exports get abandoned",
    status: "synthesis",
    problem: "Half of the people who open the export dialog close it without exporting anything. We don't know whether they can't find the format they need, don't trust what they'd get, or wanted something else entirely.",
    background: "Support tickets asking for CSV and a circulating workaround doc for scheduled exports both point at export, but neither says why the dialog itself loses people.",
    approach: "Moderated interviews with people who abandoned an export in the last month, each followed by a short task on their own data. Usage metrics to size what we hear.",
    participants: "Eight active users who closed the export dialog without exporting at least twice in 30 days — a mix of admins and individual contributors, recruited from the in-app prompt.",
    discussionGuide: "1. Tell me about the last time you needed data out of the product.\n2. What did you expect to happen when you opened export?\n3. Walk me through what you did next.\n4. What did you end up doing instead?",
    questions: [
      "What are people trying to do when they open export?",
      "Which part of the dialog makes them give up?",
      "What do they use instead when they abandon it?",
      "Would a saved view replace the export for them?",
    ],
    answered: 2,
  },
  {
    title: "Enterprise buying blockers",
    status: "fieldwork",
    problem: "Enterprise deals stall after the second call, and sales can't say which requirement is the one that stops them.",
    background: "SSO and SOC 2 come up early in almost every enterprise conversation, but we don't know which of them actually block a purchase.",
    approach: "Client calls with prospects in late-stage deals, plus a review of lost-deal notes from the last two quarters.",
    participants: "Six prospects with more than 200 seats, including two lost deals. Recruited through account executives.",
    discussionGuide: "1. Who has to sign off before you can buy?\n2. What did your security review ask for?\n3. What would have made this an easy yes?",
    questions: [
      "Which requirements block a purchase, rather than just being asked about?",
      "Who raises them, and at what stage of the deal?",
    ],
    answered: 1,
  },
  {
    title: "First-week collaboration",
    status: "planned",
    problem: "Trial users who invite a teammate convert at three times the rate of those who don't, and we don't know what gets someone to invite.",
    background: "",
    approach: "",
    participants: "",
    discussionGuide: "",
    questions: ["What prompts someone to invite a teammate in their first week?"],
    answered: 0,
  },
];

function genEntityId(rand) {
  return "m-" + Math.floor(rand() * 1e9).toString(36);
}
function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function at(rand, dayFrom, dayTo) {
  const d = dayFrom + rand() * (dayTo - dayFrom);
  return NOW - Math.round(d) * DAY;
}

export function mockWorkspace(seed = 42) {
  const rand = mulberry32(seed);

  // --- activities ---
  const activities = Array.from({ length: 6 }, (_, i) => {
    const created = at(rand, WINDOW_DAYS, WINDOW_DAYS - 20 - i * 6);
    return {
      id: genEntityId(rand),
      name: `${pick(rand, METHODS)} round ${i + 1}`,
      method: pick(rand, METHODS),
      link: "",
      author: pick(rand, OWNERS),
      date: created,
      createdAt: created,
      updatedAt: created + Math.round(rand() * 10) * DAY,
    };
  });

  // --- signals: a rising cadence over the last 12 weeks (each week's share follows a ramp
  //     with a little noise, so the momentum chart trends up without wild single-bar spikes).
  const MOM_WEEKS = 12;
  const weekWeight = Array.from({ length: MOM_WEEKS }, (_, w) => {
    const ramp = 0.4 + (w / (MOM_WEEKS - 1)) * 1.9; // w=0 oldest, w=11 most recent
    return Math.max(0.15, ramp + (rand() - 0.5) * 0.45);
  });
  const wTotal = weekWeight.reduce((a, b) => a + b, 0);
  const TARGET_SIGNALS = 54;
  const signalDates = [];
  weekWeight.forEach((wt, w) => {
    const n = Math.round((TARGET_SIGNALS * wt) / wTotal);
    for (let k = 0; k < n; k++) {
      const daysAgo = (MOM_WEEKS - 1 - w + rand()) * 7;
      signalDates.push(NOW - Math.round(daysAgo) * DAY);
    }
  });
  signalDates.sort((a, b) => a - b); // oldest first

  const signals = signalDates.map((created, i) => {
    const tied = rand() < 0.65;
    return {
      id: genEntityId(rand),
      text: SIGNAL_TEXT[i % SIGNAL_TEXT.length],
      source: tied ? { type: "activity", activityId: pick(rand, activities).id } : null,
      date: created,
      link: "",
      author: pick(rand, OWNERS),
      createdAt: created,
      updatedAt: created, // untouched since creation; the recent-edits pass adds the spread
    };
  });

  // --- insights: their own rising cadence, trailing signals — nothing in the first couple of
  //     weeks (no evidence yet), then a ramp. Each takes 1–4 source signals that predate it.
  const insWeight = Array.from({ length: MOM_WEEKS }, (_, w) => {
    if (w < 2) return 0.03;
    const ramp = 0.2 + ((w - 2) / (MOM_WEEKS - 3)) * 1.25;
    return Math.max(0.05, ramp + (rand() - 0.5) * 0.3);
  });
  const insTotal = insWeight.reduce((a, b) => a + b, 0);
  const TARGET_INSIGHTS = 21;
  const insightDates = [];
  insWeight.forEach((wt, w) => {
    const n = Math.round((TARGET_INSIGHTS * wt) / insTotal);
    for (let k = 0; k < n; k++) {
      const daysAgo = (MOM_WEEKS - 1 - w + rand()) * 7;
      insightDates.push(NOW - Math.round(daysAgo) * DAY);
    }
  });
  insightDates.sort((a, b) => a - b);

  const insights = insightDates.map((created, i) => {
    const eligible = signals.filter((s) => s.createdAt < created);
    const count = Math.min(eligible.length, 1 + Math.floor(rand() * 4));
    const sources = [...eligible].sort(() => rand() - 0.5).slice(0, count).map((s) => s.id);
    if (rand() < 0.14) sources.length = 0; // a few insights formed from nothing
    return {
      id: genEntityId(rand),
      text: INSIGHT_TEXT[i % INSIGHT_TEXT.length],
      sources,
      createdAt: created,
      updatedAt: created, // untouched since creation; the recent-edits pass adds the spread
    };
  });

  // --- initiatives ---
  const initiatives = INITIATIVES.map((ini) => {
    const created = at(rand, WINDOW_DAYS, WINDOW_DAYS - 30);
    return { id: genEntityId(rand), title: ini.title, status: ini.status, description: "", outcomes: ini.outcomes || [], openQuestions: [], createdAt: created, updatedAt: at(rand, 44, 12) };
  });

  // --- specs: weighted statuses, ~half under an initiative, each with a small board ---
  const STATUS_PLAN = ["draft", "draft", "draft", "draft", "active", "active", "active", "active", "active", "shipped", "shipped"];
  const specs = SPEC_TITLES.map((title, i) => {
    const status = STATUS_PLAN[i] || "draft";
    const created = at(rand, WINDOW_DAYS - 5, 8);
    // active specs land 8–40 days back so a couple read as "stale" and none crowd the recent
    // feed (which comes from the curated pass below); shipped/draft sit further back still.
    const updatedAt = status === "shipped"
      ? at(rand, 58, 22)
      : status === "active"
        ? at(rand, 40, 8)
        : at(rand, 34, 6);
    const initiativeId = rand() < 0.55 ? pick(rand, initiatives).id : null;

    const boardSignals = signals.filter(() => rand() < 0.12).map((s) => ({ id: s.id, connectsTo: [] }));
    const boardInsights = insights.filter(() => rand() < 0.28).map((n) => ({ id: n.id, connectsTo: [] }));
    const connections = [];
    boardSignals.forEach((s) => {
      if (boardInsights.length && rand() < 0.7) {
        connections.push({ id: connections.length + 1, from: s.id, to: pick(rand, boardInsights).id });
      }
    });

    const nOpen = Math.floor(rand() * 4);
    const nAcc = 2 + Math.floor(rand() * 4);
    return {
      id: genEntityId(rand),
      title,
      status,
      owner: pick(rand, OWNERS),
      initiativeId,
      problem: "…",
      goals: "",
      nonGoals: "",
      openQuestions: Array.from({ length: nOpen }, () => ({ text: "Open question", checked: rand() < 0.35 })),
      acceptanceCriteria: Array.from({ length: nAcc }, () => ({ text: "Criterion", checked: status === "shipped" ? true : rand() < 0.4 })),
      board: { signals: boardSignals, insights: boardInsights, actions: [], results: [], connections },
      design: rand() < 0.5 ? "# Design\n\n…" : "",
      plan: rand() < 0.4 ? "# Plan\n\n…" : "",
      createdAt: created,
      updatedAt,
    };
  });

  // --- recent-edits pass: bump a spread of entities so "Recently touched" reads today → ~3
  //     weeks instead of everything clustering on "today". ------------------------------------
  const RECENT_OFFSETS = [0, 1, 3, 5, 8, 12, 17, 24];
  const touchPool = [
    ...specs,
    ...insights.slice(0, 12),
    ...activities,
    ...initiatives,
  ];
  touchPool
    .map((x) => ({ x, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, RECENT_OFFSETS.length)
    .forEach(({ x }, i) => { x.updatedAt = NOW - RECENT_OFFSETS[i] * DAY; });

  // --- KB sections/docs (only the count is read) ---
  const mkDoc = (title) => ({ id: genEntityId(rand), title, body: "" });
  const sections = [
    { id: "product-knowledge", name: "Product Knowledge", documents: [mkDoc("Product vision"), mkDoc("User segments"), mkDoc("Pricing rationale")] },
    { id: "standards", name: "Standards", documents: [mkDoc("Design system"), mkDoc("Accessibility"), mkDoc("Writing style")] },
    { id: genEntityId(rand), name: "Discovery notes", documents: [mkDoc("Q3 interviews"), mkDoc("Support ticket digest")] },
  ];

  // --- research plans: the studies some of the activities are sessions of, with part of each
  //     plan's questions answered by insights and a few specs pointing back at them. Built last and
  //     without `rand`, so every preview's existing sample data comes out exactly as before. ---
  const researchPlans = RESEARCH_PLANS.map((p, i) => ({
    id: `m-plan-${i + 1}`,
    title: p.title,
    status: p.status,
    initiativeId: initiatives[i] ? initiatives[i].id : null,
    problem: p.problem, background: p.background, approach: p.approach,
    participants: p.participants, discussionGuide: p.discussionGuide,
    researchQuestions: p.questions.map((text, q) => ({
      text,
      insightIds: q < p.answered ? insights.slice(i * 4 + q, i * 4 + q + 1 + (q % 2)).map((x) => x.id) : [],
    })),
    activities: [],
    extraSections: "",
    createdAt: NOW - (50 - i * 12) * DAY,
    updatedAt: NOW - (1 + i * 4) * DAY,
  }));
  // Boards belong to research plans: the two busiest sample boards become the first two plans'.
  const busiest = [...specs].sort((a, b) => b.board.connections.length - a.board.connections.length);
  researchPlans.forEach((plan, i) => {
    const from = i < 2 ? busiest[i].board : { signals: [], insights: [], actions: [], results: [], connections: [] };
    plan.board = {
      id: plan.id, createdAt: plan.createdAt, updatedAt: plan.updatedAt,
      signals: from.signals, insights: from.insights, actions: from.actions, results: from.results, connections: from.connections,
    };
  });
  activities.forEach((a, i) => { a.planId = i < 3 ? researchPlans[0].id : i < 5 ? researchPlans[1].id : null; });
  specs.forEach((s, i) => { s.researchPlanIds = i === 0 || i === 4 ? [researchPlans[0].id] : i === 6 ? [researchPlans[1].id] : []; });

  // The sample is still generated with activities — that keeps its random stream, and so every
  // preview's data, as it was — and then goes through the same migration a real workspace gets.
  const migrated = migrateActivities({ activities, signals, researchPlans });
  const specsWithoutBoards = specs.map((s) => {
    const spec = { ...s };
    delete spec.board;
    return spec;
  });
  return { signals: migrated.signals, insights, specs: specsWithoutBoards, initiatives, researchPlans: migrated.researchPlans, sections };
}
