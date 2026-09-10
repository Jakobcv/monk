import { FolderOpen } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, SIZE, WEIGHT, SPACE, SAVE_STATUS_COLOR, SAVE_STATUS_LABEL } from "./lib/theme";
import Button from "./ui/Button";

// One header, identical everywhere — the home page and every board share it rather than
// each route rendering its own top bar. The brand doubles as the way back home.
export default function Header({ saveStatus, onRetrySave, onChangeFolder }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: `10px ${SPACE.xl}`, borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
    }}>
      <a href="#" className="btn btn--sm btn--subtle" style={{ fontSize: SIZE.md, color: INK, marginLeft: "-6px", textDecoration: "none" }}>
        Monk
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: SPACE.xl }}>
        <Button variant="subtle" onClick={onChangeFolder} title="Switch to a different research folder">
          <FolderOpen size={14} /> Change folder
        </Button>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.md }}>
          <span style={{
            width: "6px", height: "6px", borderRadius: "50%",
            backgroundColor: SAVE_STATUS_COLOR[saveStatus],
            transition: "background-color 120ms",
          }} />
          <span style={{ fontFamily: font, fontSize: SIZE.xs, color: INK_SOFT }}>{SAVE_STATUS_LABEL[saveStatus]}</span>
          {saveStatus === "error" && (
            <button
              onClick={onRetrySave}
              style={{
                fontFamily: font, fontWeight: WEIGHT.medium, fontSize: SIZE.xs, color: INK,
                background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline",
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
