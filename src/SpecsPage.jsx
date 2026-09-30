import { useEffect, useId } from "react";
import { Plus, Trash2, ChevronRight, FolderGit2 } from "lucide-react";
import { INK_FAINT, SPACE, PAGE, ACCENT, SPEC_STATUS_COLOR } from "./lib/theme";
import { Dot, Eyebrow, Meta, PageHeading } from "./ui/text";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import EmptyState from "./ui/EmptyState";
import Page from "./ui/Page";
import RollupBar from "./ui/RollupBar";
import { shippedCount } from "./lib/specRollup";
import { parsePlan, taskCounts } from "./lib/planModel";

const INITIATIVE_STATUS_COLOR = { active: ACCENT.insight, paused: INK_FAINT, done: ACCENT.action };

const byRecency = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

// Which initiatives are expanded lives in two places. The URL holds the set the page shows, so a
// view can be linked. This browser remembers each initiative the person has toggled — true or
// false by id — so coming back through a bare #/specs restores the page as they left it. An
// initiative they never touched follows its status: active ones start expanded. How someone likes
// to look at the page is a fact about them, not the product, so none of this is written to disk.
const EXPANDED_KEY = "monk:specs-expanded";
// A private window can refuse localStorage outright. Toggles then last for the session instead.
const sessionToggles = {};

function readToggles() {
  let stored = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPANDED_KEY) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) stored = parsed;
  } catch { /* private mode, or a value we didn't write */ }
  return { ...stored, ...sessionToggles };
}

function rememberToggle(id, open) {
  sessionToggles[id] = open;
  try {
    const stored = JSON.parse(localStorage.getItem(EXPANDED_KEY) || "{}");
    const next = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    next[id] = open;
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
  } catch { /* private mode — sessionToggles still has it */ }
}

function Status({ color, children }) {
  return (
    <Meta className="spec-table__status" style={{ color }}>
      <Dot color={color} /> {children}
    </Meta>
  );
}

// Who a row belongs to, or nothing. Free text, so it truncates like a title and says it in full on hover.
function Owner({ name }) {
  const owner = (name || "").trim();
  return <td className="spec-table__owner" title={owner || undefined}><Meta>{owner}</Meta></td>;
}

// How far an initiative's specs have got: the initiative page's bar, with the shipped count beside
// it in words. Nothing for an initiative with no specs — its count already says 0.
function InitiativeProgress({ specs }) {
  if (specs.length === 0) return null;
  return (
    <div className="spec-table__rollup">
      <RollupBar specs={specs} />
      <Meta>{shippedCount(specs)}/{specs.length} shipped</Meta>
    </div>
  );
}

// A spec's progress through its plan's tasks, or nothing when the plan has none.
function progressOf(spec) {
  const counts = taskCounts(parsePlan(spec.plan).tasks);
  if (!counts.total) return "";
  return [`${counts.done}/${counts.total} tasks`, counts.blocked && `${counts.blocked} blocked`].filter(Boolean).join(" · ");
}

function SpecRow({ spec, href, onDelete, id, hidden, nested }) {
  const title = spec.title || "Untitled spec";
  return (
    <tr id={id} hidden={hidden} className={`spec-table__spec reveal-group${nested ? " spec-table__spec--nested" : ""}`}>
      <th scope="row" className="spec-table__name">
        <a href={href} className="spec-table__link" title={title}>{title}</a>
      </th>
      <Owner name={spec.owner} />
      <td className="spec-table__count" />
      <td className="spec-table__progress"><Meta>{progressOf(spec)}</Meta></td>
      <td><Status color={SPEC_STATUS_COLOR[spec.status] || INK_FAINT}>{spec.status}</Status></td>
      <td className="spec-table__actions">
        <IconButton
          className="reveal"
          danger
          onClick={() => onDelete(spec.id)}
          title="Delete spec"
          aria-label={`Delete ${title}`}
          style={{ "--hit": "32px" }}
        >
          <Trash2 size={14} />
        </IconButton>
      </td>
    </tr>
  );
}

// One initiative and, when it's expanded, its specs — a <tbody> each, so the group is one unit in
// the table. The chevron and the title are sibling controls: a link can't hold a button, and a
// keyboard or screen reader user needs to reach "open it" and "show what's in it" separately.
function InitiativeGroup({ initiative, members, expanded, onToggle, href, specHref, onDelete }) {
  const baseId = useId();
  const title = initiative.title || "Untitled initiative";
  const rowIds = members.map((s, i) => `${baseId}-${i}`);
  return (
    <tbody className="spec-table__group">
      <tr className="spec-table__initiative">
        <th scope="row" className="spec-table__name">
          <span className="spec-table__lead">
            {members.length > 0 ? (
              <IconButton
                className="spec-table__chevron"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={rowIds.join(" ")}
                aria-label={`Specs in ${title}`}
                style={{ "--hit": "32px" }}
              >
                <ChevronRight size={14} aria-hidden="true" />
              </IconButton>
            ) : (
              <span className="spec-table__chevron-space" aria-hidden="true" />
            )}
            <a href={href} className="spec-table__link" title={title}>{title}</a>
          </span>
        </th>
        <Owner name={initiative.owner} />
        <td className="spec-table__count"><Meta>{members.length}</Meta></td>
        <td className="spec-table__progress"><InitiativeProgress specs={members} /></td>
        <td><Status color={INITIATIVE_STATUS_COLOR[initiative.status] || INK_FAINT}>{initiative.status}</Status></td>
        <td className="spec-table__actions" />
      </tr>
      {members.map((s, i) => (
        <SpecRow key={s.id} id={rowIds[i]} hidden={!expanded} nested spec={s} href={specHref(s.id)} onDelete={onDelete} />
      ))}
    </tbody>
  );
}

