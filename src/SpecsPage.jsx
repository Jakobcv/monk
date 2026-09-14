import { Plus, Trash2, Layers, FolderGit2 } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, SIZE, WEIGHT, SPACE, PAGE, SPEC_STATUS_COLOR } from "./lib/theme";
import { Dot, Eyebrow, Meta, PageHeading } from "./ui/text";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import Page from "./ui/Page";
import { parsePlan, taskCounts } from "./lib/planModel";

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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: SPACE.lg }}>
      {specs.map((s, i) => <SpecCard key={s.id} spec={s} idx={i} href={specHref(s.id)} onDelete={onDelete} />)}
    </div>
  );
}

// Specs get the same fixed-top-level-page treatment as Research Repository (no search for v1).
// Renaming happens on the entity's own page, not inline here. The page groups specs under
// their initiative (an epic to their tickets — see initiativeModel.js), with a final
// "Not in an initiative" group for loose ones. A spec's initiative is set from its own sidebar.
export default function SpecsPage({ specs, initiatives, specHref, initiativeHref, onCreate, onCreateInitiative, onDelete }) {
  const byRecency = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);
  const sortedInitiatives = [...(initiatives || [])].sort(byRecency);
  const loose = [...specs].filter((s) => !s.initiativeId).sort(byRecency);
  const isEmpty = specs.length === 0 && sortedInitiatives.length === 0;

  return (
    <Page>
      <div style={{ maxWidth: PAGE.wide, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE["3xl"], gap: SPACE.base }}>
          <PageHeading>Specs</PageHeading>
          <div style={{ display: "flex", gap: SPACE.base }}>
            <Button size="md" onClick={onCreateInitiative}>
              <FolderGit2 size={16} /> New initiative
            </Button>
            <Button variant="primary" size="md" onClick={() => onCreate()}>
              <Plus size={16} /> New spec
            </Button>
          </div>
        </div>

        {isEmpty ? (
          <EmptyState icon={Layers}>No specs yet — create one, or group a few under an initiative.</EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE["4xl"] }}>
            {sortedInitiatives.map((ini) => {
              const members = [...specs].filter((s) => s.initiativeId === ini.id).sort(byRecency);
              return (
                <div key={ini.id}>
                  <a
                    href={initiativeHref(ini.id)}
                    className="crumb"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.lg,
                      padding: `${SPACE.sm} ${SPACE.md}`, marginLeft: `-${SPACE.md}`, textDecoration: "none",
                      fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.lg, color: INK,
                    }}
                  >
                    <FolderGit2 size={16} style={{ color: INK_FAINT }} />
                    {ini.title || "Untitled initiative"}
                    <Meta style={{ fontWeight: WEIGHT.normal }}>
                      {members.length} spec{members.length === 1 ? "" : "s"} · {ini.status}
                    </Meta>
                  </a>
                  {members.length === 0 ? (
                    <EmptyState compact>Nothing in this initiative yet.</EmptyState>
                  ) : (
                    <SpecGrid specs={members} specHref={specHref} onDelete={onDelete} />
                  )}
                </div>
              );
            })}

            {loose.length > 0 && (
              <div>
                {sortedInitiatives.length > 0 && (
                  <Eyebrow style={{ marginBottom: SPACE.lg }}>Not in an initiative</Eyebrow>
                )}
                <SpecGrid specs={loose} specHref={specHref} onDelete={onDelete} />
              </div>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
