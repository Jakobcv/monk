import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, SPACE, SIZE, WEIGHT, SPEC_STATUS_COLOR } from "./lib/theme";
import { eyebrow, pageTitleInput, meta } from "./ui/text";
import { INITIATIVE_STATUS_OPTIONS } from "./lib/initiativeModel";
import Breadcrumbs from "./Breadcrumbs";
import CrepeEditor from "./CrepeEditor";
import Button from "./ui/Button";
import Card from "./ui/Card";
import IconButton from "./ui/IconButton";
import EmptyState from "./ui/EmptyState";

// The layer above specs — an epic to their tickets. `initiative` only seeds local state on
// mount (parent remounts via `key={initiative.id}`, same as SpecPage/ActivityPage). `specs`
// arrives already filtered to this initiative's members (see App.jsx's specsForInitiative) —
// this page never sees the others.
//
// Assigning an *existing* loose spec happens from that spec's own sidebar, not here — same
// split as ActivityPage, where you add signals by creating them but a signal's activity is
// also settable from the signal itself. Here you either create a spec already in the
// initiative ("New spec" below) or detach one that's in it.
export default function InitiativePage({
  initiative, specs, specHref, onChange, onDelete, onCreateSpec, onDetachSpec, breadcrumbs,
}) {
  const [title, setTitle] = useState(initiative.title);
  const [status, setStatus] = useState(initiative.status);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChange({ title, status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, status]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Breadcrumbs items={breadcrumbs} />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", boxSizing: "border-box", padding: `${SPACE["3xl"]} ${SPACE["5xl"]} ${SPACE["5xl"]}` }}>
        <div className="enter-up" style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled initiative"
            style={pageTitleInput}
          />

          <div style={{ display: "flex", gap: SPACE.lg, alignItems: "center" }}>
            <div className="select-wrap" style={{ width: "160px" }}>
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ color: SPEC_STATUS_COLOR[status] || INK }}
              >
                {INITIATIVE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={12} className="select-chevron" />
            </div>
          </div>

          <div style={{ height: "1px", backgroundColor: BORDER }} />

          <div>
            <div style={{ ...eyebrow, marginBottom: SPACE.base }}>Description</div>
            {/* Freeform context shared by every spec under this initiative — it flows into
                each one's "Start build" brief as an "## Initiative" section. A short blurb,
                not a document, so it starts near-empty and grows with the text rather than
                claiming the 60vh canvas DocumentPage wants. */}
            <CrepeEditor value={initiative.description} onChange={(description) => onChange({ description })} minHeight="0" />
          </div>

          <div style={{ height: "1px", backgroundColor: BORDER }} />

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg }}>
              <div style={eyebrow}>Specs in this initiative ({specs.length})</div>
              <Button onClick={onCreateSpec}>
                <Plus size={12} /> New spec
              </Button>
            </div>

            {specs.length === 0 ? (
              <EmptyState compact>No specs yet — create one, or assign an existing spec from its own page.</EmptyState>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: SPACE.lg }}>
                {[...specs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map((s) => (
                  <Card
                    key={s.id}
                    as="a"
                    href={specHref(s.id)}
                    interactive
                    className="reveal-group"
                    style={{ position: "relative", textAlign: "left", padding: "12px 14px" }}
                  >
                    <IconButton
                      className="reveal"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDetachSpec(s.id); }}
                      title="Remove from this initiative (keeps the spec)"
                      style={{ position: "absolute", top: SPACE.sm, right: SPACE.sm }}
                    >
                      <X size={12} />
                    </IconButton>
                    <div style={{ fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.body, color: INK, marginBottom: SPACE.sm, paddingRight: SPACE.xl, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title || "Untitled spec"}
                    </div>
                    <div style={{ fontFamily: font, fontSize: SIZE.sm, color: INK_SOFT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.problem || "No problem statement yet"}
                    </div>
                    <div style={{ marginTop: SPACE.md }}>
                      <span style={{ ...meta, fontWeight: WEIGHT.semibold, color: SPEC_STATUS_COLOR[s.status] || INK_FAINT }}>{s.status}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: "1px", backgroundColor: BORDER }} />

          <Button variant="danger" onClick={onDelete} style={{ alignSelf: "flex-start" }}>
            <Trash2 size={13} /> Delete initiative
          </Button>
        </div>
      </div>
    </div>
  );
}
