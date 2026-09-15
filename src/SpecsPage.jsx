import { Plus, Trash2, Layers, FolderGit2 } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, SIZE, WEIGHT, SPACE, PAGE, ACCENT, SPEC_STATUS_COLOR } from "./lib/theme";
import { Dot, Eyebrow, Meta, PageHeading } from "./ui/text";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import Page from "./ui/Page";
import { parsePlan, taskCounts } from "./lib/planModel";

const INITIATIVE_STATUS_COLOR = { active: ACCENT.insight, paused: INK_FAINT, done: ACCENT.action };

const byRecency = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

// An initiative's description is markdown; the row only wants its opening words as plain text.
function plainSummary(markdown = "") {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function SpecCard({ spec, idx = 0, href, onDelete }) {
  // Progress through the plan's tasks where there are any; otherwise which tabs have been written.
  const counts = taskCounts(parsePlan(spec.plan).tasks);
  const meta = counts.total
    ? [`${counts.done}/${counts.total} tasks`, counts.blocked && `${counts.blocked} blocked`].filter(Boolean).join(" · ")
    : [spec.design && "design", spec.plan && "plan"].filter(Boolean).join(" + ");
  return (
    <Card
      as="a"
      href={href}
      interactive
      className="reveal-group enter-up"
      // A gentle stagger on load — capped so a long list doesn't have a visible tail.
      // fill-mode backwards holds each card hidden through its delay.
      style={{ position: "relative", textAlign: "left", animationDelay: `${Math.min(idx * 30, 300)}ms`, animationFillMode: "backwards" }}
    >
      <IconButton
        className="reveal"
        danger
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(spec.id); }}
        title="Delete spec"
        aria-label="Delete spec"
        // Inset 8px from the card corner with 12px between cards, so a 36px target stops just
        // inside the card's own edge and never reaches the next one.
        style={{ position: "absolute", top: SPACE.base, right: SPACE.base, "--hit": "36px" }}
      >
        <Trash2 size={16} />
      </IconButton>

      <div style={{
        fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.md, color: INK,
        marginBottom: SPACE.md, paddingRight: SPACE["2xl"],
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {spec.title || "Untitled spec"}
      </div>

      <div style={{
        fontFamily: font, fontSize: SIZE.sm, color: INK_SOFT, minHeight: SPACE.xl,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {spec.problem || "No problem statement yet"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginTop: SPACE.lg }}>
        <Meta style={{ fontWeight: WEIGHT.semibold, color: SPEC_STATUS_COLOR[spec.status] || INK_FAINT }}>
          {spec.status}
        </Meta>
        {meta && (
          <>
            <Dot color={INK_FAINT} size={4} />
            <Meta style={{ fontVariantNumeric: "tabular-nums" }}>{meta}</Meta>
          </>
        )}
      </div>
    </Card>
  );
}

function SpecGrid({ specs, specHref, onDelete }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE.lg }}>
      {specs.map((s, i) => <SpecCard key={s.id} spec={s} idx={i} href={specHref(s.id)} onDelete={onDelete} />)}
    </div>
  );
}

