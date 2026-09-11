import { Plus, Trash2, Layers, FolderGit2 } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, SIZE, WEIGHT, SPACE, SPEC_STATUS_COLOR } from "./lib/theme";
import { pageHeading, eyebrow, meta } from "./ui/text";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";

function SpecCard({ spec, idx = 0, href, onDelete }) {
  return (
    <Card
      as="a"
      href={href}
      interactive
      className="reveal-group enter-up"
      // A gentle stagger on load — capped so a long list doesn't have a visible tail.
      // fill-mode backwards holds each card hidden through its delay.
      style={{ position: "relative", textAlign: "left", padding: "14px 16px", animationDelay: `${Math.min(idx * 30, 300)}ms`, animationFillMode: "backwards" }}
    >
      <IconButton
        className="reveal"
        danger
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(spec.id); }}
        title="Delete spec"
        // Inset 8px from the card corner with 14px between cards, so a 36px target stops at
        // the card's own edge and never reaches the next one.
        style={{ position: "absolute", top: SPACE.base, right: SPACE.base, "--hit": "36px" }}
      >
        <Trash2 size={12} />
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
        <span style={{ ...meta, fontWeight: WEIGHT.semibold, color: SPEC_STATUS_COLOR[spec.status] || INK_FAINT }}>
          {spec.status}
        </span>
        {(spec.design || spec.plan) && (
          <>
            <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: INK_FAINT }} />
            <span style={meta}>
              {[spec.design && "design", spec.plan && "plan"].filter(Boolean).join(" + ")}
            </span>
          </>
        )}
      </div>
    </Card>
  );
}

function SpecGrid({ specs, specHref, onDelete }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
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
    <div style={{ height: "100%", overflowY: "auto", padding: `${SPACE["4xl"]} ${SPACE["5xl"]}`, boxSizing: "border-box" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", gap: SPACE.base }}>
          <h1 style={pageHeading}>Specs</h1>
          <div style={{ display: "flex", gap: SPACE.base }}>
            <Button size="md" onClick={onCreateInitiative}>
              <FolderGit2 size={14} /> New initiative
            </Button>
            <Button variant="primary" size="md" onClick={() => onCreate()}>
              <Plus size={14} /> New spec
            </Button>
          </div>
        </div>

        {isEmpty ? (
          <EmptyState icon={Layers}>No specs yet — create one, or group a few under an initiative.</EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "34px" }}>
            {sortedInitiatives.map((ini) => {
              const members = [...specs].filter((s) => s.initiativeId === ini.id).sort(byRecency);
              return (
                <div key={ini.id}>
                  <a
                    href={initiativeHref(ini.id)}
                    className="crumb"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.lg,
                      padding: "3px 6px", marginLeft: "-6px", textDecoration: "none",
                      fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.lg, color: INK,
                    }}
                  >
                    <FolderGit2 size={15} style={{ color: INK_FAINT }} />
                    {ini.title || "Untitled initiative"}
                    <span style={{ ...meta, fontWeight: WEIGHT.normal }}>
                      {members.length} spec{members.length === 1 ? "" : "s"} · {ini.status}
                    </span>
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
                  <div style={{ ...eyebrow, marginBottom: SPACE.lg }}>Not in an initiative</div>
                )}
                <SpecGrid specs={loose} specHref={specHref} onDelete={onDelete} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
