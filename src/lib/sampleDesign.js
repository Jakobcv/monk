// Sample design.md for the DEV-only #/design-preview route — a realistic filled-in Design tab,
// in the on-disk format lib/designModel.js reads and writes.
export const SAMPLE_DESIGN_MD = `## Artefacts

- [Bulk export — flows v3](figma.com/file/bulk-export) — design, follow direction
- [Clickable prototype](proto.monk.dev/export) — prototype, match exactly
- [Research lead persona](notion.so/research-lead) — persona, background

## Use cases

- **Primary:** Export every signal behind one insight as a shareable doc
  - Flow: Open insight → Choose Export → Pick format → Copy link
- **Secondary:** Export a filtered set of signals from Research Repository
- **Tertiary:** Re-export after edits without redoing the selection

## Principles

1. The evidence is the hero — export chrome should disappear once you've chosen.
2. Never make someone pick a format before they've seen what's included.
3. When speed and completeness conflict, favour completeness: a readout missing evidence is worse than a slow one.

## Constraints

- Reuse the existing Modal and DialogActions — no new dialog pattern
- Must be fully keyboard operable
- No server round-trip; everything is generated locally

## Experience qualities

- **Layout:** One column, preview-first. Options stay out of the way until asked for.
- **Motion:** Calm. Animate only to confirm a state change (copied, exported).

## Edge cases

- The insight has no linked signals → Disable export and say why
- A signal's text is very long → _agent decides_
- Export is triggered twice quickly → Second trigger is a no-op

## Decisions

- **Markdown is the only format in v1**
  - Because: It pastes cleanly everywhere our users write readouts.
  - Rejected: PDF — layout cost, and nobody edits a PDF.
`;
