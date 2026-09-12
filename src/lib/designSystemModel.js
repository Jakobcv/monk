// DESIGN.md as structured data, for the design system editor (DesignSystemEditor.jsx). The file on
// disk stays exactly the format at github.com/google-labs-code/design.md — YAML front matter of
// design tokens, then `##` sections of prose — so an agent or a person reading the raw file sees
// nothing app-specific. parseDesignSystem/serializeDesignSystem convert between the two.
//
// The format needs only a small part of YAML: scalars, and maps nested at most three deep
// (group → token → property). That subset is parsed here rather than pulling in a YAML library.
// Anything outside it — block scalars, anchors, lists or flow collections inside a token group,
// tabs — makes parsing report `ok: false` with a reason, and the page falls back to editing the
// raw markdown. A structured save must never quietly rewrite a file into something it isn't.
//
// What is kept that the editor doesn't model:
//   - front-matter keys other than version/name/description and the five token groups (`omitted`,
//     or anything custom) — verbatim, as the raw YAML block they were written as
//   - text before the first heading, and `##` headings the format doesn't define — verbatim
//   - typography properties the editor doesn't show (fontFeature, fontVariation, anything else)
// What is not: YAML comments. `droppedComments` says the file had some, so the page can say so.

export const DESIGN_SECTIONS = [
  { key: "overview", title: "Overview", aliases: ["Brand & Style"] },
  { key: "colors", title: "Colors" },
  { key: "typography", title: "Typography" },
  { key: "layout", title: "Layout", aliases: ["Layout & Spacing"] },
  { key: "elevation", title: "Elevation & Depth", aliases: ["Elevation"] },
  { key: "shapes", title: "Shapes" },
  { key: "components", title: "Components" },
  { key: "dos", title: "Do's and Don'ts" },
];

// The properties the editor gives a field of its own, in the order they're written. The spec also
// allows fontFeature and fontVariation; they, and anything else, round-trip untouched.
export const TYPOGRAPHY_FIELDS = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"];
const TYPOGRAPHY_ORDER = [...TYPOGRAPHY_FIELDS, "fontFeature", "fontVariation"];

// The only properties the spec allows on a component. A variant (hover, pressed…) is its own
// component with a related name — button-primary-hover — not a nested state.
export const COMPONENT_PROPS = ["backgroundColor", "textColor", "typography", "rounded", "padding", "size", "height", "width"];

const PROSE_KEYS = DESIGN_SECTIONS.filter((s) => s.key !== "dos").map((s) => s.key);
const normTitle = (t) => t.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const SECTION_BY_TITLE = new Map(
  DESIGN_SECTIONS.flatMap((s) => [s.title, ...(s.aliases || [])].map((t) => [normTitle(t), s.key])),
);
const MODELLED_KEYS = new Set(["version", "name", "description", "colors", "typography", "rounded", "spacing", "components"]);

export function blankDesignSystem(name = "") {
  return {
    version: "alpha",
    name,
    description: "",
    colors: [],      // { name, value }
    typography: [],  // { name, props: { fontFamily, fontSize, … } }
    rounded: [],     // { name, value }
    spacing: [],     // { name, value }
    components: [],  // { name, props: [{ key, value }] }
    frontExtra: [],  // raw YAML blocks for front-matter keys the editor doesn't model
    sections: Object.fromEntries(PROSE_KEYS.map((k) => [k, ""])),
    dos: [],
    donts: [],
    dosNotes: "",    // anything under Do's and Don'ts that isn't a Do / Don't bullet
    preamble: "",    // text between the front matter and the first heading
    otherSections: "", // `##` sections the format doesn't define, headings included
    droppedComments: false,
  };
}

// ---------------------------------------------------------------------------
// Checks the editor uses to flag a value, without refusing it.
// ---------------------------------------------------------------------------
const clean = (s) => String(s ?? "").trim();
export const isDimension = (v) => /^-?(?:\d+|\d*\.\d+)(?:px|em|rem)$/.test(clean(v));
export const isNumber = (v) => /^-?(?:\d+|\d*\.\d+)$/.test(clean(v));
export const isReference = (v) => /^\{[^{}\s]+\}$/.test(clean(v));

