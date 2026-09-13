// The briefing an agent reads when it lands in a connected folder.
//
// MONK.md (monkSchema.js) is the reference — every format, every field. This is the thing that
// gets read first: what the folder is, what is safe to touch, and how to work in it while the
// app might be open. Short on purpose. Anything that is a format question belongs in MONK.md and
// is linked to rather than repeated, so the two can't drift.
//
// It's called AGENTS.md because that, and CLAUDE.md, are what agents actually look for. A file
// named after this app is only found by an agent that happens to list the directory first.

export const AGENT_MARKER_BEGIN = "<!-- monk:begin -->";
export const AGENT_MARKER_END = "<!-- monk:end -->";

export const AGENTS_DOC_BODY = `## Monk workspace

This folder holds product specs and the research behind them, as plain markdown. Every file
format is documented in \`MONK.md\` — read that before writing.

### What's here

- \`<uuid>/\` — one spec: \`spec.md\` (problem / goals / non-goals), \`solution.md\` (what's being
  built), \`plan.md\`, and \`board/\` (the signals and insights it came from)
- \`signals/\`, \`insights/\`, \`activities/\`, \`initiatives/\` — global records, one file each
- \`product-knowledge/\`, \`standards/\` — shared context that goes into every spec's build brief
- \`MONK.md\` — the schema. Generated on save; don't edit it by hand.
- \`DESIGN.md\` — optional: this product's design system, in the format at
  <https://github.com/google-labs-code/design.md>. Monk only creates it when asked, as an unfilled
  skeleton. If it's there, every build brief carries it as a contract (minus comments and empty
  sections) — so that is where tokens, type and component rules belong, not in an individual spec.
  People edit it in a structured editor, so keep its front matter to single-line \`key: value\`
  pairs (\`MONK.md\` has a complete example), and don't rely on YAML comments — an edit in the app
  drops them.

Anything else in this folder isn't Monk's, and Monk never touches it.

### Where things go

- **A finding about the product or its users** — including one you made by reading the code — is a
  signal in \`signals/\`, with a \`Codebase review\` activity as its source if that's how you found
  it. That is what the Discovery board is for.
- **A fact about how the code is built** — which function to reuse, where a pattern lives — is
  implementation grounding, and goes in that spec's \`solution.md\` Notes.
- **A decision and its reason** go in \`solution.md\` Decisions, once. Don't repeat them in open
  questions and acceptance criteria.
- **An answered open question** keeps the question in \`text\`, gets the answer in \`resolution\`, and
  is checked.
- **An acceptance criterion** is one testable statement, with no reasoning attached.
- **The work on a spec** is the task list in its \`plan.md\`. Add tasks before you build; mark one
  \`[~]\` when you start it and \`[x]\` when it's done, and record what was built and tested in
  \`solution.md\` Notes. If a task is blocked, mark it \`[!]\` and add an open question saying what's in
  the way.

### Working alongside the app

The app may be open while you work.

- It watches this folder and picks your changes up about a second after you stop writing, so
  write whole files rather than streaming into one.
- It will not overwrite a file you changed. If the same file is edited in the app, your version
  stays on disk and the app reports the divergence instead of silently resolving it.
- Folder names are identity. Renaming a spec's folder creates a new spec and orphans the old
  one — change the \`title\` in its frontmatter instead.

### Editing rules

- Frontmatter is a single line of JSON between \`---\` fences. Not YAML. The one exception is
  \`DESIGN.md\`, whose format is YAML front matter of its own.
- Leave \`id\` exactly as it is.
- Don't hard-wrap. Put every paragraph and every list item on one line; Monk shows text exactly as
  it is in the file. (A wrapped list item is joined back together when read; prose isn't.)
- A \`## Heading\` the schema doesn't recognise is kept rather than dropped. In \`solution.md\` it
  lands in Notes; in \`spec.md\` it stays below Non-goals and goes into the build brief, but the app
  doesn't show it. That's the escape hatch for something the format has no place for.
- Keep records consistent: when you settle something, update every file that still calls it open,
  such as the initiative's description.
- Set a spec's \`status\` to \`active\` when building starts, but don't mark it \`shipped\`. When the
  build is done, say so in \`solution.md\` Notes and leave that call to a person.
`;

// The standalone file, for a folder that has no agent guidance of its own yet. It carries the
// same markers as the appended section — a file we generated has to be identifiable as generated,
// or a later run cannot tell it apart from one you wrote and will never bring it up to date.
export const AGENTS_DOC = `# Working in this folder

${AGENT_MARKER_BEGIN}
${AGENTS_DOC_BODY}${AGENT_MARKER_END}`;

// The same body, fenced by markers, for appending to an AGENTS.md that already belongs to
// someone else. The markers are what let a later run update its own section without reading or
// touching a single line the repo wrote.
export const AGENTS_DOC_SECTION = `${AGENT_MARKER_BEGIN}
${AGENTS_DOC_BODY}${AGENT_MARKER_END}`;
