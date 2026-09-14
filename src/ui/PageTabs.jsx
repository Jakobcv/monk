import { useRef, useState, useLayoutEffect } from "react";

// A page's tab bar under its title — a spec's Overview / Solution / Plan, a research plan's Overview /
// Analysis. Tabs are real links (`tabHref`), so each tab has a URL and opens in a new tab like any
// link. `tabs` should be a module-level constant: the underline is re-measured when the active tab
// changes, not when the array does. Layout and colour live in .page-tabs / .spec-tab (index.css).
//
// The underline is one bar that slides and resizes between tabs. Its geometry is measured from the
// active link; the first measurement lands before paint, so it doesn't slide in from the left.
export default function PageTabs({ tabs, activeTab, tabHref }) {
  const tabRefs = useRef([]);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    if (!tabs) return undefined;
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
    <div role="tablist" className="page-tabs">
      {tabs.map((t, i) => (
        <a
          key={t.key}
          ref={(el) => (tabRefs.current[i] = el)}
          className="spec-tab"
          href={tabHref(t.key)}
          role="tab"
          aria-selected={activeTab === t.key}
        >
          {t.label}
        </a>
      ))}
      <span
        aria-hidden="true"
        className="page-tabs__underline"
        style={{ width: `${underline.width}px`, transform: `translateX(${underline.left}px)` }}
      />
    </div>
  );
}
