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

export async function getStoredHandle() {
  try {
    return (await idbGet(KEY)) || null;
  } catch {
    return null;
  }
}

// `showDirectoryPicker` and `requestPermission` both require an active user gesture
// (a click), so this must only ever be called from an onClick handler, never on mount.
export async function pickFolder() {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await idbSet(KEY, handle);
  return handle;
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
