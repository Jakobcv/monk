# Evidence Loop

A multi-board "evidence → problem → idea → result" tracker. Start page lists your boards and
lets you create new ones; each board is its own evidence/problem/idea/result grid. Vite + React.

## Setup

```bash
npm install
npm run dev
```

That's it — no accounts, no API keys.

## How persistence works

- Everything is saved to this browser's `localStorage` — one key holding every board as JSON.
- On any edit — including creating, renaming, or deleting a board — a save is debounced ~700ms.
- The top bar shows a small save-status dot: saved / saving / failed (with a manual retry link;
  `localStorage` writes essentially never fail outside quota limits or private-browsing lockouts,
  but the indicator is there either way).
- Data lives only in this browser, on this device — clearing site data or using a different
  browser/profile starts you over with the built-in demo board. It doesn't sync across devices.

## Importing / exporting a board

- **Export**: open a board and click **Export JSON** in the sidebar to download it (name, goal,
  target, all its cards and connections) as a standalone `.json` file.
- **Import**: on the start page, click **Import JSON** and pick a `.json` file — either one
  exported from here, or hand-edited (fields are validated/coerced rather than trusted as-is;
  an invalid file shows an error instead of crashing). Imported boards always get a fresh id, so
  importing the same file twice — or a file already open in another tab — just creates a copy
  rather than colliding with anything.

This pair is how you move a board across browsers/devices or back it up, since nothing syncs
automatically (see below).

## Out of scope for v1

- Multi-user / realtime collaboration, and any automatic cross-device sync.
- Save versioning/undo.
