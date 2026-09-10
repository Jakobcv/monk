// A deterministic, plausible workspace for building and testing the Home dashboard without a
// connected folder. Shapes match the real models (signalModel/insightModel/specModel/etc.);
// only the fields the dashboard reads are filled in with any care.

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

const METHODS = ["Interview", "Survey", "Usage metrics", "Client call", "Other"];
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
  { title: "Export & views overhaul", status: "active" },
  { title: "Enterprise readiness", status: "active" },
  { title: "Onboarding funnel", status: "paused" },
];
const OWNERS = ["Priya", "Sam", "Dani", "Lee"];

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
    return { id: genEntityId(rand), title: ini.title, status: ini.status, description: "", createdAt: created, updatedAt: at(rand, 44, 12) };
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

  return { signals, insights, activities, specs, initiatives, sections };
}
