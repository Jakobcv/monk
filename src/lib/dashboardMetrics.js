// Pure derivations for the Home dashboard. Everything here takes the raw entity arrays App
// already holds and returns plain numbers / small arrays — no React, no formatting.

const DAY = 86400000;

// --- time bucketing --------------------------------------------------------
// `weeks` buckets ending at `now`, oldest first. Each bucket is [start, end).
export function weekBuckets(now = Date.now(), weeks = 10) {
  const end = now;
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    out.push({ start: end - (i + 1) * 7 * DAY, end: end - i * 7 * DAY });
  }
  return out;
}

export function countPerWeek(items, dateKey = "createdAt", weeks = 10, now = Date.now()) {
  const buckets = weekBuckets(now, weeks);
  return buckets.map((b) => items.filter((it) => {
    const t = it[dateKey] || 0;
    return t >= b.start && t < b.end;
  }).length);
}

// running total, for a "growth" sparkline
export function cumulative(counts) {
  let sum = 0;
  return counts.map((c) => (sum += c));
}

// --- group 1: inventory --------------------------------------------------------
export function inventory({ signals, insights, activities, specs, initiatives, sections }) {
  const docs = (sections || []).reduce((n, s) => n + (s.documents?.length || 0), 0);
  return {
    signals: signals.length,
    insights: insights.length,
    activities: activities.length,
    specs: specs.length,
    initiatives: initiatives.length,
    docs,
  };
}

// signals -> insights -> specs -> shipped, as an ordered funnel
export function funnel({ signals, insights, specs }) {
  return [
    { key: "signal", label: "Signals", value: signals.length },
    { key: "insight", label: "Insights", value: insights.length },
    { key: "spec", label: "Specs", value: specs.length },
    { key: "shipped", label: "Shipped", value: specs.filter((s) => s.status === "shipped").length },
  ];
}

// --- group 2: synthesis health ----------------------------------------------
export function synthesis({ signals, insights }) {
  const usedSignalIds = new Set();
  let sourced = 0;
  let sourceTotal = 0;
  for (const ins of insights) {
    const src = ins.sources || [];
    if (src.length) sourced++;
    sourceTotal += src.length;
    for (const id of src) usedSignalIds.add(id);
  }
  const unsynthesized = signals.filter((s) => !usedSignalIds.has(s.id)).length;
  return {
    totalSignals: signals.length,
    synthesized: signals.length - unsynthesized,
    unsynthesized,
    synthesisRate: signals.length ? (signals.length - unsynthesized) / signals.length : 0,
    // share of insights that were formed from at least one signal
    evidenceRatio: insights.length ? sourced / insights.length : 0,
    avgEvidence: insights.length ? sourceTotal / insights.length : 0,
  };
}

// insight linked into the most spec boards
export function mostReusedInsight({ insights, specs }) {
  let best = null;
  let bestN = 0;
  for (const ins of insights) {
    const n = specs.filter((s) => (s.board?.insights || []).some((x) => x.id === ins.id)).length;
    if (n > bestN) { bestN = n; best = ins; }
  }
  return best ? { text: best.text, count: bestN } : null;
}

// --- group 4: status & progress -------------------------------------------------
export function statusSplit(items, order) {
  const counts = Object.fromEntries(order.map((k) => [k, 0]));
  for (const it of items) if (it.status in counts) counts[it.status]++;
  return order.map((k) => ({ key: k, value: counts[k] }));
}

export const SPEC_STATUS_ORDER = ["draft", "active", "shipped"];
export const INITIATIVE_STATUS_ORDER = ["active", "paused", "done"];

// acceptance-criteria completion across the specs still in flight (draft + active)
export function acceptanceProgress({ specs }) {
  let done = 0;
  let total = 0;
  let specsWithCriteria = 0;
  for (const s of specs) {
    if (s.status === "shipped") continue;
    const items = (s.acceptanceCriteria || []).filter((c) => (c.text || "").trim() || c.checked);
    if (!items.length) continue;
    specsWithCriteria++;
    total += items.length;
    done += items.filter((c) => c.checked).length;
  }
  return { done, total, specs: specsWithCriteria, ratio: total ? done / total : 0 };
}

export function openQuestions({ specs }) {
  let open = 0;
  let specsWith = 0;
  for (const s of specs) {
    const unresolved = (s.openQuestions || []).filter((q) => !q.checked && (q.text || "").trim() !== "").length
      || (s.openQuestions || []).filter((q) => !q.checked).length;
    if (unresolved > 0) specsWith++;
    open += unresolved;
  }
  return { open, specs: specsWith };
}

// --- group 5: momentum -----------------------------------------------------
export function momentum({ signals, insights }, weeks = 10, now = Date.now()) {
  return {
    weeks: weekBuckets(now, weeks),
    signals: countPerWeek(signals, "createdAt", weeks, now),
    insights: countPerWeek(insights, "createdAt", weeks, now),
  };
}

export function staleSpecs({ specs }, days = 21, now = Date.now()) {
  const cutoff = now - days * DAY;
  return specs
    .filter((s) => s.status === "active" && (s.updatedAt || s.createdAt || 0) < cutoff)
    .map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt || s.createdAt || 0 }))
    .sort((a, b) => a.updatedAt - b.updatedAt);
}

export function recentlyTouched({ signals, insights, activities, specs, initiatives }, n = 6) {
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
    ...tag(activities, "activity", "name"),
    ...tag(initiatives, "initiative", "title"),
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
