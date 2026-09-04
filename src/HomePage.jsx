import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, Upload, Search as SearchIcon, X, Link2, ArrowLeft, Star } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BORDER_STRONG, BG, STATUS_COLOR, ACCENT } from "./lib/theme";

// per-type: which array on a board holds these cards, and which of the card's fields to
// search against (Action has three text fields, everything else has just `text`)
const TYPE_DEFS = [
  { kind: "signal", label: "Signal", arrayKey: "signals", fields: (x) => [x.text] },
  { kind: "insight", label: "Insight", arrayKey: "insights", fields: (x) => [x.text] },
  { kind: "action", label: "Action", arrayKey: "actions", fields: (x) => [x.ifWe, x.then, x.expected] },
  { kind: "result", label: "Result", arrayKey: "results", fields: (x) => [x.text] },
];
const ATTACHABLE_KINDS = new Set(TYPE_DEFS.map((d) => d.kind));
const UNLINKED_COLOR = "#E03E3E"; // same red used for Blocked/High elsewhere — reads as "needs attention"
const CITED_COLOR = "#946800"; // muted gold — reads as "authoritative", distinct from the four type accents

const tint = (hex, alpha) => `${hex}${alpha}`;
const cardCount = (b) =>
  (b.signals?.length || 0) + (b.insights?.length || 0) + (b.actions?.length || 0) + (b.results?.length || 0);

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

