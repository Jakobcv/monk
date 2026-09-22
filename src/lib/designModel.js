// A spec's Design tab is structured on screen but stored as one readable markdown file
// (design.md) with fixed `## Section` headings — so it stays scannable, diffable and greppable
// like every other file in the folder, and an agent reading the raw file gets the same shape the
// app shows. parseDesign/serializeDesign convert between the two.
//
// This is the *feature's* design intent — what this experience has to achieve. Visual language
// (tokens, type, components) belongs to the workspace-level DESIGN.md / Standards, not here.
//
// Parsing is forgiving on purpose: anything it doesn't recognise — text before the first heading,
// an unknown `## Heading`, a pre-structure freeform design.md — lands in Notes rather than being
// dropped, so migrating an existing spec is lossless. Sections are written in this order — the
// solution first, then the intent behind it, then what must be covered, then reference material —
// one item per line except the two freeform ones:
//
//   ## Solution             freeform markdown
//   ## Sketches             - ![Caption](sketches/file) — outcome
//   ## Design principles    1. text
//   ## Constraints          - text
//   ## Decisions            - text
//   ## Artefacts            - [Title](url)
//   ## Notes                freeform markdown

// Sections that were dropped along the way — "Experience qualities", "Use cases" (with the flow
// map) and "Edge cases" — aren't listed here, which is exactly how they survive: an unrecognised
// `##` heading lands in Notes verbatim, title and all, so a file written before the change loses
// nothing and the writer decides what to do with it.
const TITLES = {
  artefacts: "Artefacts", solution: "Solution", sketches: "Sketches", principles: "Design principles",
  constraints: "Constraints", decisions: "Decisions", notes: "Notes",
};
// Headings a section has been known by, beyond its current title — a file written before a rename
// still parses into the same key rather than falling through to Notes as an unknown heading.
const ALIASES = { principles: "principles" };
const KEY_BY_TITLE = {
  ...ALIASES,
  ...Object.fromEntries(Object.entries(TITLES).map(([k, t]) => [t.toLowerCase(), k])),
};

// The two sections that are prose rather than a list: their body is kept and written back as
// typed, and they have no per-line parser below.
const FREEFORM = new Set(["solution", "notes"]);

export function blankDesign() {
  return { artefacts: [], solution: "", sketches: [], principles: [], constraints: [], decisions: [], notes: "" };
}

// List items are one line each in the file; a stray newline typed into a field is collapsed.
const oneLine = (s) => (s || "").replace(/\s+/g, " ").trim();
const MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const bullet = (l) => l.replace(MARKER, "").trim();

// A list section's lines, grouped into items. Only a line with a list marker starts an item; a
// line without one continues the item above it, because people and agents both hard-wrap long
// bullets, and reading each wrapped line as its own item shattered three principles into ten.
// Blank lines follow markdown: an indented line after a blank still belongs to the item (a second
// paragraph of it); an unindented one after a blank is a new item rather than being lost.
export function listItems(lines) {
  const items = [];
  let afterBlank = false;
  for (const line of lines) {
    if (!line.trim()) { afterBlank = true; continue; }
    const continues = items.length && !MARKER.test(line) && (/^\s/.test(line) || !afterBlank);
    if (continues) items[items.length - 1].push(line);
    else items.push([line]);
    afterBlank = false;
  }
  return items;
}
// An item's lines as one line of text, marker still on it.
const joined = (group) => group.map((l) => l.trim()).join(" ");

// The non-empty sections, in canonical order, each rendered to its markdown body, for
// serializeDesign to write under `##` headings.
export function designSections(d) {
  const out = [];
  const add = (key, lines) => {
    const body = lines.filter(Boolean).join("\n");
    if (body.trim()) out.push({ key, title: TITLES[key], body });
  };

  // The solution leads: it's the one section that says what is actually being built, and
  // everything under it qualifies that.
  add("solution", [(d.solution || "").trim()]);

  // The sketches come straight after it: they're the same claim as the Solution prose, drawn
  // rather than written. A sketch with no caption and no image is an empty row and isn't written.
  add("sketches", d.sketches
    .map((s) => ({ caption: oneLine(s.caption), path: oneLine(s.path).replace(/\s/g, ""), outcome: oneLine(s.outcome) }))
    .filter((s) => s.caption || s.path)
    .map((s) => {
      const body = s.path ? `![${s.caption}](${s.path})` : s.caption;
      return `- ${body}${s.outcome ? ` — ${s.outcome}` : ""}`;
    }));

  add("principles", d.principles.map(oneLine).filter(Boolean).map((p, i) => `${i + 1}. ${p}`));
  add("constraints", d.constraints.map(oneLine).filter(Boolean).map((c) => `- ${c}`));
  add("decisions", d.decisions.map(oneLine).filter(Boolean).map((x) => `- ${x}`));

  // Reference material comes after the intent and coverage it supports.
  add("artefacts", d.artefacts
    .filter((a) => oneLine(a.title) || oneLine(a.url))
    .map((a) => `- [${oneLine(a.title)}](${oneLine(a.url).replace(/\s/g, "")})`));

  add("notes", [(d.notes || "").trim()]);
  return out;
}

