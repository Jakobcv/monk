import { ChevronRight } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, SIZE, WEIGHT, SPACE, RADIUS, PAGE } from "./lib/theme";

// `items` is an ordered list of `{ label, href?, onClick?, icon?, title? }` — the last item is
// always rendered as plain (current-page) text even if it carries a link; an earlier item is a
// real `<a href>` when it navigates (so Cmd/Ctrl/middle-click work), a `<button>` when it fires
// an action that isn't navigation (the folder crumb re-opens the folder picker), and plain text
// when it goes nowhere (a "Section not found" crumb). The first crumb is the connected folder,
// which is why `icon` exists: it should read as "the folder this all lives in".
//
// Colour / background / hover live in `.crumb` (index.css) — keep them out of here so :hover
// isn't overridden by an inline value.
//
// The side padding is PAGE.chromeX, the gutter the title block and the side rail use too, so the
// first crumb, the page kind and the title share one left edge.
const crumbStyle = {
  display: "flex", alignItems: "center", gap: SPACE.sm, minWidth: 0,
  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui,
  border: "none", cursor: "pointer", padding: `${SPACE.xs} ${SPACE.sm}`, margin: `0 -${SPACE.sm}`,
  borderRadius: RADIUS.xs, textDecoration: "none",
};

export default function Breadcrumbs({ items }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: SPACE.md, flexShrink: 0,
      padding: `${SPACE.lg} ${PAGE.chromeX}`, borderBottom: `1px solid ${BORDER}`, boxSizing: "border-box",
    }}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const Icon = item.icon;
        const label = (
          <>
            {Icon && <Icon size={13} style={{ flexShrink: 0 }} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
          </>
        );
        const clickable = !isLast && (item.href || item.onClick);
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: SPACE.md, minWidth: 0 }}>
            {idx > 0 && <ChevronRight size={12} style={{ color: INK_FAINT, flexShrink: 0 }} />}
            {clickable && item.href ? (
              <a className="crumb" href={item.href} title={item.title} style={crumbStyle}>{label}</a>
            ) : clickable ? (
              <button className="crumb" onClick={item.onClick} title={item.title} style={crumbStyle}>{label}</button>
            ) : (
              <span style={{ ...crumbStyle, cursor: "default", color: isLast ? INK : INK_SOFT }}>{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
