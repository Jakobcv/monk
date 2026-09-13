import { listItems } from "./designModel.js";

// A spec's Plan tab is its tasks plus the approach, stored as one readable plan.md:
//
//   ## Tasks
//
//   - [ ] not started
//   - [~] in progress
//   - [x] done
//   - [!] blocked
//
//   ## Approach
//
//   freeform markdown
//
// One list with a state per task rather than a list per state: finishing a task is a one-character
// change and the task keeps its place in the plan, where moving it between lists would lose its
// position and make an agent edit two places. Blocked is the exception rather than a step, so
// unblocking goes back to to do rather than remembering where it was.
//
// A task is its text and its state, nothing else. Why it's blocked is an open question on the spec;
// what was built and how it was checked goes in solution.md Notes.
//
// Parsing is forgiving the same way designModel.js is: a plan.md with no `## Tasks` section is all
// approach and comes back out byte for byte, and any other `##` section or text before the first
// heading stays in the approach with its heading.

export const TASK_STATUSES = ["todo", "doing", "done", "blocked"];

const MARK = { todo: " ", doing: "~", done: "x", blocked: "!" };
// `[/]` and `[-]` are what other tools use for "in progress"; read them, write `[~]`.
const STATUS_BY_MARK = { " ": "todo", "~": "doing", "/": "doing", "-": "doing", x: "done", X: "done", "!": "blocked" };
const TASK_LINE = /^\s*[-*+]\s+\[([ ~/xX!-])\]\s?(.*)$/;
const BULLET = /^\s*[-*+]\s+/;

const oneLine = (s) => (s || "").replace(/\s+/g, " ").trim();
const joinLines = (lines) => lines.map((l) => l.trim()).join(" ").trim();

export function blankPlan() {
  return { tasks: [], approach: "" };
}

function parseTasks(lines) {
  const tasks = [];
  for (const group of listItems(lines)) {
    const first = group[0];
    // A nested bullet — a sub-point, or a `- Note:` line from before tasks dropped notes — joins the
    // task above it rather than becoming a task of its own, so nothing written there is lost.
    if (/^\s+[-*+]\s+/.test(first) && tasks.length) {
      const last = tasks[tasks.length - 1];
      last.text = oneLine(`${last.text} ${joinLines(group).replace(BULLET, "")}`);
      continue;
    }
    const m = TASK_LINE.exec(first);
    const text = m ? joinLines([m[2], ...group.slice(1)]) : joinLines(group).replace(BULLET, "");
    tasks.push({ text: oneLine(text), status: m ? STATUS_BY_MARK[m[1]] : "todo" });
  }
  return tasks;
}

export function parsePlan(md) {
  const source = md || "";
  const text = source.replace(/\r\n?/g, "\n");
  const chunks = [{ title: null, lines: [] }];
  for (const line of text.split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) chunks.push({ title: h[1], lines: [] });
    else chunks[chunks.length - 1].lines.push(line);
  }
  const tasksChunk = chunks.find((c) => c.title && c.title.toLowerCase() === "tasks");
  // No tasks section: the whole file is the approach, exactly as written.
  if (!tasksChunk) return { tasks: [], approach: source };

  let approachSeen = false;
  const approach = [];
  for (const chunk of chunks) {
    if (chunk === tasksChunk) continue;
    const body = chunk.lines.join("\n").trim();
    if (!chunk.title) { if (body) approach.push(body); continue; }
    if (!approachSeen && chunk.title.toLowerCase() === "approach") {
      approachSeen = true;
      if (body) approach.push(body);
      continue;
    }
    approach.push(body ? `## ${chunk.title}\n\n${body}` : `## ${chunk.title}`);
  }
  return { tasks: parseTasks(tasksChunk.lines), approach: approach.join("\n\n") };
}

// Tasks still empty stay on screen but aren't written. No tasks at all writes the approach alone,
// untouched, so a plan that never used tasks never changes shape.
export function serializePlan(plan) {
  const tasks = (plan.tasks || []).filter((t) => oneLine(t.text));
  const approach = plan.approach || "";
  if (!tasks.length) return approach;
  const lines = tasks.map((t) => `- [${MARK[t.status] || " "}] ${oneLine(t.text)}`);
  const rest = approach.trim();
  return `## Tasks\n\n${lines.join("\n")}\n${rest ? `\n## Approach\n\n${rest}\n` : ""}`;
}

// Counts of tasks that have text, by status, plus the total.
export function taskCounts(tasks) {
  const counts = { todo: 0, doing: 0, done: 0, blocked: 0, total: 0 };
  for (const t of tasks || []) {
    if (!oneLine(t.text)) continue;
    counts[TASK_STATUSES.includes(t.status) ? t.status : "todo"]++;
    counts.total++;
  }
  return counts;
}
