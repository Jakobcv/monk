import { useState } from "react";
import { Plus } from "lucide-react";
import {
  font, INK, INK_SOFT, INK_FAINT, ACCENT, ACTIVITY, SIZE, WEIGHT, LEADING, SPACE,
  BRAND, BRAND_GRADIENT,
} from "./lib/theme";
import { eyebrow, meta } from "./ui/text";
import { recentlyTouched, relativeTime } from "./lib/dashboardMetrics";

const KIND_COLOR = {
  signal: ACCENT.signal,
  insight: ACCENT.insight,
  spec: ACTIVITY,
  activity: ACTIVITY,
  initiative: ACCENT.action,
};

// Two circles: the gradient disc, and a disc painted in the page background sitting on top of
// it. At rest the second one bites a crescent out of the first; on load it drops in from above
// (see .moon-mark in index.css) so the mark reads as a full moon first and then waxes.
//
// Geometry: disc r=34 at (50,50), cutout r=31 offset 19 units up-and-right — which leaves a
// crescent 34 + 19 − 31 = 22 units thick at its widest, opening toward the upper right, the
// same way the brand mark does.
function MoonMark({ size = 148 }) {
  return (
    <svg className="moon-mark" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Monk">
      <defs>
        <linearGradient id="moon-gradient" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor={BRAND.from} />
          <stop offset="100%" stopColor={BRAND.to} />
        </linearGradient>
      </defs>
      <circle className="moon-mark__disc" cx="50" cy="50" r="34" fill="url(#moon-gradient)" />
      <circle className="moon-mark__cut" cx="64.5" cy="37.5" r="31" fill="var(--bg)" />
    </svg>
  );
}

function RecentRow({ item, href, now, delay }) {
  const inner = (
    <>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0, background: KIND_COLOR[item.kind] || INK_FAINT }} />
      <span style={{ ...meta, fontSize: SIZE.xs, width: "62px", flexShrink: 0, textTransform: "capitalize" }}>{item.kind}</span>
      <span style={{ flex: 1, minWidth: 0, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      <span style={{ ...meta, fontSize: SIZE.sm, flexShrink: 0 }}>{relativeTime(item.updatedAt, now)}</span>
    </>
  );
  const style = {
    display: "flex", alignItems: "center", gap: SPACE.lg,
    fontFamily: font, fontSize: SIZE.body, textDecoration: "none",
    padding: "10px 12px", margin: "0 -12px", borderRadius: "8px",
    animationDelay: `${delay}ms`, animationFillMode: "backwards",
  };
  return href
    ? <a className="enter-up recent-row" href={href} style={style}>{inner}</a>
    : <div className="enter-up recent-row" style={style}>{inner}</div>;
}

// The start page. Not a dashboard — the numbers live on their own page now (DashboardPage);
// this is the mark, and the short list of what you last touched so you can get back into it.
export default function Home({ signals = [], insights = [], activities = [], specs = [], initiatives = [], onCreateSpec, recentHref }) {
  const [now] = useState(() => Date.now());
  const recent = recentlyTouched({ signals, insights, activities, specs, initiatives }, 8);

  return (
    <div style={{ height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "10vh 40px 64px", background: "var(--bg)" }}>
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <MoonMark />
          <h1
            className="enter-up"
            style={{
              fontFamily: font, fontWeight: WEIGHT.black, fontSize: "46px",
              letterSpacing: "-0.035em", margin: `${SPACE.xl} 0 0`, lineHeight: LEADING.tight,
              background: BRAND_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text",
              color: "transparent", WebkitTextFillColor: "transparent",
              animationDelay: "1250ms", animationFillMode: "backwards",
            }}
          >
            monk
          </h1>
        </div>

        <div className="enter-up" style={{ marginTop: "72px", animationDelay: "1400ms", animationFillMode: "backwards" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.lg, marginBottom: SPACE.base }}>
            <div style={{ ...eyebrow, fontSize: SIZE.xs, letterSpacing: "0.07em" }}>Recently touched</div>
            {onCreateSpec && (
              <button className="btn btn--sm btn--subtle" onClick={onCreateSpec} style={{ color: INK_SOFT, marginRight: "-6px" }}>
                <Plus size={12} /> New spec
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <div style={{ ...meta, fontSize: SIZE.body, lineHeight: 1.6, paddingTop: SPACE.base }}>
              Nothing here yet. Start a spec, or capture your first signal in the research repository.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recent.map((item, i) => (
                <RecentRow
                  key={`${item.kind}:${item.id}:${i}`}
                  item={item}
                  href={recentHref ? recentHref(item.kind, item.id) : null}
                  now={now}
                  delay={1460 + i * 45}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
