import { Eyebrow } from "./text";

// The persistent metadata panel of a paper page — a spec's Status/Initiative/Owner, a research plan's
// Status/Initiative/Specs. Beside the body it's a tinted column whose shadow falls left, into the
// page; in a narrow frame PaperFrame's container query turns it into a wrapping strip under the tabs.
// Both looks live in .side-rail (index.css), which is why nothing here is inline.
export default function SideRail({ children }) {
  return <div className="side-rail">{children}</div>;
}

// One labelled block of the rail. `action` sits on the label's line (an add control, say).
export function SideRailSection({ label, action = null, children }) {
  return (
    <div className="side-rail__section">
      <div className={`side-rail__label${action ? " side-rail__label--action" : ""}`}>
        <Eyebrow>{label}</Eyebrow>
        {action}
      </div>
      <div className="side-rail__body">{children}</div>
    </div>
  );
}

export function SideRailDivider() {
  return <div className="side-rail__divider" />;
}

// What sits at the foot of the rail — a page's Delete. Pinned to the bottom of the column; in the
// strip it goes to the end of the row.
export function SideRailFoot({ children }) {
  return <div className="side-rail__foot">{children}</div>;
}
