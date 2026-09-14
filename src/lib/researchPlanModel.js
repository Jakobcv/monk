import { genEntityId, blankBoard } from "./boardModel.js";
import { INK_FAINT, ACCENT } from "./theme.js";

// A research plan is the study behind a set of signals — what research is to an initiative's specs,
// after Erika Hall's research plan. Its Overview says why the research is being done (problem
// statement, background), how (approach, participants, discussion guide), what it has to find out
// (research questions) and what was done (activities). Its Analysis is the board: the signals the
// study collected, the insights formed from them, and the actions and results they lead to.
//
// - `activities` are plain strings — "Interview with P3", "Survey wave 1" — with nothing else to them,
//   and not linked to signals. A back seat on purpose: recording what you did shouldn't be a form.
// - `board` is the study's board (Board.jsx), stored beside the plan file (storage.js). Its signal
//   and insight cards are pointers to global records, so one signal can sit on several plans' boards.
// - A research question is answered by insights: `insightIds` are pointers into the global
//   insights list. A question with at least one is answered; there is no separate checkbox to
//   drift out of step with the evidence.
// - A spec lists the plans behind it in `researchPlanIds`, so "specs informed by this plan" is
//   derived (see specsForPlan).
//
// Called researchPlan everywhere in code because "plan" is already a spec's task list (planModel.js).
export function blankResearchPlan(title = "Untitled research plan") {
  const now = Date.now();
  const id = genEntityId();
  return {
    id, title, status: "planned", initiativeId: null,
    problem: "", background: "", approach: "", participants: "", discussionGuide: "",
    researchQuestions: [],
    activities: [],
    board: blankBoard(id),
    // Sections of the file the app doesn't show, kept as raw markdown (see markdown.js).
    extraSections: "",
    createdAt: now, updatedAt: now,
  };
}

export const RESEARCH_PLAN_STATUS_OPTIONS = ["planned", "fieldwork", "synthesis", "done"];
export const RESEARCH_PLAN_STATUS_COLOR = {
  planned: INK_FAINT, fieldwork: ACCENT.signal, synthesis: ACCENT.insight, done: ACCENT.action,
};

export function specsForPlan(specs, planId) {
  return (specs || []).filter((s) => (s.researchPlanIds || []).includes(planId));
}

export const isQuestionAnswered = (q) => (q.insightIds || []).length > 0;

export function answeredCount(plan) {
  return (plan.researchQuestions || []).filter(isQuestionAnswered).length;
}