// Same shape as Research Repository's research plan row: the name with its status at the end,
// then what it's about, clamped to two lines — the full text is one click away.
function InitiativeRow({ initiative, specCount, href }) {
  const statusColor = INITIATIVE_STATUS_COLOR[initiative.status] || INK_FAINT;
  const summary = plainSummary(initiative.description) || (initiative.outcomes || []).map((o) => o.text).find(Boolean) || "";
  return (
    <Card as="a" href={href} interactive style={{ padding: `14px ${SPACE.xl}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.xl, marginBottom: SPACE.sm }}>
        <div style={{ fontFamily: font, fontSize: SIZE.lg, fontWeight: WEIGHT.semibold, color: INK, lineHeight: 1.4, minWidth: 0, overflowWrap: "anywhere" }}>
          {initiative.title || "Untitled initiative"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.lg, flexShrink: 0 }}>
          <Meta style={{ fontVariantNumeric: "tabular-nums" }}>
            {specCount} spec{specCount === 1 ? "" : "s"}
          </Meta>
          <Meta style={{ display: "flex", alignItems: "center", gap: SPACE.md, fontWeight: WEIGHT.semibold, color: statusColor }}>
            <Dot color={statusColor} /> {initiative.status}
          </Meta>
        </div>
      </div>
      <div
        style={{
          fontFamily: font, fontSize: SIZE.body, lineHeight: 1.5, color: summary ? INK_SOFT : INK_FAINT,
          display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", overflowWrap: "anywhere",
        }}
      >
        {summary || "No description yet"}
      </div>
    </Card>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg, gap: SPACE.base, flexWrap: "wrap" }}>
      <PageHeading>{title}</PageHeading>
      {children}
    </div>
  );
}

const Divider = () => <div style={{ height: "1px", backgroundColor: BORDER, marginBottom: SPACE["4xl"] }} />;

// Specs gets the same sectioned landing page as Research Repository (no search for v1): initiatives
// first — an initiative is to its specs what an epic is to its tickets (see initiativeModel.js) —
// then the specs that belong to one, grouped under it, then the loose ones. Renaming happens on
// the entity's own page, not here; a spec's initiative is set from its own sidebar.
export default function SpecsPage({ specs, initiatives, specHref, initiativeHref, onCreate, onCreateInitiative, onDelete }) {
  const sortedInitiatives = [...(initiatives || [])].sort(byRecency);
  const knownIds = new Set(sortedInitiatives.map((ini) => ini.id));
  const groups = sortedInitiatives
    .map((ini) => ({ initiative: ini, members: specs.filter((s) => s.initiativeId === ini.id).sort(byRecency) }));
  const grouped = groups.filter((g) => g.members.length > 0);
  // A spec pointing at an initiative that no longer exists is loose, not lost.
  const loose = specs.filter((s) => !s.initiativeId || !knownIds.has(s.initiativeId)).sort(byRecency);

  return (
    <Page>
      <div className="enter-up" style={{ maxWidth: PAGE.wide, margin: "0 auto" }}>
        <SectionHeader title="Initiatives">
          <Button onClick={onCreateInitiative}>
            <Plus size={16} /> New initiative
          </Button>
        </SectionHeader>

        {groups.length === 0 ? (
          <EmptyState compact icon={FolderGit2} style={{ paddingBottom: SPACE["4xl"] }}>
            No initiatives yet — start one to group the specs that serve the same outcome.
          </EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, marginBottom: SPACE["4xl"] }}>
            {groups.map(({ initiative, members }) => (
              <InitiativeRow key={initiative.id} initiative={initiative} specCount={members.length} href={initiativeHref(initiative.id)} />
            ))}
          </div>
        )}

        <Divider />

        <SectionHeader title="Specs">
          <Button variant="primary" onClick={() => onCreate()}>
            <Plus size={16} /> New spec
          </Button>
        </SectionHeader>

        {grouped.length === 0 ? (
          <EmptyState compact icon={Layers} style={{ paddingBottom: SPACE["4xl"] }}>
            {specs.length === 0
              ? "No specs yet — create one above."
              : "No specs in an initiative yet — set one from a spec's sidebar."}
          </EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE["3xl"], marginBottom: SPACE["4xl"] }}>
            {grouped.map(({ initiative, members }) => (
              <section key={initiative.id}>
                <Eyebrow
                  as="a"
                  href={initiativeHref(initiative.id)}
                  className="crumb"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.base,
                    padding: `${SPACE.sm} ${SPACE.md}`, marginLeft: `-${SPACE.md}`, textDecoration: "none",
                  }}
                >
                  <FolderGit2 size={12} aria-hidden="true" />
                  {initiative.title || "Untitled initiative"}
                </Eyebrow>
                <SpecGrid specs={members} specHref={specHref} onDelete={onDelete} />
              </section>
            ))}
          </div>
        )}

        <Divider />

        <SectionHeader title="Not in an initiative" />

        {loose.length === 0 ? (
          <EmptyState compact style={{ paddingBottom: SPACE["4xl"] }}>
            Every spec belongs to an initiative.
          </EmptyState>
        ) : (
          <div style={{ marginBottom: SPACE["4xl"] }}>
            <SpecGrid specs={loose} specHref={specHref} onDelete={onDelete} />
          </div>
        )}
      </div>
    </Page>
  );
}
