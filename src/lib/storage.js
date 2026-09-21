import { genId } from "./boardModel.js";
import {
  boardMetaToMarkdown, markdownToBoardMeta, cardToMarkdown, markdownToCard,
  sectionMetaToMarkdown, markdownToSectionMeta, documentToMarkdown, markdownToDocument,
  specToMarkdown, markdownToSpec,
  signalToMarkdown, markdownToSignal, markdownToActivity,
  insightToMarkdown, markdownToInsight,
  initiativeToMarkdown, markdownToInitiative,
  researchPlanToMarkdown, markdownToResearchPlan, } from "./markdown.js";
import { MONK_SCHEMA_DOC } from "./monkSchema.js";
import { migrateActivities } from "./migrateActivities.js";
import { AGENTS_DOC, AGENTS_DOC_SECTION, AGENT_MARKER_BEGIN, AGENT_MARKER_END } from "./agentsDoc.js";
import { WORKSPACE_DOCS, workspaceDocById, workspaceDocByFile } from "./workspaceDocs.js";

const CARD_KINDS = ["signals", "insights", "actions", "results"];
const singular = (kind) => kind.slice(0, -1);

// ---------------------------------------------------------------------------
// What this session has actually put on disk.
//
// A save used to rewrite every file it was given, every time: one keystroke in one spec rewrote
// the whole folder — 273 files for a workspace the size of the sample one, every 700ms while you
// type. That is wasteful, but the real cost is that it made the folder unreadable as a shared
// space. Every file's timestamp moved on every save, so "has something else changed this?" had
// no answer, and anything an agent (or your editor, or git) wrote between two keystrokes was
// gone without a trace.
//
// `written` is the fix: path → the exact text we last wrote there. A save now compares and skips
// what matches, so a file's mtime moves only when its content really changed, and a file we did
// not write is visibly not ours. On the first save of a session a path is absent from the map,
// so it is read from disk once to decide — which seeds the map from what is actually there
// rather than from what we assume.
//
// `managed` is the same idea for folders and collection files: the ids we loaded, plus the ids
// we have written since. The cleanup pass is only allowed to delete from this set, so a spec
// folder that appeared while we were running — created by an agent, restored from git — is never
// ours to remove. It used to delete any folder carrying a marker file that wasn't in memory,
// recursively, which meant a spec written next to a running app survived exactly until the next
// keystroke.
//
// Both are per-connected-folder and reset by loadWorkspace.
// ---------------------------------------------------------------------------
let written = new Map();
let managed = new Set();
// Paths this save refused to overwrite. Reset at the top of every saveWorkspace.
let conflicts = [];

// Every write in a save funnels through here so a refusal is recorded rather than swallowed.
async function put(dirHandle, name, content, path) {
  const result = await writeFile(dirHandle, name, content, path);
  if (result === "conflict") conflicts.push(path || name);
  return result;
}

function resetLedger() {
  written = new Map();
  managed = new Set();
  conflicts = [];
}

async function readFileOrNull(dirHandle, name) {
  try {
    return await (await (await dirHandle.getFileHandle(name)).getFile()).text();
  } catch {
    return null;
  }
}

// Reading a file *is* learning what is on disk, so loading records it. The ledger used to be
// filled lazily, on the first attempt to write each path, and a path it had never seen was
// treated as "first save of the session — go ahead". That is the right call when a folder has
// just been attached. It is the wrong one immediately after the watcher reloads, because
// loadWorkspace resets the ledger: for one save afterwards every file looked untouched, and a
// page still holding pre-reload text could write straight over whatever had just arrived —
// precisely the overwrite the conflict guard exists to refuse. Seeding here costs nothing: the
// bytes are already in hand, and they were being thrown away.
function recordRead(path, text) {
  written.set(path, text);
  return text;
}

async function readAndRecord(dirHandle, name, path) {
  return recordRead(path, await (await (await dirHandle.getFileHandle(name)).getFile()).text());
}

// Writes only when the bytes would actually differ, and never over someone else's edit. `path`
// is the file's place in the workspace ("<spec-id>/design.md"), which is what the ledger is keyed
// by — `name` alone is ambiguous, half the folder is called design.md.
//
// Returns "written", "unchanged", or "conflict". A conflict means the file on disk is neither
// what we last put there nor what we are about to write: something else has edited it since, and
// this save is not entitled to decide whose version wins. The file is left exactly as it is and
// the path is reported up to saveWorkspace's caller.
async function writeFile(dirHandle, name, content, path) {
  const key = path || name;
  const ours = written.get(key);

  if (ours === content) return "unchanged";

  // A read before every real write. That was unaffordable when a save wrote the whole folder;
  // now that a save writes one or two files it costs nothing, and it is the only way to know
  // whether the copy on disk is still the one we left there.
  const onDisk = await readFileOrNull(dirHandle, name);
  if (onDisk === content) {
    written.set(key, content);   // someone (or a previous session) already wrote exactly this
    return "unchanged";
  }
  if (ours !== undefined && onDisk !== null && onDisk !== ours) return "conflict";
  // ours === undefined means the first save of a session: the file predates us and we have no
  // claim to it being untouched, so writing is the documented behaviour — the app's in-memory
  // copy came from that same file moments ago.

  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  written.set(key, content);
  return "written";
}

