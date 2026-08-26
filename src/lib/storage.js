const BASE = "https://api.jsonbin.io/v3/b";
const BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID;
const API_KEY = import.meta.env.VITE_JSONBIN_API_KEY;

// The bin holds the whole workspace — { boards: [...] } — not a single board. Multiple
// boards share one bin/one JSON document rather than one bin per board, so the existing
// single scoped API key still works unmodified (creating new bins would need broader,
// account-level permissions the scoped key intentionally doesn't have).
export async function loadWorkspace() {
  const res = await fetch(`${BASE}/${BIN_ID}/latest`, {
    headers: { "X-Master-Key": API_KEY },
  });
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const json = await res.json();
  return json.record; // JSONBin wraps your data under `.record`
}

export async function saveWorkspace(state) {
  const res = await fetch(`${BASE}/${BIN_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": API_KEY,
      "X-Bin-Versioning": "false", // don't create a new version on every save
    },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return res.json();
}
