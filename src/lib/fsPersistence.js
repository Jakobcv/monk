const DB_NAME = "evidence-loop";
const STORE = "handles";
const KEY = "researchFolder";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const fsAccessSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

// The folder Monk keeps its files in, inside a product's repo.
export const WORKSPACE_DIR = "monk";

// A connection is `{ root, workspace }`. `workspace` is the folder Monk reads and writes — every
// storage call gets that and nothing else. `root` is the project it lives in, the folder you
// picked, kept so the app can say which project you're in: the browser only ever sees downward
// from a folder you picked, so a workspace can't tell you its own parent.
//
// What you pick decides which you get:
//   - a project (any other folder): Monk works in its monk/ subfolder, created if missing.
//   - a workspace itself — a folder named monk/, or one that already holds MONK.md: used as it is,
//     with no known root. That includes every folder connected before roots existed, and a repo
//     that was connected at its top level, whose files must not quietly move into a subfolder.
async function hasFile(dir, name) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function resolveConnection(picked) {
  if (picked.name === WORKSPACE_DIR || (await hasFile(picked, "MONK.md"))) {
    return { root: null, workspace: picked };
  }
  const workspace = await picked.getDirectoryHandle(WORKSPACE_DIR, { create: true });
  return { root: picked, workspace };
}

// Before roots, the store held the bare workspace handle; that still reads back as a connection.
export async function getStoredConnection() {
  try {
    const stored = await idbGet(KEY);
    if (!stored) return null;
    if (stored.kind === "directory") return { root: null, workspace: stored };
    return stored.workspace ? { root: stored.root || null, workspace: stored.workspace } : null;
  } catch {
    return null;
  }
}

// The handle permission is asked for: the root where there is one, which covers the workspace
// inside it.
export const permissionHandle = (connection) => connection.root || connection.workspace;

// `showDirectoryPicker` and `requestPermission` both require an active user gesture
// (a click), so this must only ever be called from an onClick handler, never on mount.
export async function pickFolder() {
  const picked = await window.showDirectoryPicker({ mode: "readwrite" });
  const connection = await resolveConnection(picked);
  await idbSet(KEY, connection);
  return connection;
}

// Silent path for repeat visits: if permission is already granted for this handle,
// no user gesture is needed at all.
export async function tryReuseHandle(handle) {
  if (!handle) return false;
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return false;
}

// Needs a user gesture — used when a stored handle exists but permission has lapsed.
export async function reconnectHandle(handle) {
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}
