import { useState } from "react";
import { PAPER } from "./lib/theme";
import { parsePlan, serializePlan, taskCounts } from "./lib/planModel";
import { Eyebrow } from "./ui/text";
import ChecklistEditor from "./ChecklistEditor";
import MarkdownEditor from "./MarkdownEditor";

// A spec's Plan tab: the work as tasks, each with a state, above the approach in freeform markdown.
// Stored as one plan.md (see lib/planModel.js), the same way DesignTab keeps solution.md: `value`
// seeds local structured state once, and every edit goes back out as the whole file through
// `onChange`. SpecPage remounts this per spec.
//
// One list in the order the work was planned. Changing a task's state never moves it; the line
// beside the heading is where you read how far along it is.
const SUMMARY = [["todo", "to do"], ["doing", "in progress"], ["done", "done"], ["blocked", "blocked"]];

export default function PlanTab({ value, onChange }) {
  const [plan, setPlan] = useState(() => parsePlan(value));
  const commit = (next) => { setPlan(next); onChange(serializePlan(next)); };

  const counts = taskCounts(plan.tasks);
  const summary = SUMMARY.filter(([key]) => counts[key]).map(([key, label]) => `${counts[key]} ${label}`).join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: PAPER.sectionGap }}>
      <ChecklistEditor
        paper tasks label="Tasks" summary={summary}
        items={plan.tasks} onChange={(tasks) => commit({ ...plan, tasks })}
      />

      <div className="paper-rule" style={{ flexShrink: 0 }} />

      {/* The approach keeps the whole rest of the sheet (MarkdownEditor `fill`): the legend settles at
          the foot of the page and the blank paper above it puts the caret at the end. */}
      <div className="paper-section" style={{ flex: 1 }}>
        <Eyebrow>Approach</Eyebrow>
        <MarkdownEditor
          fill minHeight={0} placeholder="How it'll be built, in Markdown…"
          value={plan.approach} onChange={(approach) => commit({ ...plan, approach })}
        />
      </div>
    </div>
  );
}
