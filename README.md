# Evidence Loop

A multi-board "evidence → problem → idea → result" tracker. Start page lists your boards and
lets you create new ones; each board is its own evidence/problem/idea/result grid. Vite + React,
persisted to a [JSONBin.io](https://jsonbin.io) bin. Single user, no auth — see the security note
below before you put anything sensitive in it.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a free account at [jsonbin.io](https://jsonbin.io).
3. Create a new bin and seed it with this shape — one bin holds the whole workspace (every
   board), not just one board:

   ```json
   { "boards": [] }
   ```

4. Grab the **Bin ID** and an API key (prefer a scoped Access Key limited to this one bin if
   JSONBin's dashboard offers it, so a leaked key can't touch other bins on the account — the app
   never creates additional bins, so a key scoped to just this one is enough).
5. Copy `.env.example` to `.env` and fill in both values:

   ```
   VITE_JSONBIN_BIN_ID=your-bin-id
   VITE_JSONBIN_API_KEY=your-master-or-access-key
   ```

6. Run the dev server:

   ```bash
   npm run dev
   ```

If `.env` isn't configured yet, the app still loads (falling back to a built-in demo board) but
shows "Save failed" in the top bar since there's nowhere to persist to.

## Security note

The JSONBin key ships in the client-side JS bundle — Vite `import.meta.env.VITE_*` vars are
inlined at build time, not secret. That's an accepted tradeoff for a single-user personal tool.
Don't reuse this key for anything else, and don't put anything sensitive in the bin.

## How persistence works

- On load, the app fetches the bin and populates the board list; if the fetch fails or the bin
  is empty, it falls back to a single local demo board instead.
- On any edit — including creating, renaming, or deleting a board — a save is debounced ~700ms
  and PUTs the whole workspace (every board) back as one JSON document.
- The top bar shows a small save-status dot: saved / saving / failed (with a manual retry link).

## Out of scope for v1

- Multi-user / realtime collaboration (two tabs editing at once will overwrite each other).
- Auth — anyone with the bin ID + key can read/write it.
- Offline support and save versioning/undo.
