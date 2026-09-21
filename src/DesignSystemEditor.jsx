import { useState, useRef, useId, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { font, INK_SOFT, BORDER, PAPER, SIZE, SPACE } from "./lib/theme";
import { Eyebrow } from "./ui/text";
import { insertAt } from "./lib/arrays";
import {
  parseDesignSystem, serializeDesignSystem, COMPONENT_PROPS, tokenReferences, duplicateNames,
  isDimension, isNumber, isReference, isPercentage,
} from "./lib/designSystemModel";
import LiveMarkdown from "./ui/LiveMarkdown";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";

// The workspace's DESIGN.md as a sheet of paper (see lib/designSystemModel.js for the format and
// what round-trips). Built from the same parts as a spec's Solution tab — an eyebrow per section,
// borderless prose fields, a ghost "+ Add" row at the foot of each list, Undo on removal — and in
// the order the format itself uses, so reading the page top to bottom is reading the file.
//
// Each section takes the input its content actually is: tokens as rows of name and value, with
// the value checked (a CSS colour, a px/em/rem dimension — or a percentage, for a radius — a
// number, a reference to a token that exists) and shown rather than just typed — a swatch, a type
// specimen, a radius, a length. Prose stays prose, and formats its markdown as you type
// (ui/LiveMarkdown). A value that fails its check is flagged, never refused: the file is yours, and
// a half-typed `1.2r` shouldn't be un-typeable.
//
// `value` seeds local state once (the page remounts this when the file changes on disk or the
// markdown view hands it back); every edit is serialized straight out through `onChange`. The page
// only mounts this for a file that parsed, so `.value` is always there.

const SPECIMEN_TEXT = "Sphinx of black quartz, judge my vow";

const hasContent = (x) =>
  typeof x === "string" ? !!x.trim()
    : Array.isArray(x) ? x.some(hasContent)
      : x && typeof x === "object" ? Object.values(x).some(hasContent) : false;

const supportsColor = (v) => {
  try { return typeof CSS !== "undefined" && CSS.supports("color", v); } catch { return false; }
};
// A value <input type="color"> can show: it only speaks six-digit hex.
const asHex6 = (v) => {
  const s = (v || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${[...s.slice(1)].map((c) => c + c).join("")}`.toLowerCase();
  return s ? null : "#000000";
};
const toPx = (v) => {
  const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec((v || "").trim());
  return m ? (m[2] === "px" ? +m[1] : +m[1] * 16) : null;
};

// Same rhythm as the Solution tab: eyebrow, PAPER.labelGap, content (.paper-section).
function Section({ title, children }) {
  return (
    <section className="paper-section" data-section-label={title}>
      <Eyebrow style={{ minHeight: "18px", display: "flex", alignItems: "center" }}>{title}</Eyebrow>
      {children}
    </section>
  );
}

const Divider = () => <div style={{ height: "1px", backgroundColor: BORDER }} />;

// A token's small subheading inside a section ("Tokens", "Do", "Don't") — a step under the eyebrow.
const Sub = ({ children }) => (
  <div style={{ fontFamily: font, fontSize: SIZE.ui, fontWeight: 600, color: INK_SOFT, marginTop: "2px" }}>{children}</div>
);

// One row: marker gutter (the token's preview), content, trailing remove.
function Row({ marker, children, trailing }) {
  return (
    <div className="reveal-group" style={{ display: "grid", gridTemplateColumns: `${PAPER.marker} 1fr auto`, columnGap: SPACE.base, alignItems: "start" }}>
      <div style={{ minWidth: 0, display: "flex", justifyContent: "flex-end" }}>{marker}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", minWidth: "24px", marginTop: "2px" }}>{trailing}</div>
    </div>
  );
}

const rows = { display: "flex", flexDirection: "column", gap: SPACE.md };

function AddRow({ label, onClick }) {
  return (
    <div style={{ marginTop: "2px" }}>
      <PaperButton icon={Plus} onClick={onClick}>{label}</PaperButton>
    </div>
  );
}

const RemoveBtn = ({ onClick, title = "Remove" }) => (
  <IconButton className="reveal" danger title={title} onClick={onClick} style={{ flexShrink: 0, "--hit-w": "34px", "--hit-h": "28px" }}>
    <X size={16} />
  </IconButton>
);

// A single-line token input. `invalid` flags without blocking; `title` says why.
function Field({ value, onChange, mono, invalid, why, ...rest }) {
  return (
    <input
      className={mono ? "token-field token-field--mono" : "token-field"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      title={invalid ? why : undefined}
      spellCheck={false}
      autoComplete="off"
      {...rest}
    />
  );
}

// A labelled field in a typography row. The <label> wraps the input, so the text is its name.
function Labeled({ label, grow, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", flex: grow ? "1 1 180px" : "0 1 96px", minWidth: 0 }}>
      <span style={{ fontFamily: font, fontSize: SIZE.xs, color: INK_SOFT, padding: "0 0 1px" }}>{label}</span>
      {children}
    </label>
  );
}

// Name and value side by side — the shape of every flat token group.
const pair = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: SPACE.xl };

function Swatch({ value, onPick, label }) {
  const v = value.trim();
  const valid = !!v && supportsColor(v);
  const hex = asHex6(v);
  return (
    <span className="ds-swatch" data-empty={valid ? undefined : ""} style={valid ? { background: v } : undefined}>
      {hex !== null && <input type="color" value={hex} onChange={(e) => onPick(e.target.value.toUpperCase())} aria-label={label} />}
    </span>
  );
}

export default function DesignSystemEditor({ value, onChange, onToast }) {
  const [ds, setDs] = useState(() => parseDesignSystem(value).value);
  // "group:index" of the row just added — it mounts focused.
  const [fresh, setFresh] = useState(null);
  // The latest state, for Undo: a row comes back into whatever the page holds when you press it,
  // not the snapshot from when it was removed.
  const latest = useRef(ds);
  const refListId = useId();
  // Decided once, at mount: a field for text the format doesn't define appears only if the file
  // had some, and doesn't vanish if you empty it while typing.
  const [showOther] = useState(() => ({ preamble: !!ds.preamble.trim(), sections: !!ds.otherSections.trim() }));

  const commit = (next) => { latest.current = next; setDs(next); onChange(serializeDesignSystem(next)); };
  const set = (patch) => commit({ ...ds, ...patch });
  const setSection = (key, v) => set({ sections: { ...ds.sections, [key]: v } });
  const patchAt = (group, i, patch) =>
    set({ [group]: ds[group].map((x, j) => (j === i ? (typeof x === "string" ? patch : { ...x, ...patch }) : x)) });
  const append = (group, item) => { setFresh(`${group}:${ds[group].length}`); set({ [group]: [...ds[group], item] }); };
  const isFresh = (group, i) => fresh === `${group}:${i}`;
  const removeAt = (group, i, noun) => {
    const item = ds[group][i];
    set({ [group]: ds[group].filter((_, j) => j !== i) });
    if (!hasContent(item)) return;
    onToast?.(`Removed ${noun}`, () => {
      const cur = latest.current;
      commit({ ...cur, [group]: insertAt(cur[group], i, item) });
    });
  };

  const refs = useMemo(() => tokenReferences(ds), [ds]);
  const refSet = useMemo(() => new Set(refs), [refs]);
  const dupes = {
    colors: duplicateNames(ds.colors), typography: duplicateNames(ds.typography),
    rounded: duplicateNames(ds.rounded), spacing: duplicateNames(ds.spacing), components: duplicateNames(ds.components),
  };
  const nameProblem = (group, row, hasValue) => {
    const n = row.name.trim();
    if (!n && hasValue) return "Needs a name to be saved";
    if (n && dupes[group].has(n)) return "Another token already has this name; only the first is saved";
    return null;
  };

  const prose = (key, placeholder, minLines = 2) => (
    <LiveMarkdown
      className="prose-field" minLines={minLines} placeholder={placeholder}
      ariaLabel={`${key} notes`} value={ds.sections[key]} onChange={(v) => setSection(key, v)}
    />
  );

  // Name + value rows for colors, spacing and rounded, differing only in their preview and check.
  const flatGroup = ({ group, noun, marker, valuePlaceholder, check, why }) => (
    <>
      {ds[group].length > 0 && (
        <div style={rows}>
          {ds[group].map((t, i) => {
            const bad = !!t.value.trim() && !check(t.value);
            const nameWhy = nameProblem(group, t, !!t.value.trim());
            return (
              <Row key={i} marker={marker(t, i)} trailing={<RemoveBtn onClick={() => removeAt(group, i, noun)} />}>
                <div style={pair}>
                  <Field
                    value={t.name} onChange={(v) => patchAt(group, i, { name: v })}
                    placeholder="name" aria-label={`${noun} ${i + 1} name`} autoFocus={isFresh(group, i)}
                    invalid={!!nameWhy} why={nameWhy}
                  />
                  <Field
                    mono value={t.value} onChange={(v) => patchAt(group, i, { value: v })}
                    placeholder={valuePlaceholder} aria-label={`${noun} ${i + 1} value`}
                    invalid={bad} why={why}
                  />
                </div>
              </Row>
            );
          })}
        </div>
      )}
      <AddRow label={`Add ${noun}`} onClick={() => append(group, { name: "", value: "" })} />
    </>
  );

  const bulletList = (group, noun, placeholder) => (
    <>
      {ds[group].length > 0 && (
        <div style={rows}>
          {ds[group].map((text, i) => (
            <Row key={i} marker={<span aria-hidden="true" className="ds-bullet" />} trailing={<RemoveBtn onClick={() => removeAt(group, i, noun)} />}>
              {/* A rule is one line in the file (`singleLine`), and usually names tokens in
                  backticks, so it formats its markdown as you type. */}
              <LiveMarkdown
                singleLine className="prose-field" autoFocus={isFresh(group, i)}
                value={text} onChange={(v) => patchAt(group, i, v)}
                placeholder={placeholder} ariaLabel={`${noun} ${i + 1}`}
              />
            </Row>
          ))}
        </div>
      )}
      <AddRow label={`Add a ${noun}`} onClick={() => append(group, "")} />
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: PAPER.sectionGap }}>
      {ds.droppedComments && (
        <p className="ds-note">
          This file has YAML comments in its front matter. They aren't kept once you edit here — use
          the Markdown view to keep them.
        </p>
      )}

      <Section title="Name">
        <input
          className="prose-field ds-name" value={ds.name} onChange={(e) => set({ name: e.target.value })}
          placeholder="Name this design system…" aria-label="Name" spellCheck={false}
        />
      </Section>

      <Section title="Description">
        {/* One line in the front matter (`singleLine`). */}
        <LiveMarkdown
          singleLine className="prose-field" value={ds.description}
          onChange={(v) => set({ description: v })}
          placeholder="One line on what this visual language is…" ariaLabel="Description"
        />
      </Section>

      <Divider />

      <Section title="Overview">
        {prose("overview", "Who the product is for, and how it should look and feel…", 3)}
      </Section>

      <Section title="Colors">
        {flatGroup({
          group: "colors", noun: "color", valuePlaceholder: "#1A1C1E",
          check: supportsColor, why: "Not a CSS colour",
          marker: (t, i) => <Swatch value={t.value} label={`Pick color ${i + 1}`} onPick={(v) => patchAt("colors", i, { value: v })} />,
        })}
        {prose("colors", "What each colour is for, and when to use it…")}
      </Section>

      <Section title="Typography">
        {ds.typography.length > 0 && (
          <div style={{ ...rows, gap: SPACE.xl }}>
            {ds.typography.map((t, i) => {
              const p = t.props;
              const setProp = (k, v) => patchAt("typography", i, { props: { ...p, [k]: v } });
              const val = (k) => p[k] || "";
              const nameWhy = nameProblem("typography", t, Object.values(p).some((v) => String(v).trim()));
              const specimen = {
                fontFamily: val("fontFamily").trim() ? `${val("fontFamily")}, ${font}` : font,
                fontSize: isDimension(val("fontSize")) ? `min(${val("fontSize").trim()}, 40px)` : PAPER.body,
                fontWeight: isNumber(val("fontWeight")) ? val("fontWeight").trim() : undefined,
                lineHeight: isNumber(val("lineHeight")) || isDimension(val("lineHeight")) ? val("lineHeight").trim() : 1.3,
                letterSpacing: isDimension(val("letterSpacing")) ? val("letterSpacing").trim() : undefined,
              };
              return (
                <Row
                  key={i}
                  marker={<span aria-hidden="true" className="ds-aa" style={{ fontFamily: specimen.fontFamily, fontWeight: specimen.fontWeight }}>Aa</span>}
                  trailing={<RemoveBtn onClick={() => removeAt("typography", i, "type style")} />}
                >
                  <Field
                    value={t.name} onChange={(v) => patchAt("typography", i, { name: v })}
                    placeholder="name, e.g. body-md" aria-label={`Type style ${i + 1} name`}
                    autoFocus={isFresh("typography", i)} invalid={!!nameWhy} why={nameWhy}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: `${SPACE.sm} ${SPACE.xl}`, marginTop: SPACE.sm }}>
                    <Labeled grow label="Font family">
                      <Field value={val("fontFamily")} onChange={(v) => setProp("fontFamily", v)} placeholder="Inter" />
                    </Labeled>
                    <Labeled label="Size">
                      <Field mono value={val("fontSize")} onChange={(v) => setProp("fontSize", v)} placeholder="1rem"
                        invalid={!!val("fontSize").trim() && !isDimension(val("fontSize"))} why="Use px, em or rem" />
                    </Labeled>
                    <Labeled label="Weight">
                      <Field mono value={val("fontWeight")} onChange={(v) => setProp("fontWeight", v)} placeholder="400"
                        invalid={!!val("fontWeight").trim() && !isNumber(val("fontWeight"))} why="A number, like 400" />
                    </Labeled>
                    <Labeled label="Line height">
                      <Field mono value={val("lineHeight")} onChange={(v) => setProp("lineHeight", v)} placeholder="1.5"
                        invalid={!!val("lineHeight").trim() && !isNumber(val("lineHeight")) && !isDimension(val("lineHeight"))} why="A number, or px, em or rem" />
                    </Labeled>
                    <Labeled label="Letter spacing">
                      <Field mono value={val("letterSpacing")} onChange={(v) => setProp("letterSpacing", v)} placeholder="0em"
                        invalid={!!val("letterSpacing").trim() && !isDimension(val("letterSpacing"))} why="Use px, em or rem" />
                    </Labeled>
                  </div>
                  {Object.values(p).some((v) => String(v).trim()) && (
                    <div className="ds-specimen" style={specimen}>{SPECIMEN_TEXT}</div>
                  )}
                </Row>
              );
            })}
          </div>
        )}
        <AddRow label="Add type style" onClick={() => append("typography", { name: "", props: {} })} />
        {prose("typography", "The type scale, and where each style is used…")}
      </Section>

      <Section title="Layout">
        {flatGroup({
          group: "spacing", noun: "spacing step", valuePlaceholder: "8px",
          check: (v) => isDimension(v) || isNumber(v), why: "A number, or px, em or rem",
          marker: (t) => {
            const px = toPx(t.value) ?? (isNumber(t.value) ? +t.value : null);
            return <span aria-hidden="true" className="ds-length" style={{ width: `${px == null ? 0 : Math.max(2, Math.min(px, 26))}px` }} />;
          },
        })}
        {prose("layout", "Grid, spacing rhythm, breakpoints, density…")}
      </Section>

      <Section title="Elevation & Depth">
        {prose("elevation", "How surfaces stack: shadows, borders, overlays…")}
      </Section>

      <Section title="Shapes">
        {flatGroup({
          group: "rounded", noun: "radius", valuePlaceholder: "4px or 50%",
          check: (v) => isDimension(v) || isPercentage(v), why: "Use px, em, rem or a percentage",
          // A percentage is drawn as a percentage of the preview's corner box, so 50% and up read as
          // fully round; a length is drawn in px, capped to the box.
          marker: (t) => {
            const v = t.value.trim();
            const px = toPx(v);
            const radius = isPercentage(v) ? `${Math.min(parseFloat(v), 100)}%` : `${px == null ? 0 : Math.min(Math.max(px, 0), 16)}px`;
            return <span aria-hidden="true" className="ds-radius" style={{ borderTopRightRadius: radius }} />;
          },
        })}
        {prose("shapes", "Corner radii and the shape language…")}
      </Section>

      <Section title="Components">
        {ds.components.length > 0 && (
          <div style={{ ...rows, gap: SPACE.xl }}>
            {ds.components.map((c, i) => {
              const used = new Set(c.props.map((p) => p.key));
              const setProps = (props) => patchAt("components", i, { props });
              const nameWhy = nameProblem("components", c, c.props.some((p) => p.value.trim()));
              return (
                <Row key={i} marker={<span aria-hidden="true" className="ds-bullet" style={{ marginTop: "11px" }} />} trailing={<RemoveBtn onClick={() => removeAt("components", i, "component")} />}>
                  <Field
                    value={c.name} onChange={(v) => patchAt("components", i, { name: v })}
                    placeholder="name, e.g. button-primary" aria-label={`Component ${i + 1} name`}
                    autoFocus={isFresh("components", i)} invalid={!!nameWhy} why={nameWhy}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: SPACE.sm }}>
                    {c.props.map((p, j) => {
                      const v = p.value.trim();
                      const badRef = isReference(v) && !refSet.has(v);
                      return (
                        <div key={j} className="reveal-group" style={{ display: "grid", gridTemplateColumns: "minmax(0, 150px) minmax(0, 1fr) auto", columnGap: SPACE.lg, alignItems: "center" }}>
                          <select
                            className="token-field" value={p.key} aria-label={`Component ${i + 1} property ${j + 1}`}
                            onChange={(e) => setProps(c.props.map((x, k) => (k === j ? { ...x, key: e.target.value } : x)))}
                          >
                            {!COMPONENT_PROPS.includes(p.key) && <option value={p.key}>{p.key || "property"}</option>}
                            {COMPONENT_PROPS.map((k) => (
                              <option key={k} value={k} disabled={k !== p.key && used.has(k)}>{k}</option>
                            ))}
                          </select>
                          <Field
                            mono list={refListId} value={p.value} placeholder="{colors.primary}"
                            onChange={(val) => setProps(c.props.map((x, k) => (k === j ? { ...x, value: val } : x)))}
                            aria-label={`Component ${i + 1} ${p.key || "property"} value`}
                            invalid={badRef} why="No token by that name"
                          />
                          <RemoveBtn title="Remove property" onClick={() => setProps(c.props.filter((_, k) => k !== j))} />
                        </div>
                      );
                    })}
                    {used.size < COMPONENT_PROPS.length && (
                      <div>
                        <button
                          type="button" className="btn btn--sm btn--subtle" style={{ color: INK_SOFT, marginLeft: "-8px" }}
                          onClick={() => setProps([...c.props, { key: COMPONENT_PROPS.find((k) => !used.has(k)), value: "" }])}
                        >
                          <Plus size={14} /> Property
                        </button>
                      </div>
                    )}
                  </div>
                </Row>
              );
            })}
          </div>
        )}
        <AddRow label="Add component" onClick={() => append("components", { name: "", props: [{ key: COMPONENT_PROPS[0], value: "" }] })} />
        {prose("components", "States, variants, and rules for shared components…")}
        {/* The token references a component value can use, offered as you type. */}
        <datalist id={refListId}>
          {refs.map((r) => <option key={r} value={r} />)}
        </datalist>
      </Section>

      <Divider />

      <Section title="Do's and Don'ts">
        <Sub>Do</Sub>
        {bulletList("dos", "do", "use the primary colour only for the main action…")}
        <Sub>Don't</Sub>
        {bulletList("donts", "don't", "mix rounded and sharp corners…")}
        {ds.dosNotes.trim() && (
          <LiveMarkdown
            className="prose-field" ariaLabel="Do's and Don'ts notes"
            value={ds.dosNotes} onChange={(v) => set({ dosNotes: v })}
          />
        )}
      </Section>

      {(showOther.preamble || showOther.sections) && (
        <>
          <Divider />
          <Section title="Other">
            <p className="ds-note">Text this format doesn't define, kept as written.</p>
            {showOther.preamble && (
              <LiveMarkdown
                className="prose-field" ariaLabel="Text before the first section"
                value={ds.preamble} onChange={(v) => set({ preamble: v })}
              />
            )}
            {showOther.sections && (
              <LiveMarkdown
                className="prose-field ds-raw" minLines={2} ariaLabel="Other sections"
                value={ds.otherSections} onChange={(v) => set({ otherSections: v })}
              />
            )}
          </Section>
        </>
      )}
    </div>
  );
}
