import { genId } from "./boardModel.js";
import {
  boardMetaToMarkdown, markdownToBoardMeta, cardToMarkdown, markdownToCard,
  sectionMetaToMarkdown, markdownToSectionMeta, documentToMarkdown, markdownToDocument,
  specToMarkdown, markdownToSpec,
  signalToMarkdown, markdownToSignal, activityToMarkdown, markdownToActivity,
  insightToMarkdown, markdownToInsight,
  initiativeToMarkdown, markdownToInitiative,
} from "./markdown.js";
import { MONK_SCHEMA_DOC } from "./monkSchema.js";

const CARD_KINDS = ["signals", "insights", "actions", "results"];
const singular = (kind) => kind.slice(0, -1);

async function writeFile(dirHandle, name, content) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function hasFile(dirHandle, name) {
  try {
    await dirHandle.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

// Any marker file recognized below makes a folder "ours" for the safety check in
// saveWorkspace's cleanup step — a folder with none of these is left completely alone.
// `board.md` is no longer one of these: a board is never its own top-level folder anymore,
// only ever a `board/` subfolder nested inside a spec, so it doesn't need to classify anything.
async function hasAnyMarker(handle) {
  return (
    (await hasFile(handle, "section.md")) ||
    (await hasFile(handle, "spec.md"))
  );
}

// Reads a board (id/createdAt/updatedAt + its four card subfolders + derived connections) from
// whatever directory handle it lives in — today that's always a spec's own `board` subfolder.
async function loadBoardFrom(handle) {
  const boardMdFile = await handle.getFileHandle("board.md");
  const meta = markdownToBoardMeta(await (await boardMdFile.getFile()).text());
  const board = { ...meta, signals: [], insights: [], actions: [], results: [], connections: [] };

  for (const kind of CARD_KINDS) {
    let subDir;
    try {
      subDir = await handle.getDirectoryHandle(kind);
    } catch {
      continue; // no cards of this kind yet
    }
    for await (const [fname, fhandle] of subDir.entries()) {
      if (fhandle.kind !== "file" || !fname.endsWith(".md")) continue;
      const text = await (await fhandle.getFile()).text();
      const { card, connectsTo } = markdownToCard(text, singular(kind));
      board[kind].push(card);
      for (const to of connectsTo) board.connections.push({ id: genId(), from: card.id, to });
    }
  }
  return board;
}

// Writes a board into whatever directory handle it should live in, with the same stale-file
// cleanup per card kind that every other card/document collection in this file uses.
async function saveBoardTo(handle, board) {
  await writeFile(handle, "board.md", boardMetaToMarkdown(board));

  for (const kind of CARD_KINDS) {
    const items = board[kind] || [];
    const subDir = await handle.getDirectoryHandle(kind, { create: true });
    const currentNames = new Set(items.map((item) => `${item.id}.md`));
    for await (const [fname, fhandle] of subDir.entries()) {
      if (fhandle.kind === "file" && !currentNames.has(fname)) await subDir.removeEntry(fname);
    }
    for (const item of items) {
      const connectsTo = (board.connections || []).filter((c) => c.from === item.id).map((c) => c.to);
      await writeFile(subDir, `${item.id}.md`, cardToMarkdown({ ...item, connectsTo }, singular(kind)));
    }
  }
}

// Signals, Insights, Activities and Initiatives are flat, top-level, one-file-per-item
// collections — no per-item folder, no marker file of their own, just a reserved top-level
// folder name (`signals/`, `insights/`, `activities/`, `initiatives/`) that loadWorkspace/
// saveWorkspace recognize by name directly rather than by scanning for a marker file inside
// each entry (see hasAnyMarker above).
async function loadFlatCollection(dirHandle, folderName, parse) {
  const out = [];
  let subDir;
  try {
    subDir = await dirHandle.getDirectoryHandle(folderName);
  } catch {
    return out; // folder doesn't exist yet — nothing saved here so far
  }
  for await (const [fname, fhandle] of subDir.entries()) {
    if (fhandle.kind !== "file" || !fname.endsWith(".md")) continue;
    out.push(parse(await (await fhandle.getFile()).text()));
  }
  return out;
}

async function saveFlatCollection(dirHandle, folderName, items, toMarkdown) {
  const subDir = await dirHandle.getDirectoryHandle(folderName, { create: true });
  const currentNames = new Set((items || []).map((item) => `${item.id}.md`));
  for await (const [fname, fhandle] of subDir.entries()) {
    if (fhandle.kind === "file" && !currentNames.has(fname)) await subDir.removeEntry(fname);
  }
  for (const item of items || []) await writeFile(subDir, `${item.id}.md`, toMarkdown(item));
}

async function loadSection(handle) {
  const sectionMdFile = await handle.getFileHandle("section.md");
  const meta = markdownToSectionMeta(await (await sectionMdFile.getFile()).text());
  const section = { ...meta, documents: [] };

  for await (const [fname, fhandle] of handle.entries()) {
    if (fhandle.kind !== "file" || fname === "section.md" || !fname.endsWith(".md")) continue;
    section.documents.push(markdownToDocument(await (await fhandle.getFile()).text()));
  }
  return section;
}

// A spec's `design`/`plan` are two more sibling files in its own folder (design.md/plan.md) —
// always-present tabs, not optional linked documents, so they're plain markdown text with no
// frontmatter of their own (no metadata left to track once there's no independent title/id).
// `board` is a nested subfolder — the spec's Discovery tab, always present (auto-created blank),
// loaded with the same logic a top-level board folder used to use before boards moved here.
async function loadSpec(handle) {
  const specMdFile = await handle.getFileHandle("spec.md");
  const spec = markdownToSpec(await (await specMdFile.getFile()).text());
  spec.design = (await hasFile(handle, "design.md")) ? await (await (await handle.getFileHandle("design.md")).getFile()).text() : "";
  spec.plan = (await hasFile(handle, "plan.md")) ? await (await (await handle.getFileHandle("plan.md")).getFile()).text() : "";
  try {
    const boardDir = await handle.getDirectoryHandle("board");
    spec.board = await loadBoardFrom(boardDir);
  } catch {
    // a spec saved before Discovery existed, or one whose board dir hasn't been written yet —
    // treat as a fresh blank board rather than failing to load the whole spec
    spec.board = { id: spec.id, signals: [], insights: [], actions: [], results: [], connections: [] };
  }
  return spec;
}

// Workspace persistence: every section and spec is its own top-level folder in the connected
// directory, distinguished by which marker file it contains (section.md / spec.md) — anything
// with neither is left completely alone, since the connected folder might not be dedicated to
// this app (it could be a whole product repo). A spec's Discovery board lives nested inside it,
// not as its own top-level folder. No per-item dirty-tracking yet — every save rewrites
// everything it's given. Fine at personal scale.
export async function loadWorkspace(dirHandle) {
  const sections = [];
  const specs = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== "directory") continue;
    if (name === "signals" || name === "insights" || name === "activities" || name === "initiatives") continue; // handled separately below
    if (await hasFile(handle, "section.md")) {
      try {
        sections.push(await loadSection(handle));
      } catch (err) {
        console.error(`Skipping "${name}" — couldn't read it as a section folder:`, err);
      }
    } else if (await hasFile(handle, "spec.md")) {
      try {
        specs.push(await loadSpec(handle));
      } catch (err) {
        console.error(`Skipping "${name}" — couldn't read it as a spec folder:`, err);
      }
    }
    // else: not one of ours (e.g. .git, node_modules, src) — skip silently
  }
  const signals = await loadFlatCollection(dirHandle, "signals", markdownToSignal);
  const insights = await loadFlatCollection(dirHandle, "insights", markdownToInsight);
  const activities = await loadFlatCollection(dirHandle, "activities", markdownToActivity);
  const initiatives = await loadFlatCollection(dirHandle, "initiatives", markdownToInitiative);
  return { sections, specs, signals, insights, activities, initiatives };
}

