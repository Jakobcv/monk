import { useState, useRef, useEffect } from "react";
import { Plus, X, ExternalLink, ImageOff } from "lucide-react";
import { font, INK_SOFT, BORDER, PAPER, SIZE, SPACE } from "./lib/theme";
import { Eyebrow } from "./ui/text";
import { parseDesign, serializeDesign } from "./lib/designModel";
import { insertAt } from "./lib/arrays";
import { pickFile, IMAGE_FILES } from "./lib/pickFile";
import LiveMarkdown from "./ui/LiveMarkdown";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";
import Modal from "./ui/Modal";

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
  sketches: "sketch",
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

// A sketch's file lives in the spec's own `sketches/` folder, and only `sketches/<name>` resolves:
// a path pointing anywhere else — an absolute URL, a traversal out of the folder — renders as a
// missing sketch rather than being fetched. Whatever resolves goes into an `img` and is never
// inlined, which is what keeps script inside an SVG from ever running.
const sketchName = (path) => /^sketches\/([^/\\]+)$/.exec((path || "").trim())?.[1] || null;

// One sketch's file as a blob URL, or null once it's clear there isn't one. `onRead` is a fresh
// closure on every render of the page above this tab, so it can't be an effect dependency — read
// through a ref, a sketch reads its file when its *path* changes and not on every keystroke in
// the caption beside it, which is also what stops the blob URLs from piling up.
function useSketchUrl(path, onRead) {
  const name = sketchName(path);
  const [state, setState] = useState({ status: "loading", url: null });
  const read = useRef(onRead);
  useEffect(() => { read.current = onRead; });

  useEffect(() => {
    if (!name || !read.current) { setState({ status: "missing", url: null }); return undefined; }
    let live = true;
    let url = null;
    setState({ status: "loading", url: null });
    read.current(name)
      .then((file) => {
        if (!live) return;
        url = URL.createObjectURL(file);
        setState({ status: "ready", url });
      })
      .catch(() => { if (live) setState({ status: "missing", url: null }); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [name]);

  return state;
}

// A sketch as it sits in the row: its picture in a frame, or a dashed frame where the file should
// have been. A sketch whose file is gone still has its caption under it, so the row keeps saying
// what the option was — the same rule the rest of the tab follows, where an empty row stays on
// screen rather than vanishing.
function SketchFrame({ sketch, onRead, onOpen }) {
  const { status, url } = useSketchUrl(sketch.path, onRead);
  const label = sketch.caption.trim() || "Sketch";

  if (status !== "ready") {
    return (
      <div
        className="sketch-missing"
        title={status === "loading" ? "Loading…" : "This sketch isn't in the spec's sketches folder"}
      >
        {status === "missing" && <ImageOff size={18} aria-hidden="true" />}
      </div>
    );
  }
  return (
    <button type="button" className="sketch-frame" onClick={onOpen} title="Open full size">
      <img src={url} alt={label} />
    </button>
  );
}

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

export default function DesignTab({ value, onChange, onToast, onUploadSketch, onReadSketch }) {
  const [d, setD] = useState(() => parseDesign(value));
  // The sketch open full size, by index, or null.
  const [zoom, setZoom] = useState(null);
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

  // Sketches carrying the same outcome, word for word, are one set of alternatives: they share a
  // single outcome line and sit in one row under it. Groups keep the order the sketches are in,
  // and the one holding the sketches with no outcome yet is a group like any other — its line is
  // the empty field that asks for one. The key is the membership rather than the text, so typing
  // in an outcome doesn't remount the field being typed in: every member is rewritten on each
  // keystroke, so the set stays the set.
  const sketchGroups = [];
  const groupByOutcome = new Map();
  d.sketches.forEach((s, i) => {
    const key = s.outcome.trim();
    if (!groupByOutcome.has(key)) {
      const group = { outcome: key, idxs: [] };
      groupByOutcome.set(key, group);
      sketchGroups.push(group);
    }
    groupByOutcome.get(key).idxs.push(i);
  });
  const setGroupOutcome = (idxs, outcome) =>
    set("sketches", d.sketches.map((s, j) => (idxs.includes(j) ? { ...s, outcome } : s)));

  // Adding a sketch is picking its file: it's written into the spec's sketches/ folder and the
  // line goes in pointing at it. The caption is left for you to write, because naming the option
  // is the part that makes a sketch worth looking at — a file name isn't a name. With no upload
  // handler (the preview routes have no folder) the row is still added, empty, so the section's
  // shape is visible.
  const addSketch = async () => {
    if (!onUploadSketch) { append("sketches", { caption: "", path: "", outcome: "" }); return; }
    try {
      const file = await pickFile(IMAGE_FILES);
      if (!file) return;
      const name = await onUploadSketch(file);
      append("sketches", { caption: "", path: `sketches/${name}`, outcome: "" });
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Couldn't add the sketch:", err);
        onToast?.("Couldn't add that sketch");
      }
    }
  };

  // Removal reports through the app's Undo toast, same as deleting a card or a document. An empty
  // row has nothing to bring back, so it goes quietly. Undo re-inserts at the row's old position.
  // A sketch's *file* is left in the folder: Undo has to be able to bring the whole sketch back,
  // and deleting the bytes would make it restore a line pointing at nothing. An orphan sketch is
  // visible in the folder and in the next diff, which is the right place to decide about it.
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

      {/* The same claim as the Solution above it, drawn rather than written — and crude on
          purpose, so the room argues about whether the layout achieves the outcome instead of
          about its copy. A set of alternatives shares one outcome line; see WRITING.md. */}
      <Section title="Sketches">
        {d.sketches.length === 0 && (
          <p className="paper-hint" style={{ marginBottom: SPACE.sm }}>
            No sketches yet. Two or three crude options for one outcome beat a single finished picture.
          </p>
        )}
        {sketchGroups.map((group) => (
          <div key={group.idxs.join(",")} style={{ marginBottom: SPACE.xl }}>
            <Row label={<div aria-hidden="true" style={bullet} />}>
              <RowText
                value={group.outcome} onChange={(v) => setGroupOutcome(group.idxs, v)}
                placeholder="What these have to achieve…"
                label={`Outcome for ${group.idxs.length === 1 ? "this sketch" : `these ${group.idxs.length} sketches`}`}
              />
            </Row>
            {/* Indented into the same column the row text above starts in, so a set reads as
                hanging off its outcome rather than as a second list. */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: SPACE.lg,
              marginLeft: `calc(${PAPER.marker} + ${SPACE.base})`, marginTop: SPACE.base,
            }}>
              {group.idxs.map((i) => (
                <div key={i} className="reveal-group" style={{ width: "196px", maxWidth: "100%" }}>
                  <SketchFrame
                    sketch={d.sketches[i]} onRead={onReadSketch}
                    onOpen={() => setZoom(i)}
                  />
                  <div style={{ display: "flex", alignItems: "flex-start", gap: SPACE.xs, marginTop: SPACE.xs }}>
                    <RowText
                      value={d.sketches[i].caption} onChange={(v) => patchAt("sketches", i, { caption: v })}
                      placeholder="Name this option…" label={`Sketch ${i + 1} caption`}
                      autoFocus={isFresh("sketches", i)}
                      style={{ flex: 1, minWidth: 0, fontSize: SIZE.ui }}
                    />
                    <RemoveBtn onClick={() => removeAt("sketches", i)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <AddRow onClick={addSketch} />
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

      {zoom != null && d.sketches[zoom] && (
        <Modal title={d.sketches[zoom].caption.trim() || "Sketch"} onClose={() => setZoom(null)} width={900}>
          <SketchZoom sketch={d.sketches[zoom]} onRead={onReadSketch} />
        </Modal>
      )}
    </div>
  );
}

// A sketch at full size. Same frame and the same greyscale as the thumbnail, because a sketch
// opened larger is still a sketch — the point of opening it is to read the layout, not to
// discover that it was a finished design all along.
function SketchZoom({ sketch, onRead }) {
  const { status, url } = useSketchUrl(sketch.path, onRead);
  const outcome = sketch.outcome.trim();
  return (
    <div>
      {status === "ready"
        ? <div className="sketch-frame" style={{ cursor: "default" }}><img src={url} alt={sketch.caption.trim() || "Sketch"} /></div>
        : <div className="sketch-missing" style={{ aspectRatio: "16 / 9" }}>{status === "missing" && <ImageOff size={24} aria-hidden="true" />}</div>}
      {outcome && <p className="paper-hint" style={{ marginTop: SPACE.lg, fontSize: SIZE.ui }}>{outcome}</p>}
    </div>
  );
}
