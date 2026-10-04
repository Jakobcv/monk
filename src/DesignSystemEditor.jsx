import { useState, useRef, useId, useMemo } from "react";
import { Plus, X, Check } from "lucide-react";
import { font, INK, INK_SOFT, PAPER } from "./lib/theme";
import { insertAt } from "./lib/arrays";
import {
  parseDesignSystem, serializeDesignSystem, COMPONENT_PROPS, tokenReferences, duplicateNames,
  isDimension, isNumber, isReference, isPercentage,
} from "./lib/designSystemModel";
import LiveMarkdown from "./ui/LiveMarkdown";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";

// The workspace's DESIGN.md as a specimen book rather than a sheet of paper (see
// lib/designSystemModel.js for the format and what round-trips). It sits straight on the page, and
// each token is shown at the size it actually is: colours as large chips in a grid, type set at its
// own size, spacing drawn to length, radii on tiles, and each component drawn from its own
// properties with the references followed. Prose fields, ghost "+ Add" rows and Undo on removal
// are the parts a spec's Solution tab uses, and the sections run in the order the format itself
// uses, so reading the page top to bottom is reading the file.
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

// A section of the page: a heading over its specimens, then its notes. No sheet around any of it —
// the tokens are the thing being shown, so they get the page's full measure and sit on its ground.
function Section({ title, count, children }) {
  return (
    <section className="paper-section open-section" data-section-label={title}>
      <header className="open-section__head">
        <h2 className="open-h2">{title}</h2>
        {count > 0 && <span className="open-count">{count}</span>}
      </header>
      {children}
    </section>
  );
}

