// WRITING.md as the editor sees it (see WritingGuideEditor.jsx). The file is prose, so the model
// is deliberately thin: a banner comment, a title, the intro above the first heading, and a list
// of `## ` sections, each heading with everything under it as markdown — `###` subheadings and
// examples included. That is the whole structure the format has, and anything the editor doesn't
// model round-trips inside a section's body rather than being dropped.
//
// Unlike DESIGN.md this always parses: every file is a (possibly empty) intro followed by zero or
// more sections, so there is no shape the structured view has to refuse. What it does not promise
// is byte-identical round-tripping — serializing normalizes the blank lines between blocks — so
// the app writes the file back only once you actually edit it.

// A `## ` heading, unless it's inside a fenced code block: the shipped guide has none, but a
// workspace that adds an example with `## ` in it shouldn't have the file split down the middle.
function splitLines(text) {
  const lines = String(text ?? "").split("\n");
  const out = [];
  let fence = null;
  for (const line of lines) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
    }
    out.push({ line, heading: !fence && /^## (?!#)/.test(line) });
  }
  return out;
}

const trimBlank = (lines) => {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
};

export function parseWritingGuide(text) {
  const lines = splitLines(text);
  const sections = [];
  let banner = "";
  let title = "";
  const intro = [];
  let current = null;
  let seenBody = false;

  for (const { line, heading } of lines) {
    if (heading) {
      current = { heading: line.replace(/^##\s+/, "").trim(), body: [] };
      sections.push(current);
      continue;
    }
    if (current) { current.body.push(line); continue; }
    // Above the first section: the generated banner, the title, then the intro prose.
    if (!seenBody && !banner && /^\s*<!--/.test(line)) { banner = line.trim(); continue; }
    if (!seenBody && !title && /^#\s+/.test(line)) { title = line.replace(/^#\s+/, "").trim(); continue; }
    if (line.trim()) seenBody = true;
    intro.push(line);
  }

  return {
    ok: true,
    value: {
      banner,
      title,
      intro: trimBlank(intro).join("\n"),
      sections: sections.map((s) => ({ heading: s.heading, body: trimBlank(s.body).join("\n") })),
    },
  };
}

export function serializeWritingGuide(value) {
  const blocks = [];
  if (value.banner?.trim()) blocks.push(value.banner.trim());
  if (value.title?.trim()) blocks.push(`# ${value.title.trim()}`);
  if (value.intro?.trim()) blocks.push(value.intro.trim());
  for (const section of value.sections || []) {
    const heading = section.heading?.trim();
    const body = section.body?.trim();
    // A section with neither is nothing at all; one with only a body keeps the body, so emptying a
    // heading while typing can't silently bin what's under it.
    if (!heading && !body) continue;
    blocks.push(heading ? `## ${heading}` : "");
    if (body) blocks.push(body);
  }
  return blocks.filter((b) => b !== "").join("\n\n") + "\n";
}

// Does this file still match the default it was created from? Compared as text, ignoring trailing
// whitespace, so "Restore default" can say whether there is anything to restore.
export const matchesDefault = (text, template) =>
  String(text ?? "").trimEnd() === String(template ?? "").trimEnd();