// Removing a file has to clear its ledger entry too, or a later file at the same path would be
// compared against the content of the one that used to be there and skipped.
async function removeFile(dirHandle, name, path) {
  await dirHandle.removeEntry(name);
  written.delete(path || name);
}

async function hasDirectory(dirHandle, name) {
  try {
    await dirHandle.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

// Records every .md under a folder in the ledger without parsing it — for a folder that is about to
// be removed, so the watcher doesn't report its files as new while it's still there.
async function recordTree(handle, base) {
  for await (const [name, child] of handle.entries()) {
    const path = `${base}/${name}`;
    if (child.kind === "directory") await recordTree(child, path);
    else if (name.endsWith(".md")) recordRead(path, await (await child.getFile()).text());
  }
}

async function hasFile(dirHandle, name) {
  try {
    await dirHandle.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

// Resolves a "/"-joined record base path ("<spec-id>", "research-plans/<id>",
// "initiatives/<id>") into its directory handle, creating any folder along the way that isn't
// there yet — an initiative is normally a flat file with no folder of its own, so its first
// upload is what creates one.
async function getRecordDir(dirHandle, base, { create = false } = {}) {
  let handle = dirHandle;
  for (const part of base.split("/")) handle = await handle.getDirectoryHandle(part, { create });
  return handle;
}

// A name not already taken in `dirHandle` — `name` itself if free, else "name (2).ext",
// "name (3).ext", and so on, the same way a browser dedupes a second download of the same file.
async function uniqueFileName(dirHandle, name) {
  if (!(await hasFile(dirHandle, name))) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot <= 0 ? name : name.slice(0, dot);
  const ext = dot <= 0 ? "" : name.slice(dot);
  for (let i = 2; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!(await hasFile(dirHandle, candidate))) return candidate;
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
async function loadBoardFrom(handle, base) {
  const meta = markdownToBoardMeta(await readAndRecord(handle, "board.md", `${base}/board.md`));
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
      const text = recordRead(`${base}/${kind}/${fname}`, await (await fhandle.getFile()).text());
      const { card, connectsTo } = markdownToCard(text, singular(kind));
      board[kind].push(card);
      for (const to of connectsTo) board.connections.push({ id: genId(), from: card.id, to });
    }
  }
  return board;
}

// Writes a board into whatever directory handle it should live in, with the same stale-file
// cleanup per card kind that every other card/document collection in this file uses.
async function saveBoardTo(handle, board, base) {
  await put(handle, "board.md", boardMetaToMarkdown(board), `${base}/board.md`);

  for (const kind of CARD_KINDS) {
    const items = board[kind] || [];
    const subDir = await handle.getDirectoryHandle(kind, { create: true });
    const currentNames = new Set(items.map((item) => `${item.id}.md`));
    for await (const [fname, fhandle] of subDir.entries()) {
      const path = `${base}/${kind}/${fname}`;
      // Only cards this session put there: a card file that appeared underneath us belongs to
      // whoever wrote it.
      if (fhandle.kind === "file" && !currentNames.has(fname) && managed.has(path)) {
        await removeFile(subDir, fname, path);
        managed.delete(path);
      }
    }
    for (const item of items) {
      const connectsTo = (board.connections || []).filter((c) => c.from === item.id).map((c) => c.to);
      const path = `${base}/${kind}/${item.id}.md`;
      await put(subDir, `${item.id}.md`, cardToMarkdown({ ...item, connectsTo }, singular(kind)), path);
      managed.add(path);
    }
  }
}

// Signals, Insights, Activities, Initiatives and Research plans are flat, top-level,
// one-file-per-item collections — no per-item folder, no marker file of their own, just a
// reserved top-level folder name (FLAT_COLLECTIONS, below) that loadWorkspace/
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
    out.push(parse(recordRead(`${folderName}/${fname}`, await (await fhandle.getFile()).text())));
  }
  return out;
}

// Removes an initiative's `<id>/sources/` folder once the initiative itself is gone — the one
// per-record folder that isn't already covered by the top-level marker-file cleanup in
// saveWorkspace (an initiative has no marker file; it's a flat record that only grows a folder
// once a file is uploaded to it). Same managed-and-current rule as everywhere else in this file.
async function cleanupInitiativeFolders(dirHandle, initiatives, held) {
  let initiativesDir;
  try { initiativesDir = await dirHandle.getDirectoryHandle("initiatives"); } catch { return; }
  const current = new Set((initiatives || []).map((i) => i.id));
  for await (const [name, handle] of initiativesDir.entries()) {
    if (handle.kind !== "directory") continue;
    const path = `initiatives/${name}`;
    if (current.has(name) || held.has(name) || !managed.has(path)) continue;
    await initiativesDir.removeEntry(name, { recursive: true });
    managed.delete(path);
    for (const key of [...written.keys()]) if (key.startsWith(`${path}/`)) written.delete(key);
  }
}

async function saveFlatCollection(dirHandle, folderName, items, toMarkdown, held = new Set()) {
  const subDir = await dirHandle.getDirectoryHandle(folderName, { create: true });
  const currentNames = new Set((items || []).map((item) => `${item.id}.md`));
  for await (const [fname, fhandle] of subDir.entries()) {
    const path = `${folderName}/${fname}`;
    if (fhandle.kind === "file" && !currentNames.has(fname) && managed.has(path)) {
      await removeFile(subDir, fname, path);
      managed.delete(path);
    }
  }
  for (const item of items || []) {
    if (held.has(item.id)) continue;
    const path = `${folderName}/${item.id}.md`;
    await put(subDir, `${item.id}.md`, toMarkdown(item), path);
    managed.add(path);
  }
}

// A research plan's board — its Analysis tab — lives in a folder beside the plan's own file:
// `research-plans/<id>/board/`, the same layout a spec's board used to have. Its `id` is always the
// plan's, which is what a card `ref`'s `boardId` names.
async function loadPlanBoard(plansDir, id) {
  const base = `research-plans/${id}/board`;
  try {
    const board = await loadBoardFrom(await (await plansDir.getDirectoryHandle(id)).getDirectoryHandle("board"), base);
    managed.add(`research-plans/${id}`);
    return { ...board, id };
  } catch {
    // Not written yet — a plan from before boards moved here, or one just created. The timestamps
    // are stamped once here rather than left to the serializer, which would default a missing one to
    // Date.now() on every call and rewrite board.md on every save.
    const now = Date.now();
    return { id, createdAt: now, updatedAt: now, signals: [], insights: [], actions: [], results: [], connections: [] };
  }
}

// Writes each plan's board, and removes the board folder of a plan that's gone — only if this
// session loaded or wrote it, the same rule as every other removal here.
async function savePlanBoards(dirHandle, plans, held) {
  const plansDir = await dirHandle.getDirectoryHandle("research-plans", { create: true });
  const current = new Set(plans.map((p) => p.id));
  for await (const [name, handle] of plansDir.entries()) {
    const path = `research-plans/${name}`;
    if (handle.kind !== "directory" || current.has(name) || !managed.has(path)) continue;
    await plansDir.removeEntry(name, { recursive: true });
    managed.delete(path);
    for (const key of [...written.keys()]) if (key.startsWith(`${path}/`)) written.delete(key);
  }
  for (const plan of plans) {
    if (held.has(plan.id) || !plan.board) continue;
    const planDir = await plansDir.getDirectoryHandle(plan.id, { create: true });
    const boardDir = await planDir.getDirectoryHandle("board", { create: true });
    await saveBoardTo(boardDir, { ...plan.board, id: plan.id }, `research-plans/${plan.id}/board`);
    managed.add(`research-plans/${plan.id}`);
  }
}

// Where the original of every activity file Monk migrates ends up. No marker file and not a
// reserved name, so after the move nothing here reads, writes or deletes it again.
export const MIGRATED_ACTIVITIES_DIR = "_migrated-activities";

// Moves each migrated activity's file out of `activities/` into MIGRATED_ACTIVITIES_DIR, byte for
// byte, once the research plans and signals that replace it are on disk (see saveWorkspace). Moved
// rather than deleted: this removes files that hold the only copy of what they say until the
// migration is committed, and keeping a copy costs nothing. Only files this session loaded and that
// still hold what was loaded — an activity edited on disk since is left where it is, and the next
// load migrates the newer version.
async function retireActivities(dirHandle, ids) {
  let activitiesDir;
  try {
    activitiesDir = await dirHandle.getDirectoryHandle("activities");
  } catch {
    return;
  }
  let backupDir = null;
  let moved = 0;
  for (const id of ids) {
    const name = `${id}.md`;
    const path = `activities/${name}`;
    if (!managed.has(path)) continue;
    const text = await readFileOrNull(activitiesDir, name);
    if (text === null) {
      managed.delete(path);
      written.delete(path);
      continue;
    }
    if (written.get(path) !== text) continue;
    backupDir ??= await dirHandle.getDirectoryHandle(MIGRATED_ACTIVITIES_DIR, { create: true });
    // Never over a different file of the same name — a second migration of the same id, say.
    const existing = await readFileOrNull(backupDir, name);
    const backupName = existing === null || existing === text ? name : `${id}.${Date.now()}.md`;
    const writable = await (await backupDir.getFileHandle(backupName, { create: true })).createWritable();
    await writable.write(text);
    await writable.close();
    await removeFile(activitiesDir, name, path);
    managed.delete(path);
    moved++;
  }
  if (moved && (await activitiesDir.entries().next()).done) {
    await dirHandle.removeEntry("activities");
  }
}

async function loadSection(handle, base) {
  const meta = markdownToSectionMeta(await readAndRecord(handle, "section.md", `${base}/section.md`));
  const section = { ...meta, documents: [] };

  for await (const [fname, fhandle] of handle.entries()) {
    if (fhandle.kind !== "file" || fname === "section.md" || !fname.endsWith(".md")) continue;
    const text = recordRead(`${base}/${fname}`, await (await fhandle.getFile()).text());
    section.documents.push(markdownToDocument(text));
  }
  return section;
}

// A spec's `design`/`plan` are two more sibling files in its own folder (design.md/plan.md) —
// always-present tabs, not optional linked documents, so they're plain markdown text with no
// frontmatter of their own (no metadata left to track once there's no independent title/id).
// The Solution tab's file. It was `design.md` until DESIGN.md came to mean something else
// entirely — a workspace's design system, tokens and all (see google-labs-code/design.md) — which
// is a different document with a different author and a different reader. The tab had already
// been called Solution for a while; the file just hadn't caught up. A spec still holding the old
// name is read from it and written back to the new one on the next save, and the old file is
// removed only once the new one exists.
const SOLUTION_FILE = "solution.md";
const LEGACY_SOLUTION_FILE = "design.md";

async function loadSpec(handle, base) {
  const spec = markdownToSpec(await readAndRecord(handle, "spec.md", `${base}/spec.md`));
  spec.design = (await hasFile(handle, SOLUTION_FILE))
    ? await readAndRecord(handle, SOLUTION_FILE, `${base}/${SOLUTION_FILE}`)
    : (await hasFile(handle, LEGACY_SOLUTION_FILE))
      ? await readAndRecord(handle, LEGACY_SOLUTION_FILE, `${base}/${LEGACY_SOLUTION_FILE}`)
      : "";
  spec.plan = (await hasFile(handle, "plan.md")) ? await readAndRecord(handle, "plan.md", `${base}/plan.md`) : "";
  // Specs no longer have a board: the board moved to research plans, and spec boards were retired
  // rather than migrated. One left over from before is read into the ledger — so the watcher doesn't
  // report its files as new — and marked as ours, so saveWorkspace removes it.
  if (await hasDirectory(handle, "board")) {
    await recordTree(await handle.getDirectoryHandle("board"), `${base}/board`);
    managed.add(`${base}/board`);
  }
  return spec;
}

// Workspace persistence: every section and spec is its own top-level folder in the connected
// directory, distinguished by which marker file it contains (section.md / spec.md) — anything
// with neither is left completely alone, since the connected folder might not be dedicated to
// this app (it could be a whole product repo). Boards live inside research plans' folders
// (see loadPlanBoard), never at the top level.
export async function loadWorkspace(dirHandle) {
  // A fresh connection — nothing on disk is ours until we have read or written it.
  resetLedger();
  const sections = [];
  const specs = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== "directory") continue;
    if (FLAT_COLLECTIONS.includes(name)) continue; // handled separately below
    if (await hasFile(handle, "section.md")) {
      try {
        sections.push(await loadSection(handle, name));
        managed.add(name);
      } catch (err) {
        console.error(`Skipping "${name}" — couldn't read it as a section folder:`, err);
      }
    } else if (await hasFile(handle, "spec.md")) {
      try {
        specs.push(await loadSpec(handle, name));
        managed.add(name);
      } catch (err) {
        console.error(`Skipping "${name}" — couldn't read it as a spec folder:`, err);
      }
    }
    // else: not one of ours (e.g. .git, node_modules, src) — skip silently
  }
  // Workspace documents (workspaceDocs.js) — DESIGN.md today. Optional files at the root, read if
  // they're there. `null` means there isn't one, which is not the same as one that exists and is
  // empty: the first gets a Create button, the second an editor.
  const docs = {};
  for (const doc of WORKSPACE_DOCS) {
    const text = await readFileOrNull(dirHandle, doc.file);
    if (text !== null) recordRead(doc.file, text);
    docs[doc.id] = text;
  }

  const signals = await loadFlatCollection(dirHandle, "signals", markdownToSignal);
  const insights = await loadFlatCollection(dirHandle, "insights", markdownToInsight);
  // Legacy: activities are read only to be folded into research plans (migrateActivities.js).
  const activities = (await loadFlatCollection(dirHandle, "activities", markdownToActivity)).filter((a) => a.id);
  const initiatives = await loadFlatCollection(dirHandle, "initiatives", markdownToInitiative);
  const researchPlans = await loadFlatCollection(dirHandle, "research-plans", markdownToResearchPlan);
  for (const [folder, items] of [["signals", signals], ["insights", insights], ["activities", activities], ["initiatives", initiatives], ["research-plans", researchPlans]]) {
    for (const item of items) managed.add(`${folder}/${item.id}.md`);
  }
  // An initiative with uploaded sources also has a folder beside its flat file (see
  // uploadSourceFile) — mark it managed the same way a spec or section folder is, so a later save
  // knows it's this session's to clean up if the initiative is deleted.
  try {
    const initiativesDir = await dirHandle.getDirectoryHandle("initiatives");
    for (const initiative of initiatives) {
      if (await hasDirectory(initiativesDir, initiative.id)) managed.add(`initiatives/${initiative.id}`);
    }
  } catch { /* no initiatives folder yet */ }
  let plansDir = null;
  try { plansDir = await dirHandle.getDirectoryHandle("research-plans"); } catch { /* no plans yet */ }
  for (const plan of researchPlans) plan.board = await loadPlanBoard(plansDir, plan.id);

  // In memory only. Nothing is written until the caller saves; `retiredActivityIds` tells that save
  // which old files to move once the migrated plans and signals are on disk.
  const migrated = migrateActivities({ activities, signals, researchPlans });
  return {
    sections, specs, insights, initiatives, docs,
    signals: migrated.signals,
    researchPlans: migrated.researchPlans,
    retiredActivityIds: migrated.retiredActivityIds,
    // `specBoards`: spec board folders found, which the next save removes (see loadSpec).
    migration: { ...migrated.report, specBoards: specs.filter((s) => managed.has(`${s.id}/board`)).length },
  };
}