// The header both tables share. Its cells carry the column widths (fixed layout reads them from
// the first row), so the loose specs' table lines up under the initiatives' and a long title
// truncates instead of pushing status off the row. No <colgroup>: a column hidden at phone width
// has to leave the grid, and a <col> would keep it there as an empty gap.
function Head({ first }) {
  return (
    <thead>
      <tr>
        <th scope="col">{first}</th>
        <th scope="col" className="spec-table__owner">Owner</th>
        <th scope="col" className="spec-table__count">Specs</th>
        <th scope="col" className="spec-table__progress">Progress</th>
        <th scope="col" className="spec-table__status-col">Status</th>
        <th scope="col"><span className="visually-hidden">Actions</span></th>
      </tr>
    </thead>
  );
}

// Initiatives is one table of initiatives — an initiative is to its specs what an epic is to its tickets
// (see initiativeModel.js) — each expanding in place to show its specs in the same columns, then
// the specs that belong to none. Renaming happens on the entity's own page, not here; a spec's
// initiative is set from its own sidebar.
export default function SpecsPage({ specs, initiatives, open, specsHref, specHref, initiativeHref, onCreateInitiative, onDelete }) {
  const sortedInitiatives = [...(initiatives || [])].sort(byRecency);
  const knownIds = new Set(sortedInitiatives.map((ini) => ini.id));
  const groups = sortedInitiatives
    .map((ini) => ({ initiative: ini, members: specs.filter((s) => s.initiativeId === ini.id).sort(byRecency) }));
  // A spec pointing at an initiative that no longer exists is loose, not lost.
  const loose = specs.filter((s) => !s.initiativeId || !knownIds.has(s.initiativeId)).sort(byRecency);

  // Only an initiative with specs can be expanded; one with none has nothing to show.
  const expandable = groups.filter((g) => g.members.length > 0).map((g) => g.initiative);
  const remembered = () => {
    const toggles = readToggles();
    return expandable.filter((ini) => toggles[ini.id] ?? ini.status === "active").map((ini) => ini.id);
  };
  // A URL that lists initiatives wins for this visit; a bare one shows what this browser remembers.
  const openIds = open ?? remembered();
  const openSet = new Set(openIds);

  // A bare #/specs — the sidebar's link, a fresh tab — catches the address bar up to what's shown.
  // replace(), so it doesn't leave a history entry behind for Back to land on.
  useEffect(() => {
    if (open == null) window.location.replace(specsHref(remembered()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id) => {
    const next = !openSet.has(id);
    rememberToggle(id, next);
    // In table order, so the same view is always the same URL. replace(), not a new entry: ten
    // toggles shouldn't take ten Backs to leave the page.
    const ids = expandable.map((ini) => ini.id).filter((x) => (x === id ? next : openSet.has(x)));
    window.location.replace(specsHref(ids));
  };

  return (
    <Page className="specs-page">
      <div className="enter-up" style={{ maxWidth: PAGE.table, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg, gap: SPACE.base, flexWrap: "wrap" }}>
          <PageHeading>Initiatives</PageHeading>
          <Button variant="primary" onClick={onCreateInitiative}>
            <Plus size={16} /> New initiative
          </Button>
        </div>

        {groups.length === 0 ? (
          <EmptyState compact icon={FolderGit2} style={{ paddingBottom: SPACE["4xl"] }}>
            No initiatives yet — start one to group the specs that serve the same outcome.
          </EmptyState>
        ) : (
          <div className="card spec-table-wrap" style={{ marginBottom: SPACE["4xl"] }}>
            <table className="spec-table" aria-label="Initiatives and their specs">
              <Head first="Initiative" />
              {groups.map(({ initiative, members }) => (
                <InitiativeGroup
                  key={initiative.id}
                  initiative={initiative}
                  members={members}
                  expanded={openSet.has(initiative.id)}
                  onToggle={() => toggle(initiative.id)}
                  href={initiativeHref(initiative.id)}
                  specHref={specHref}
                  onDelete={onDelete}
                />
              ))}
            </table>
          </div>
        )}

        <Eyebrow as="h2" section style={{ margin: `0 0 ${SPACE.lg}` }}>Not in an initiative</Eyebrow>

        {loose.length === 0 ? (
          <EmptyState compact style={{ paddingBottom: SPACE["4xl"] }}>
            {specs.length === 0 ? "No specs yet — open an initiative to create one." : "Every spec belongs to an initiative."}
          </EmptyState>
        ) : (
          <div className="card spec-table-wrap" style={{ marginBottom: SPACE["4xl"] }}>
            <table className="spec-table" aria-label="Specs not in an initiative">
              <Head first="Spec" />
              <tbody>
                {loose.map((s) => <SpecRow key={s.id} spec={s} href={specHref(s.id)} onDelete={onDelete} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}