// The home page leads with search — before you spin up a new study, check whether the
// answer already exists somewhere in the repository. The board list (create/import) sits
// right below, always reachable, but search is what you see first.
export default function HomePage({ boards, onCreate, onImport, onOpen, onRename, onDelete, onAttach }) {
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const fileInputRef = useRef(null);

  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState("all");
  const [activated, setActivated] = useState(false);
  const [attachOpenKey, setAttachOpenKey] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // reset so picking the same file again still fires onChange
    if (file) onImport(file);
  };

  const startEdit = (b) => { setEditingId(b.id); setDraftName(b.name); };
  const commitEdit = () => {
    if (editingId != null) onRename(editingId, draftName.trim() || "Untitled board");
    setEditingId(null);
  };
  const handleDelete = (b) => {
    if (window.confirm(`Delete "${b.name || "Untitled board"}"? This can't be undone.`)) onDelete(b.id);
  };

  const handleAttach = (m, destBoardId) => {
    onAttach(m.kind, m.boardId, m.cardId, destBoardId);
    setAttachOpenKey(null);
  };

  const backToBoards = () => {
    setActivated(false);
    setQuery("");
    setActiveKind("all");
  };

  const q = query.trim();

  const matches = useMemo(() => {
    if (!activated) return [];
    const ql = q.toLowerCase();
    const out = [];

    if (activeKind === "cited") {
      // count how many reference cards point at each original, across every board
      const counts = new Map(); // `${boardId}:${itemId}` -> count
      for (const board of boards) {
        for (const def of TYPE_DEFS) {
          for (const item of board[def.arrayKey] || []) {
            if (!item.ref) continue;
            const refKey = `${item.ref.boardId}:${item.ref.itemId}`;
            counts.set(refKey, (counts.get(refKey) || 0) + 1);
          }
        }
      }
      for (const board of boards) {
        for (const def of TYPE_DEFS) {
          for (const item of board[def.arrayKey] || []) {
            if (item.ref) continue; // only originals can be cited, not references themselves
            const count = counts.get(`${board.id}:${item.id}`) || 0;
            if (count === 0) continue;
            const text = def.fields(item).filter(Boolean)[0] || "";
            if (q && !text.toLowerCase().includes(ql)) continue;
            out.push({ key: `${board.id}:${item.id}`, boardId: board.id, cardId: item.id, boardName: board.name || "Untitled board", kind: def.kind, label: def.label, text, citationCount: count });
          }
        }
      }
      out.sort((a, b) => b.citationCount - a.citationCount); // ranked by citations, always — not by recency
      return out;
    }

    for (const board of boards) {
      if (activeKind === "unlinked") {
        for (const item of board.signals || []) {
          if (item.ref) continue; // a reference's "linked" status belongs to its source board
          if ((board.connections || []).some((c) => c.from === item.id)) continue; // has an outgoing link
          const text = item.text || "";
          if (q && !text.toLowerCase().includes(ql)) continue;
          out.push({ key: `${board.id}:${item.id}`, boardId: board.id, cardId: item.id, boardName: board.name || "Untitled board", kind: "signal", label: "Signal", text, boardUpdatedAt: board.updatedAt || 0 });
        }
        continue;
      }
      for (const def of TYPE_DEFS) {
        if (activeKind !== "all" && def.kind !== activeKind) continue;
        for (const item of board[def.arrayKey] || []) {
          if (item.ref) continue; // reference cards carry no local text of their own
          let text;
          if (q) {
            text = def.fields(item).filter(Boolean).find((f) => f.toLowerCase().includes(ql));
            if (!text) continue;
          } else {
            text = def.fields(item).filter(Boolean)[0] || "";
          }
          out.push({ key: `${board.id}:${item.id}`, boardId: board.id, cardId: item.id, boardName: board.name || "Untitled board", kind: def.kind, label: def.label, text, boardUpdatedAt: board.updatedAt || 0 });
        }
      }
    }
    if (!q) out.sort((a, b) => b.boardUpdatedAt - a.boardUpdatedAt); // browsing: most recently active board first
    return out;
  }, [activated, q, activeKind, boards]);

  const sorted = [...boards].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "32px 40px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <style>{`
          @keyframes el-fade-in-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          .el-page-transition { animation: el-fade-in-up 160ms ease-out; }
        `}</style>
        <div style={{ height: "20px", marginBottom: "10px" }}>
          <button
            onClick={backToBoards}
            style={{
              visibility: activated ? "visible" : "hidden",
              display: "flex", alignItems: "center", gap: "5px",
              fontFamily: font, fontWeight: 600, fontSize: "13px", color: INK,
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            <ArrowLeft size={14} /> Your boards
          </button>
        </div>
        <div style={{ position: "relative", marginBottom: "14px" }}>
          <SearchIcon size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: INK_FAINT }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActivated(true); }}
            onFocus={() => setActivated(true)}
            placeholder="Search across every board before starting something new…"
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

        {activated && (
        <div className="el-page-transition" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "26px" }}>
          <button
            onClick={() => setActiveKind("all")}
            style={{
              fontFamily: font, fontWeight: 600, fontSize: "12px", cursor: "pointer",
              borderRadius: "999px", padding: "5px 12px",
              border: `1px solid ${activeKind === "all" ? INK : BORDER_STRONG}`,
              background: activeKind === "all" ? INK : "#fff",
              color: activeKind === "all" ? "#fff" : INK_SOFT,
            }}
          >
            All
          </button>
          {TYPE_DEFS.map((def) => {
            const active = activeKind === def.kind;
            const color = ACCENT[def.kind];
            return (
              <button
                key={def.kind}
                onClick={() => setActiveKind(def.kind)}
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
          <button
            onClick={() => setActiveKind("unlinked")}
            title="Signals not yet connected to any insight — easy to misread out of context"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              fontFamily: font, fontWeight: 600, fontSize: "12px", cursor: "pointer",
              borderRadius: "999px", padding: "5px 12px",
              border: `1px solid ${activeKind === "unlinked" ? tint(UNLINKED_COLOR, "60") : BORDER_STRONG}`,
              background: activeKind === "unlinked" ? tint(UNLINKED_COLOR, "12") : "#fff",
              color: activeKind === "unlinked" ? UNLINKED_COLOR : INK_SOFT,
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: UNLINKED_COLOR, flexShrink: 0 }} />
            Unlinked
          </button>
          <button
            onClick={() => setActiveKind("cited")}
            title="Cards referenced by the most other boards — likely authoritative findings"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              fontFamily: font, fontWeight: 600, fontSize: "12px", cursor: "pointer",
              borderRadius: "999px", padding: "5px 12px",
              border: `1px solid ${activeKind === "cited" ? tint(CITED_COLOR, "60") : BORDER_STRONG}`,
              background: activeKind === "cited" ? tint(CITED_COLOR, "12") : "#fff",
              color: activeKind === "cited" ? CITED_COLOR : INK_SOFT,
            }}
          >
            <Star size={11} fill={activeKind === "cited" ? CITED_COLOR : "none"} />
            Most cited
          </button>
        </div>
        )}

        {activated ? (
          matches.length === 0 ? (
            <div className="el-page-transition" style={{ fontFamily: font, color: INK_FAINT, fontSize: "13.5px", textAlign: "center", padding: "50px 0" }}>
              {q
                ? `No matches for "${q}".`
                : activeKind === "unlinked"
                  ? "Every signal is linked to an insight — nothing to flag."
                  : activeKind === "cited"
                    ? "No cards have been cited elsewhere yet."
                    : activeKind === "all"
                      ? "No cards yet — add some to a board first."
                      : `No ${TYPE_DEFS.find((d) => d.kind === activeKind)?.label.toLowerCase()} cards yet.`}
            </div>
          ) : (
            <div className="el-page-transition">
              <div style={{ fontFamily: font, fontSize: "12px", color: INK_FAINT, marginBottom: "10px" }}>
                {matches.length} result{matches.length === 1 ? "" : "s"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <style>{`
                  .el-resultcard { border: 1px solid ${BORDER}; transition: border-color .12s, box-shadow .12s; }
                  .el-resultcard:hover { border-color: ${BORDER_STRONG}; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
                `}</style>
                {matches.map((m) => (
                  <div
                    key={m.key}
                    className="el-resultcard"
                    onClick={() => onOpen(m.boardId, m.cardId)}
                    style={{
                      cursor: "pointer", borderRadius: "8px",
                      padding: "10px 14px", background: BG,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT[m.kind], flexShrink: 0 }} />
                      <span style={{ fontFamily: font, fontWeight: 600, fontSize: "11px", color: ACCENT[m.kind] }}>{m.label}</span>
                      <span style={{ fontFamily: font, fontSize: "11px", color: INK_FAINT }}>in {m.boardName}</span>
                      {m.citationCount != null && (
                        <span style={{ display: "flex", alignItems: "center", gap: "3px", fontFamily: font, fontWeight: 600, fontSize: "11px", color: CITED_COLOR }}>
                          <Star size={10} fill={CITED_COLOR} /> {m.citationCount} citation{m.citationCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: font, fontSize: "13.5px", color: INK, lineHeight: 1.5 }}>
                      {highlight(m.text, q)}
                    </div>
                    {ATTACHABLE_KINDS.has(m.kind) && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "8px" }}>
                        {attachOpenKey === m.key ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) handleAttach(m, e.target.value); }}
                            onBlur={() => setAttachOpenKey(null)}
                            style={{
                              fontFamily: font, fontSize: "12px", color: INK, border: `1px solid ${BORDER_STRONG}`,
                              borderRadius: "6px", padding: "4px 8px", cursor: "pointer", background: "#fff",
                            }}
                          >
                            <option value="" disabled>Attach to…</option>
                            <option value="__new__">+ New board</option>
                            {boards.map((b) => (
                              <option key={b.id} value={b.id}>{b.name || "Untitled board"}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setAttachOpenKey(m.key)}
                            style={{
                              display: "flex", alignItems: "center", gap: "5px",
                              fontFamily: font, fontWeight: 600, fontSize: "11.5px", color: INK_SOFT,
                              background: "none", border: `1px solid ${BORDER_STRONG}`, borderRadius: "6px",
                              padding: "4px 9px", cursor: "pointer",
                            }}
                          >
                            <Link2 size={11} /> Attach to board
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="el-page-transition">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
              <h1 style={{ fontFamily: font, fontSize: "16px", fontWeight: 600, color: INK, margin: 0 }}>Your boards</h1>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} style={{ display: "none" }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px", fontFamily: font, fontWeight: 600, fontSize: "13px",
                    color: INK, background: "#fff", border: `1px solid ${BORDER_STRONG}`, borderRadius: "7px", padding: "8px 14px", cursor: "pointer",
                  }}
                >
                  <Upload size={14} /> Import JSON
                </button>
                <button
                  onClick={onCreate}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px", fontFamily: font, fontWeight: 600, fontSize: "13px",
                    color: "#fff", background: INK, border: "none", borderRadius: "7px", padding: "8px 14px", cursor: "pointer",
                  }}
                >
                  <Plus size={14} /> New board
                </button>
              </div>
            </div>

            {sorted.length === 0 ? (
              <div style={{ fontFamily: font, color: INK_FAINT, fontSize: "13.5px", textAlign: "center", padding: "60px 0" }}>
                No boards yet — create one to get started.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
                <style>{`
                  .el-boardcard { border: 1px solid ${BORDER}; transition: border-color .12s, box-shadow .12s; }
                  .el-boardcard:hover { border-color: ${BORDER_STRONG}; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
                  .el-boardcard-del { opacity: 0; transition: opacity .12s; }
                  .el-boardcard:hover .el-boardcard-del { opacity: 1; }
                `}</style>
                {sorted.map((b) => (
                  <div
                    key={b.id}
                    className="el-boardcard"
                    onClick={() => editingId !== b.id && onOpen(b.id)}
                    style={{
                      position: "relative", textAlign: "left", borderRadius: "8px",
                      padding: "14px 16px", background: BG, cursor: "pointer",
                    }}
                  >
                    <button
                      className="el-boardcard-del"
                      onClick={(e) => { e.stopPropagation(); handleDelete(b); }}
                      title="Delete board"
                      style={{
                        position: "absolute", top: "8px", right: "8px", width: "22px", height: "22px", borderRadius: "6px",
                        border: `1px solid ${BORDER_STRONG}`, background: "#fff", color: INK_SOFT, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                      }}
                    >
                      <Trash2 size={12} />
                    </button>

                    {editingId === b.id ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{
                          fontFamily: font, fontWeight: 600, fontSize: "14px", color: INK, border: "none", outline: "none",
                          width: "calc(100% - 24px)", padding: 0, marginBottom: "6px", display: "block",
                        }}
                      />
                    ) : (
                      <div
                        onClick={(e) => { e.stopPropagation(); startEdit(b); }}
                        title="Click to rename"
                        style={{
                          fontFamily: font, fontWeight: 600, fontSize: "14px", color: INK, marginBottom: "6px", paddingRight: "20px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {b.name || "Untitled board"}
                      </div>
                    )}

                    <div style={{
                      fontFamily: font, fontSize: "12px", color: INK_SOFT, minHeight: "16px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {b.goal || "No goal set"}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                      <span style={{ fontFamily: font, fontSize: "11px", fontWeight: 600, color: STATUS_COLOR[b.status] || INK_FAINT }}>
                        {b.status}
                      </span>
                      <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: INK_FAINT }} />
                      <span style={{ fontFamily: font, fontSize: "11px", color: INK_FAINT }}>{cardCount(b)} cards</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
