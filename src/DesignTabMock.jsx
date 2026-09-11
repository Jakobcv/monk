import { useState } from "react";
import { Plus, X, ExternalLink, ArrowRight, PenTool, Workflow, UserRound, MonitorPlay, Link2 } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, SIZE, WEIGHT, SPACE } from "./lib/theme";
import { eyebrow, meta } from "./ui/text";
import AutoTextarea from "./ui/AutoTextarea";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

// MOCKUP ONLY (DEV route #/design-preview) — local state, nothing persists. A structured
// Design tab built from the same parts as Overview: an eyebrow label per section, borderless
// prose fields, plain rows, and a subtle "+ Add". Each section will carry a framing into the
// build brief (intent / binding / coverage / reference) — that lives in the brief, not on
// screen. Visual language (tokens, type, components) belongs to the workspace DESIGN.md.

const AUTHORITY = {
  exact:     { label: "Match exactly", tone: INK },
  direction: { label: "Follow direction", tone: INK_SOFT },
  context:   { label: "Background", tone: INK_FAINT },
};

// lucide dropped its brand icons, so design files get a generic pen rather than a Figma logo.
const ARTEFACT_ICON = { prototype: MonitorPlay, figma: PenTool, diagram: Workflow, persona: UserRound, link: Link2 };

const TIERS = ["Primary", "Secondary", "Tertiary"];

const OPTIONAL = [
  { key: "qualities", label: "Experience qualities" },
  { key: "notes", label: "Notes" },
];

const SAMPLE = {
  artefacts: [
    { type: "figma", title: "Bulk export — flows v3", url: "figma.com/file/…", authority: "direction" },
    { type: "prototype", title: "Clickable prototype", url: "proto.monk.dev/export", authority: "exact" },
    { type: "persona", title: "Research lead persona", url: "notion.so/…", authority: "context" },
  ],
  useCases: [
    { tier: 0, text: "Export every signal behind one insight as a shareable doc", flow: ["Open insight", "Choose Export", "Pick format", "Copy link"] },
    { tier: 1, text: "Export a filtered set of signals from Research Repository", flow: [] },
    { tier: 2, text: "Re-export after edits without redoing the selection", flow: [] },
  ],
  principles: [
    "The evidence is the hero — export chrome should disappear once you've chosen.",
    "Never make someone pick a format before they've seen what's included.",
    "When speed and completeness conflict, favour completeness: a readout missing evidence is worse than a slow one.",
  ],
  constraints: [
    "Reuse the existing Modal and DialogActions — no new dialog pattern",
    "Must be fully keyboard operable",
    "No server round-trip; everything is generated locally",
  ],
  qualities: {
    Layout: "One column, preview-first. Options stay out of the way until asked for.",
    Motion: "Calm. Animate only to confirm a state change (copied, exported).",
    Responsive: "Follows DESIGN.md. Only difference: below 600px the preview collapses to a count.",
    Copy: "Plain, verb-first. The success toast must say exactly: “Export copied — N signals”.",
  },
  edgeCases: [
    { when: "The insight has no linked signals", then: "Disable export and say why" },
    { when: "A signal's text is very long", then: "" },
    { when: "Export is triggered twice quickly", then: "Second trigger is a no-op" },
  ],
  decisions: [
    { decision: "Markdown is the only format in v1", why: "It pastes cleanly everywhere our users write readouts.", rejected: "PDF — layout cost, and nobody edits a PDF." },
  ],
  notes: "",
};

// --- small pieces — same rhythm as Overview: eyebrow, 8px, content ---------------------------

function Section({ title, children, onRemove }) {
  return (
    <section className="reveal-group" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: "16px" }}>
        <div style={{ ...eyebrow, flex: 1 }}>{title}</div>
        {onRemove && (
          <IconButton className="reveal" onClick={onRemove} title="Remove section" style={{ margin: "-4px 0" }}><X size={16} /></IconButton>
        )}
      </div>
      {children}
    </section>
  );
}

// Matches ChecklistEditor's row input so rows here read like Overview's checklists.
const rowInput = {
  flex: 1, minWidth: 0, border: "none", outline: "none", background: "none",
  fontFamily: font, fontWeight: WEIGHT.normal, fontSize: SIZE.ui, color: INK, padding: "2px 0",
};

const rows = { display: "flex", flexDirection: "column", gap: SPACE.sm };

