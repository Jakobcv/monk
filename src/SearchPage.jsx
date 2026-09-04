import { useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BORDER_STRONG, BG, ACCENT } from "./lib/theme";

// per-type: which array on a board holds these cards, and which of the card's fields to
// search against (Action has three text fields, everything else has just `text`)
const TYPE_DEFS = [
  { kind: "signal", label: "Signal", arrayKey: "signals", fields: (x) => [x.text] },
  { kind: "insight", label: "Insight", arrayKey: "insights", fields: (x) => [x.text] },
  { kind: "action", label: "Action", arrayKey: "actions", fields: (x) => [x.ifWe, x.then, x.expected] },
  { kind: "result", label: "Result", arrayKey: "results", fields: (x) => [x.text] },
];
const ALL_KINDS = TYPE_DEFS.map((d) => d.kind);

const tint = (hex, alpha) => `${hex}${alpha}`;

function highlight(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "transparent", color: "inherit", fontWeight: 700, padding: 0 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchPage({ boards, onOpenBoard }) {
  const [query, setQuery] = useState("");
  const [activeKinds, setActiveKinds] = useState(() => new Set(ALL_KINDS));

  const toggleKind = (kind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  };
  const selectAll = () => setActiveKinds(new Set(ALL_KINDS));

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    const out = [];
    for (const board of boards) {
      for (const def of TYPE_DEFS) {
        if (!activeKinds.has(def.kind)) continue;
        for (const item of board[def.arrayKey] || []) {
          const hit = def.fields(item).filter(Boolean).find((f) => f.toLowerCase().includes(ql));
          if (hit) out.push({ key: `${board.id}:${item.id}`, boardId: board.id, boardName: board.name || "Untitled board", kind: def.kind, label: def.label, text: hit });
        }
      }
    }
    return out;
  }, [query, activeKinds, boards]);

  const allSelected = activeKinds.size === ALL_KINDS.length;
  const q = query.trim();

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "32px 40px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: font, fontSize: "20px", fontWeight: 600, color: INK, margin: "0 0 18px" }}>Search</h1>

        <div style={{ position: "relative", marginBottom: "14px" }}>
          <SearchIcon size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: INK_FAINT }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across every board…"
            style={{
              width: "100%", boxSizing: "border-box", fontFamily: font, fontSize: "14px", color: INK,
              border: `1px solid ${BORDER_STRONG}`, borderRadius: "8px", padding: "10px 36px",
              outline: "none", background: BG,
            }}
          />
          {q && (
            <button
              onClick={() => setQuery("")}
              title="Clear"
              style={{
                position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                border: "none", background: "none", color: INK_FAINT, cursor: "pointer", padding: "2px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "22px" }}>
          <button
            onClick={selectAll}
            style={{
              fontFamily: font, fontWeight: 600, fontSize: "12px", cursor: "pointer",
              borderRadius: "999px", padding: "5px 12px",
              border: `1px solid ${allSelected ? INK : BORDER_STRONG}`,
              background: allSelected ? INK : "#fff",
              color: allSelected ? "#fff" : INK_SOFT,
            }}
          >
            All
          </button>
          {TYPE_DEFS.map((def) => {
            const active = activeKinds.has(def.kind);
            const color = ACCENT[def.kind];
            return (
              <button
                key={def.kind}
                onClick={() => toggleKind(def.kind)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontFamily: font, fontWeight: 600, fontSize: "12px", cursor: "pointer",
                  borderRadius: "999px", padding: "5px 12px",
                  border: `1px solid ${active ? tint(color, "60") : BORDER_STRONG}`,
                  background: active ? tint(color, "12") : "#fff",
                  color: active ? color : INK_SOFT,
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                {def.label}
              </button>
            );
          })}
        </div>

        {!q ? (
          <div style={{ fontFamily: font, color: INK_FAINT, fontSize: "13.5px", textAlign: "center", padding: "50px 0" }}>
            Start typing to search across every board.
          </div>
        ) : matches.length === 0 ? (
          <div style={{ fontFamily: font, color: INK_FAINT, fontSize: "13.5px", textAlign: "center", padding: "50px 0" }}>
            No matches for "{q}".
          </div>
        ) : (
          <>
            <div style={{ fontFamily: font, fontSize: "12px", color: INK_FAINT, marginBottom: "10px" }}>
              {matches.length} result{matches.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {matches.map((m) => (
                <div
                  key={m.key}
                  onClick={() => onOpenBoard(m.boardId)}
                  style={{
                    cursor: "pointer", border: `1px solid ${BORDER}`, borderRadius: "8px",
                    padding: "10px 14px", background: BG,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT[m.kind], flexShrink: 0 }} />
                    <span style={{ fontFamily: font, fontWeight: 600, fontSize: "11px", color: ACCENT[m.kind] }}>{m.label}</span>
                    <span style={{ fontFamily: font, fontSize: "11px", color: INK_FAINT }}>in {m.boardName}</span>
                  </div>
                  <div style={{ fontFamily: font, fontSize: "13.5px", color: INK, lineHeight: 1.5 }}>
                    {highlight(m.text, q)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
