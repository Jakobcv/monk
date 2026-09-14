import { useState, useRef } from "react";
import { Plus, X, ExternalLink } from "lucide-react";
import { font, INK_SOFT, BORDER, PAPER, SIZE, SPACE } from "./lib/theme";
import { Eyebrow } from "./ui/text";
import { parseDesign, serializeDesign } from "./lib/designModel";
import { insertAt } from "./lib/arrays";
import LiveMarkdown from "./ui/LiveMarkdown";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";

// A spec's Solution tab (design.md on disk, and DesignTab here — the storage name outlived the
// label): what's being built and the intent around it, in structured sections, built from the
// same parts as Overview — an eyebrow per section, borderless prose fields, a subtle "+ Add".
// No helper text or treatment labels on screen: how an agent treats each section (intent,
// binding, settled, reference) is spelled out in MONK.md (lib/monkSchema.js).
//
// The page runs on two indents and no more: Solution and Notes are prose, flush with the section
// headings and with Overview's fields, and everything between them is a plain list in one marker
// gutter — MARKER_W + 8px, the same 34px a checkbox and its label take on Overview, so a list
// indents identically on either tab. Every text is an auto-growing prose field, so nothing long is
// ever silently cut off.
//
// `value` is the design.md string; it seeds local structured state once, and every edit is
// serialized back out through `onChange` (see lib/designModel.js). SpecPage remounts this per
// spec. Rows still empty stay on screen but aren't written to the file.

// What the Undo toast calls a removed row.
const ROW_NOUN = {
  principles: "principle", constraints: "constraint", decisions: "decision", artefacts: "artefact",
};
const hasContent = (x) =>
  typeof x === "string" ? !!x.trim() : Object.values(x).some((v) => typeof v === "string" && v.trim());

const withScheme = (url) => (/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);

// The gutter a row's marker sits in (PAPER.marker), right-hand-aligned against the text it marks
// rather than stretched to the column, which is why a 4px bullet in it still reads as attached to
// its line. + SPACE.base puts the text at 34px, Overview's checklist indent.

// A principle's number: a step below the row's prose (PAPER.label under PAPER.body) so it reads as
// the annotation it is, with the top padding set to put the two on a shared baseline — at 16px/1.6
// in a field padded 4px the row's first baseline falls 24.3px down, and a 14px/1.6 number's falls
// 17.8px, so it owes ~7px.
const labelText = { fontFamily: font, fontSize: PAPER.label, lineHeight: PAPER.leading, color: INK_SOFT, paddingTop: "7px" };
// Numbers and bullets sit at the right of their gutter, next to the text they mark rather than
// stranded at its left edge. 15px centres the dot on the row's first line.
const bullet = { width: "4px", height: "4px", borderRadius: "50%", background: INK_SOFT, marginTop: "15px", marginLeft: "auto" };

// An artefact's link, on its own line under the title it belongs to — smaller and softer, the
// way a citation sits under what it supports.
const linkLine = {
  fontFamily: font, fontSize: SIZE.ui, lineHeight: PAPER.leading,
  padding: "2px 0", color: INK_SOFT,
};

// Same rhythm as Overview: eyebrow, PAPER.labelGap, content (.paper-section).
function Section({ title, children }) {
  return (
    <section className="paper-section">
      <Eyebrow style={{ minHeight: "18px", display: "flex", alignItems: "center" }}>{title}</Eyebrow>
      {children}
    </section>
  );
}

// One row: marker gutter, text, trailing controls.
function Row({ label, children, trailing }) {
  return (
    <div className="reveal-group" style={{
      display: "grid",
      gridTemplateColumns: `${PAPER.marker} 1fr auto`,
      columnGap: SPACE.base,
      alignItems: "start",
    }}>
      <div style={{ minWidth: 0 }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, minWidth: "24px", marginTop: "3px" }}>{trailing}</div>
    </div>
  );
}

const rows = { display: "flex", flexDirection: "column", gap: SPACE.md };

// Same as ChecklistEditor's "+ Add" — a ghost row at the foot of the list (see ui/PaperButton).
function AddRow({ onClick }) {
  return (
    <div style={{ marginTop: "2px" }}>
      <PaperButton icon={Plus} onClick={onClick}>Add</PaperButton>
    </div>
  );
}

// Bounded by the row's text to the left and the next row below — ChecklistEditor's cap.
const RemoveBtn = ({ onClick }) => (
  <IconButton className="reveal" danger title="Remove" onClick={onClick} style={{ flexShrink: 0, "--hit-w": "34px", "--hit-h": "28px" }}>
    <X size={16} />
  </IconButton>
);

