# Monk

Specs and the research behind them, kept as plain markdown inside your product's repo — so the
people writing them and the coding agents building from them read the same files.

- **Research Repository** — signals (what you observed), insights formed from them, and the
  activities they came from.
- **Specs** — each with an Overview (problem, goals, non-goals, open questions, acceptance
  criteria), a Discovery board linking the signals and insights behind it, a Solution and a Plan.
  Specs can be grouped under initiatives.
- **Product Knowledge** and **Standards** — shared documents that go into every spec's build brief.
- **Design system** — an optional `DESIGN.md` in the [google-labs-code/design.md](https://github.com/google-labs-code/design.md)
  format, edited as tokens and sections, and carried into every build brief as a contract.
- **Start build** on a spec copies a build brief — Standards, Product Knowledge, the design
  system and the spec — ready to paste into an agent.

No accounts, no server, no API keys: the app reads and writes a folder you pick.

## Requirements

- Node.js and npm.
- **Chrome or Edge.** Monk needs the File System Access API. Firefox and Safari don't have it, and
  Brave turns it off by default; the app says "browser not supported" rather than failing.

```bash
npm install
```

## Using Monk alongside a product

This is the everyday setup: Monk in one browser tab, your product's own dev server and your
agent working in the product's repo.

### 1. Run the built app

```bash
npm run app
```

This builds Monk and serves the build at **http://localhost:4180**. Open it in Chrome or Edge.

> **Windows PowerShell:** if npm fails with *"running scripts is disabled on this system"*, that's
> PowerShell's execution policy blocking `npm.ps1`, not Monk. Run `npm.cmd run app` instead (or use
> Command Prompt or Git Bash). To make plain `npm` work in PowerShell for your account, run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

Use this — not `npm run dev` — whenever Monk is connected to real work. The dev server
hot-reloads every open tab when Monk's code changes, and a tab connected to your folder reloading
mid-save is exactly how a previous bug deleted spec folders. The build doesn't change until you
rebuild it: after pulling or changing Monk, stop the server, run `npm run app` again, and reload
the tab.

The port is fixed on purpose. Chrome remembers the folder you connected, and the permission to
write to it, per origin — and the port is part of the origin. If Monk ran on a different port it
would forget the folder, so rather than move it fails with "port in use" if 4180 is taken.

### 2. Connect the product's repo

On first load Monk asks for a folder. Pick the product's repo itself — `my-product/`. Monk works
in a `monk/` folder inside it, creating it if it isn't there, and never touches anything else in
the repo. The repo's name is what the breadcrumbs and the start page show, so you can always see
which project you're in.

Picking a folder that is already a Monk workspace — one named `monk`, or one with a `MONK.md` in
it — uses that folder as it is. Its project name can't be known that way (the browser can't see
above a folder you picked), so the folder's own name is shown instead; reconnect from the repo to
get the project name back.

Monk writes these into `monk/`:

```
monk/
  MONK.md              the file formats, for agents (rewritten on every save — don't edit)
  AGENTS.md            a briefing for agents working in the folder
  DESIGN.md            optional: the design system, created only when you ask
  product-knowledge/   documents shared by every spec
  standards/
  <section-id>/        your own document sections
  <spec-id>/           spec.md, solution.md, plan.md, board/
  signals/  insights/  activities/  initiatives/
```

The full format of every file is in the generated `MONK.md`.

If you do connect a folder that already has an `AGENTS.md` or `CLAUDE.md`, Monk won't touch it —
it asks whether to append a section of its own, and remembers if you say no.

### 3. Point your agent at it

Agents working at the repo root read the root's `AGENTS.md` / `CLAUDE.md`, not the one inside
`monk/`. Add a line to the repo's own file, for example:

> Product specs and the research behind them live in `monk/`. Read `monk/AGENTS.md` before
> working on a feature.

### 4. Work

- The product's dev server runs as usual — Monk never uses port 5173, so the two don't collide.
- Your agent can read and write `monk/` directly. Monk watches the folder and picks changes up
  about a second after the writing stops; if you're typing in the thing that changed, it asks
  before replacing your text.
- On a spec, **Start build** copies the build brief to paste into the agent.
- Commit `monk/` with the product's code, on your own schedule. Monk never runs git.
- After a browser restart, Monk asks you to reconnect the folder — one click.

## How saving works

- Edits save about 0.7s after you stop typing, and only files whose content changed are
  written, so a file's timestamp moves only when it really changed.
- Monk never overwrites a file that was edited outside the app since it last read it. The file
  is left as it is, the header shows the conflict, and the folder is re-read.
- It only ever deletes folders and files it loaded or wrote itself during the session. Anything
  else in the connected folder — `.git`, `node_modules`, source code, a spec an agent just
  created — is never touched.
- A failed load shows an error screen and saves nothing, so an empty workspace can never be
  written over a real one.

## Working on Monk itself

```bash
npm run dev
```

The dev server runs at **http://localhost:5180** with hot reload. Don't connect it to a folder you
care about while changing code — use a copy, or the preview routes below, which render real
pages on sample data without any folder:

| Route | Shows |
| --- | --- |
| `#/home-preview` | the start page |
| `#/spec-preview` | a spec, all tabs |
| `#/design-preview` | a spec's Solution tab |
| `#/board-preview` | a Discovery board |
| `#/research-preview` | the Research Repository |
| `#/workspace-doc-preview` | the Design system page, from empty |
| `#/initiative-preview` | an initiative, with open questions |
| `#/disk-log-preview` | the header's disk-changes log and its toast |

```bash
npm run lint
```

```bash
npm run build
```
