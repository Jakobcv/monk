import { useRef, useState } from "react";
import { BookOpen, Layers, FileText, Plus, Trash2, Library, ShieldCheck, Palette, PenLine } from "lucide-react";
import { font, INK_FAINT, BORDER, SIZE, WEIGHT, SPACE, RADIUS } from "./lib/theme";
import { FIXED_SECTIONS, isFixedSection } from "./lib/documentModel";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import useModalFocus from "./ui/useModalFocus";

// Icon + one-line tooltip for each fixed section — purely presentational, keyed by id.
const FIXED_SECTION_META = {
  "product-knowledge": { icon: Library, tooltip: "The team's shared memory — what the product is for, what's been decided, what we know about users." },
  "standards": { icon: ShieldCheck, tooltip: "Contracts agents build to — from the design system to accessibility." },
};

// Colour / background / hover / active-page all live in `.nav-item` (index.css) so :hover
// works — this is just the layout. Add `className="nav-item"` alongside it.
const navItemStyle = {
  display: "flex", alignItems: "center", gap: SPACE.base, width: "100%", textAlign: "left",
  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui, border: "none",
  borderRadius: RADIUS.sm, padding: `${SPACE.md} ${SPACE.base}`, cursor: "pointer", textDecoration: "none",
  boxSizing: "border-box",
};

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
// Workspace documents (lib/workspaceDocs.js) get an icon here rather than in the registry, which
// stays free of React so storage and the tests can import it.
const WORKSPACE_DOC_ICONS = { "design-system": Palette, "writing-guide": PenLine };

// Below 768px the same sidebar is a drawer: off-screen until the header's menu control opens it
// (`open`), over the dimmed page, and modal while it's out — see .sidebar in index.css. It's one
// element in both places rather than a second copy in a drawer, so the two can't drift apart.
// Opening it only ever happens on a narrow screen, so `open` alone says whether it's a drawer now.
export default function Sidebar({ sections, workspaceDocs = [], activeView, researchHref, specsHref, docHref, onCreateSection, onRenameSection, onDeleteSection, onCreateDocument, onDeleteDocument, open = false, onClose }) {
  const panelRef = useRef(null);
  // Escape in the rename field cancels the rename, not the drawer.
  useModalFocus(panelRef, onClose, { active: open, escapeInFields: false });
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
    <>
    {/* Closes on click, not pointerdown: gone at pointerdown, the rest of the tap would land on the
        page beneath — taking focus from the menu control it was just handed back to, or following
        whatever link was under the finger. */}
    {open && <div className="sidebar-backdrop" aria-hidden="true" onClick={onClose} />}
    <div
      ref={panelRef}
      id="sidebar"
      className="sidebar"
      data-open={open || undefined}
      role={open ? "dialog" : undefined}
      aria-modal={open || undefined}
      aria-label={open ? "Menu" : undefined}
      tabIndex={open ? -1 : undefined}
      // Choosing a place puts the drawer away — including the page already open, which changes
      // no hash and so wouldn't close it on its own.
      onClick={open ? (e) => { if (e.target.closest("a[href]")) onClose(); } : undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
        <a
          className="nav-item"
          href={researchHref}
          aria-current={activeView.type === "research" ? "page" : undefined}
          style={navItemStyle}
        >
          <BookOpen size={16} /> Research Repository
        </a>
        <a
          className="nav-item"
          href={specsHref}
          aria-current={activeView.type === "specs" ? "page" : undefined}
          style={navItemStyle}
        >
          <Layers size={16} /> Initiatives
        </a>
        {/* Always listed, so a workspace without one can see it's missing. The link opens its page
            either way; creating the file is a button there, never a side effect of a click here. */}
        {workspaceDocs.map((d) => {
          const Icon = WORKSPACE_DOC_ICONS[d.id] || FileText;
          return (
            <a
              key={d.id}
              className="nav-item"
              href={d.href}
              aria-current={activeView.type === "workspaceDoc" && activeView.id === d.id ? "page" : undefined}
              style={navItemStyle}
            >
              <Icon size={16} style={{ flexShrink: 0 }} /> {d.label}
              {!d.exists && (
                <span style={{ marginLeft: "auto", fontWeight: WEIGHT.normal, fontSize: SIZE.xs, color: INK_FAINT }}>Not set up</span>
              )}
            </a>
          );
        })}
      </div>

      <div style={{ height: "1px", backgroundColor: BORDER }} />

      {/* overflowX hidden: the invisible hit-area pseudos on the flush-right trash buttons (see
          .icon-btn::after) otherwise count as scrollable overflow and summon a horizontal bar. */}
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
        {orderedSections.map((s) => {
          const fixed = isFixedSection(s.id);
          const FixedIcon = FIXED_SECTION_META[s.id]?.icon;
          return (
            <div key={s.id}>
              <div className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.sm, padding: `0 ${SPACE.base}`, marginBottom: SPACE.xs }}>
                {fixed ? (
                  <div title={FIXED_SECTION_META[s.id]?.tooltip} style={{ ...sectionLabelStyle, display: "flex", alignItems: "center", gap: SPACE.sm }}>
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
                {/* This pair sits 4px apart — 25px centre to centre — so the targets cap just
                    under that. Height is free; the section label above is not interactive. */}
                <IconButton onClick={() => onCreateDocument(s.id)} title="New document in this section" style={{ "--hit-w": "28px", "--hit-h": "28px" }}>
                  <Plus size={16} />
                </IconButton>
                {!fixed && (
                  <IconButton className="reveal" danger onClick={() => onDeleteSection(s.id)} title="Delete section" style={{ "--hit-w": "28px", "--hit-h": "28px" }}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </div>

              {s.documents.length === 0 ? (
                <div style={{ fontFamily: font, fontSize: SIZE.sm, color: INK_FAINT, padding: `${SPACE.sm} ${SPACE.base}` }}>No documents yet</div>
              ) : (
                s.documents.map((doc) => (
                  <div key={doc.id} className="reveal-group" style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                    <a
                      className="nav-item"
                      href={docHref(s.id, doc.id)}
                      aria-current={activeView.type === "doc" && activeView.docId === doc.id ? "page" : undefined}
                      style={{ ...navItemStyle, flex: 1, minWidth: 0 }}
                    >
                      <FileText size={16} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.title || "Untitled document"}
                      </span>
                    </a>
                    <IconButton
                      className="reveal" danger
                      onClick={() => onDeleteDocument(s.id, doc.id)}
                      title="Delete document"
                      // The document link sits 2px to the left and fills the row, so width is
                      // capped hard to keep this off it. Rows are ~29px tall with no gap.
                      style={{ flexShrink: 0, "--hit-w": "26px", "--hit-h": "28px" }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <Button fullWidth onClick={onCreateSection}>
        <Plus size={16} /> New section
      </Button>
    </div>
    </>
  );
}
