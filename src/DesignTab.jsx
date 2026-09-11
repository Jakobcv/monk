import { useState } from "react";
import { Plus, X, ExternalLink, ArrowRight, Link2, MonitorPlay, PenTool, Workflow, UserRound } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, SIZE, WEIGHT, SPACE } from "./lib/theme";
import { eyebrow, meta } from "./ui/text";
import { parseDesign, serializeDesign, ARTEFACT_TYPES, AUTHORITIES, TIERS, QUALITY_FACETS } from "./lib/designModel";
import AutoTextarea from "./ui/AutoTextarea";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

// A spec's Design tab: the feature's design intent, in structured sections, built from the same
// parts as Overview — an eyebrow per section, borderless prose fields, plain rows, a subtle
// "+ Add". Deliberately no helper text or treatment labels on screen: how each section is framed
// for an agent (intent / binding / coverage / reference) lives in the build brief (buildBrief.js).
//
// `value` is the design.md string; it seeds local structured state once, and every edit is
// serialized back out through `onChange` (see lib/designModel.js). SpecPage remounts this per
// spec, same as its other tabs. Rows that are still empty stay on screen while you're editing but
// aren't written to the file.

// lucide dropped its brand icons, so a design file gets a generic pen rather than a Figma logo.
const ARTEFACT_META = {
  link:      { icon: Link2,       label: "Link" },
  prototype: { icon: MonitorPlay, label: "Prototype" },
  design:    { icon: PenTool,     label: "Design file" },
  diagram:   { icon: Workflow,    label: "Diagram" },
  persona:   { icon: UserRound,   label: "Persona" },
};
const AUTHORITY_TONE = { exact: INK, direction: INK_SOFT, context: INK_FAINT };

const withScheme = (url) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

// Matches ChecklistEditor's row input so rows here read like Overview's checklists.
const rowInput = {
  flex: 1, minWidth: 0, border: "none", outline: "none", background: "none",
  fontFamily: font, fontWeight: WEIGHT.normal, fontSize: SIZE.ui, color: INK, padding: "2px 0",
};
const metaInput = { ...rowInput, fontSize: meta.fontSize, color: INK_SOFT };
const rows = { display: "flex", flexDirection: "column", gap: SPACE.sm };

// A left-hand label column — the same device for use-case tier, quality facet and decision part.
const sideLabel = { fontFamily: font, fontSize: SIZE.ui, fontWeight: WEIGHT.normal, color: INK_FAINT, paddingTop: "2px" };

// Same rhythm as Overview: eyebrow, 8px, content.
function Section({ title, children, onRemove }) {
  return (
    <section className="reveal-group" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: "16px" }}>
        <div style={{ ...eyebrow, flex: 1 }}>{title}</div>
        {onRemove && (
          <IconButton className="reveal" onClick={onRemove} title="Remove section" style={{ margin: "-4px 0" }}>
            <X size={16} />
          </IconButton>
        )}
      </div>
      {children}
    </section>
  );
}

// Same as ChecklistEditor's "+ Add".
function AddRow({ onClick }) {
  return (
    <Button variant="subtle" onClick={onClick} style={{ alignSelf: "flex-start", marginTop: "4px", marginLeft: "-6px" }}>
      <Plus size={16} /> Add
    </Button>
  );
}

// Bounded by the row's input to the left and the next row below — ChecklistEditor's cap.
const RemoveBtn = ({ onClick }) => (
  <IconButton className="reveal" danger title="Remove" onClick={onClick} style={{ flexShrink: 0, "--hit-w": "34px", "--hit-h": "28px" }}>
    <X size={16} />
  </IconButton>
);

