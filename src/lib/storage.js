const STORAGE_KEY = "evidence-loop:workspace";

// Workspace persistence: everything lives in this browser's localStorage — one key,
// one JSON blob of { boards: [...] }, same shape the app already works with in memory.
// No network, no setup, no cross-device sync (that's what the per-board JSON export is for).
export async function loadWorkspace() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) throw new Error("No workspace saved yet");
  return JSON.parse(raw);
}

export async function saveWorkspace(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
