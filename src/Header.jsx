import { Menu, Settings as SettingsIcon } from "lucide-react";
import { font, INK, INK_SOFT, BORDER, SIZE, WEIGHT, SPACE, SAVE_STATUS_COLOR, SAVE_STATUS_LABEL } from "./lib/theme";
import { Wordmark } from "./ui/text";
import IconButton from "./ui/IconButton";
import DiskChanges from "./DiskChanges";

// One header, identical everywhere — the home page and every board share it rather than
// each route rendering its own top bar. The brand doubles as the way back home.
//
// The folder controls used to live here as a button and an icon, which is what made a header of
// three things read as a toolbar. They are in Settings now, one home each.
// Below 768px the sidebar is a drawer, and `onOpenNav` puts its menu control at the left of the row.
// The control is in the markup at every width and only shown on a narrow screen (.nav-toggle).
export default function Header({ onOpenNav, navOpen = false, saveStatus, onRetrySave, onOpenSettings, diskLog = [], diskLogOpen = false, onDiskLogOpenChange, diskLogHref }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: `10px ${SPACE.xl}`, borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
    }}>
      {/* Same wordmark as the start page, just smaller — the shared definition in ui/text.js
          overrides .btn's own weight so the two can't drift apart again. */}
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.base, minWidth: 0 }}>
        {onOpenNav && (
          <IconButton className="nav-toggle" onClick={onOpenNav} aria-label="Menu" aria-expanded={navOpen} aria-controls="sidebar" style={{ color: INK_SOFT, marginLeft: "-4px" }}>
            <Menu size={16} />
          </IconButton>
        )}
        <Wordmark as="a" size={SIZE.md} href="#" className="btn btn--sm btn--subtle" style={{ marginLeft: "-6px", textDecoration: "none" }}>
          monk
        </Wordmark>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: SPACE.xl }}>
        <DiskChanges log={diskLog} open={diskLogOpen} onOpenChange={onDiskLogOpenChange} hrefFor={diskLogHref} />
        {onOpenSettings && (
          <IconButton onClick={onOpenSettings} title="Settings" aria-label="Settings" style={{ color: INK_SOFT }}>
            <SettingsIcon size={16} />
          </IconButton>
        )}
        {/* No status at all when nothing is being saved (the demo), rather than one that lies. */}
        {saveStatus != null && <div style={{ display: "flex", alignItems: "center", gap: SPACE.md }}>
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
        </div>}
      </div>
    </div>
  );
}
