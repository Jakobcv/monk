import { useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BORDER_STRONG, BG, STATUS_COLOR } from "./lib/theme";

const cardCount = (b) =>
  (b.evidence?.length || 0) + (b.problems?.length || 0) + (b.ideas?.length || 0) + (b.results?.length || 0);

export default function StartPage({ boards, onCreate, onImport, onOpen, onRename, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const fileInputRef = useRef(null);

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

  const sorted = [...boards].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "32px 40px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
          <h1 style={{ fontFamily: font, fontSize: "20px", fontWeight: 600, color: INK, margin: 0 }}>Your boards</h1>
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
    </div>
  );
}