export default function DesignTab({ value, onChange }) {
  const [d, setD] = useState(() => parseDesign(value));
  // Optional sections start open only if they already have something in them.
  const [shown, setShown] = useState(() => {
    const s = new Set();
    if (Object.values(d.qualities).some((v) => v.trim())) s.add("qualities");
    if (d.notes.trim()) s.add("notes");
    return s;
  });
  // "section:index" of the row just added — it mounts with autoFocus, so you can type straight away.
  const [fresh, setFresh] = useState(null);

  const commit = (next) => { setD(next); onChange(serializeDesign(next)); };
  const set = (key, v) => commit({ ...d, [key]: v });
  const patchAt = (key, i, fields) =>
    set(key, d[key].map((x, j) => (j === i ? (typeof x === "object" ? { ...x, ...fields } : fields) : x)));
  const removeAt = (key, i) => set(key, d[key].filter((_, j) => j !== i));
  const append = (key, item) => { setFresh(`${key}:${d[key].length}`); set(key, [...d[key], item]); };
  const isFresh = (key, i) => fresh === `${key}:${i}`;

  const openSection = (key) => setShown((s) => new Set(s).add(key));
  // Removing an optional section clears it too — otherwise it'd vanish from view but stay in the file.
  const removeSection = (key) => {
    setShown((s) => { const n = new Set(s); n.delete(key); return n; });
    set(key, key === "notes" ? "" : {});
  };

  const facets = [...QUALITY_FACETS, ...Object.keys(d.qualities).filter((k) => !QUALITY_FACETS.includes(k))];
  const optional = [
    { key: "qualities", label: "Experience qualities" },
    { key: "notes", label: "Notes" },
  ].filter((o) => !shown.has(o.key));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <Section title="Artefacts">
        {d.artefacts.length > 0 && (
          <div style={rows}>
            {d.artefacts.map((a, i) => {
              const type = ARTEFACT_META[a.type] ? a.type : "link";
              const Icon = ARTEFACT_META[type].icon;
              const nextType = ARTEFACT_TYPES[(ARTEFACT_TYPES.indexOf(type) + 1) % ARTEFACT_TYPES.length];
              return (
                <div key={i} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.base }}>
                  <IconButton
                    onClick={() => patchAt("artefacts", i, { type: nextType })}
                    title={`${ARTEFACT_META[type].label} — click to change type`}
                    style={{ flexShrink: 0, margin: "0 -4px", color: INK_SOFT, "--hit-w": "28px", "--hit-h": "28px" }}
                  >
                    <Icon size={16} />
                  </IconButton>
                  <input
                    autoFocus={isFresh("artefacts", i)}
                    value={a.title}
                    onChange={(e) => patchAt("artefacts", i, { title: e.target.value })}
                    placeholder="Title"
                    style={{ ...rowInput, flex: "0 1 auto", fieldSizing: "content", minWidth: "48px" }}
                  />
                  <input
                    value={a.url}
                    onChange={(e) => patchAt("artefacts", i, { url: e.target.value })}
                    placeholder="Paste a link…"
                    style={{ ...metaInput, color: INK_FAINT }}
                  />
                  <select
                    value={a.authority}
                    onChange={(e) => patchAt("artefacts", i, { authority: e.target.value })}
                    title="How closely an agent should follow this"
                    style={{ fontFamily: font, fontSize: SIZE.sm, border: "none", background: "none", color: AUTHORITY_TONE[a.authority] || INK_FAINT, cursor: "pointer", outline: "none" }}
                  >
                    {Object.entries(AUTHORITIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  {a.url.trim() ? (
                    <a
                      className="icon-btn" href={withScheme(a.url.trim())} target="_blank" rel="noreferrer" title="Open"
                      style={{ flexShrink: 0, "--hit-w": "30px", "--hit-h": "28px" }}
                    >
                      <ExternalLink size={16} />
                    </a>
                  ) : (
                    <span style={{ width: "24px", flexShrink: 0 }} />
                  )}
                  <RemoveBtn onClick={() => removeAt("artefacts", i)} />
                </div>
              );
            })}
          </div>
        )}
        <AddRow onClick={() => append("artefacts", { type: "link", title: "", url: "", authority: "context" })} />
      </Section>

      <Section title="Use cases">
        {d.useCases.length > 0 && (
          <div style={{ ...rows, gap: SPACE.md }}>
            {d.useCases.map((u, i) => (
              <div key={i} className="reveal-group" style={{ display: "flex", gap: SPACE.lg, alignItems: "flex-start" }}>
                <button
                  onClick={() => patchAt("useCases", i, { tier: (u.tier + 1) % TIERS.length })}
                  title="Change priority"
                  style={{
                    ...sideLabel, width: "72px", flexShrink: 0, textAlign: "left", background: "none", border: "none",
                    padding: "2px 0 0", cursor: "pointer",
                    color: u.tier === 0 ? INK_SOFT : INK_FAINT, fontWeight: u.tier === 0 ? WEIGHT.semibold : WEIGHT.normal,
                  }}
                >
                  {TIERS[u.tier]}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    autoFocus={isFresh("useCases", i)}
                    value={u.text}
                    onChange={(e) => patchAt("useCases", i, { text: e.target.value })}
                    placeholder="…"
                    style={{ ...rowInput, width: "100%" }}
                  />
                  {u.flow !== null && (
                    <input
                      autoFocus={isFresh("flow", i)}
                      value={u.flow}
                      // "->" is the easy way to type a step separator; show it as the real arrow.
                      onChange={(e) => patchAt("useCases", i, { flow: e.target.value.replace(/->/g, "→") })}
                      onBlur={() => { if (!u.flow.trim()) patchAt("useCases", i, { flow: null }); }}
                      placeholder="Step -> step -> step"
                      style={{ ...metaInput, width: "100%", marginTop: "2px" }}
                    />
                  )}
                </div>
                {/* Inline at the row's end, not on a line of its own — a hidden control still
                    occupies layout, so a line under every flow-less use case read as uneven spacing. */}
                {u.flow === null && (
                  <button
                    className="reveal"
                    onClick={() => { setFresh(`flow:${i}`); patchAt("useCases", i, { flow: "" }); }}
                    style={{ ...meta, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: "3px 0", cursor: "pointer", color: INK_SOFT }}
                  >
                    <Plus size={11} /> Flow
                  </button>
                )}
                <RemoveBtn onClick={() => removeAt("useCases", i)} />
              </div>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("useCases", { tier: d.useCases.length ? 1 : 0, text: "", flow: null })} />
      </Section>

      <Section title="Principles">
        {d.principles.length > 0 && (
          <div style={rows}>
            {d.principles.map((p, i) => (
              <div key={i} className="reveal-group" style={{ display: "flex", gap: SPACE.base, alignItems: "flex-start" }}>
                <span style={{ ...sideLabel, width: "16px", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <AutoTextarea
                  className="prose-field" minRows={1} autoFocus={isFresh("principles", i)}
                  value={p} onChange={(e) => patchAt("principles", i, e.target.value)} placeholder="…"
                  style={{ flex: 1 }}
                />
                <RemoveBtn onClick={() => removeAt("principles", i)} />
              </div>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("principles", "")} />
      </Section>

      <Section title="Constraints">
        {d.constraints.length > 0 && (
          <div style={rows}>
            {d.constraints.map((c, i) => (
              <div key={i} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.base }}>
                <span aria-hidden="true" style={{ width: "4px", height: "4px", borderRadius: "50%", background: INK_FAINT, flexShrink: 0, margin: "0 6px" }} />
                <input
                  autoFocus={isFresh("constraints", i)}
                  value={c} onChange={(e) => patchAt("constraints", i, e.target.value)} placeholder="…"
                  style={rowInput}
                />
                <RemoveBtn onClick={() => removeAt("constraints", i)} />
              </div>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("constraints", "")} />
      </Section>

      {shown.has("qualities") && (
        <Section title="Experience qualities" onRemove={() => removeSection("qualities")}>
          <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", rowGap: SPACE.sm, columnGap: SPACE.lg, alignItems: "start" }}>
            {facets.map((facet) => (
              <div key={facet} style={{ display: "contents" }}>
                <span style={sideLabel}>{facet}</span>
                <AutoTextarea
                  className="prose-field" minRows={1} placeholder="…"
                  value={d.qualities[facet] || ""}
                  onChange={(e) => set("qualities", { ...d.qualities, [facet]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <Section title="Edge cases">
        {d.edgeCases.length > 0 && (
          <div style={rows}>
            {d.edgeCases.map((e, i) => (
              <div key={i} className="reveal-group" style={{ display: "grid", gridTemplateColumns: "1fr 14px 1fr 24px", alignItems: "center", gap: SPACE.base }}>
                <input
                  autoFocus={isFresh("edgeCases", i)}
                  value={e.when} onChange={(ev) => patchAt("edgeCases", i, { when: ev.target.value })} placeholder="When…"
                  style={rowInput}
                />
                <ArrowRight size={14} style={{ color: INK_FAINT }} />
                <input
                  value={e.then} onChange={(ev) => patchAt("edgeCases", i, { then: ev.target.value })} placeholder="Agent decides"
                  style={rowInput}
                />
                <RemoveBtn onClick={() => removeAt("edgeCases", i)} />
              </div>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("edgeCases", { when: "", then: "" })} />
      </Section>

      <Section title="Decisions">
        {d.decisions.length > 0 && (
          <div style={{ ...rows, gap: SPACE.lg }}>
            {d.decisions.map((x, i) => (
              <div key={i} className="reveal-group" style={{ display: "grid", gridTemplateColumns: "88px 1fr 24px", rowGap: "2px", columnGap: SPACE.lg, alignItems: "start" }}>
                {[["Decided", "decision"], ["Because", "why"], ["Rejected", "rejected"]].map(([label, key], r) => (
                  <div key={key} style={{ display: "contents" }}>
                    <span style={sideLabel}>{label}</span>
                    <AutoTextarea
                      className="prose-field" minRows={1} placeholder="…"
                      autoFocus={r === 0 && isFresh("decisions", i)}
                      value={x[key]} onChange={(e) => patchAt("decisions", i, { [key]: e.target.value })}
                    />
                    {r === 0 ? <RemoveBtn onClick={() => removeAt("decisions", i)} /> : <span />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("decisions", { decision: "", why: "", rejected: "" })} />
      </Section>

      {shown.has("notes") && (
        <Section title="Notes" onRemove={() => removeSection("notes")}>
          <AutoTextarea
            className="prose-field" minRows={2} placeholder="Anything else…"
            value={d.notes} onChange={(e) => set("notes", e.target.value)}
          />
        </Section>
      )}

      {optional.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginLeft: "-6px" }}>
          {optional.map((o) => (
            <Button key={o.key} variant="subtle" onClick={() => openSection(o.key)}>
              <Plus size={16} /> {o.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