// Creating a workspace document is always an explicit request, so it is its own call rather than
// something a save infers from state. If the file has turned up in the meantime — an agent wrote
// one, you did in an editor — that one wins and is returned instead: "create" never means
// "replace". Returns { created, text }.
export async function createWorkspaceDoc(dirHandle, id, content) {
  const doc = workspaceDocById(id);
  if (!doc) throw new Error(`Unknown workspace document: ${id}`);
  const existing = await readFileOrNull(dirHandle, doc.file);
  if (existing !== null) return { created: false, text: recordRead(doc.file, existing) };
  written.delete(doc.file);
  await writeFile(dirHandle, doc.file, content, doc.file);
  return { created: true, text: content };
}

// Removing one is allowed only while the file on disk is still the version the app last read or
// wrote — the one you were looking at when you chose to remove it. If something else has edited it
// since, the removal is refused and the file stays: that edit hasn't been seen, so it isn't ours to
// throw away. Returns "removed", "missing" (already gone) or "conflict".
export async function removeWorkspaceDoc(dirHandle, id) {
  const doc = workspaceDocById(id);
  if (!doc) throw new Error(`Unknown workspace document: ${id}`);
  const onDisk = await readFileOrNull(dirHandle, doc.file);
  if (onDisk === null) {
    written.delete(doc.file);
    return "missing";
  }
  if (!written.has(doc.file) || written.get(doc.file) !== onDisk) return "conflict";
  await removeFile(dirHandle, doc.file, doc.file);
  return "removed";
}

