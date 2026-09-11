// A spec's Design tab is structured on screen but stored as one readable markdown file
// (design.md) with fixed `## Section` headings — so it stays scannable, diffable and greppable
// like every other file in the folder, and an agent reading the raw file gets the same shape the
// build brief does. parseDesign/serializeDesign convert between the two.
//
// This is the *feature's* design intent — what this experience has to achieve. Visual language
// (tokens, type, components) belongs to the workspace-level DESIGN.md / Standards, not here.
//
// Parsing is forgiving on purpose: anything it doesn't recognise — text before the first heading,
// an unknown `## Heading`, a pre-structure freeform design.md — lands in Notes rather than being
// dropped, so migrating an existing spec is lossless. Sections are written in this order — intent
// first, then what must be covered, then reference material — one item per line:
//
//   (## Use cases — no longer written here; still read, so older files migrate into the spec's
//    flow, where use cases now live with ids — see flowModel.js)
//   ## Principles           1. text
//   ## Constraints          - text
//   ## Edge cases          - when → then                ("_agent decides_" when no outcome given)
//   ## Decisions            - **Decision**               (nested "  - Because: …", "  - Rejected: …")
//   ## Artefacts            - [Title](url) — prototype, match exactly
//   ## Notes                freeform markdown

export const TIERS = ["Primary", "Secondary", "Tertiary"];
export const ARTEFACT_TYPES = ["link", "prototype", "design", "diagram", "persona"];
export const AUTHORITIES = { exact: "Match exactly", direction: "Follow direction", context: "Background" };

// There used to be an "Experience qualities" section; it was dropped. A file that still has one
// keeps it — as an unknown heading it lands in Notes verbatim, so nothing is lost.
const TITLES = {
  artefacts: "Artefacts", useCases: "Use cases", principles: "Principles", constraints: "Constraints",
  edgeCases: "Edge cases", decisions: "Decisions", notes: "Notes",
};
const KEY_BY_TITLE = Object.fromEntries(Object.entries(TITLES).map(([k, t]) => [t.toLowerCase(), k]));

const AGENT_DECIDES = "_agent decides_";

export function blankDesign() {
  return { artefacts: [], useCases: [], principles: [], constraints: [], edgeCases: [], decisions: [], notes: "" };
}

// List items are one line each in the file; a stray newline typed into a field is collapsed.
const oneLine = (s) => (s || "").replace(/\s+/g, " ").trim();
const splitFlow = (s) => (s || "").split(/\s*(?:→|->)\s*/).map(oneLine).filter(Boolean);
const bullet = (l) => l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").trim();

// The non-empty sections, in canonical order, each rendered to its markdown body. Shared by
// serializeDesign (under `##` headings) and the build brief (under its own headings + framing).
export function designSections(d) {
  const out = [];
  const add = (key, lines) => {
    const body = lines.filter(Boolean).join("\n");
    if (body.trim()) out.push({ key, title: TITLES[key], body });
  };

  add("principles", d.principles.map(oneLine).filter(Boolean).map((p, i) => `${i + 1}. ${p}`));
  add("constraints", d.constraints.map(oneLine).filter(Boolean).map((c) => `- ${c}`));

  add("edgeCases", d.edgeCases
    .filter((e) => oneLine(e.when))
    .map((e) => `- ${oneLine(e.when)} → ${oneLine(e.then) || AGENT_DECIDES}`));

  add("decisions", d.decisions
    .filter((x) => oneLine(x.decision) || oneLine(x.why) || oneLine(x.rejected))
    .flatMap((x) => [
      `- **${oneLine(x.decision)}**`,
      oneLine(x.why) ? `  - Because: ${oneLine(x.why)}` : "",
      oneLine(x.rejected) ? `  - Rejected: ${oneLine(x.rejected)}` : "",
    ]));

  // Reference material comes after the intent and coverage it supports.
  add("artefacts", d.artefacts
    .filter((a) => oneLine(a.title) || oneLine(a.url))
    .map((a) => {
      const type = ARTEFACT_TYPES.includes(a.type) ? a.type : "link";
      const authority = (AUTHORITIES[a.authority] || AUTHORITIES.context).toLowerCase();
      return `- [${oneLine(a.title)}](${oneLine(a.url).replace(/\s/g, "")}) — ${type}, ${authority}`;
    }));

  add("notes", [(d.notes || "").trim()]);
  return out;
}

// Empty design → empty string (not a file of bare headings), so "has a design" checks elsewhere
// (SpecsPage) keep meaning what they say.
export function serializeDesign(d) {
  const sections = designSections(d);
  return sections.length ? sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n") + "\n" : "";
}

const PARSERS = {
  artefacts(d, lines) {
    for (const l of lines) {
      const m = /^\s*[-*+]\s+\[(.*)\]\(([^)]*)\)\s*(?:[—–-]\s*(.*))?$/.exec(l);
      if (!m) { d.artefacts.push({ type: "link", title: bullet(l), url: "", authority: "context" }); continue; }
      const tags = (m[3] || "").toLowerCase().split(",").map((s) => s.trim());
      d.artefacts.push({
        type: ARTEFACT_TYPES.find((t) => tags.includes(t)) || "link",
        title: m[1], url: m[2],
        authority: Object.keys(AUTHORITIES).find((k) => tags.includes(AUTHORITIES[k].toLowerCase())) || "context",
      });
    }
  },
  useCases(d, lines) {
    for (const l of lines) {
      const flow = /^\s+[-*+]\s+Flow:\s*(.*)$/i.exec(l);
      if (flow && d.useCases.length) { d.useCases[d.useCases.length - 1].flow = splitFlow(flow[1]).join(" → "); continue; }
      const m = /^\s*[-*+]\s+\*\*(\w+):\*\*\s*(.*)$/.exec(l);
      const tier = m ? TIERS.findIndex((t) => t.toLowerCase() === m[1].toLowerCase()) : -1;
      d.useCases.push({ tier: Math.max(tier, 0), text: tier !== -1 ? m[2] : bullet(l), flow: null });
    }
  },
  principles(d, lines) { for (const l of lines) d.principles.push(bullet(l)); },
  constraints(d, lines) { for (const l of lines) d.constraints.push(bullet(l)); },
  edgeCases(d, lines) {
    for (const l of lines) {
      const [when, ...rest] = bullet(l).split(" → ");
      const then = rest.join(" → ").trim();
      d.edgeCases.push({ when: when.trim(), then: then === AGENT_DECIDES ? "" : then });
    }
  },
  decisions(d, lines) {
    for (const l of lines) {
      const sub = /^\s+[-*+]\s+(Because|Rejected):\s*(.*)$/i.exec(l);
      const last = d.decisions[d.decisions.length - 1];
      if (sub && last) { last[sub[1].toLowerCase() === "because" ? "why" : "rejected"] = sub[2]; continue; }
      const m = /^\s*[-*+]\s+\*\*(.*)\*\*\s*$/.exec(l);
      d.decisions.push({ decision: m ? m[1] : bullet(l), why: "", rejected: "" });
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
    if (key && key !== "notes") { PARSERS[key](d, lines.filter((l) => l.trim())); continue; }
    // Notes, preamble, or an unknown heading — kept verbatim (unknown headings keep their title).
    const body = lines.join("\n").trim();
    const raw = title && !key ? [`## ${title}`, body].filter(Boolean).join("\n\n") : body;
    if (raw) notes.push(raw);
  }
  d.notes = notes.join("\n\n");
  return d;
}
