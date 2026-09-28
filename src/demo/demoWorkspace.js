import { memoryFolder } from "../lib/memoryFolder.js";
import {
  sectionMetaToMarkdown, documentToMarkdown, specToMarkdown, signalToMarkdown, insightToMarkdown,
  initiativeToMarkdown, researchPlanToMarkdown, boardMetaToMarkdown, cardToMarkdown,
} from "../lib/markdown.js";
import { MONK_SCHEMA_DOC } from "../lib/monkSchema.js";
import { AGENTS_DOC } from "../lib/agentsDoc.js";
import { WORKSPACE_DOCS } from "../lib/workspaceDocs.js";
import { blankSpec } from "../lib/specModel.js";
import { blankSignal } from "../lib/signalModel.js";
import { blankInsight } from "../lib/insightModel.js";
import { blankInitiative } from "../lib/initiativeModel.js";
import { blankResearchPlan } from "../lib/researchPlanModel.js";
import { blankSection, blankDocument, FIXED_SECTIONS } from "../lib/documentModel.js";
import { fileSource } from "../lib/sourceModel.js";

// The demo's workspace, as a folder in memory for App.jsx to load like any other (see
// lib/memoryFolder.js). This is the one seam between the demo and what is in it: the app only
// ever calls openDemoFolder().
//
// What is here now is a stand-in — one record of each kind, about a household grocery app called
// Larder — so the demo can be opened and checked before its real content exists. That content is
// the spec "Larder: the demo's sample workspace", which replaces the body of this function with
// a folder of files. Until then the records are built with the app's own factories and turned into
// files with its own serializers, so they can't drift from the format.
//
// It deliberately doesn't seed by calling saveWorkspace on an empty folder. storage.js keeps one
// record of what it has written, for whichever folder is open, and a seed written through it would
// share that record with the app — so two seeds at once (React runs mount effects twice in
// development) each skipped files the other had "already written".

const DAY = 86400000;

// Fixed ids, so a link into the demo still resolves after a reload starts it over.
const ID = (n) => `1a2d0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const withId = (record, n) => Object.assign(record, { id: ID(n) });

// A board's cards, one file each, carrying the connections that leave them — as storage.js writes them.
function boardFiles(base, board) {
  const files = { [`${base}/board.md`]: boardMetaToMarkdown(board) };
  for (const kind of ["signals", "insights", "actions", "results"]) {
    for (const card of board[kind] || []) {
      const connectsTo = (board.connections || []).filter((c) => c.from === card.id).map((c) => c.to);
      files[`${base}/${kind}/${card.id}.md`] = cardToMarkdown({ ...card, connectsTo }, kind.slice(0, -1));
    }
  }
  return files;
}

const SKETCH = (title, blocks) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200" role="img" aria-labelledby="t"><title id="t">${title}</title><rect x="0.5" y="0.5" width="319" height="199" fill="#F2F2F0" stroke="#9A9A96"/>${blocks}</svg>`;