// ---------------------------------------------------------------------------
// A record's uploaded sources — files that live in `<base>/sources/`, beside its own file(s)
// (`base` is "<spec-id>", "research-plans/<id>" or "initiatives/<id>"; the last has no folder of
// its own otherwise, and gets one the moment a file lands in it — see getRecordDir).
//
// Upload and removal are explicit, immediate calls, the same way createWorkspaceDoc and
// removeWorkspaceDoc are: binary content shouldn't sit waiting on the debounced text autosave,
// and the ledger's written-bytes conflict check (writeFile, above) exists for text files that get
// re-diffed on every keystroke, not for a file dropped in once. The record's `sources` list
// itself — which names the file — is ordinary state, saved the normal way through saveWorkspace.
// ---------------------------------------------------------------------------

// Writes `file` into the record's sources folder, deduping its name if one's already there.
// Returns the name it was actually saved under — what the caller stores in the record's
// `sources` array (sourceModel.js `fileSource`).
export async function uploadSourceFile(dirHandle, base, file) {
  const recordDir = await getRecordDir(dirHandle, base, { create: true });
  const sourcesDir = await recordDir.getDirectoryHandle("sources", { create: true });
  const name = await uniqueFileName(sourcesDir, file.name || "Untitled");
  const writable = await (await sourcesDir.getFileHandle(name, { create: true })).createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
  managed.add(base); // a fresh initiative folder wasn't managed until this upload created it
  return name;
}

