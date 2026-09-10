import { ChevronRight } from "lucide-react";
import { font, INK, INK_SOFT, INK_FAINT, BORDER, SIZE, WEIGHT } from "./lib/theme";

// `items` is an ordered list of `{ label, onClick?, icon?, title? }` — the last item is always
// rendered as plain (current-page) text even if it happens to carry an onClick; every earlier
// item is clickable only if it has one (e.g. a "Section not found" crumb has nowhere useful to
// go). The first crumb is the connected folder, which is why `icon` exists: it should read as
// "the folder this all lives in", not as another level of navigation.
export default function Breadcrumbs({ items }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
      padding: "11px 20px", borderBottom: `1px solid ${BORDER}`, boxSizing: "border-box",
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
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            {idx > 0 && <ChevronRight size={12} style={{ color: INK_FAINT, flexShrink: 0 }} />}
            {item.onClick && !isLast ? (
              <button
                className="crumb"
                onClick={item.onClick}
                title={item.title}
                style={{
                  display: "flex", alignItems: "center", gap: "5px", minWidth: 0,
                  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui, color: INK_SOFT,
                  background: "none", border: "none", cursor: "pointer", padding: "2px 4px", margin: "0 -4px",
                  borderRadius: "4px",
                }}
              >
                {label}
              </button>
            ) : (
              <span style={{
                display: "flex", alignItems: "center", gap: "5px", minWidth: 0,
                fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui, color: isLast ? INK : INK_SOFT,
              }}>
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