// Every token a component property can point at, as the reference you'd type.
export function tokenReferences(ds) {
  const refs = [];
  for (const group of ["colors", "typography", "rounded", "spacing"]) {
    for (const t of uniqueNamed(ds[group])) refs.push(`{${group}.${clean(t.name)}}`);
  }
  return refs;
}

// Names used more than once in a group — only the first is written, so the editor flags the rest.
export function duplicateNames(rows) {
  const seen = new Set();
  const dupes = new Set();
  for (const r of rows) {
    const n = clean(r.name);
    if (!n) continue;
    if (seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  return dupes;
}

function uniqueNamed(rows) {
  const seen = new Set();
  return (rows || []).filter((r) => {
    const n = clean(r.name);
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
class Unsupported extends Error {}

// Removes a trailing ` # comment`, respecting quoted scalars.
function stripComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (quote === '"' && c === "\\") { i++; continue; }
      if (c === quote) {
        if (quote === "'" && s[i + 1] === "'") { i++; continue; }
        quote = null;
      }
      continue;
    }
    if ((c === '"' || c === "'") && (i === 0 || /[\s:]/.test(s[i - 1]))) { quote = c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s.trimEnd();
}

function scalar(raw) {
  const v = clean(raw);
  if (v === "") return "";
  if (v[0] === '"') {
    try { return String(JSON.parse(v)); } catch { throw new Unsupported(`the quoted value ${v}`); }
  }
  if (v[0] === "'") {
    if (!/^'(?:[^']|'')*'$/.test(v)) throw new Unsupported(`the quoted value ${v}`);
    return v.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[[{|>&*!%@`]/.test(v)) throw new Unsupported(`the value ${v}`);
  return v;
}

const KEY_LINE = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^']|'')*)'|([^\s#'"\-?:[\]{},][^:]*?))\s*:(?:\s+(.*))?$/;

// Lines of one top-level block → a tree of { key, value, children }. Comment-only and blank lines
// are skipped (and noted); every other line has to be `key:` or `key: value`.
function blockTree(lines, ds) {
  const root = { indent: -1, value: null, children: [] };
  const stack = [root];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (/^\s*#/.test(raw)) { ds.droppedComments = true; continue; }
    if (/^ *\t/.test(raw)) throw new Unsupported("tab indentation");
    const indent = raw.match(/^ */)[0].length;
    const text = stripComment(raw.slice(indent));
    if (text !== raw.slice(indent).trimEnd()) ds.droppedComments = true;
    const m = KEY_LINE.exec(text);
    if (!m) throw new Unsupported(`the line "${text}", which isn't a key and a value`);
    const key = m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2] !== undefined ? m[2].replace(/''/g, "'") : m[3].trim();
    // Caught here, on the key's own line: left to the lines that follow, a multi-line value would
    // be reported as whichever of its lines failed to parse, which names the symptom, not the cause.
    if (/^[|>][-+0-9]*\s*$/.test(clean(m[4]))) throw new Unsupported(`a multi-line value for "${key}"`);
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent.value !== null) throw new Unsupported(`"${parent.key}", which has both a value and nested keys`);
    const value = m[4] === undefined || clean(m[4]) === "" || clean(m[4]) === "{}" ? null : m[4];
    const node = { key, indent, value, children: [] };
    parent.children.push(node);
    stack.push(node);
  }
  return root.children;
}

function leaf(node, path) {
  if (node.children.length) throw new Unsupported(`nested keys under ${path}`);
  return scalar(node.value ?? "");
}

function parseFrontMatter(yaml, ds) {
  // Split into top-level blocks: each starts at a non-blank, non-comment line with no indent.
  const blocks = [];
  for (const raw of yaml.split("\n")) {
    const quiet = !raw.trim() || /^\s*#/.test(raw);
    if (!quiet && !/^\s/.test(raw)) blocks.push([raw]);
    else if (blocks.length) blocks[blocks.length - 1].push(raw);
    else if (!quiet) throw new Unsupported("indented front matter");
    else if (/^\s*#/.test(raw)) ds.droppedComments = true;
  }

  const seen = new Set();
  for (const lines of blocks) {
    const key = KEY_LINE.exec(stripComment(lines[0]))?.[3]?.trim() ?? null;
    if (!key || !MODELLED_KEYS.has(key)) {
      // Not ours to interpret: kept as written, minus trailing blank lines.
      const block = lines.join("\n").replace(/\s+$/, "");
      if (block) ds.frontExtra.push(block);
      continue;
    }
    if (seen.has(key)) throw new Unsupported(`"${key}" appearing twice`);
    seen.add(key);

    const [node] = blockTree(lines, ds);
    if (key === "version" || key === "name" || key === "description") {
      ds[key] = leaf(node, key);
      continue;
    }
    if (node.value !== null) throw new Unsupported(`"${key}" written as a single value`);
    if (key === "colors" || key === "rounded" || key === "spacing") {
      ds[key] = node.children.map((t) => ({ name: t.key, value: leaf(t, `${key}.${t.key}`) }));
    } else if (key === "typography") {
      ds.typography = node.children.map((t) => {
        if (t.value !== null) throw new Unsupported(`typography.${t.key} written as a single value`);
        const props = {};
        for (const p of t.children) props[p.key] = leaf(p, `typography.${t.key}.${p.key}`);
        return { name: t.key, props };
      });
    } else if (key === "components") {
      ds.components = node.children.map((c) => {
        if (c.value !== null) throw new Unsupported(`components.${c.key} written as a single value`);
        return { name: c.key, props: c.children.map((p) => ({ key: p.key, value: leaf(p, `components.${c.key}.${p.key}`) })) };
      });
    }
  }
}

// A body's text without the blank lines around it; indentation inside is kept.
const trimBlock = (lines) => lines.join("\n").replace(/^(?:[ \t]*\n)+/, "").trimEnd();

function parseDos(lines, ds) {
  const notes = [];
  for (const l of lines) {
    const dont = /^\s*[-*+]\s+(?:Don['’]t|Do not)\b:?\s*(.*)$/i.exec(l);
    if (dont) { ds.donts.push(dont[1].trim()); continue; }
    const doIt = /^\s*[-*+]\s+Do\b(?!['’])(?:\s*:)?\s*(.*)$/i.exec(l);
    if (doIt) { ds.dos.push(doIt[1].trim()); continue; }
    notes.push(l);
  }
  ds.dosNotes = trimBlock(notes);
}

function parseBody(md, ds) {
  const chunks = [{ title: null, lines: [] }];
  let fence = false;
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = !fence && /^##\s+(.+?)\s*$/.exec(line);
    if (h) chunks.push({ title: h[1], lines: [] });
    else chunks[chunks.length - 1].lines.push(line);
  }

  const seen = new Set();
  const other = [];
  for (const { title, lines } of chunks) {
    if (title === null) { ds.preamble = trimBlock(lines); continue; }
    const key = SECTION_BY_TITLE.get(normTitle(title));
    // An unknown heading, or a second copy of a known one, is kept verbatim with its title.
    if (!key || seen.has(key)) {
      const body = trimBlock(lines);
      other.push(body ? `## ${title}\n\n${body}` : `## ${title}`);
      continue;
    }
    seen.add(key);
    if (key === "dos") parseDos(lines, ds);
    else ds.sections[key] = trimBlock(lines);
  }
  ds.otherSections = other.join("\n\n");
}

// Returns { ok: true, value } or { ok: false, reason } — the reason names what the editor can't
// represent, for the page to show.
export function parseDesignSystem(md) {
  const ds = blankDesignSystem();
  const lines = (md || "").replace(/\r\n?/g, "\n").split("\n");
  try {
    let body = lines;
    if (/^---\s*$/.test(lines[0] || "")) {
      const end = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l));
      if (end === -1) throw new Unsupported("front matter that never closes");
      parseFrontMatter(lines.slice(1, end).join("\n"), ds);
      body = lines.slice(end + 1);
    }
    parseBody(body.join("\n"), ds);
    return { ok: true, value: ds };
  } catch (err) {
    if (err instanceof Unsupported) return { ok: false, reason: err.message };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Serializing
// ---------------------------------------------------------------------------
const PLAIN_VALUE = /^[A-Za-z0-9_(][A-Za-z0-9 _.,%()/+-]*$/;
const RESERVED = /^(?:true|false|yes|no|on|off|null|~)$/i;
const yamlValue = (v) => {
  const s = clean(v);
  return PLAIN_VALUE.test(s) && !RESERVED.test(s) ? s : JSON.stringify(s);
};
const yamlKey = (k) => (/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(k) ? k : JSON.stringify(k));
const oneLine = (s) => clean(s).replace(/\s+/g, " ");

function frontMatter(ds) {
  const y = [
    `version: ${yamlValue(clean(ds.version) || "alpha")}`,
    `name: ${yamlValue(ds.name)}`,
  ];
  if (clean(ds.description)) y.push(`description: ${yamlValue(oneLine(ds.description))}`);

  const flat = (key) => {
    const rows = uniqueNamed(ds[key]);
    if (!rows.length) return;
    y.push(`${key}:`);
    for (const r of rows) y.push(`  ${yamlKey(clean(r.name))}: ${yamlValue(r.value)}`);
  };
  // A token whose properties are all empty is still written, as `{}`, so a name you've typed isn't
  // lost the next time the file is read.
  const nested = (key, rows, entries) => {
    if (!rows.length) return;
    y.push(`${key}:`);
    for (const r of rows) {
      const props = entries(r).filter(([k, v]) => clean(k) && clean(v));
      if (!props.length) { y.push(`  ${yamlKey(clean(r.name))}: {}`); continue; }
      y.push(`  ${yamlKey(clean(r.name))}:`);
      for (const [k, v] of props) y.push(`    ${yamlKey(clean(k))}: ${yamlValue(v)}`);
    }
  };

  flat("colors");
  nested("typography", uniqueNamed(ds.typography), (t) => {
    const keys = [...TYPOGRAPHY_ORDER.filter((k) => k in t.props), ...Object.keys(t.props).filter((k) => !TYPOGRAPHY_ORDER.includes(k))];
    return keys.map((k) => [k, t.props[k]]);
  });
  flat("rounded");
  flat("spacing");
  nested("components", uniqueNamed(ds.components), (c) => {
    const seen = new Set();
    return c.props.filter((p) => !seen.has(clean(p.key)) && seen.add(clean(p.key))).map((p) => [p.key, p.value]);
  });

  for (const block of ds.frontExtra) y.push(block);
  return `---\n${y.join("\n")}\n---\n`;
}

function dosBody(ds) {
  const list = [
    ...ds.dos.map(oneLine).filter(Boolean).map((t) => `- Do ${t}`),
    ...ds.donts.map(oneLine).filter(Boolean).map((t) => `- Don't ${t}`),
  ].join("\n");
  return [list, clean(ds.dosNotes) ? ds.dosNotes.trimEnd() : ""].filter(Boolean).join("\n\n");
}

// Every section heading is written, empty or not: the file keeps the format's shape for anyone
// editing it by hand, and the build brief already drops sections with nothing under them
// (designSystemForBrief).
export function serializeDesignSystem(ds) {
  const parts = [];
  if (clean(ds.preamble)) parts.push(ds.preamble.trimEnd());
  for (const s of DESIGN_SECTIONS) {
    const content = s.key === "dos" ? dosBody(ds) : (ds.sections[s.key] || "").trimEnd();
    parts.push(clean(content) ? `## ${s.title}\n\n${content}` : `## ${s.title}`);
  }
  if (clean(ds.otherSections)) parts.push(ds.otherSections.trimEnd());
  return `${frontMatter(ds)}\n${parts.join("\n\n")}\n`;
}