// Deletes one uploaded file. Quiet about a file (or folder) that's already gone — removing a
// source that was already removed from disk is not an error, just a no-op.
export async function removeSourceFile(dirHandle, base, name) {
  try {
    const recordDir = await getRecordDir(dirHandle, base);
    const sourcesDir = await recordDir.getDirectoryHandle("sources");
    await sourcesDir.removeEntry(name);
  } catch { /* already gone */ }
}

// Reads one uploaded file's bytes back, for opening it (App.jsx turns the returned File into a
// blob URL). Throws if it's gone — the caller decides how to tell the user.
export async function readSourceFile(dirHandle, base, name) {
  const recordDir = await getRecordDir(dirHandle, base);
  const sourcesDir = await recordDir.getDirectoryHandle("sources");
  return await (await sourcesDir.getFileHandle(name)).getFile();
}

// Which entities a set of changed paths belongs to. A spec or section is its own top-level
// folder; the flat records are one file each inside a collection folder. Module scope because it
// closes over nothing — inside the component it was a new function every render, which the
// watcher effect would then have to list as a dependency and be torn down for.
// Also the one list of reserved folder names: load, save and the watcher all read it, so a new
// collection can't be recognised in one place and swept up as a stray folder in another.
// `activities` is legacy — never written — but stays reserved so an old-format file that turns up
// (an agent, a checkout of an older branch) is noticed and migrated rather than ignored.
export const FLAT_COLLECTIONS = ["signals", "insights", "activities", "initiatives", "research-plans"];
export function entityIdsFor(paths) {
  const ids = new Set();
  for (const path of paths) {
    const [head, second] = path.split("/");
    if (FLAT_COLLECTIONS.includes(head)) {
      if (second && second.endsWith(".md")) ids.add(second.slice(0, -3));
      else if (head === "research-plans" && second) ids.add(second); // a plan's board folder
    } else if (second) {
      ids.add(head);
    } else {
      const doc = workspaceDocByFile(head); // a workspace document is one file at the root
      if (doc) ids.add(doc.id);
    }
  }
  return ids;
}

