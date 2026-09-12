// DESIGN.md — the workspace's design system, in the format at github.com/google-labs-code/design.md:
// design tokens as YAML front matter (`name` is the one required key), then `##` sections of prose
// in a fixed order, any of which may be left out. The structured model and its parser live in
// designSystemModel.js; this file holds what the rest of the app needs from it.
import { blankDesignSystem, serializeDesignSystem, DESIGN_SECTIONS as SECTIONS } from "./designSystemModel.js";

export const DESIGN_SECTIONS = SECTIONS.map((s) => s.title);

// What Create writes: the required front matter and every section heading, nothing chosen. `name`
// is filled with the folder's name because the format requires one; it's a placeholder you can
// see and change, not a decision about how anything looks. The editor supplies the guidance a
// template used to carry in comments.
export function designSystemTemplate(name) {
  return serializeDesignSystem(blankDesignSystem(name || "Design system"));
}

const FRONT_MATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

// What of a DESIGN.md is worth an agent's attention: front matter without its comment lines, and
// only the sections that have something written under them. Returns "" when nothing is left —
// only `version` and `name` in the front matter and no section with content — which is what an
// unfilled file reduces to, so the brief can leave the design system out entirely.
export function designSystemForBrief(md) {
  const text = (md || "").replace(/\r\n?/g, "\n");
  const match = text.match(FRONT_MATTER);
  const frontLines = match
    ? match[1].split("\n").filter((line) => line.trim() && !/^\s*#/.test(line))
    : [];
  const hasTokens = frontLines.some((line) => !/^(version|name)\s*:/.test(line));

  const body = (match ? text.slice(match[0].length) : text).replace(/<!--[\s\S]*?-->/g, "");
  // Split at `## ` headings only — a `###` inside a section belongs to that section.
  const kept = body
    .split(/^(?=## )/m)
    .filter((part) => {
      const content = part.startsWith("## ") ? part.slice(part.indexOf("\n") + 1 || part.length) : part;
      return content.trim();
    })
    .map((part) => part.trim().replace(/\n{3,}/g, "\n\n"));

  if (!hasTokens && !kept.length) return "";
  const front = frontLines.length ? `---\n${frontLines.join("\n")}\n---\n\n` : "";
  return `${front}${kept.join("\n\n")}`.trim() + "\n";
}
