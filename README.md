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

## Exporting a board

Open a board and click **Export JSON** in the sidebar to download that board (name, goal,
target, all its cards and connections) as a standalone `.json` file — for backup, sharing, or
moving a board to another browser/device by hand.

## Out of scope for v1

- Import (re-loading an exported `.json` back into a board).
- Multi-user / realtime collaboration, and any cross-device sync.
- Save versioning/undo.
