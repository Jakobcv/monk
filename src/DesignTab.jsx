import { useState } from "react";
import { Plus, X, ExternalLink } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, SIZE, WEIGHT, SPACE } from "./lib/theme";
import { eyebrow, meta } from "./ui/text";
import { parseDesign, serializeDesign, ARTEFACT_TYPES, AUTHORITIES, TIERS, QUALITY_FACETS } from "./lib/designModel";
import AutoTextarea from "./ui/AutoTextarea";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

// A spec's Design tab: the feature's design intent, in structured sections, built from the same
// parts as Overview — an eyebrow per section, borderless prose fields, a subtle "+ Add". No helper
// text or treatment labels on screen: how each section is framed for an agent (intent / binding /
// coverage / reference) lives in the build brief (buildBrief.js).
//
// Every row is the same three-column grid — a label column, the text, the remove button — so
// text starts at one x down the whole page, whatever the section. The label column holds the
// row's own label (priority, number, bullet, facet, decision part, artefact type), and every text
// is an auto-growing prose field, so nothing long is ever silently cut off. Order runs intent →
// coverage → reference, matching the file (lib/designModel.js).
//
// `value` is the design.md string; it seeds local structured state once, and every edit is
// serialized back out through `onChange`. SpecPage remounts this per spec. Rows still empty stay
// on screen while you're editing but aren't written to the file.

const ARTEFACT_LABEL = { link: "Link", prototype: "Prototype", design: "Design file", diagram: "Diagram", persona: "Persona" };
const FACET_PLACEHOLDER = {
  Layout: "How it's arranged…", Motion: "How it moves…", Responsive: "How it adapts…", Copy: "Voice, or exact strings…",
};

const withScheme = (url) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

// List items are one line each in the file, so Enter shouldn't start a second line the save would
// only collapse again.
const singleLine = (e) => { if (e.key === "Enter" && !e.shiftKey) e.preventDefault(); };

// The label column. 13px at the prose field's 1.5 line-height and 3px top padding puts its text on
// the same baseline as the row's text. INK_SOFT, not INK_FAINT — these labels carry meaning.
const LABEL_W = "88px";
const labelText = { fontFamily: font, fontSize: SIZE.ui, lineHeight: 1.5, color: INK_SOFT, paddingTop: "3px" };
// Numbers and bullets sit at the right of the label column, next to the text they mark, rather
// than stranded 88px away at its left edge.
const bullet = { width: "4px", height: "4px", borderRadius: "50%", background: INK_SOFT, marginTop: "11px", marginLeft: "auto" };

// Label-column dropdown (priority, artefact type) and the artefact's authority: a real <select>,
// so every option is visible and one click away, dressed as plain text (see .design-select).
const labelSelect = { ...labelText, padding: "3px 0", minHeight: "26px", width: "100%" };

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

// One row: label column, text, trailing controls (the remove button, sometimes a "+ Flow" first).
function Row({ label, children, trailing }) {
  return (
    <div className="reveal-group" style={{ display: "grid", gridTemplateColumns: `${LABEL_W} 1fr auto`, columnGap: SPACE.xl, alignItems: "start" }}>
      <div style={{ minWidth: 0 }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, minWidth: "24px", marginTop: "1px" }}>{trailing}</div>
    </div>
  );
}

const rows = { display: "flex", flexDirection: "column", gap: SPACE.sm };

// Same as ChecklistEditor's "+ Add".
function AddRow({ onClick }) {
  return (
    <Button variant="subtle" onClick={onClick} style={{ alignSelf: "flex-start", marginTop: "4px", marginLeft: "-6px" }}>
      <Plus size={16} /> Add
    </Button>
  );
}

// Bounded by the row's text to the left and the next row below — ChecklistEditor's cap.
const RemoveBtn = ({ onClick }) => (
  <IconButton className="reveal" danger title="Remove" onClick={onClick} style={{ flexShrink: 0, "--hit-w": "34px", "--hit-h": "28px" }}>
    <X size={16} />
  </IconButton>
);

