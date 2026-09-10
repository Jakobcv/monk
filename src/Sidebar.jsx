import { useState } from "react";
import { BookOpen, Layers, FileText, Plus, Trash2, Library, ShieldCheck } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, BG_SIDEBAR, SIZE, WEIGHT, SPACE, RADIUS, MOTION } from "./lib/theme";
import { FIXED_SECTIONS, isFixedSection } from "./lib/documentModel";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

// Icon + one-line tooltip for each fixed section — purely presentational, keyed by id.
const FIXED_SECTION_META = {
  "product-knowledge": { icon: Library, tooltip: "The team's shared memory — what the product is for, what's been decided, what we know about users." },
  "standards": { icon: ShieldCheck, tooltip: "Contracts agents build to — from the design system to accessibility." },
};

const navItemStyle = (active) => ({
  display: "flex", alignItems: "center", gap: SPACE.base, width: "100%", textAlign: "left",
  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui, color: active ? INK : INK_SOFT,
  background: active ? "#fff" : "none", border: "none", borderRadius: RADIUS.sm,
  padding: "7px 8px", cursor: "pointer", textDecoration: "none", boxSizing: "border-box",
  transition: `background-color ${MOTION.fast} ${MOTION.ease}, color ${MOTION.fast} ${MOTION.ease}`,
});

const sectionLabelStyle = {
  flex: 1, fontFamily: font, fontWeight: WEIGHT.bold, fontSize: SIZE.micro, letterSpacing: "0.05em",
  textTransform: "uppercase", color: INK_FAINT,
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

// Research Repository and Specs are deliberately not `sections` entries — they're purpose-built,
// structured systems (a different shape from a freeform document), so they stay fixed,
// always-present top-level items rather than forcing an awkward type-match. Individual specs
// don't get their own row here (for now) — they're reached by opening the Specs page, the same
// way individual boards are reached through Research Repository rather than listed in the sidebar.
//
// Product Knowledge and Standards ARE `sections` entries (freeform documents, exactly like a
// user-created section) — they just can't be renamed or deleted, and always sort first, because
// what belongs in them is a matter of purpose, not user choice (see documentModel.js).
export default function Sidebar({ sections, activeView, researchHref, specsHref, docHref, onCreateSection, onRenameSection, onDeleteSection, onCreateDocument, onDeleteDocument }) {
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [draftName, setDraftName] = useState("");

  const fixedSections = FIXED_SECTIONS.map((f) => sections.find((s) => s.id === f.id)).filter(Boolean);
  const customSections = sections.filter((s) => !isFixedSection(s.id));
  const orderedSections = [...fixedSections, ...customSections];

  const startEdit = (s) => { setEditingSectionId(s.id); setDraftName(s.name); };
  const commitEdit = () => {
    if (editingSectionId != null) onRenameSection(editingSectionId, draftName.trim() || "Untitled section");
    setEditingSectionId(null);
  };

  // No confirm dialog: the delete happens, and App reports it with an Undo toast instead
  // (see App.jsx's deleteSection/deleteDocument).

  return (
    <div style={{
      width: "230px", flexShrink: 0, height: "100%", overflowY: "auto", boxSizing: "border-box",
      backgroundColor: BG_SIDEBAR, borderRight: `1px solid ${BORDER}`, padding: "14px 10px",
      display: "flex", flexDirection: "column", gap: "14px",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
        <a
          href={researchHref}
          aria-current={activeView.type === "research" ? "page" : undefined}
          style={navItemStyle(activeView.type === "research")}
        >
          <BookOpen size={14} /> Research Repository
        </a>
        <a
          href={specsHref}
          aria-current={activeView.type === "specs" ? "page" : undefined}
          style={navItemStyle(activeView.type === "specs")}
        >
          <Layers size={14} /> Specs
        </a>
      </div>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {orderedSections.map((s) => {
          const fixed = isFixedSection(s.id);
          const FixedIcon = FIXED_SECTION_META[s.id]?.icon;
          return (
            <div key={s.id}>
              <div className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.sm, padding: `0 ${SPACE.base}`, marginBottom: SPACE.xs }}>
                {fixed ? (
                  <div title={FIXED_SECTION_META[s.id]?.tooltip} style={{ ...sectionLabelStyle, display: "flex", alignItems: "center", gap: "5px" }}>
                    {FixedIcon && <FixedIcon size={11} style={{ flexShrink: 0 }} />}
                    {s.name}
                  </div>
                ) : editingSectionId === s.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingSectionId(null);
                    }}
                    style={{ ...sectionLabelStyle, border: "none", outline: "none", background: "none", padding: 0, minWidth: 0 }}
                  />
                ) : (
                  <div onClick={() => startEdit(s)} title="Click to rename" style={{ ...sectionLabelStyle, cursor: "pointer" }}>
                    {s.name || "Untitled section"}
                  </div>
                )}
                <IconButton onClick={() => onCreateDocument(s.id)} title="New document in this section">
                  <Plus size={12} />
                </IconButton>
                {!fixed && (
                  <IconButton className="reveal" danger onClick={() => onDeleteSection(s.id)} title="Delete section">
                    <Trash2 size={12} />
                  </IconButton>
                )}
              </div>

              {s.documents.length === 0 ? (
                <div style={{ fontFamily: font, fontSize: SIZE.sm, color: INK_FAINT, padding: `${SPACE.sm} ${SPACE.base}` }}>No documents yet</div>
              ) : (
                s.documents.map((doc) => (
                  <div key={doc.id} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                    <a
                      href={docHref(s.id, doc.id)}
                      aria-current={activeView.type === "doc" && activeView.docId === doc.id ? "page" : undefined}
                      style={{ ...navItemStyle(activeView.type === "doc" && activeView.docId === doc.id), flex: 1, minWidth: 0 }}
                    >
                      <FileText size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title || "Untitled document"}
                      </span>
                    </a>
                    <IconButton
                      className="reveal" danger
                      onClick={() => onDeleteDocument(s.id, doc.id)}
                      title="Delete document"
                      style={{ flexShrink: 0 }}
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <Button fullWidth onClick={onCreateSection}>
        <Plus size={13} /> New section
      </Button>
    </div>
  );
}
