import { useState, useRef } from "react";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, SIZE, SPACE, WEIGHT } from "./lib/theme";
import { Eyebrow } from "./ui/text";
import { parseWritingGuide, serializeWritingGuide } from "./lib/writingGuideModel";
import LiveMarkdown from "./ui/LiveMarkdown";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";

// The workspace's WRITING.md as a sheet of paper. Built from the same parts as the Solution tab
// and DESIGN.md's editor — borderless prose fields, a ghost "+ Add" row at the foot, Undo on
// removal — because this file is read the same way: top to bottom, one section per thing you
// might be writing.
//
// The structure the editor models is only what the file actually has (writingGuideModel.js): a
// title, the intro above the first heading, and a `## ` section per record type. A section's body
// stays markdown — the `###` subheadings and the ✗/✓ examples the shipped guide uses live inside
// it, formatted as you type, rather than being broken into fields that would fight anyone who
// writes their own guide in a different shape.
//
// `value` seeds local state once; the page remounts this (via `key`) when the file changes on
// disk or the markdown view hands it back, and every edit serializes straight out through
// `onChange`.

const hasContent = (section) => !!(section.heading?.trim() || section.body?.trim());

function Section({ title, children }) {
  return (
    <section className="paper-section" data-section-label={title}>
      <Eyebrow style={{ minHeight: "18px", display: "flex", alignItems: "center" }}>{title}</Eyebrow>
      {children}
    </section>
  );
}

export default function WritingGuideEditor({ value, onChange, onToast }) {
  const [guide, setGuide] = useState(() => parseWritingGuide(value).value);
  // Index of the section just added — its heading mounts focused.
  const [fresh, setFresh] = useState(null);
  // The latest state, for Undo: a section comes back into whatever the page holds when you press
  // it, not the snapshot from when it was removed.
  const latest = useRef(guide);

  const commit = (next) => { latest.current = next; setGuide(next); onChange(serializeWritingGuide(next)); };
  const set = (patch) => commit({ ...guide, ...patch });
  const patchSection = (i, patch) =>
    set({ sections: guide.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const addSection = () => {
    setFresh(guide.sections.length);
    set({ sections: [...guide.sections, { heading: "", body: "" }] });
  };

  const moveSection = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= guide.sections.length) return;
    const next = [...guide.sections];
    [next[i], next[j]] = [next[j], next[i]];
    set({ sections: next });
  };

  const removeSection = (i) => {
    const section = guide.sections[i];
    set({ sections: guide.sections.filter((_, j) => j !== i) });
    if (!hasContent(section)) return;
    onToast?.(`Removed ${section.heading?.trim() || "section"}`, () => {
      const cur = latest.current;
      const sections = [...cur.sections];
      sections.splice(Math.min(i, sections.length), 0, section);
      commit({ ...cur, sections });
    });
  };

  return (
    <>
      <Section title="Title">
        <input
          className="el-edit edit-area"
          value={guide.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Writing guide"
          aria-label="Title"
          // em, not px: the paper surface sets the reading scale, and these are the sizes the
          // Markdown view gives the same `#` and `##` (.md-h1 / .md-h2), so switching views
          // doesn't resize the document.
          style={{ fontFamily: font, fontSize: "1.5em", fontWeight: WEIGHT.semibold, color: INK, lineHeight: 1.3 }}
        />
      </Section>

      <Section title="Intro">
        <LiveMarkdown
          className="prose-field" minLines={2}
          value={guide.intro} onChange={(v) => set({ intro: v })}
          placeholder="What this guide is for, and who reads it…" ariaLabel="Intro"
        />
      </Section>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      {guide.sections.map((section, i) => (
        <section
          key={i}
          className="paper-section reveal-group"
          data-section-label={section.heading?.trim() || `Section ${i + 1}`}
        >
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs, minHeight: "24px" }}>
            <input
              className="el-edit edit-area"
              value={section.heading}
              onChange={(e) => patchSection(i, { heading: e.target.value })}
              placeholder="Section heading…"
              aria-label={`Section ${i + 1} heading`}
              autoFocus={fresh === i}
              style={{ fontFamily: font, fontSize: "1.25em", fontWeight: WEIGHT.semibold, color: INK, lineHeight: 1.35, flex: 1, minWidth: 0 }}
            />
            <IconButton
              className="reveal" title="Move up" disabled={i === 0}
              onClick={() => moveSection(i, -1)} style={{ flexShrink: 0 }}
            >
              <ChevronUp size={16} />
            </IconButton>
            <IconButton
              className="reveal" title="Move down" disabled={i === guide.sections.length - 1}
              onClick={() => moveSection(i, 1)} style={{ flexShrink: 0 }}
            >
              <ChevronDown size={16} />
            </IconButton>
            <IconButton
              className="reveal" danger title="Remove section"
              onClick={() => removeSection(i)} style={{ flexShrink: 0 }}
            >
              <X size={16} />
            </IconButton>
          </div>
          <LiveMarkdown
            className="prose-field" minLines={3}
            value={section.body} onChange={(v) => patchSection(i, { body: v })}
            placeholder="What to write in these fields, and what a bad answer looks like…"
            ariaLabel={`${section.heading?.trim() || `Section ${i + 1}`} body`}
          />
        </section>
      ))}

      <div style={{ marginTop: "2px" }}>
        <PaperButton icon={Plus} onClick={addSection}>Add a section</PaperButton>
      </div>

      <p style={{ fontFamily: font, fontSize: SIZE.xs, color: INK_SOFT, margin: `${SPACE.base} 0 0`, lineHeight: 1.5 }}>
        Agents read this file before they write. Sections are <code>##</code> headings in the
        markdown; anything else you write in a section — subheadings, examples — stays as it is.
      </p>
    </>
  );
}