// The dashed tile that ends a grid of tokens: the next one, not yet made.
function AddTile({ label, onClick, className = "" }) {
  return (
    <button type="button" className={`ds-add-tile ${className}`} onClick={onClick}>
      <Plus size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function AddRow({ label, onClick }) {
  return (
    <div>
      <PaperButton icon={Plus} onClick={onClick}>{label}</PaperButton>
    </div>
  );
}

const RemoveBtn = ({ onClick, title = "Remove" }) => (
  <IconButton className="reveal" danger title={title} aria-label={title} onClick={onClick} style={{ flexShrink: 0, "--hit-w": "34px", "--hit-h": "28px" }}>
    <X size={16} />
  </IconButton>
);

// A single-line token input. `invalid` flags without blocking; `title` says why.
function Field({ value, onChange, mono, invalid, why, className = "", ...rest }) {
  return (
    <input
      className={`token-field${mono ? " token-field--mono" : ""} ${className}`}
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
    <label className="ds-labeled" style={{ flex: grow ? "1 1 160px" : "0 1 88px" }}>
      <span className="ds-labeled__label">{label}</span>
      {children}
    </label>
  );
}

// The colour itself, large — and the native picker laid over it, so the chip is what you click.
function Swatch({ value, onPick, label }) {
  const v = value.trim();
  const valid = !!v && supportsColor(v);
  const hex = asHex6(v);
  return (
    <span className="ds-chip" data-empty={valid ? undefined : ""} style={valid ? { background: v } : undefined}>
      {hex !== null && <input type="color" value={hex} onChange={(e) => onPick(e.target.value.toUpperCase())} aria-label={label} />}
    </span>
  );
}

// "button-primary" → "Button primary": what a component's preview says on it.
const humanize = (name) => {
  const s = name.trim().replace(/[-_]+/g, " ");
  return s ? s[0].toUpperCase() + s.slice(1) : "Component";
};

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

  // What a token reference in a component points at: a colour, radius or spacing value as written,
  // or a type style's properties. Null for a reference to nothing (already flagged on the field).
  const lookup = (ref) => {
    const m = /^\{([^.{}]+)\.([^{}]+)\}$/.exec(ref.trim());
    const group = m && ["colors", "typography", "rounded", "spacing"].includes(m[1]) ? ds[m[1]] : null;
    const t = group?.find((r) => r.name.trim() === m[2]);
    if (!t) return null;
    return m[1] === "typography" ? t.props : t.value.trim();
  };
  const resolve = (v) => {
    const s = (v || "").trim();
    return isReference(s) ? lookup(s) : s;
  };

  // The component drawn from its own properties, references followed — so a change to `basil`
  // repaints every button that uses it. Sizes are capped to the stage, never stretched.
  const componentPreview = (c) => {
    const get = (k) => resolve(c.props.find((p) => p.key === k)?.value);
    const str = (v) => (typeof v === "string" ? v : "");
    const st = { fontFamily: font, color: INK };
    const bg = str(get("backgroundColor"));
    if (bg && supportsColor(bg)) st.background = bg;
    const fg = str(get("textColor"));
    if (fg && supportsColor(fg)) st.color = fg;
    const type = get("typography");
    if (type && typeof type === "object") {
      const tv = (k) => String(type[k] || "").trim();
      if (tv("fontFamily")) st.fontFamily = `${tv("fontFamily")}, ${font}`;
      if (isDimension(tv("fontSize"))) st.fontSize = `min(${tv("fontSize")}, 28px)`;
      if (isNumber(tv("fontWeight"))) st.fontWeight = tv("fontWeight");
      if (isNumber(tv("lineHeight")) || isDimension(tv("lineHeight"))) st.lineHeight = tv("lineHeight");
      if (isDimension(tv("letterSpacing"))) st.letterSpacing = tv("letterSpacing");
    }
    const r = str(get("rounded"));
    if (isDimension(r) || isPercentage(r)) st.borderRadius = r;
    const pad = str(get("padding"));
    if (isDimension(pad)) st.padding = `min(${pad}, 32px)`;
    const size = str(get("size"));
    if (isDimension(size)) { st.width = `min(${size}, 100%)`; st.minHeight = `min(${size}, 160px)`; }
    const h = str(get("height"));
    if (isDimension(h)) st.minHeight = `min(${h}, 160px)`;
    const w = str(get("width"));
    if (isDimension(w) || isPercentage(w)) st.width = `min(${w}, 100%)`;
    return st;
  };

  const prose = (key, placeholder, minLines = 2) => (
    <LiveMarkdown
      className="prose-field" minLines={minLines} placeholder={placeholder}
      ariaLabel={`${key} notes`} value={ds.sections[key]} onChange={(v) => setSection(key, v)}
    />
  );

  // A flat token's name and value fields, with the problems each can have.
  const nameValue = (group, t, i, noun, { valuePlaceholder, check, why }) => {
    const nameWhy = nameProblem(group, t, !!t.value.trim());
    return {
      name: (
        <Field
          className="ds-token-name" value={t.name} onChange={(v) => patchAt(group, i, { name: v })}
          placeholder="name" aria-label={`${noun} ${i + 1} name`} autoFocus={isFresh(group, i)}
          invalid={!!nameWhy} why={nameWhy}
        />
      ),
      value: (
        <Field
          mono value={t.value} onChange={(v) => patchAt(group, i, { value: v })}
          placeholder={valuePlaceholder} aria-label={`${noun} ${i + 1} value`}
          invalid={!!t.value.trim() && !check(t.value)} why={why}
        />
      ),
    };
  };

  const ruleList = (group, noun, placeholder, Icon) => (
    <div className="ds-rules">
      {ds[group].map((text, i) => (
        <div key={i} className="ds-rule reveal-group">
          <Icon size={16} aria-hidden="true" className="ds-rule__icon" />
          {/* A rule is one line in the file (`singleLine`), and usually names tokens in
              backticks, so it formats its markdown as you type. */}
          <LiveMarkdown
            singleLine className="prose-field" autoFocus={isFresh(group, i)}
            value={text} onChange={(v) => patchAt(group, i, v)}
            placeholder={placeholder} ariaLabel={`${noun} ${i + 1}`}
          />
          <RemoveBtn onClick={() => removeAt(group, i, noun)} />
        </div>
      ))}
      <AddRow label={`Add a ${noun}`} onClick={() => append(group, "")} />
    </div>
  );

  const colorCheck = { valuePlaceholder: "#1A1C1E", check: supportsColor, why: "Not a CSS colour" };
  const spacingCheck = { valuePlaceholder: "8px", check: (v) => isDimension(v) || isNumber(v), why: "A number, or px, em or rem" };
  const radiusCheck = { valuePlaceholder: "4px or 50%", check: (v) => isDimension(v) || isPercentage(v), why: "Use px, em, rem or a percentage" };

  return (
    <div className="open-page">
      {ds.droppedComments && (
        <p className="ds-note">
          This file has YAML comments in its front matter. They aren't kept once you edit here — use
          the Markdown view to keep them.
        </p>
      )}

      <section className="paper-section open-hero" data-section-label="Name">
        <input
          className="prose-field open-title" value={ds.name} onChange={(e) => set({ name: e.target.value })}
          placeholder="Name this design system…" aria-label="Name" spellCheck={false}
        />
        {/* One line in the front matter (`singleLine`). */}
        <LiveMarkdown
          singleLine className="prose-field open-lede" value={ds.description}
          onChange={(v) => set({ description: v })}
          placeholder="One line on what this visual language is…" ariaLabel="Description"
        />
      </section>

      <Section title="Overview">
        {prose("overview", "Who the product is for, and how it should look and feel…", 3)}
      </Section>

      <Section title="Colors" count={ds.colors.length}>
        <div className="ds-grid ds-grid--colors">
          {ds.colors.map((t, i) => {
            const f = nameValue("colors", t, i, "color", colorCheck);
            return (
              <div key={i} className="ds-tile reveal-group">
                <Swatch value={t.value} label={`Pick color ${i + 1}`} onPick={(v) => patchAt("colors", i, { value: v })} />
                <div className="ds-tile__meta">
                  <div className="ds-tile__line">{f.name}<RemoveBtn onClick={() => removeAt("colors", i, "color")} /></div>
                  {f.value}
                </div>
              </div>
            );
          })}
          <AddTile label="Add color" onClick={() => append("colors", { name: "", value: "" })} />
        </div>
        {prose("colors", "What each colour is for, and when to use it…")}
      </Section>

      <Section title="Typography" count={ds.typography.length}>
        {ds.typography.length > 0 && (
          <div className="ds-type-list">
            {ds.typography.map((t, i) => {
              const p = t.props;
              const setProp = (k, v) => patchAt("typography", i, { props: { ...p, [k]: v } });
              const val = (k) => p[k] || "";
              const nameWhy = nameProblem("typography", t, Object.values(p).some((v) => String(v).trim()));
              // Set at its own size, up to a display size the column can hold.
              const specimen = {
                fontFamily: val("fontFamily").trim() ? `${val("fontFamily")}, ${font}` : font,
                fontSize: isDimension(val("fontSize")) ? `min(${val("fontSize").trim()}, 64px)` : PAPER.body,
                fontWeight: isNumber(val("fontWeight")) ? val("fontWeight").trim() : undefined,
                lineHeight: isNumber(val("lineHeight")) || isDimension(val("lineHeight")) ? val("lineHeight").trim() : 1.3,
                letterSpacing: isDimension(val("letterSpacing")) ? val("letterSpacing").trim() : undefined,
              };
              return (
                <div key={i} className="ds-type reveal-group">
                  <div aria-hidden="true" className="ds-type__aa" style={{ fontFamily: specimen.fontFamily, fontWeight: specimen.fontWeight }}>Aa</div>
                  <div className="ds-type__body">
                    <div className="ds-tile__line">
                      <Field
                        className="ds-token-name" value={t.name} onChange={(v) => patchAt("typography", i, { name: v })}
                        placeholder="name, e.g. body-md" aria-label={`Type style ${i + 1} name`}
                        autoFocus={isFresh("typography", i)} invalid={!!nameWhy} why={nameWhy}
                      />
                      <RemoveBtn onClick={() => removeAt("typography", i, "type style")} />
                    </div>
                    <div className="ds-specimen" style={specimen}>{SPECIMEN_TEXT}</div>
                    <div className="ds-type__fields">
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <AddRow label="Add type style" onClick={() => append("typography", { name: "", props: {} })} />
        {prose("typography", "The type scale, and where each style is used…")}
      </Section>

      <Section title="Layout" count={ds.spacing.length}>
        <div className="ds-grid ds-grid--shapes">
          {ds.spacing.map((t, i) => {
            const f = nameValue("spacing", t, i, "spacing step", spacingCheck);
            const px = toPx(t.value) ?? (isNumber(t.value) ? +t.value : null);
            return (
              <div key={i} className="ds-tile reveal-group">
                {/* The step as what it is — the gap between two things — at its true size, so the
                    steps compare as they will on screen. */}
                <div className="ds-shape ds-gap" aria-hidden="true">
                  <span className="ds-gap__block" />
                  <span className="ds-gap__space" style={{ width: `${px == null ? 0 : Math.min(Math.max(px, 1), 72)}px` }} />
                  <span className="ds-gap__block" />
                </div>
                <div className="ds-tile__meta">
                  <div className="ds-tile__line">{f.name}<RemoveBtn onClick={() => removeAt("spacing", i, "spacing step")} /></div>
                  {f.value}
                </div>
              </div>
            );
          })}
          <AddTile label="Add spacing step" onClick={() => append("spacing", { name: "", value: "" })} />
        </div>
        {prose("layout", "Grid, spacing rhythm, breakpoints, density…")}
      </Section>

      <Section title="Elevation & Depth">
        {prose("elevation", "How surfaces stack: shadows, borders, overlays…")}
      </Section>

      <Section title="Shapes" count={ds.rounded.length}>
        <div className="ds-grid ds-grid--shapes">
          {ds.rounded.map((t, i) => {
            const f = nameValue("rounded", t, i, "radius", radiusCheck);
            const v = t.value.trim();
            const px = toPx(v);
            // A percentage is a percentage of the tile, so 50% is a circle; a length is drawn in
            // px, capped at half the tile.
            const radius = isPercentage(v) ? `${Math.min(parseFloat(v), 50)}%` : `${px == null ? 0 : Math.min(Math.max(px, 0), 48)}px`;
            return (
              <div key={i} className="ds-tile reveal-group">
                <div className="ds-shape" aria-hidden="true">
                  <span className="ds-shape__box" style={{ borderRadius: radius }} />
                </div>
                <div className="ds-tile__meta">
                  <div className="ds-tile__line">{f.name}<RemoveBtn onClick={() => removeAt("rounded", i, "radius")} /></div>
                  {f.value}
                </div>
              </div>
            );
          })}
          <AddTile label="Add radius" onClick={() => append("rounded", { name: "", value: "" })} />
        </div>
        {prose("shapes", "Corner radii and the shape language…")}
      </Section>

      <Section title="Components" count={ds.components.length}>
        <div className="ds-grid ds-grid--components">
          {ds.components.map((c, i) => {
            const used = new Set(c.props.map((p) => p.key));
            const setProps = (props) => patchAt("components", i, { props });
            const nameWhy = nameProblem("components", c, c.props.some((p) => p.value.trim()));
            return (
              <div key={i} className="ds-component reveal-group">
                <div className="ds-component__stage" aria-hidden="true">
                  <span className="ds-component__preview" style={componentPreview(c)}>{humanize(c.name)}</span>
                </div>
                <div className="ds-component__body">
                  <div className="ds-tile__line">
                    <Field
                      className="ds-token-name" value={c.name} onChange={(v) => patchAt("components", i, { name: v })}
                      placeholder="name, e.g. button-primary" aria-label={`Component ${i + 1} name`}
                      autoFocus={isFresh("components", i)} invalid={!!nameWhy} why={nameWhy}
                    />
                    <RemoveBtn title="Remove component" onClick={() => removeAt("components", i, "component")} />
                  </div>
                  <div className="ds-props">
                    {c.props.map((p, j) => {
                      const v = p.value.trim();
                      const badRef = isReference(v) && !refSet.has(v);
                      const shown = resolve(v);
                      const dot = /^(backgroundColor|textColor)$/.test(p.key) && typeof shown === "string" && shown && supportsColor(shown);
                      return (
                        <div key={j} className="ds-prop reveal-group">
                          <select
                            className="token-field" value={p.key} aria-label={`Component ${i + 1} property ${j + 1}`}
                            onChange={(e) => setProps(c.props.map((x, k) => (k === j ? { ...x, key: e.target.value } : x)))}
                          >
                            {!COMPONENT_PROPS.includes(p.key) && <option value={p.key}>{p.key || "property"}</option>}
                            {COMPONENT_PROPS.map((k) => (
                              <option key={k} value={k} disabled={k !== p.key && used.has(k)}>{k}</option>
                            ))}
                          </select>
                          <div className="ds-prop__value">
                            {dot && <span aria-hidden="true" className="ds-dot" style={{ background: shown }} />}
                            <Field
                              mono list={refListId} value={p.value} placeholder="{colors.primary}"
                              onChange={(val) => setProps(c.props.map((x, k) => (k === j ? { ...x, value: val } : x)))}
                              aria-label={`Component ${i + 1} ${p.key || "property"} value`}
                              invalid={badRef} why="No token by that name"
                            />
                          </div>
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
                </div>
              </div>
            );
          })}
          <AddTile
            label="Add component"
            onClick={() => append("components", { name: "", props: [{ key: COMPONENT_PROPS[0], value: "" }] })}
          />
        </div>
        {prose("components", "States, variants, and rules for shared components…")}
        {/* The token references a component value can use, offered as you type. */}
        <datalist id={refListId}>
          {refs.map((r) => <option key={r} value={r} />)}
        </datalist>
      </Section>

      <Section title="Do's and Don'ts">
        <div className="ds-dos">
          <div className="ds-dos__panel" data-kind="do">
            <h3 className="ds-dos__head"><span className="ds-dos__badge" aria-hidden="true"><Check size={14} /></span>Do</h3>
            {ruleList("dos", "do", "use the primary colour only for the main action…", Check)}
          </div>
          <div className="ds-dos__panel" data-kind="dont">
            <h3 className="ds-dos__head"><span className="ds-dos__badge" aria-hidden="true"><X size={14} /></span>Don't</h3>
            {ruleList("donts", "don't", "mix rounded and sharp corners…", X)}
          </div>
        </div>
        {ds.dosNotes.trim() && (
          <LiveMarkdown
            className="prose-field" ariaLabel="Do's and Don'ts notes"
            value={ds.dosNotes} onChange={(v) => set({ dosNotes: v })}
          />
        )}
      </Section>

      {(showOther.preamble || showOther.sections) && (
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
      )}
    </div>
  );
}