// A single-line-in-the-file text, as a wrapping prose field.
function RowText({ value, onChange, placeholder, label, autoFocus, className, style }) {
  return (
    <AutoTextarea
      className={className ? `prose-field ${className}` : "prose-field"}
      minRows={1} autoFocus={autoFocus}
      value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={singleLine}
      placeholder={placeholder} aria-label={label} style={style}
    />
  );
}

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
      <Section title="Use cases">
        {d.useCases.length > 0 && (
          <div style={rows}>
            {d.useCases.map((u, i) => (
              <Row
                key={i}
                label={
                  <select
                    className="design-select" aria-label="Priority"
                    value={u.tier} onChange={(e) => patchAt("useCases", i, { tier: Number(e.target.value) })}
                    style={{ ...labelSelect, fontWeight: u.tier === 0 ? WEIGHT.semibold : WEIGHT.normal, color: u.tier === 0 ? INK : INK_SOFT }}
                  >
                    {TIERS.map((t, n) => <option key={t} value={n}>{t}</option>)}
                  </select>
                }
                trailing={
                  <>
                    {/* In the trailing controls, not on a line of its own — a hidden control still
                        occupies layout, so a line under every flow-less use case read as uneven spacing. */}
                    {u.flow === null && (
                      <button
                        className="reveal"
                        onClick={() => { setFresh(`flow:${i}`); patchAt("useCases", i, { flow: "" }); }}
                        style={{ ...meta, display: "inline-flex", alignItems: "center", gap: "3px", background: "none", border: "none", padding: "3px 0", cursor: "pointer", color: INK_SOFT }}
                      >
                        <Plus size={11} /> Flow
                      </button>
                    )}
                    <RemoveBtn onClick={() => removeAt("useCases", i)} />
                  </>
                }
              >
                <RowText
                  value={u.text} onChange={(v) => patchAt("useCases", i, { text: v })}
                  placeholder="A use case…" label={`Use case ${i + 1}`} autoFocus={isFresh("useCases", i)}
                />
                {u.flow !== null && (
                  <RowText
                    value={u.flow}
                    // "->" is the easy way to type a step separator; show it as the real arrow.
                    onChange={(v) => patchAt("useCases", i, { flow: v.replace(/->/g, "→") })}
                    placeholder="Step -> step -> step" label={`Use case ${i + 1} flow`} autoFocus={isFresh("flow", i)}
                    style={{ fontSize: SIZE.sm, color: INK_SOFT }}
                  />
                )}
              </Row>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("useCases", { tier: d.useCases.length ? 1 : 0, text: "", flow: null })} />
      </Section>

      <Section title="Principles">
        {d.principles.length > 0 && (
          <div style={rows}>
            {d.principles.map((p, i) => (
              <Row
                key={i}
                label={<div style={{ ...labelText, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{i + 1}</div>}
                trailing={<RemoveBtn onClick={() => removeAt("principles", i)} />}
              >
                <RowText
                  value={p} onChange={(v) => patchAt("principles", i, v)}
                  placeholder="A principle…" label={`Principle ${i + 1}`} autoFocus={isFresh("principles", i)}
                />
              </Row>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("principles", "")} />
      </Section>

      <Section title="Constraints">
        {d.constraints.length > 0 && (
          <div style={rows}>
            {d.constraints.map((c, i) => (
              <Row key={i} label={<div aria-hidden="true" style={bullet} />} trailing={<RemoveBtn onClick={() => removeAt("constraints", i)} />}>
                <RowText
                  value={c} onChange={(v) => patchAt("constraints", i, v)}
                  placeholder="A constraint…" label={`Constraint ${i + 1}`} autoFocus={isFresh("constraints", i)}
                />
              </Row>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("constraints", "")} />
      </Section>

      {shown.has("qualities") && (
        <Section title="Experience qualities" onRemove={() => removeSection("qualities")}>
          <div style={rows}>
            {facets.map((facet) => (
              <Row key={facet} label={<div style={labelText}>{facet}</div>}>
                <AutoTextarea
                  className="prose-field" minRows={1} aria-label={facet}
                  placeholder={FACET_PLACEHOLDER[facet] || "…"}
                  value={d.qualities[facet] || ""}
                  onChange={(e) => set("qualities", { ...d.qualities, [facet]: e.target.value })}
                />
              </Row>
            ))}
          </div>
        </Section>
      )}

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <Section title="Edge cases">
        {d.edgeCases.length > 0 && (
          <div style={rows}>
            {d.edgeCases.map((e, i) => (
              <Row key={i} label={<div aria-hidden="true" style={bullet} />} trailing={<RemoveBtn onClick={() => removeAt("edgeCases", i)} />}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 12px 1fr", columnGap: SPACE.xl, alignItems: "start" }}>
                  <RowText
                    value={e.when} onChange={(v) => patchAt("edgeCases", i, { when: v })}
                    placeholder="When…" label={`Edge case ${i + 1}: when`} autoFocus={isFresh("edgeCases", i)}
                  />
                  <span aria-hidden="true" style={{ ...labelText, textAlign: "center" }}>→</span>
                  <RowText
                    className="design-then"
                    value={e.then} onChange={(v) => patchAt("edgeCases", i, { then: v })}
                    placeholder="Agent decides" label={`Edge case ${i + 1}: then`}
                  />
                </div>
              </Row>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("edgeCases", { when: "", then: "" })} />
      </Section>

      <Section title="Decisions">
        {d.decisions.length > 0 && (
          <div style={{ ...rows, gap: SPACE.lg }}>
            {d.decisions.map((x, i) => (
              <div key={i} style={rows}>
                {[["Decided", "decision", "What was decided…"], ["Because", "why", "Why…"], ["Rejected", "rejected", "What was rejected…"]].map(([label, key, ph], r) => (
                  <Row
                    key={key}
                    label={<div style={labelText}>{label}</div>}
                    trailing={r === 0 ? <RemoveBtn onClick={() => removeAt("decisions", i)} /> : null}
                  >
                    <AutoTextarea
                      className="prose-field" minRows={1} placeholder={ph} aria-label={`Decision ${i + 1}: ${label}`}
                      autoFocus={r === 0 && isFresh("decisions", i)}
                      value={x[key]} onChange={(e) => patchAt("decisions", i, { [key]: e.target.value })}
                      style={{ fontWeight: r === 0 ? WEIGHT.medium : WEIGHT.normal }}
                    />
                  </Row>
                ))}
              </div>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("decisions", { decision: "", why: "", rejected: "" })} />
      </Section>

      {/* Reference material last — it supports the intent above rather than leading it. */}
      <Section title="Artefacts">
        {d.artefacts.length > 0 && (
          <div style={{ ...rows, gap: SPACE.md }}>
            {d.artefacts.map((a, i) => (
              <Row
                key={i}
                label={
                  <select
                    className="design-select" aria-label="Artefact type"
                    value={ARTEFACT_TYPES.includes(a.type) ? a.type : "link"}
                    onChange={(e) => patchAt("artefacts", i, { type: e.target.value })}
                    style={labelSelect}
                  >
                    {ARTEFACT_TYPES.map((t) => <option key={t} value={t}>{ARTEFACT_LABEL[t]}</option>)}
                  </select>
                }
                trailing={<RemoveBtn onClick={() => removeAt("artefacts", i)} />}
              >
                <RowText
                  value={a.title} onChange={(v) => patchAt("artefacts", i, { title: v })}
                  placeholder="Title" label={`Artefact ${i + 1} title`} autoFocus={isFresh("artefacts", i)}
                />
                {/* Authority sits directly under the title it qualifies — it's what tells an agent
                    how closely to follow this — then the link it points at. */}
                <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginTop: "-2px" }}>
                  <select
                    className="design-select" aria-label="How closely an agent should follow this"
                    value={a.authority} onChange={(e) => patchAt("artefacts", i, { authority: e.target.value })}
                    // field-sizing: without it a select reserves its longest option's width, which
                    // left a gap between "Background" and the link.
                    style={{ ...labelSelect, width: "auto", fieldSizing: "content", fontSize: SIZE.sm, color: a.authority === "exact" ? INK : INK_SOFT, fontWeight: a.authority === "exact" ? WEIGHT.semibold : WEIGHT.normal }}
                  >
                    {Object.entries(AUTHORITIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <span aria-hidden="true" style={{ ...labelText, paddingTop: 0 }}>·</span>
                  <input
                    value={a.url} onChange={(e) => patchAt("artefacts", i, { url: e.target.value })}
                    placeholder="Paste a link…" aria-label={`Artefact ${i + 1} link`}
                    className="design-link"
                    style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", padding: "3px 0", fontFamily: font, fontSize: SIZE.sm, color: INK_SOFT }}
                  />
                  {a.url.trim() && (
                    <a
                      className="icon-btn" href={withScheme(a.url.trim())} target="_blank" rel="noreferrer" title="Open link"
                      style={{ flexShrink: 0, "--hit-w": "30px", "--hit-h": "28px" }}
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </Row>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("artefacts", { type: "link", title: "", url: "", authority: "context" })} />
      </Section>

      {shown.has("notes") && (
        <Section title="Notes" onRemove={() => removeSection("notes")}>
          <AutoTextarea
            className="prose-field" minRows={2} placeholder="Anything else…" aria-label="Notes"
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
