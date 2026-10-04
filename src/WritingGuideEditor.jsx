import { useState, useRef } from "react";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { SPACE } from "./lib/theme";
import { parseWritingGuide, serializeWritingGuide } from "./lib/writingGuideModel";
import LiveMarkdown from "./ui/LiveMarkdown";
import PaperButton from "./ui/PaperButton";
import IconButton from "./ui/IconButton";
import { examplePairs } from "./ui/examplePairs";

// The workspace's WRITING.md on an open page, laid out like DESIGN.md's beside it: no sheet, the
// guide's title set large with its intro as a lede, and each section opening on a hairline and a
// heading (the shared .open-* classes). Built from the same parts as the Solution tab — borderless
// prose fields, a ghost "+ Add" row at the foot, Undo on removal — because it's read the same way:
// top to bottom, one section per thing you might be writing, found with the section map.
//
// The ✗/✓ examples in a section are drawn as panels side by side (ui/examplePairs.js), since
// they're what a person most wants to see; the text in the file stays the quote lines it always was.
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
    <div className="open-page">
      <section className="paper-section open-hero" data-section-label={guide.title.trim() || "Title"}>
        {/* One line in the file (the `# ` heading), but a long one wraps rather than running off a
            narrow screen. */}
        <LiveMarkdown
          singleLine className="prose-field open-title"
          value={guide.title} onChange={(v) => set({ title: v })}
          placeholder="Writing guide" ariaLabel="Title"
        />
        <LiveMarkdown
          className="prose-field open-lede" minLines={2}
          value={guide.intro} onChange={(v) => set({ intro: v })}
          placeholder="What this guide is for, and who reads it…" ariaLabel="Intro"
        />
      </section>

      {guide.sections.map((section, i) => (
        <section
          key={i}
          className="paper-section open-section reveal-group"
          data-section-label={section.heading?.trim() || `Section ${i + 1}`}
        >
          <div className="open-section__head" style={{ alignItems: "center", gap: SPACE.xs }}>
            <input
              className="token-field open-h2"
              value={section.heading}
              onChange={(e) => patchSection(i, { heading: e.target.value })}
              placeholder="Section heading…"
              aria-label={`Section ${i + 1} heading`}
              autoFocus={fresh === i}
              spellCheck={false}
              style={{ flex: 1, minWidth: 0 }}
            />
            <IconButton
              className="reveal" title="Move up" aria-label="Move section up" disabled={i === 0}
              onClick={() => moveSection(i, -1)} style={{ flexShrink: 0 }}
            >
              <ChevronUp size={16} />
            </IconButton>
            <IconButton
              className="reveal" title="Move down" aria-label="Move section down" disabled={i === guide.sections.length - 1}
              onClick={() => moveSection(i, 1)} style={{ flexShrink: 0 }}
            >
              <ChevronDown size={16} />
            </IconButton>
            <IconButton
              className="reveal" danger title="Remove section" aria-label="Remove section"
              onClick={() => removeSection(i)} style={{ flexShrink: 0 }}
            >
              <X size={16} />
            </IconButton>
          </div>
          <LiveMarkdown
            className="prose-field" minLines={3} extensions={examplePairs}
            value={section.body} onChange={(v) => patchSection(i, { body: v })}
            placeholder="What to write in these fields, and what a bad answer looks like…"
            ariaLabel={`${section.heading?.trim() || `Section ${i + 1}`} body`}
          />
        </section>
      ))}

      <div className="open-section" style={{ gap: SPACE.base }}>
        <div>
          <PaperButton icon={Plus} onClick={addSection}>Add a section</PaperButton>
        </div>
        <p className="ds-note">
          Agents read this file before they write. Sections are <code>##</code> headings in the
          markdown; anything else you write in a section — subheadings, examples — stays as it is.
          A <code>&gt; ✗</code> or <code>&gt; ✓</code> line is shown as an example to avoid or follow.
        </p>
      </div>
    </div>
  );
}
