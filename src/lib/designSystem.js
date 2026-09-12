// DESIGN.md — the workspace's design system, in the format at github.com/google-labs-code/design.md:
// design tokens as YAML front matter (`name` is the one required key), then `##` sections of prose
// in a fixed order, any of which may be left out.
//
// Two things live here. The skeleton the app writes when you ask it to create one — the structure
// and some guidance, but no values, because a visual language is decided rather than generated.
// And the reduction the build brief applies before handing the file to an agent: guidance comments
// and sections nobody has written in yet are dropped, so an untouched skeleton contributes nothing
// instead of arriving in a brief as a contract made of placeholders.

export const DESIGN_SECTIONS = [
  "Overview",
  "Colors",
  "Typography",
  "Layout",
  "Elevation & Depth",
  "Shapes",
  "Components",
  "Do's and Don'ts",
];

const SECTION_GUIDANCE = {
  "Overview": "Who the product is for and how it should feel, in a few sentences.",
  "Colors": "What each colour is for, not just its value. Which one signals interaction?",
  "Typography": "The type scale, and when each step is used.",
  "Layout": "Grid, spacing rhythm, breakpoints, and how dense a screen should be.",
  "Elevation & Depth": "How surfaces stack: shadows, borders, overlays.",
  "Shapes": "Corner radii and the shape language.",
  "Components": "Rules for shared components: states, variants, what never to build twice.",
  "Do's and Don'ts": "The mistakes you most want an agent to avoid.",
};

// Token examples are commented out, not filled in: YAML comments are invisible to anything that
// parses the file, so the skeleton is valid DESIGN.md from the first save and asserts nothing.
// `name` is filled in because the format requires it; the folder's name is a placeholder you can
// see and change, not a decision about how anything looks.
export function designSystemTemplate(name) {
  return `---
version: alpha
name: ${JSON.stringify(name || "Design system")}
# Tokens. Uncomment the groups you use and choose the values. A component can
# refer to another token as "{colors.primary}".
# Format: https://github.com/google-labs-code/design.md
#
# colors:
#   primary: "#1A1C1E"
#   neutral: "#F7F5F2"
# typography:
#   body-md:
#     fontFamily: Inter
#     fontSize: 1rem
#     lineHeight: 1.5
# rounded:
#   sm: 4px
#   md: 8px
# spacing:
#   sm: 8px
#   md: 16px
# components:
#   button-primary:
#     backgroundColor: "{colors.primary}"
#     textColor: "{colors.neutral}"
#     rounded: "{rounded.sm}"
---
${DESIGN_SECTIONS.map((title) => `
## ${title}

<!-- ${SECTION_GUIDANCE[title]} -->
`).join("")}`;
}

const FRONT_MATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

// What of a DESIGN.md is worth an agent's attention: front matter without its comment lines, and
// only the sections that have something written under them. Returns "" when nothing is left —
// only `version` and `name` in the front matter and no section with content — which is what an
// unfilled skeleton reduces to, so the brief can leave the design system out entirely.
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
