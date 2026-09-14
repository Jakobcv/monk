// What was touched last, for the start page's "Recently touched" list. Takes the raw entity
// arrays App already holds and returns plain values — no React, no formatting beyond the short
// relative time the list shows.

const DAY = 86400000;

export function recentlyTouched({ signals, insights, specs, initiatives, researchPlans = [] }, n = 6) {
  const tag = (arr, kind, nameKey) => arr.map((x) => ({
    id: x.id,
    kind,
    label: x[nameKey] || x.title || x.name || x.text || "Untitled",
    updatedAt: x.updatedAt || x.createdAt || 0,
  }));
  return [
    ...tag(specs, "spec", "title"),
    ...tag(insights, "insight", "text"),
    ...tag(signals, "signal", "text"),
    ...tag(initiatives, "initiative", "title"),
    ...tag(researchPlans, "researchPlan", "title"),
  ]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, n);
}

export function relativeTime(ts, now = Date.now()) {
  const d = Math.max(0, now - ts);
  const days = Math.floor(d / DAY);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(days / 30);
  return `${mo}mo ago`;
}