// A write whose content was just derived from the file's own current bytes — an append or a
// replacement of our marked section. The conflict guard exists to stop us overwriting an edit we
// never saw; here we have just read it and kept it, so the guard would be refusing a merge on the
// grounds that a merge was needed. Still recorded in the ledger, so the watcher knows it was us.
async function writeMerged(dirHandle, name, content, path) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  written.set(path || name, content);
}

// ---------------------------------------------------------------------------
// The documents an agent needs to find.
//
// MONK.md is the schema, WRITING.md is how to fill the fields it describes, and AGENTS.md is the
// briefing that points at both. All are written when a folder is *attached*, not on the first
// save — a folder you connected and haven't edited yet is exactly the one an agent is most
// likely to be pointed at cold, and until now it had neither.
//
// MONK.md is rewritten every time because it documents a format this app defines. WRITING.md is
// seeded once and then left alone: how much to write in a field is a team's call, so the file is
// theirs from the moment it exists (see workspaceDocs.js, and the Writing guide page that edits
// it). A workspace that already has one — an agent's, an earlier version's, an edited one — keeps
// what's there.
//
// The hard rule here is that a connected folder may not be ours alone. Pointing this at a real
// product repo's root is a documented, supported thing to do, and that repo may well already
// have an AGENTS.md — this app's own repo does. So: we create one only where there is none, and
// where there is, we do not touch it. ensureAgentGuides reports what it found and the caller
// asks. Nothing here writes over a file the app didn't create.
// ---------------------------------------------------------------------------
const AGENT_GUIDES = ["AGENTS.md", "CLAUDE.md"];

export async function ensureAgentGuides(dirHandle) {
  await put(dirHandle, "MONK.md", MONK_SCHEMA_DOC, "MONK.md");
  // Seeded documents (WORKSPACE_DOCS `seeded`): created if missing, never replaced. The text is
  // returned so the caller can show it without waiting for the next load.
  const seeded = {};
  for (const doc of WORKSPACE_DOCS.filter((d) => d.seeded)) {
    const { text } = await createWorkspaceDoc(dirHandle, doc.id, doc.template({}));
    seeded[doc.id] = text;
  }

  for (const name of AGENT_GUIDES) {
    const existing = await readFileOrNull(dirHandle, name);
    if (existing === null) continue;
    // Someone else's, unless it carries our marker from a previous run.
    const linked = existing.includes(AGENT_MARKER_BEGIN);
    if (linked) await refreshAgentSection(dirHandle, name, existing);
    return { created: false, existing: name, linked, seeded };
  }

  await put(dirHandle, "AGENTS.md", AGENTS_DOC, "AGENTS.md");
  return { created: true, existing: null, linked: true, seeded };
}

// Adds our section to a guide the repo already owns — only ever called because someone said yes.
// A second run replaces what's between the markers and leaves every other line alone, so the
// section can be kept current without the file becoming ours.
export async function addAgentSection(dirHandle, name) {
  const existing = (await readFileOrNull(dirHandle, name)) ?? "";
  if (existing.includes(AGENT_MARKER_BEGIN)) return refreshAgentSection(dirHandle, name, existing);
  const joiner = existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  await writeMerged(dirHandle, name, existing + joiner + AGENTS_DOC_SECTION, name);
  return true;
}

async function refreshAgentSection(dirHandle, name, existing) {
  const start = existing.indexOf(AGENT_MARKER_BEGIN);
  const end = existing.indexOf(AGENT_MARKER_END);
  if (start === -1 || end === -1 || end < start) return false;
  const next = existing.slice(0, start) + AGENTS_DOC_SECTION + existing.slice(end + AGENT_MARKER_END.length);
  await writeMerged(dirHandle, name, next, name);
  return true;
}

// ---------------------------------------------------------------------------
// Watching the folder.
//
// The workspace is plain markdown in a directory, which was always the point: an agent, an
// editor or a git checkout can write to it too. This is the other half of that — noticing when
// they do. FileSystemObserver reports changes under the connected directory; `onSettle` fires
// once the folder has been quiet for `quietMs`, which is what makes "whenever it was done
// writing" work without the writer having to announce anything. An agent rewriting six files
// produces one callback, not six.
//
// A change we caused ourselves is filtered out by the ledger: if the file's content is what we
// last wrote there, nobody else touched it. Without that every save would wake the watcher and
// the watcher would reload over the save.
//
// Returns a stop function. Where FileSystemObserver is unavailable the app behaves exactly as it
// did before — no watching, no error — so this is additive, not a requirement.
// ---------------------------------------------------------------------------
export const canWatchWorkspace = () => typeof FileSystemObserver !== "undefined";

