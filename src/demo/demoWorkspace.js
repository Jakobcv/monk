import { memoryFolder } from "../lib/memoryFolder.js";
import { MONK_SCHEMA_DOC } from "../lib/monkSchema.js";
import { AGENTS_DOC } from "../lib/agentsDoc.js";
import { WORKSPACE_DOCS } from "../lib/workspaceDocs.js";

// The demo's workspace, as a folder in memory for App.jsx to load like any other (see
// lib/memoryFolder.js). This is the one seam between the demo and what is in it: the app only
// ever calls openDemoFolder().
//
// What is in it is ./larder — Larder, a fictional household grocery app, written as an ordinary
// Monk folder. To change it, connect that folder in Monk (npm run dev, a scratch copy is safest)
// and edit it like any workspace; everything in it is bundled as text. Keep its ids as they are: a
// reload restarts the demo, and a changed id breaks the link the person reloaded on.
//
// This module is only ever imported dynamically, when the demo opens, so a person working in their
// own folder never downloads any of it.

// Record files, sketches and sources. MONK.md and AGENTS.md are left out even if Monk has written
// them into the folder while someone edited it: they come from the app's own constants below, so
// the demo never carries a stale copy (which the first save would then rewrite, and count as the
// person's first change).
const FOLDER = import.meta.glob(["./larder/**/*", "!./larder/MONK.md", "!./larder/AGENTS.md"], {
  query: "?raw", import: "default", eager: true,
});

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g;

// Every timestamp moves by the same amount, so the newest record lands on the moment the demo
// opens and everything else keeps its distance from it — a demo whose latest activity was months
// ago reads as abandoned. Only the frontmatter line is touched; prose is left alone.
function shiftDates(files) {
  const frontmatter = (text) => (text.startsWith("---\n{") ? text.split("\n", 2)[1] : null);
  let newest = 0;
  for (const text of Object.values(files)) {
    const line = frontmatter(text);
    for (const iso of (line && line.match(ISO)) || []) newest = Math.max(newest, Date.parse(iso));
  }
  const by = newest ? Date.now() - newest : 0;
  return Object.fromEntries(Object.entries(files).map(([path, text]) => {
    const line = frontmatter(text);
    if (!line) return [path, text];
    const moved = line.replace(ISO, (iso) => new Date(Date.parse(iso) + by).toISOString());
    return [path, text.replace(line, moved)];
  }));
}

export async function openDemoFolder() {
  // LF throughout, whatever a checkout did to the line endings: the app writes LF, and a file that
  // differs from what it would write gets rewritten on the first save.
  const files = Object.fromEntries(Object.entries(FOLDER).map(([path, text]) => [path.slice("./larder/".length), text.replace(/\r\n/g, "\n")]));
  return memoryFolder("larder", {
    // Seeded documents (WRITING.md) as the app writes them on attach, unless the folder has its own.
    ...Object.fromEntries(WORKSPACE_DOCS.filter((d) => d.seeded).map((d) => [d.file, d.template({})])),
    ...shiftDates(files),
    "MONK.md": MONK_SCHEMA_DOC,
    "AGENTS.md": AGENTS_DOC,
  });
}
