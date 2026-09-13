
// Frontmatter here is a single line of JSON between `---` fences, not YAML — the data is
// always simple (strings/numbers/an array/a small object or null), so JSON's own
// unambiguous serializer is a better fit than pulling in a YAML library. Still perfectly
// readable to a human or an LLM opening the file.
const FRONTMATTER_RE = /^---\n(.*)\n---\n?([\s\S]*)$/;

function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { data: {}, body: content };
  let data = {};
  try { data = JSON.parse(match[1]); } catch { /* malformed frontmatter — treat as empty */ }
  return { data, body: match[2] };
}

function stringifyFrontmatter(data, body) {
  return `---\n${JSON.stringify(data)}\n---\n${body}`;
}

// Pulls one `## Heading` section's body out of a spec.md.
//
// The whitespace after the heading is deliberately horizontal-only. It used to be `\s*\n`,
// which for an *empty* section swallowed the blank line separating it from the next heading —
// so the lookahead never saw `\n##`, and the section read back as the literal text of the
// heading below it. An empty Goals came back as "## Non-goals", was written into the file on
// the next save, and the duplicate compounded every round trip. Nothing surfaced it because
// the file was rewritten identically-corrupted every 700ms; it only became visible once saves
// started skipping unchanged files and this one refused to settle.
function extractSection(body, heading) {
  const re = new RegExp(`(?:^|\\n)##\\s*${heading}[^\\S\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const match = body.match(re);
  return match ? match[1].trim() : "";
}

// A board is now pure canvas — no name/goal/status/etc., that all lives on the owning spec.
export function boardMetaToMarkdown(board) {
  const frontmatter = {
    id: board.id,
    createdAt: new Date(board.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(board.updatedAt || Date.now()).toISOString(),
  };
  return stringifyFrontmatter(frontmatter, "");
}

export function markdownToBoardMeta(content) {
  const { data } = parseFrontmatter(content);
  return {
    id: data.id,
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
  };
}

// `card` here always carries a `connectsTo` array (the outgoing edges from this card,
// derived from the board's flat `connections` list at save time — see storage.js).
// "signal" and "insight" cards are pure pointers now — `id` IS the id of a record in the
// workspace's global `signals`/`insights` collection (see signalToMarkdown/insightToMarkdown
// below), so there's no local content or `ref` wrapper to carry here at all.
export function cardToMarkdown(card, kind) {
  if (kind === "signal" || kind === "insight") {
    return stringifyFrontmatter({ id: card.id, connectsTo: card.connectsTo || [] }, "");
  }

  const frontmatter = {
    id: card.id,
    connectsTo: card.connectsTo || [],
    ref: card.ref || null,
  };

  let body = "";
  if (!card.ref) {
    body = kind === "action"
      ? ["## If we", card.ifWe || "", "", "## Then", card.then || "", "", "## Expected", card.expected || ""].join("\n")
      : (card.text || "");
  }
  return stringifyFrontmatter(frontmatter, body);
}

// Returns { card, connectsTo } — connectsTo is threaded back out so the caller can
// synthesize the board's flat `connections` list from every card's outgoing edges.
export function markdownToCard(content, kind) {
  const { data, body } = parseFrontmatter(content);
  const connectsTo = Array.isArray(data.connectsTo) ? data.connectsTo : [];

  if (kind === "signal" || kind === "insight") {
    return { card: { id: data.id }, connectsTo };
  }
  if (data.ref) {
    return { card: { id: data.id, ref: data.ref }, connectsTo };
  }
  if (kind === "action") {
    return {
      card: {
        id: data.id,
        ifWe: extractSection(body, "If we"),
        then: extractSection(body, "Then"),
        expected: extractSection(body, "Expected"),
      },
      connectsTo,
    };
  }
  const card = { id: data.id, text: body.trim() };
  return { card, connectsTo };
}

// A signal is a global workspace record (see signalModel.js) — Source/Date/Link/Author are
// all optional metadata in frontmatter, the observation itself is the body (same shape as a
// document).
export function signalToMarkdown(signal) {
  const frontmatter = {
    id: signal.id,
    source: signal.source || null,
    date: new Date(signal.date || signal.createdAt || Date.now()).toISOString(),
    link: signal.link || "",
    author: signal.author || "",
    createdAt: new Date(signal.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(signal.updatedAt || Date.now()).toISOString(),
  };
  return stringifyFrontmatter(frontmatter, signal.text || "");
}

export function markdownToSignal(content) {
  const { data, body } = parseFrontmatter(content);
  return {
    id: data.id,
    text: body.trim(),
    source: data.source || null,
    date: data.date ? new Date(data.date).getTime() : Date.now(),
    link: data.link || "",
    author: data.author || "",
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
  };
}

// An activity has no body of its own — Name/Method/Link/Date/Author are all short scalars, so
// everything fits in frontmatter (same call as boardMetaToMarkdown made for the old board
// metadata). Date/Author live here rather than on the signals it collects — see signalModel.js.
export function activityToMarkdown(activity) {
  const frontmatter = {
    id: activity.id,
    name: activity.name || "",
    method: activity.method || "",
    link: activity.link || "",
    date: new Date(activity.date || activity.createdAt || Date.now()).toISOString(),
    author: activity.author || "",
    createdAt: new Date(activity.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(activity.updatedAt || Date.now()).toISOString(),
  };
  return stringifyFrontmatter(frontmatter, "");
}

export function markdownToActivity(content) {
  const { data } = parseFrontmatter(content);
  return {
    id: data.id,
    name: data.name || "",
    method: data.method || "",
    link: data.link || "",
    date: data.date ? new Date(data.date).getTime() : Date.now(),
    author: data.author || "",
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
  };
}

// An insight is a global workspace record (see insightModel.js) — `sources` (the signal ids it
// was formed from) is scalar-enough to sit in frontmatter; the insight text itself is the body,
// same shape as a signal.
export function insightToMarkdown(insight) {
  const frontmatter = {
    id: insight.id,
    sources: insight.sources || [],
    createdAt: new Date(insight.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(insight.updatedAt || Date.now()).toISOString(),
  };
  return stringifyFrontmatter(frontmatter, insight.text || "");
}

export function markdownToInsight(content) {
  const { data, body } = parseFrontmatter(content);
  return {
    id: data.id,
    text: body.trim(),
    sources: Array.isArray(data.sources) ? data.sources : [],
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
  };
}

export function sectionMetaToMarkdown(section) {
  const frontmatter = {
    id: section.id,
    name: section.name || "",
    createdAt: new Date(section.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(section.updatedAt || Date.now()).toISOString(),
  };
  return stringifyFrontmatter(frontmatter, "");
}

export function markdownToSectionMeta(content) {
  const { data } = parseFrontmatter(content);
  return {
    id: data.id,
    name: data.name || "",
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
  };
}

export function documentToMarkdown(doc) {
  const frontmatter = {
    id: doc.id,
    title: doc.title || "",
    createdAt: new Date(doc.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(doc.updatedAt || Date.now()).toISOString(),
  };
  return stringifyFrontmatter(frontmatter, doc.body || "");
}

export function markdownToDocument(content) {
  const { data, body } = parseFrontmatter(content);
  return {
    id: data.id,
    title: data.title || "",
    body,
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
  };
}

// A spec's structured prose (Problem/Goals/Non-goals) lives in the body as headed sections,
// same trick as boardMetaToMarkdown's Goal/Target/Description — everything else (status, refs,
// checklists) is scalar/array data that belongs in frontmatter. `design`/`plan` are NOT part of
// this frontmatter — they're separate sibling files (design.md/plan.md) in the spec's own
// folder, plain markdown text with no frontmatter of their own (see storage.js).
// Everything in a spec.md body that isn't one of its three sections — text before the first heading,
// any other `##` section, a second copy of a known heading — as raw markdown, headings included. It
// isn't shown in the app, but it's written back and goes into the build brief: an agent recording
// something the format has no place for used to have it silently dropped on the next save.
const SPEC_SECTIONS = ["problem", "goals", "non-goals"];
function extraSpecSections(body) {
  const chunks = [{ title: null, lines: [] }];
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) chunks.push({ title: h[1].toLowerCase(), lines: [line] });
    else chunks[chunks.length - 1].lines.push(line);
  }
  const seen = new Set();
  return chunks
    .filter((c) => {
      if (!c.title || !SPEC_SECTIONS.includes(c.title) || seen.has(c.title)) return true;
      seen.add(c.title);
      return false;
    })
    .map((c) => c.lines.join("\n").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function specToMarkdown(spec) {
  const frontmatter = {
    id: spec.id,
    title: spec.title || "",
    status: spec.status || "draft",
    owner: spec.owner || "",
    initiativeId: spec.initiativeId || null,
    openQuestions: spec.openQuestions || [],
    acceptanceCriteria: spec.acceptanceCriteria || [],
    createdAt: new Date(spec.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(spec.updatedAt || Date.now()).toISOString(),
  };
  // Extra text from before the first heading goes back before it; extra `##` sections go after
  // Non-goals. Written anywhere else, loose text would be read back as part of Non-goals.
  const extra = (spec.extraSections || "").trim();
  const firstHeading = extra.search(/^##\s/m);
  const lead = (firstHeading === -1 ? extra : extra.slice(0, firstHeading)).trim();
  const tail = firstHeading === -1 ? "" : extra.slice(firstHeading).trim();
  const body = [
    ...(lead ? [lead, ""] : []),
    "## Problem", spec.problem || "", "",
    "## Goals", spec.goals || "", "",
    "## Non-goals", spec.nonGoals || "",
  ].join("\n");
  return stringifyFrontmatter(frontmatter, tail ? `${body}\n\n${tail}\n` : body);
}

export function markdownToSpec(content) {
  const { data, body } = parseFrontmatter(content);
  return {
    id: data.id,
    title: data.title || "",
    status: data.status || "draft",
    owner: data.owner || "",
    initiativeId: data.initiativeId || null,
    openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions : [],
    acceptanceCriteria: Array.isArray(data.acceptanceCriteria) ? data.acceptanceCriteria : [],
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
    problem: extractSection(body, "Problem"),
    goals: extractSection(body, "Goals"),
    nonGoals: extractSection(body, "Non-goals"),
    extraSections: extraSpecSections(body),
  };
}

// An initiative is a flat top-level record like a signal/insight/activity — title/status in
// frontmatter, the freeform description as the body. See initiativeModel.js.
export function initiativeToMarkdown(initiative) {
  const frontmatter = {
    id: initiative.id,
    title: initiative.title || "",
    status: initiative.status || "active",
    openQuestions: initiative.openQuestions || [],
    createdAt: new Date(initiative.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(initiative.updatedAt || Date.now()).toISOString(),
  };
  return stringifyFrontmatter(frontmatter, initiative.description || "");
}

export function markdownToInitiative(content) {
  const { data, body } = parseFrontmatter(content);
  return {
    id: data.id,
    title: data.title || "",
    status: data.status || "active",
    openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions : [],
    description: body,
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
  };
}
