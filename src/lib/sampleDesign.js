// Sample design.md for the DEV-only #/design-preview and #/spec-preview routes — a realistic
// filled-in Design tab, in the on-disk format (and canonical section order) lib/designModel.js
// reads and writes.
export const SAMPLE_DESIGN_MD = `## Solution

An **Export** action on every insight card opens one dialog: a live preview of the readout on the left, and three ways out of it — copy to the clipboard, download as Markdown, or copy as plain text. Whatever leaves carries the insight, the signals behind it, and where each signal came from.

Nothing is configured up front. You see the thing, then you choose how to take it.

## Sketches

- ![Preview left, actions right](sketches/export-preview-left.svg) — Choosing a format without leaving the readout
- ![Actions under the preview](sketches/export-actions-below.svg) — Choosing a format without leaving the readout
- ![One button, format on hover](sketches/export-single-action.svg) — Choosing a format without leaving the readout

## Design principles

1. The evidence is the hero — export chrome should disappear once you've chosen.
2. Never make someone pick a format before they've seen what's included.
3. When speed and completeness conflict, favour completeness: a readout missing evidence is worse than a slow one.

## Constraints

- Reuse the existing Modal and DialogActions — no new dialog pattern
- Must be fully keyboard operable
- No server round-trip; everything is generated locally

## Decisions

- Markdown is the only format in v1 — because it pastes cleanly everywhere our users write readouts, and PDF costs layout work nobody edits afterwards
- The unit of export is one insight, not a board — a board dump is a different feature with a different audience
- Exports are a snapshot, not a live link — a shared readout that silently changes under the reader is worse than a stale one

## Artefacts

- [Export dialog, third pass](figma.com/file/bulk-export)
- [Clickable prototype of the copy flow](proto.monk.dev/export)
- [Research lead persona](notion.so/research-lead)

## Notes

Long signal bodies make the preview unwieldy — may need a collapse at around six lines. Clipboard permission is refused in some embedded contexts, so the download is the fallback, not a nicety.
`;
