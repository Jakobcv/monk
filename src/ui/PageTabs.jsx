import { useRef, useState, useLayoutEffect } from "react";
import { font, INK, BORDER, SIZE, WEIGHT, MOTION } from "../lib/theme";

// The active-tab marker is a single sliding bar, not a per-tab border — so a tab is just its label.
// Colour + hover live in .spec-tab (index.css).
const tabLinkStyle = {
  fontFamily: font, fontWeight: WEIGHT.semibold, fontSize: SIZE.ui,
  padding: "8px 2px", textDecoration: "none",
};

// A page's tab bar under its title — a spec's Overview / Solution / Plan, a research plan's Overview /
// Analysis. Tabs are real links (`tabHref`), so each tab has a URL and opens in a new tab like any
// link. `tabs` should be a module-level constant: the underline is re-measured when the active tab
// changes, not when the array does.
//
// The underline is one bar that slides and resizes between tabs. Its geometry is measured from the
// active link; the first measurement lands before paint, so it doesn't slide in from the left.
export default function PageTabs({ tabs, activeTab, tabHref }) {
  const tabRefs = useRef([]);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[tabs.findIndex((t) => t.key === activeTab)];
      if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div role="tablist" style={{ position: "relative", display: "flex", gap: "18px", borderBottom: `1px solid ${BORDER}`, marginTop: "18px" }}>
      {tabs.map((t, i) => (
        <a
          key={t.key}
          ref={(el) => (tabRefs.current[i] = el)}
          className="spec-tab"
          href={tabHref(t.key)}
          role="tab"
          aria-selected={activeTab === t.key}
          style={tabLinkStyle}
        >
          {t.label}
        </a>
      ))}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, bottom: "-1px", height: "2px",
          width: `${underline.width}px`, transform: `translateX(${underline.left}px)`,
          backgroundColor: INK, borderRadius: "1px",
          transition: `transform ${MOTION.base} ${MOTION.ease}, width ${MOTION.base} ${MOTION.ease}`,
        }}
      />
    </div>
  );
}