// Empty design → empty string (not a file of bare headings), so "has a design" checks elsewhere
// (SpecsPage) keep meaning what they say.
export function serializeDesign(d) {
  const sections = designSections(d);
  return sections.length ? sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n") + "\n" : "";
}

// Each parser takes the section's items from listItems — arrays of the raw lines that make up one item.
const PARSERS = {
  // An artefact is a title and a link. It used to carry trailing tags after an em dash — a kind
  // (prototype, diagram, persona…) the title already said out loud, and an authority saying how
  // closely to follow it — and the regex still tolerates them so an older line parses, but they
  // aren't read and aren't written back.
  artefacts(d, items) {
    for (const group of items) {
      const l = joined(group);
      const m = /^\s*[-*+]\s+\[(.*)\]\(([^)]*)\)\s*(?:[—–-]\s*.*)?$/.exec(l);
      d.artefacts.push(m ? { title: m[1], url: m[2] } : { title: bullet(l), url: "" });
    }
  },
  // A sketch is a markdown image and the outcome it's meant to achieve, after an em dash — the
  // caption names the option, the outcome is what the room is meant to judge it against, and two
  // sketches carrying the same outcome are one set of alternatives (DesignTab groups on it).
  // Image syntax rather than a plain link so a reader outside Monk — GitHub reviewing `monk/`,
  // an agent reading the raw file — sees a picture without inferring one from the extension.
  // A line that isn't an image keeps its text as the caption, the same way a bare artefact
  // bullet does, so nothing a person typed by hand is dropped.
  sketches(d, items) {
    for (const group of items) {
      const l = joined(group);
      const m = /^\s*[-*+]\s+!\[(.*?)\]\(([^)]*)\)\s*(?:[—–-]\s*(.*))?$/.exec(l);
      if (m) { d.sketches.push({ caption: m[1], path: m[2], outcome: (m[3] || "").trim() }); continue; }
      const text = bullet(l);
      const split = /^(.*?)\s+[—–]\s+(.*)$/.exec(text);
      d.sketches.push(split
        ? { caption: split[1], path: "", outcome: split[2] }
        : { caption: text, path: "", outcome: "" });
    }
  },
  principles(d, items) { for (const group of items) d.principles.push(bullet(joined(group))); },
  constraints(d, items) { for (const group of items) d.constraints.push(bullet(joined(group))); },
  // A plain list now, but a decision used to be a three-part record — `- **Decided**` with
  // nested `- Because: …` / `- Rejected: …` under it. Rather than let those nested lines become
  // three separate decisions, they fold back onto the line they belong to, so a file written in
  // the old shape reads as one sentence per decision instead of shattering.
  decisions(d, items) {
    for (const group of items) {
      const part = /^\s+[-*+]\s+(Because|Rejected):\s*(.*)$/i.exec(group[0]);
      if (part && d.decisions.length) {
        const label = part[1][0].toUpperCase() + part[1].slice(1).toLowerCase();
        const text = [part[2], ...group.slice(1)].map((l) => l.trim()).join(" ").trim();
        d.decisions[d.decisions.length - 1] += ` — ${label}: ${text}`;
        continue;
      }
      d.decisions.push(bullet(joined(group)).replace(/^\*\*(.*)\*\*$/, "$1"));
    }
  },
};

export function parseDesign(md) {
  const d = blankDesign();
  const notes = [];
  const chunks = [{ title: null, lines: [] }];
  for (const line of (md || "").replace(/\r\n?/g, "\n").split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) chunks.push({ title: h[1], lines: [] });
    else chunks[chunks.length - 1].lines.push(line);
  }
  for (const { title, lines } of chunks) {
    const key = title ? KEY_BY_TITLE[title.toLowerCase()] : null;
    if (key && !FREEFORM.has(key)) { PARSERS[key](d, listItems(lines)); continue; }
    if (key === "solution") { d.solution = lines.join("\n").trim(); continue; }
    // Notes, preamble, or an unknown heading — kept verbatim (unknown headings keep their title).
    const body = lines.join("\n").trim();
    const raw = title && !key ? [`## ${title}`, body].filter(Boolean).join("\n\n") : body;
    if (raw) notes.push(raw);
  }
  d.notes = notes.join("\n\n");
  return d;
}