export function watchWorkspace(dirHandle, onSettle, { quietMs = 800 } = {}) {
  if (!canWatchWorkspace()) return () => {};

  let timer = null;
  let stopped = false;

  const observer = new FileSystemObserver(() => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (stopped) return;
      const changed = await externalChanges(dirHandle);
      if (changed.length) onSettle(changed);
    }, quietMs);
  });

  observer.observe(dirHandle, { recursive: true }).catch((err) => {
    console.error("Couldn't watch the research folder:", err);
  });

  return () => {
    stopped = true;
    clearTimeout(timer);
    observer.disconnect();
  };
}

// Which paths on disk hold something other than what this session put there. Walks the folder
// rather than trusting the event's own paths: an observer can coalesce or drop records, and the
// ledger is the authority on what is ours either way.
async function externalChanges(dirHandle) {
  const changed = [];
  const visit = async (handle, prefix) => {
    for await (const [name, child] of handle.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (child.kind === "directory") {
        // At the top level, only descend into folders that are ours: one we already track, a
        // flat collection, or one carrying a marker file — which is how a spec an agent just
        // created gets noticed at all. Everything else in a shared repo (.git, node_modules,
        // src) is skipped, same rule loadWorkspace uses.
        if (!prefix
            && !managed.has(name)
            && !FLAT_COLLECTIONS.includes(name)
            && !(await hasAnyMarker(child))) continue;
        await visit(child, path);
      } else if (written.has(path)) {
        const text = await (await child.getFile()).text();
        if (text !== written.get(path)) changed.push(path);
      } else if (name.endsWith(".md")) {
        changed.push(path); // a file that appeared where we never wrote one
      }
    }
  };
  await visit(dirHandle, "");
  // Files we wrote that have since been deleted underneath us count as changes too.
  for (const path of written.keys()) {
    if (!(await pathExists(dirHandle, path))) changed.push(path);
  }
  return changed;
}

async function pathExists(dirHandle, path) {
  const parts = path.split("/");
  let handle = dirHandle;
  try {
    for (const part of parts.slice(0, -1)) handle = await handle.getDirectoryHandle(part);
    await handle.getFileHandle(parts[parts.length - 1]);
    return true;
  } catch {
    return false;
  }
}

