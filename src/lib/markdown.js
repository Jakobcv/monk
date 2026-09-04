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

function extractSection(body, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const match = body.match(re);
  return match ? match[1].trim() : "";
}

export function boardMetaToMarkdown(board) {
  const frontmatter = {
    id: board.id,
    name: board.name || "",
    status: board.status || "Not started",
    impact: board.impact || "Medium",
    method: board.method || "",
    author: board.author || "",
    createdAt: new Date(board.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(board.updatedAt || Date.now()).toISOString(),
  };
  const body = [
    "## Goal", board.goal || "", "",
    "## Target", board.target || "", "",
    "## Description", board.description || "",
  ].join("\n");
  return stringifyFrontmatter(frontmatter, body);
}

export function markdownToBoardMeta(content) {
  const { data, body } = parseFrontmatter(content);
  return {
    id: data.id,
    name: data.name || "",
    status: data.status || "Not started",
    impact: data.impact || "Medium",
    method: data.method || "",
    author: data.author || "",
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
    goal: extractSection(body, "Goal"),
    target: extractSection(body, "Target"),
    description: extractSection(body, "Description"),
  };
}

// `card` here always carries a `connectsTo` array (the outgoing edges from this card,
// derived from the board's flat `connections` list at save time — see storage.js).
export function cardToMarkdown(card, kind) {
  const frontmatter = {
    id: card.id,
    connectsTo: card.connectsTo || [],
    ref: card.ref || null,
  };
  if (kind === "signal" && !card.ref) frontmatter.type = card.type || "";

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
  if (kind === "signal") card.type = data.type || "";
  return { card, connectsTo };
}
