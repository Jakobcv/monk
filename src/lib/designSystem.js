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