export async function openDemoFolder() {
  const now = Date.now();
  const ago = (days) => now - Math.round(days * DAY);
  const stamp = (record, created, updated = created) => Object.assign(record, { createdAt: ago(created), updatedAt: ago(updated) });

  const initiative = withId(stamp(blankInitiative("Lists two people can shop from"), 40, 0), 1);
  Object.assign(initiative, {
    description: "Most Larder households have two adults shopping from one list, and the list breaks the moment both are in a shop at once: items get bought twice, or not at all, because each phone shows the list as it was when it was opened. This initiative makes the shared list live, so it can be trusted mid-shop.\n\nThe boundary: the list itself, not meal planning, and not the paid tier.",
    outcomes: [
      { text: "Two people shopping at once stop buying the same item twice.", metric: "items ticked twice within ten minutes, per shared list per week", baseline: "1.8", target: "0.2", current: "1.1" },
    ],
    openQuestions: [
      { text: "Does a ticked item disappear for the other shopper, or stay visible and struck through?", checked: true, resolution: "Struck through for five seconds, then moved to the bottom. Interviewees wanted to see that the other person had it, not have it vanish." },
      { text: "What happens to an item added while the other shopper is offline in the shop's basement?", checked: false },
    ],
  });

  const signals = [
    ["We both bought oat milk again. The list said it was still there when I looked.", 30, "Interview"],
    ["I text my partner the list instead of sharing it, because then I know it's what they're seeing.", 27, "Interview"],
    ["41% of shared lists have an item ticked twice within ten minutes, in the last month's events.", 12, "Usage metrics"],
    ["Support: three tickets this week saying the list \"didn't update\" while in the shop.", 5, "Support"],
  ].map(([text, days, author], i) => Object.assign(withId(stamp(blankSignal(), days), 10 + i), { text, date: ago(days), author }));

  const insight = withId(stamp(blankInsight(signals.map((s) => s.id)), 10, 4), 20);
  insight.text = "A shared list is only trusted if it changes while you are looking at it. When it doesn't, people fall back to texting each other, and the list stops being shared at all.";

  const spec = withId(stamp(blankSpec("Ticks reach the other phone while shopping", initiative.id), 8, 0), 30);
  const plan = withId(stamp(blankResearchPlan("Why shared lists get abandoned"), 45, 3), 40);
  Object.assign(plan, {
    status: "synthesis",
    initiativeId: initiative.id,
    problem: "Households who share a list stop using it within a month more often than people shopping alone, and we don't know what goes wrong between two people using one list.",
    background: "Sharing a list is Larder's most requested feature and its weakest retention: shared lists are abandoned at twice the rate of personal ones.",
    approach: "Eight interviews with households who stopped using a shared list, each walked through their last shop together. Event data to size what we hear.",
    participants: "Eight two-adult households who shared a list for at least two weeks and then stopped, recruited from the in-app survey.",
    discussionGuide: "1. Tell me about the last big shop you did.\n2. Who wrote the list, and who shopped from it?\n3. What happened when you were both in the shop?\n4. What do you use instead now?",
    researchQuestions: [
      { text: "What goes wrong when two people shop from one list at the same time?", insightIds: [insight.id] },
      { text: "What do households use once they stop sharing a list?", insightIds: [] },
    ],
  });
  plan.board = {
    ...plan.board,
    id: plan.id,
    signals: signals.map((s) => ({ id: s.id })),
    insights: [{ id: insight.id }],
    actions: [{ id: 1, ifWe: "update the list on every phone the moment an item is ticked", then: "both shoppers see the same list mid-shop", expected: "items bought twice drop by half within a month" }],
    results: [{ id: 2, specId: spec.id }],
    connections: [
      ...signals.map((s, i) => ({ id: 10 + i, from: s.id, to: insight.id })),
      { id: 20, from: insight.id, to: 1 },
      { id: 21, from: 1, to: 2 },
    ],
  };

  Object.assign(spec, {
    status: "active",
    owner: "Priya",
    researchPlanIds: [plan.id],
    problem: "Two people shopping from one Larder list see it as it was when they opened it. A tick on one phone doesn't reach the other until the app is reopened, so items are bought twice or missed, and households give up on sharing the list.",
    goals: "- A tick on one phone shows on the other within two seconds while both are online.\n- A shopper can tell an item the other person just ticked from one that was ticked before.",
    nonGoals: "- Editing the same item's text from two phones at once.\n- Showing where the other shopper is in the shop.",
    openQuestions: [{ text: "Is two seconds achievable on a shop's mobile signal, or does the target need to depend on connection quality?", checked: false }],
    acceptanceCriteria: [
      { text: "Given two phones on one list, when an item is ticked on one, it shows as ticked on the other within two seconds.", checked: true },
      { text: "Given an item the other shopper ticked, when it arrives, it is struck through for five seconds before moving to the bottom.", checked: false },
      { text: "Given a phone that was offline, when it reconnects, every tick made meanwhile is applied in order.", checked: false },
    ],
    design: "## Solution\n\nWhen either shopper ticks an item, every other phone with the list open shows it ticked straight away. An item ticked by someone else is struck through where it is for five seconds, so it can be seen, and then drops to the bottom with the rest.\n\n## Sketches\n\n- ![Struck through in place](sketches/struck-in-place.svg) — A shopper sees what the other person just picked up\n- ![Grouped under who ticked it](sketches/grouped-by-person.svg) — A shopper sees what the other person just picked up\n\n## Decisions\n\n- Ticks sync, text edits don't yet — because ticking is what happens mid-shop, and editing text is what happens at home.\n\n## Notes\n\nThe list already syncs on open; the gap is only while it stays open.\n",
    plan: "## Tasks\n\n- [x] Push ticks to other open copies of the list\n- [~] Strike through a remote tick for five seconds before it moves\n- [ ] Replay ticks made offline, in order, on reconnect\n- [!] Measure sync time on a real shop's signal\n\n## Approach\n\nShip the push first behind a flag for staff households, then the struck-through state.\n",
  });

  const standards = { ...FIXED_SECTIONS[1], createdAt: ago(60), updatedAt: ago(20), documents: [] };
  const knowledge = { ...FIXED_SECTIONS[0], createdAt: ago(60), updatedAt: ago(15), documents: [] };
  knowledge.documents.push(Object.assign(withId(stamp(blankDocument("Who uses Larder"), 60, 15), 50), {
    body: "Larder is a grocery list and meal planner for households. Most active households have two adults; about a third have children who add to the list.\n\nThe list is used in two places: at home, where it is written over a week, and in the shop, where it is read and ticked in twenty minutes, often one-handed.",
  }));
  standards.documents.push(Object.assign(withId(stamp(blankDocument("Accessibility"), 60, 20), 51), {
    body: "Everything in the shopping view must work one-handed on a phone: targets at least 44px, nothing that needs a swipe without a tap alternative, and text that stays readable at the largest system size.",
  }));
  const notes = withId(stamp(blankSection("Team rituals"), 30, 9), 60);
  notes.documents.push(Object.assign(withId(stamp(blankDocument("How we run research"), 30, 9), 61), {
    body: "Every study has a research plan before the first interview. Notes go in as signals the same day, while they are still exact.",
  }));

  const sketches = {
    "struck-in-place.svg": SKETCH("Ticked item struck through in place", '<g fill="#DCDCDA"><rect x="20" y="24" width="280" height="22"/><rect x="20" y="54" width="280" height="22"/><rect x="20" y="84" width="280" height="22"/></g><line x1="30" y1="65" x2="200" y2="65" stroke="#77776F" stroke-width="2"/>'),
    "grouped-by-person.svg": SKETCH("Ticked items grouped under who ticked them", '<rect x="20" y="20" width="80" height="8" fill="#C6C6C3"/><g fill="#DCDCDA"><rect x="20" y="36" width="280" height="22"/><rect x="20" y="64" width="280" height="22"/></g><rect x="20" y="104" width="80" height="8" fill="#C6C6C3"/><g fill="#DCDCDA"><rect x="20" y="120" width="280" height="22"/></g>'),
  };
  spec.sources = [fileSource("household-3-notes.txt")];

  const files = {
    "MONK.md": MONK_SCHEMA_DOC,
    "AGENTS.md": AGENTS_DOC,
    // Seeded documents (WRITING.md) as the app writes them on attach, so opening the demo doesn't
    // write them itself — which would count as the person's first change, and ask before a reload.
    ...Object.fromEntries(WORKSPACE_DOCS.filter((d) => d.seeded).map((d) => [d.file, d.template({})])),
    [`${spec.id}/spec.md`]: specToMarkdown(spec),
    [`${spec.id}/solution.md`]: spec.design,
    [`${spec.id}/plan.md`]: spec.plan,
    ...Object.fromEntries(Object.entries(sketches).map(([name, svg]) => [`${spec.id}/sketches/${name}`, svg])),
    [`${spec.id}/sources/household-3-notes.txt`]: "Interview notes, household 3: \"We both bought oat milk again.\"",
    [`initiatives/${initiative.id}.md`]: initiativeToMarkdown(initiative),
    [`insights/${insight.id}.md`]: insightToMarkdown(insight),
    [`research-plans/${plan.id}.md`]: researchPlanToMarkdown(plan),
    ...boardFiles(`research-plans/${plan.id}/board`, plan.board),
  };
  for (const signal of signals) files[`signals/${signal.id}.md`] = signalToMarkdown(signal);
  for (const section of [knowledge, standards, notes]) {
    files[`${section.id}/section.md`] = sectionMetaToMarkdown(section);
    for (const doc of section.documents) files[`${section.id}/${doc.id}.md`] = documentToMarkdown(doc);
  }
  return memoryFolder("larder", files);
}