export async function saveWorkspace(dirHandle, workspace) {
  const currentSectionIds = new Set((workspace.sections || []).map((s) => s.id));
  const currentSpecIds = new Set((workspace.specs || []).map((s) => s.id));
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== "directory" || name === "signals" || name === "insights" || name === "activities" || name === "initiatives") continue;
    if (currentSectionIds.has(name) || currentSpecIds.has(name)) continue;
    // Never delete anything that isn't recognizably one of our own folders — the connected
    // directory might not be dedicated to this app (it could be a whole product repo with its
    // own .git/node_modules/src), so only remove entries that actually contain one of our
    // marker files, mirroring the same check loadWorkspace uses to identify them.
    if (!(await hasAnyMarker(handle))) continue;
    await dirHandle.removeEntry(name, { recursive: true });
  }

  for (const section of workspace.sections || []) {
    const sectionDir = await dirHandle.getDirectoryHandle(section.id, { create: true });
    await writeFile(sectionDir, "section.md", sectionMetaToMarkdown(section));

    const currentDocNames = new Set(section.documents.map((d) => `${d.id}.md`));
    for await (const [fname, fhandle] of sectionDir.entries()) {
      if (fhandle.kind === "file" && fname !== "section.md" && !currentDocNames.has(fname)) {
        await sectionDir.removeEntry(fname);
      }
    }
    for (const doc of section.documents) {
      await writeFile(sectionDir, `${doc.id}.md`, documentToMarkdown(doc));
    }
  }

  for (const spec of workspace.specs || []) {
    const specDir = await dirHandle.getDirectoryHandle(spec.id, { create: true });
    await writeFile(specDir, "spec.md", specToMarkdown(spec));
    await writeFile(specDir, "design.md", spec.design || "");
    await writeFile(specDir, "plan.md", spec.plan || "");
    const boardDir = await specDir.getDirectoryHandle("board", { create: true });
    await saveBoardTo(boardDir, spec.board);
  }

  await saveFlatCollection(dirHandle, "signals", workspace.signals, signalToMarkdown);
  await saveFlatCollection(dirHandle, "insights", workspace.insights, insightToMarkdown);
  await saveFlatCollection(dirHandle, "activities", workspace.activities, activityToMarkdown);
  await saveFlatCollection(dirHandle, "initiatives", workspace.initiatives, initiativeToMarkdown);

  // A static schema/layout reference for any agent working in the folder (see monkSchema.js).
  // Written every save — it's a constant, so this just keeps it present and current. Top-level
  // files aren't touched by the cleanup loop above (it only walks directories), so nothing else
  // is needed to protect it.
  await writeFile(dirHandle, "MONK.md", MONK_SCHEMA_DOC);
}