// A single-line-in-the-file text, as a wrapping prose field that formats its markdown as you type.
// List items are one line each in the file, so Enter doesn't start a second line (`singleLine`).
function RowText({ value, onChange, placeholder, label, autoFocus, className, style }) {
  return (
    <LiveMarkdown
      singleLine
      className={className ? `prose-field ${className}` : "prose-field"}
      autoFocus={autoFocus}
      value={value} onChange={onChange}
      placeholder={placeholder} ariaLabel={label} style={style}
    />
  );
}

export default function DesignTab({ value, onChange, onToast }) {
  const [d, setD] = useState(() => parseDesign(value));
  // "section:index" of the row just added — it mounts with autoFocus, so you can type straight away.
  const [fresh, setFresh] = useState(null);
  // The latest design, kept in step by `commit`. Undo reads it so a row comes back into whatever
  // the tab holds *when you press Undo* — restoring the snapshot from removal time would silently
  // throw away anything typed in between.
  const latest = useRef(d);

  const commit = (next) => { latest.current = next; setD(next); onChange(serializeDesign(next)); };
  const set = (key, v) => commit({ ...d, [key]: v });
  const patchAt = (key, i, fields) =>
    set(key, d[key].map((x, j) => (j === i ? (typeof x === "object" ? { ...x, ...fields } : fields) : x)));
  const append = (key, item) => { setFresh(`${key}:${d[key].length}`); set(key, [...d[key], item]); };
  const isFresh = (key, i) => fresh === `${key}:${i}`;

  // Removal reports through the app's Undo toast, same as deleting a card or a document. An empty
  // row has nothing to bring back, so it goes quietly. Undo re-inserts at the row's old position.
  // (Like Board's card undo, it acts on this tab's state — once you've left the spec, it's moot.)
  const removeAt = (key, i) => {
    const item = d[key][i];
    set(key, d[key].filter((_, j) => j !== i));
    if (!hasContent(item)) return;
    onToast?.(`Removed ${ROW_NOUN[key]}`, () => {
      const cur = latest.current;
      commit({ ...cur, [key]: insertAt(cur[key], i, item) });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: PAPER.sectionGap }}>
      {/* What's being built, in your own words. Flush with the section headings, like Overview's
          fields — it says what's being built, and every section under it only qualifies it. */}
      <Section title="Solution">
        <LiveMarkdown
          className="prose-field" minLines={3} placeholder="What we're building, and how it works…"
          ariaLabel="Solution" value={d.solution} onChange={(v) => set("solution", v)}
        />
      </Section>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <Section title="Design principles">
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

      <Section title="Decisions">
        {d.decisions.length > 0 && (
          <div style={rows}>
            {d.decisions.map((x, i) => (
              <Row key={i} label={<div aria-hidden="true" style={bullet} />} trailing={<RemoveBtn onClick={() => removeAt("decisions", i)} />}>
                <RowText
                  value={x} onChange={(v) => patchAt("decisions", i, v)}
                  placeholder="A decision…" label={`Decision ${i + 1}`} autoFocus={isFresh("decisions", i)}
                />
              </Row>
            ))}
          </div>
        )}
        <AddRow onClick={() => append("decisions", "")} />
      </Section>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      {/* Reference material last — it supports the intent above rather than leading it. */}
      <Section title="Artefacts">
        {d.artefacts.length > 0 && (
          <div style={{ ...rows, gap: SPACE.lg }}>
            {d.artefacts.map((a, i) => (
              <Row
                key={i}
                label={<div aria-hidden="true" style={bullet} />}
                trailing={<RemoveBtn onClick={() => removeAt("artefacts", i)} />}
              >
                <RowText
                  value={a.title} onChange={(v) => patchAt("artefacts", i, { title: v })}
                  placeholder="What it is…" label={`Artefact ${i + 1} title`} autoFocus={isFresh("artefacts", i)}
                />
                {/* The link sits directly under the title it belongs to. */}
                <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, marginTop: "-2px" }}>
                  <input
                    value={a.url} onChange={(e) => patchAt("artefacts", i, { url: e.target.value })}
                    placeholder="Paste a link…" aria-label={`Artefact ${i + 1} link`}
                    className="design-link"
                    style={{ ...linkLine, flex: 1, minWidth: 0, border: "none", outline: "none", background: "none" }}
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
        <AddRow onClick={() => append("artefacts", { title: "", url: "" })} />
      </Section>

      {/* Always there — the catch-all for anything the sections above don't hold. */}
      <Section title="Notes">
        <LiveMarkdown
          className="prose-field" minLines={2} placeholder="Anything else…" ariaLabel="Notes"
          value={d.notes} onChange={(v) => set("notes", v)}
        />
      </Section>
    </div>
  );
}