// Same as ChecklistEditor's "+ Add".
function AddRow({ onClick }) {
  return (
    <Button variant="subtle" onClick={onClick} style={{ alignSelf: "flex-start", marginTop: "4px", marginLeft: "-6px" }}>
      <Plus size={16} /> Add
    </Button>
  );
}

const RemoveBtn = ({ onClick }) => (
  <IconButton className="reveal" danger title="Remove" onClick={onClick} style={{ flexShrink: 0, "--hit-w": "34px", "--hit-h": "28px" }}>
    <X size={16} />
  </IconButton>
);

// A left-hand label column — the same device for use-case tier, quality facet and decision part.
const sideLabel = { fontFamily: font, fontSize: SIZE.ui, fontWeight: WEIGHT.normal, color: INK_FAINT, paddingTop: "2px" };

// --- the mock ----------------------------------------------------------------------------------

export default function DesignTabMock() {
  const [d, setD] = useState(SAMPLE);
  const [shown, setShown] = useState(() => new Set(["qualities"]));
  const set = (key, value) => setD((p) => ({ ...p, [key]: value }));
  const patchAt = (key, i, fields) => set(key, d[key].map((x, j) => (j === i ? (typeof x === "object" ? { ...x, ...fields } : fields) : x)));
  const removeAt = (key, i) => set(key, d[key].filter((_, j) => j !== i));
  const hide = (key) => setShown((s) => { const n = new Set(s); n.delete(key); return n; });

  return (
    <div style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "24px 40px 32px" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>

        <Section title="Artefacts">
          <div style={rows}>
            {d.artefacts.map((a, i) => {
              const Icon = ARTEFACT_ICON[a.type] || Link2;
              return (
                <div key={i} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.base }}>
                  <Icon size={16} style={{ color: INK_SOFT, flexShrink: 0 }} />
                  <input value={a.title} onChange={(e) => patchAt("artefacts", i, { title: e.target.value })} style={{ ...rowInput, flex: "0 1 auto", fieldSizing: "content" }} />
                  <span style={{ ...meta, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.url}</span>
                  <select
                    value={a.authority}
                    onChange={(e) => patchAt("artefacts", i, { authority: e.target.value })}
                    style={{ fontFamily: font, fontSize: SIZE.sm, border: "none", background: "none", color: AUTHORITY[a.authority].tone, cursor: "pointer", outline: "none" }}
                  >
                    {Object.entries(AUTHORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <IconButton title="Open" style={{ flexShrink: 0, "--hit-w": "30px", "--hit-h": "28px" }}><ExternalLink size={16} /></IconButton>
                  <RemoveBtn onClick={() => removeAt("artefacts", i)} />
                </div>
              );
            })}
          </div>
          <AddRow onClick={() => set("artefacts", [...d.artefacts, { type: "link", title: "New artefact", url: "Paste a link…", authority: "context" }])} />
        </Section>

        <Section title="Use cases">
          <div style={{ ...rows, gap: SPACE.md }}>
            {d.useCases.map((u, i) => (
              <div key={i} className="reveal-group" style={{ display: "flex", gap: SPACE.lg, alignItems: "flex-start" }}>
                <button
                  onClick={() => patchAt("useCases", i, { tier: (u.tier + 1) % 3 })}
                  title="Change priority"
                  style={{ ...sideLabel, width: "72px", flexShrink: 0, textAlign: "left", background: "none", border: "none", padding: "2px 0 0", cursor: "pointer", color: u.tier === 0 ? INK_SOFT : INK_FAINT, fontWeight: u.tier === 0 ? WEIGHT.semibold : WEIGHT.normal }}
                >
                  {TIERS[u.tier]}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input value={u.text} onChange={(e) => patchAt("useCases", i, { text: e.target.value })} style={{ ...rowInput, width: "100%" }} />
                  {u.flow.length > 0 && (
                    <div style={{ ...meta, color: INK_SOFT, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      {u.flow.map((step, s) => (
                        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {s > 0 && <ArrowRight size={12} style={{ color: INK_FAINT }} />}
                          {step}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Inline at the row's end, not on a line of its own — a hidden control still
                    occupies layout, and a blank line under every flow-less use case read as
                    uneven spacing. */}
                {u.flow.length === 0 && (
                  <button className="reveal" onClick={() => patchAt("useCases", i, { flow: ["Step one", "Step two"] })}
                    style={{ ...meta, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: "3px 0", cursor: "pointer", color: INK_SOFT }}>
                    <Plus size={11} /> Flow
                  </button>
                )}
                <RemoveBtn onClick={() => removeAt("useCases", i)} />
              </div>
            ))}
          </div>
          <AddRow onClick={() => set("useCases", [...d.useCases, { tier: 2, text: "", flow: [] }])} />
        </Section>

        <Section title="Principles">
          <div style={rows}>
            {d.principles.map((p, i) => (
              <div key={i} className="reveal-group" style={{ display: "flex", gap: SPACE.base, alignItems: "flex-start" }}>
                <span style={{ ...sideLabel, width: "16px", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <AutoTextarea className="prose-field" minRows={1} value={p} onChange={(e) => patchAt("principles", i, e.target.value)} style={{ flex: 1 }} />
                <RemoveBtn onClick={() => removeAt("principles", i)} />
              </div>
            ))}
          </div>
          <AddRow onClick={() => set("principles", [...d.principles, ""])} />
        </Section>

        <Section title="Constraints">
          <div style={rows}>
            {d.constraints.map((c, i) => (
              <div key={i} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.base }}>
                <span aria-hidden="true" style={{ width: "4px", height: "4px", borderRadius: "50%", background: INK_FAINT, flexShrink: 0, margin: "0 6px" }} />
                <input value={c} onChange={(e) => patchAt("constraints", i, e.target.value)} placeholder="…" style={rowInput} />
                <RemoveBtn onClick={() => removeAt("constraints", i)} />
              </div>
            ))}
          </div>
          <AddRow onClick={() => set("constraints", [...d.constraints, ""])} />
        </Section>

        {shown.has("qualities") && (
          <Section title="Experience qualities" onRemove={() => hide("qualities")}>
            <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", rowGap: SPACE.sm, columnGap: SPACE.lg, alignItems: "start" }}>
              {Object.entries(d.qualities).map(([facet, text]) => (
                <div key={facet} style={{ display: "contents" }}>
                  <span style={sideLabel}>{facet}</span>
                  <AutoTextarea className="prose-field" minRows={1} value={text} onChange={(e) => set("qualities", { ...d.qualities, [facet]: e.target.value })} />
                </div>
              ))}
            </div>
          </Section>
        )}

        <div style={{ height: "1px", backgroundColor: BORDER }} />

        <Section title="Edge cases">
          <div style={rows}>
            {d.edgeCases.map((e, i) => (
              <div key={i} className="reveal-group" style={{ display: "grid", gridTemplateColumns: "1fr 14px 1fr 24px", alignItems: "center", gap: SPACE.base }}>
                <input value={e.when} onChange={(ev) => patchAt("edgeCases", i, { when: ev.target.value })} placeholder="When…" style={rowInput} />
                <ArrowRight size={14} style={{ color: INK_FAINT }} />
                <input value={e.then} onChange={(ev) => patchAt("edgeCases", i, { then: ev.target.value })} placeholder="Agent decides" style={rowInput} />
                <RemoveBtn onClick={() => removeAt("edgeCases", i)} />
              </div>
            ))}
          </div>
          <AddRow onClick={() => set("edgeCases", [...d.edgeCases, { when: "", then: "" }])} />
        </Section>

        <Section title="Decisions">
          <div style={{ ...rows, gap: SPACE.lg }}>
            {d.decisions.map((x, i) => (
              <div key={i} className="reveal-group" style={{ display: "grid", gridTemplateColumns: "88px 1fr 24px", rowGap: "2px", columnGap: SPACE.lg, alignItems: "start" }}>
                {[["Decided", "decision"], ["Because", "why"], ["Rejected", "rejected"]].map(([label, key], r) => (
                  <div key={key} style={{ display: "contents" }}>
                    <span style={sideLabel}>{label}</span>
                    <AutoTextarea className="prose-field" minRows={1} value={x[key]} onChange={(e) => patchAt("decisions", i, { [key]: e.target.value })} />
                    {r === 0 ? <RemoveBtn onClick={() => removeAt("decisions", i)} /> : <span />}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <AddRow onClick={() => set("decisions", [...d.decisions, { decision: "", why: "", rejected: "" }])} />
        </Section>

        {shown.has("notes") && (
          <Section title="Notes" onRemove={() => hide("notes")}>
            <AutoTextarea className="prose-field" minRows={2} value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything else…" />
          </Section>
        )}

        {OPTIONAL.some((o) => !shown.has(o.key)) && (
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginLeft: "-6px" }}>
            {OPTIONAL.filter((o) => !shown.has(o.key)).map((o) => (
              <Button key={o.key} variant="subtle" onClick={() => setShown((s) => new Set(s).add(o.key))}>
                <Plus size={16} /> {o.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
