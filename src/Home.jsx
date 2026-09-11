import { useId, useState } from "react";
import { Plus } from "lucide-react";
import {
  font, INK, INK_SOFT, INK_FAINT, ACCENT, ACTIVITY, SIZE, SPACE, BRAND,
} from "./lib/theme";
import { eyebrow, meta, wordmark } from "./ui/text";
import { recentlyTouched, relativeTime } from "./lib/dashboardMetrics";

const KIND_COLOR = {
  signal: ACCENT.signal,
  insight: ACCENT.insight,
  spec: ACTIVITY,
  activity: ACTIVITY,
  initiative: ACCENT.action,
};

// A gradient disc with a second disc subtracted out of it. At rest the subtraction leaves a
// crescent; on load the cut circle drops in from above (see .moon-mark in index.css) so the
// mark reads as a full moon first and then waxes.
//
// The subtraction is a <mask>, not a circle painted in the page colour. That was the earlier
// approach and it quietly required the mark to sit on --bg — it would have shown a white bite
// on any tinted surface. A mask composites properly on anything.
//
// Geometry: disc r=34 at (50,50), cut r=29 at (62.2, 39.5). The horns are shorter than the
// thinner crescent this replaced, which is what makes it survive being rendered at 16–24px.
//
// There was a blur-and-threshold filter here to round the cusps off. It worked, and it also
// destroyed the antialiasing: the threshold drove alpha 0→1 across a band far narrower than a
// pixel, so every edge pixel snapped fully on or fully off and the arcs came out as a visible
// staircase. Softening the threshold restores the antialiasing but then rounds nothing, since
// the rounding *is* the hard threshold. Rounding the cusps properly needs real geometry — arcs
// with fillets — which the animation can't drive. Short horns and clean edges it is.
//
// The viewBox is offset rather than starting at 0,0. A crescent's ink sits low and to the left
// of the disc it was cut from, so a geometrically centred box leaves the shape looking like it
// drifted down-left. Moving the window takes out about two thirds of that.
function MoonMark({ size = 104 }) {
  const uid = useId().replace(/:/g, "");
  const grad = `moon-grad-${uid}`, mask = `moon-mask-${uid}`;
  return (
    <svg className="moon-mark" width={size} height={size} viewBox="-8 5 100 100" role="img" aria-label="Monk">
      <defs>
        <linearGradient id={grad} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={BRAND.from} />
          <stop offset="100%" stopColor={BRAND.to} />
        </linearGradient>
        <mask id={mask}>
          <circle cx="50" cy="50" r="34" fill="#fff" />
          <circle className="moon-mark__cut" cx="62.2" cy="39.5" r="29" fill="#000" />
        </mask>
      </defs>
      {/* The entrance rides on a wrapping group so it transforms the already-masked result —
          scaling the masked circle itself would slide it against a mask that stays put. */}
      <g className="moon-mark__disc">
        <circle cx="50" cy="50" r="34" fill={`url(#${grad})`} mask={`url(#${mask})`} />
      </g>
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
          {/* Shared with the header — see `wordmark` in ui/text.js. The negative top margin
              closes the gap the crescent leaves below its own ink inside the SVG box. */}
          <h1
            className="enter-up"
            style={{
              ...wordmark("28px"), marginTop: "-6px", marginBottom: 0, marginLeft: 0,
              animationDelay: "980ms", animationFillMode: "backwards",
            }}
          >
            monk
          </h1>
        </div>

        <div className="enter-up" style={{ marginTop: "68px", animationDelay: "1100ms", animationFillMode: "backwards" }}>
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
                  delay={1160 + i * 40}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
