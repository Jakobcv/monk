# Evidence Loop

A repository for atomic research findings — Signal → Insight → Action → Result — meant to sit
next to your product's codebase as the "atomic research insights" slice of a spec-driven-design
knowledge base ([futurice.com/blog/spec-driven-design](https://www.futurice.com/blog/spec-driven-design)).
Every board is saved as plain markdown files in a folder you pick, so both humans and coding
agents can read prior research directly from the repo. Home page leads with search — check
whether the answer already exists before starting new research — with the board list right below.

## Setup

```bash
npm install
npm run dev
```

No accounts, no API keys — on first load you'll be asked to pick a folder (ideally one inside
your project's repo) where boards get saved.

**Browser requirement**: this needs the File System Access API, available in Chrome, Edge, and
other Chromium-based browsers. Firefox and Safari aren't supported.

## How persistence works

- On first load, you grant the app access to a folder. It's remembered (via IndexedDB) for next
  time — Chrome will silently reuse the granted permission unless it's lapsed (e.g. after a
  browser restart), in which case you'll see a one-click "Reconnect" prompt.
- Every board is its own subfolder (named by an internal id, so renaming a board never touches
  the folder path), containing a `board.md` plus one markdown file per card, grouped by kind:
  ```
  <your folder>/
    <board-id>/
      board.md
      signals/<card-id>.md
      insights/<card-id>.md
      actions/<card-id>.md
      results/<card-id>.md
  ```
  Each file is a small JSON frontmatter block (id, connections, cross-board reference) followed
  by the actual text — readable, diffable, grep-able like any other file in the repo.
- On any edit, a save is debounced ~700ms and rewrites the affected files. **Write-only**: the
  app never runs `git add`/`git commit` — commit your research the same way you'd commit a code
  change, on your own schedule, with your own message.
- The top bar shows a small save-status dot: saved / saving / failed (with a manual retry link).

## Cross-board references

Any card can be a *live reference* to a card in another board — found via search's "Attach to
board" action. A reference always resolves the source's current content at render time (never a
copy), shows a dashed border and a "↗ source board" link, and shows "no longer exists" gracefully
if the source is later deleted. This is how a signal, insight, action, or result from one study
gets cited in another without duplicating it.

## Importing / exporting a single board

- **Export**: open a board and click **Export JSON** in the sidebar to download it as a
  standalone `.json` file — a snapshot, separate from the markdown files on disk.
- **Import**: on the home page, click **Import JSON** and pick a `.json` file (fields are
  validated/coerced rather than trusted as-is). Imported boards always get a fresh id, so
  importing the same file twice just creates a copy.

## Out of scope for v1

- Multi-user / realtime collaboration.
- Save versioning/undo (git history covers this once you commit).
- Per-card dirty-tracking — every save currently rewrites every file for every board. Fine at
  personal scale; worth revisiting if it's ever slow with many boards.
