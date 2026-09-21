# Security review

*As of 2026-09-21.*

Monk runs entirely on the machine it is opened on. It makes no network requests of its own,
stores no credentials, and its file access is confined by the browser's OS-level sandbox to one
folder the user picks by hand. No document content reaches any server, including ours.

## What it is

Monk is a single-page web app for writing product specs as plain markdown files. It is built with
React and served as static files. There is no backend, no database, no user accounts and no API
keys.

It runs in one of two ways:

- **Locally**, via `npm run app`, which builds the app and serves it at `http://localhost:4180`.
  The server binds to localhost only and is not reachable from the network.
- **As a static site** on any static host. Nothing about data handling changes: all logic runs in
  the browser tab either way.

It requires Chrome or Edge, because it depends on the File System Access API. Firefox and Safari
don't implement it, and the app reports an unsupported browser rather than failing part-way.

## Network surface

Monk makes no network requests. A search across the whole source tree finds no `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource` or `navigator.sendBeacon`. There is no telemetry, no
analytics, no crash reporting and no sign-in.

This is structural rather than a matter of policy: no document could be transmitted, because there
is no code that transmits anything.

One third-party request existed until 2026-09-21. The app loaded the Inter typeface from
`fonts.googleapis.com`, which disclosed the viewer's IP address and referring origin to Google on
page load — never file content. That font is now vendored into the repository as two WOFF2 files
under `public/fonts/` and served from the app's own origin, so the app now makes no third-party
requests at all.

Verified in a browser after the change: 97 resource requests across a full page load, every one to
`localhost`, zero external hosts.

## File system access

Monk reads and writes through the browser's File System Access API, so the sandbox is enforced by
Chrome or Edge at the OS level rather than by Monk:

- The app has no file access whatsoever until the user clicks and chooses a folder in the native OS
  picker.
- It cannot open a picker the user did not initiate, and cannot see anything above the folder
  chosen.
- Permission is scoped per browser origin and lapses when the browser restarts. The user re-grants
  with one click.
- The folder handle is kept in IndexedDB, local to that browser profile.

Within that grant, Monk narrows further in its own code. Choosing a repository yields a root and a
workspace handle (`src/lib/fsPersistence.js`); every storage call receives the workspace handle,
which points at the `monk/` subfolder. The root handle is used for exactly two things: requesting
permission, and showing the project name in the UI.

**Stated precisely, because a reviewer should have it exactly:** the browser-level grant is
read-write and recursive over the folder chosen. If a user points Monk at a repository root, Chrome
has granted that page write access to the whole tree. The restriction to `monk/` is enforced by
Monk's application code, not by the sandbox. "Monk only touches `monk/`" is a code guarantee, not
an OS guarantee.

## Supply chain

| Measure | Count |
| --- | --- |
| Production dependencies | 9 |
| Development dependencies | 5 |
| Packages installed in total | 35 |
| Packages defining install scripts | 0 |

Every dependency is mainstream and widely audited: React, CodeMirror, Lucide icons, Vite and
oxlint.

No package anywhere in the tree defines a `preinstall`, `install` or `postinstall` script. That is
the usual vector for arbitrary code execution during `npm install`, and it is absent here.

The application code contains no `eval`, no `new Function`, no `innerHTML` and no
`dangerouslySetInnerHTML`, so markdown read from disk is not a script-execution path.

## Residual risks

Three things worth weighing. None of them involve data leaving the machine.

**Folder scoping lives in application code.** As above, the sandbox grant is wider than what Monk
uses. A defect in that code could in principle write outside `monk/`. Keeping the workspace in
version control is the practical mitigation.

**Deletion has a known history.** Monk deletes folders it manages, and a partially failed load once
left it in a state where the next autosave deleted two spec folders. Three independent guards now
precede every delete (`src/lib/storage.js`): the folder must carry a Monk marker file, it must be in
the set this session actually loaded or wrote, and a save with zero sections raises an error rather
than proceeding. This is a data-loss risk rather than a confidentiality one, and version control is
again the real mitigation.

**Running Node and npm on a managed device.** Installing dependencies runs npm's resolution
machinery locally. The tree is small and free of install scripts, but if local installs are
restricted by policy, the hosted option below avoids the question entirely.

## Recommended way to run it

Deploy the static build and open it from there. Nothing is installed on the laptop — no Node, no
npm, no local server — and because the File System Access API runs client-side, files still never
leave the machine. That reduces the review to a single question: may this web page write to a
folder the user explicitly picks? Which is the right question to be asking anyway.

If it has to run locally, use `npm run app`, which serves the built files on localhost only. Avoid
`npm run dev` against real work: the dev server hot-reloads open tabs, and a tab reloading mid-save
is how the folder-deletion defect above was triggered.

For a first look, point it at a scratch folder rather than a live repository. The blast radius is
then nil regardless of how the review turns out.
