import { FolderOpen, Unlink } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, SIZE, WEIGHT, SPACE, SAVE_STATUS_COLOR, SAVE_STATUS_LABEL } from "./lib/theme";
import { Wordmark } from "./ui/text";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import DiskChanges from "./DiskChanges";

// One header, identical everywhere — the home page and every board share it rather than
// each route rendering its own top bar. The brand doubles as the way back home.
export default function Header({ saveStatus, onRetrySave, onChangeFolder, onDetachFolder, diskLog = [], diskLogOpen = false, onDiskLogOpenChange, diskLogHref }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: `10px ${SPACE.xl}`, borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
    }}>
      {/* Same wordmark as the start page, just smaller — the shared definition in ui/text.js
          overrides .btn's own weight so the two can't drift apart again. */}
      <Wordmark as="a" size={SIZE.md} href="#" className="btn btn--sm btn--subtle" style={{ marginLeft: "-6px", textDecoration: "none" }}>
        monk
      </Wordmark>

      <div style={{ display: "flex", alignItems: "center", gap: SPACE.xl }}>
        <DiskChanges log={diskLog} open={diskLogOpen} onOpenChange={onDiskLogOpenChange} hrefFor={diskLogHref} />
        <Button variant="subtle" onClick={onChangeFolder} title="Switch to a different research folder">
          <FolderOpen size={16} /> Change folder
        </Button>
        {/* Icon-only and quiet on purpose: detaching is rare, one-way-feeling (back to the
            start screen), and shouldn't compete with "Change folder" for attention. */}
        {onDetachFolder && (
          <IconButton onClick={onDetachFolder} title="Detach this folder and return to the start screen" style={{ color: INK_SOFT }}>
            <Unlink size={15} />
          </IconButton>
        )}
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
