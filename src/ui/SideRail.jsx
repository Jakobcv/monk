import { BG_APP, BORDER, SHADOW } from "../lib/theme";
import { Eyebrow } from "./text";

// The persistent metadata panel on the right of a paper page — a spec's Status/Initiative/Owner,
// a research plan's Status/Initiative/Specs. Tinted and shadowed so it reads as a distinct panel
// rather than another column of the page (the shadow falls left, into the page).
export default function SideRail({ children }) {
  return (
    <div style={{
      width: "220px", flexShrink: 0, height: "100%", overflowY: "auto", boxSizing: "border-box",
      backgroundColor: BG_APP, borderLeft: `1px solid ${BORDER}`, boxShadow: SHADOW.panel,
      padding: "20px 18px", display: "flex", flexDirection: "column", gap: "18px",
    }}>
      {children}
    </div>
  );
}

// One labelled block of the rail. `action` sits on the label's line (an add control, say).
export function SideRailSection({ label, action = null, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", minHeight: action ? "24px" : undefined }}>
        <Eyebrow>{label}</Eyebrow>
        {action}
      </div>
      <div style={{ marginTop: "8px" }}>{children}</div>
    </div>
  );
}

export function SideRailDivider() {
  return <div style={{ height: "1px", backgroundColor: BORDER, flexShrink: 0 }} />;
}