// Returns the paths it refused to overwrite because something else had edited them. An empty
// array is the ordinary case; anything in it needs a decision a save can't make on its own.
//
// `hold` names entities not to write at all. That covers the one case the conflict guard cannot:
// the guard compares what we are writing against what we last saw on disk, so it catches an edit
// we never saw — but once the watcher has reloaded, we *have* seen it, and a page still showing
// pre-reload text would be writing an ordinary-looking edit over the top of it. There is nothing
// in the bytes to distinguish that from a real one. Only the app knows a page is holding stale
// text, so the app says so, and until someone chooses a version neither is written.
export async function saveWorkspace(dirHandle, workspace, { hold = [] } = {}) {
  // A real workspace always has at least the two fixed sections — Product Knowledge and
  // Standards are created on load and cannot be deleted in the app. So an empty `sections` does
  // not mean "the user emptied the workspace"; it means this state never came from a successful
  // load. Writing it would be wrong, and the cleanup pass below would read it as an instruction
  // to delete every folder it knows about.
  //
  // That is not hypothetical. A load that failed part-way left the app "ready" with empty state
  // while the ids it had already walked sat in `managed`, and the next autosave deleted two real
  // spec folders, recursively. `managed` cannot catch that on its own — it is filled by the very
  // load that then fails — so the floor has to be here, before anything is touched.
  if (!(workspace.sections || []).length) {
    throw new Error("Refusing to save: the workspace has no sections, so it was never loaded.");
  }

  conflicts = [];
  const held = new Set(hold);
  const currentSectionIds = new Set((workspace.sections || []).map((s) => s.id));
  const currentSpecIds = new Set((workspace.specs || []).map((s) => s.id));
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== "directory" || FLAT_COLLECTIONS.includes(name)) continue;
    if (currentSectionIds.has(name) || currentSpecIds.has(name)) continue;
    // Never delete anything that isn't recognizably one of our own folders — the connected
    // directory might not be dedicated to this app (it could be a whole product repo with its
    // own .git/node_modules/src), so only remove entries that actually contain one of our
    // marker files, mirroring the same check loadWorkspace uses to identify them.
    if (!(await hasAnyMarker(handle))) continue;
    // …and beyond that, only ones this session actually loaded or wrote. A marker file is
    // enough to say "this is the sort of thing Monk manages"; it is not enough to say "this is
    // Monk's to delete". A spec folder written next to a running app — by an agent, by git, by
    // you in an editor — is not in `managed`, and survives.
    if (!managed.has(name)) continue;
    await dirHandle.removeEntry(name, { recursive: true });
    managed.delete(name);
    for (const key of [...written.keys()]) if (key.startsWith(`${name}/`)) written.delete(key);
  }

  for (const section of workspace.sections || []) {
    if (held.has(section.id)) continue;
    const sectionDir = await dirHandle.getDirectoryHandle(section.id, { create: true });
    await put(sectionDir, "section.md", sectionMetaToMarkdown(section), `${section.id}/section.md`);
    managed.add(section.id);

    const currentDocNames = new Set(section.documents.map((d) => `${d.id}.md`));
    for await (const [fname, fhandle] of sectionDir.entries()) {
      const path = `${section.id}/${fname}`;
      if (fhandle.kind === "file" && fname !== "section.md" && !currentDocNames.has(fname) && managed.has(path)) {
        await removeFile(sectionDir, fname, path);
        managed.delete(path);
      }
    }
    for (const doc of section.documents) {
      const path = `${section.id}/${doc.id}.md`;
      await put(sectionDir, `${doc.id}.md`, documentToMarkdown(doc), path);
      managed.add(path);
    }
  }

  for (const spec of workspace.specs || []) {
    if (held.has(spec.id)) continue;
    const specDir = await dirHandle.getDirectoryHandle(spec.id, { create: true });
    await put(specDir, "spec.md", specToMarkdown(spec), `${spec.id}/spec.md`);
    await put(specDir, SOLUTION_FILE, spec.design || "", `${spec.id}/${SOLUTION_FILE}`);
    await put(specDir, "plan.md", spec.plan || "", `${spec.id}/plan.md`);
    managed.add(spec.id);

    // Retire the old name, but only once its content is safely under the new one, and only for a
    // file this session actually read — a design.md we never loaded belongs to someone else.
    const legacy = `${spec.id}/${LEGACY_SOLUTION_FILE}`;
    if (written.has(legacy) && (await hasFile(specDir, SOLUTION_FILE))) {
      await removeFile(specDir, LEGACY_SOLUTION_FILE, legacy);
    }
    // A retired spec board this session found on load (see loadSpec). One that turns up later isn't
    // managed, so it waits for the next load to find it.
    const boardPath = `${spec.id}/board`;
    if (managed.has(boardPath)) {
      try { await specDir.removeEntry("board", { recursive: true }); } catch { /* already gone */ }
      managed.delete(boardPath);
      for (const key of [...written.keys()]) if (key.startsWith(`${boardPath}/`)) written.delete(key);
    }
  }

  await saveFlatCollection(dirHandle, "signals", workspace.signals, signalToMarkdown, held);
  await saveFlatCollection(dirHandle, "insights", workspace.insights, insightToMarkdown, held);
  await saveFlatCollection(dirHandle, "initiatives", workspace.initiatives, initiativeToMarkdown, held);
  await cleanupInitiativeFolders(dirHandle, workspace.initiatives, held);
  // Only when the caller actually holds the collection. An empty list is an instruction to remove
  // every plan this session loaded; a workspace built by code that predates research plans has no
  // list at all, and must not read as that.
  if (Array.isArray(workspace.researchPlans)) {
    await saveFlatCollection(dirHandle, "research-plans", workspace.researchPlans, researchPlanToMarkdown, held);
    await savePlanBoards(dirHandle, workspace.researchPlans, held);
  }

  // Activities migrated on load leave their old files until the plans and signals that replace
  // them are written. Conservatively all or nothing: if anything in this save conflicted or was
  // held back, some replacement may not be on disk yet, so the move waits for a clean save.
  if ((workspace.retiredActivityIds || []).length && !conflicts.length && !held.size) {
    await retireActivities(dirHandle, workspace.retiredActivityIds);
  }

  // Workspace documents are only ever updated here, never created or removed — those are
  // createWorkspaceDoc/removeWorkspaceDoc, both explicit. So a save writes one only if this session
  // has read or written that file and it is still on disk: text for a document that was deleted
  // underneath us is not an instruction to bring it back (the watcher is about to reload it as
  // gone), and `null` is never an instruction to delete.
  for (const doc of WORKSPACE_DOCS) {
    const text = workspace.docs?.[doc.id];
    if (typeof text !== "string" || held.has(doc.id) || !written.has(doc.file)) continue;
    if (!(await hasFile(dirHandle, doc.file))) continue;
    await put(dirHandle, doc.file, text, doc.file);
  }

  // A static schema/layout reference for any agent working in the folder (see monkSchema.js).
  // It's a constant, so after the first save of a session this costs nothing — the ledger sees
  // identical content and skips it. Top-level files aren't touched by the cleanup loop above
  // (it only walks directories), so nothing else is needed to protect it. WRITING.md is not
  // written here: it's seeded once by ensureAgentGuides and then edited like any other workspace
  // document, by the loop above.
  await put(dirHandle, "MONK.md", MONK_SCHEMA_DOC, "MONK.md");

  return conflicts;
}
