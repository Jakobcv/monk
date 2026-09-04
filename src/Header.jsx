import { FolderOpen } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, SAVE_STATUS_COLOR, SAVE_STATUS_LABEL } from "./lib/theme";

// One header, identical everywhere — the home page and every board share it rather than
// each route rendering its own top bar. The brand doubles as the way back home.
export default function Header({ onGoHome, saveStatus, onRetrySave, onChangeFolder }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 18px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
    }}>
      <button
        onClick={onGoHome}
        style={{
          fontFamily: font, fontWeight: 600, fontSize: "14px", color: INK,
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        Evidence Loop
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          onClick={onChangeFolder}
          title="Switch to a different research folder"
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontFamily: font, fontWeight: 600, fontSize: "12px", color: INK_SOFT,
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <FolderOpen size={14} /> Change folder
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: SAVE_STATUS_COLOR[saveStatus] }} />
          <span style={{ fontFamily: font, fontSize: "11px", color: INK_SOFT }}>{SAVE_STATUS_LABEL[saveStatus]}</span>
          {saveStatus === "error" && (
            <button
              onClick={onRetrySave}
              style={{ fontFamily: font, fontSize: "11px", color: INK, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
