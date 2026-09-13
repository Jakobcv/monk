import { useId, useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import {
  font, INK, INK_SOFT, INK_FAINT, ACCENT, ACTIVITY, SIZE, SPACE, RADIUS, BRAND,
} from "./lib/theme";
import { Eyebrow, Meta, Wordmark } from "./ui/text";
import { recentlyTouched, relativeTime } from "./lib/recentActivity";
import Page from "./ui/Page";

const KIND_COLOR = {
  signal: ACCENT.signal,
  insight: ACCENT.insight,
  spec: ACTIVITY,
  activity: ACTIVITY,
  initiative: ACCENT.action,
};

// A gradient disc with a second disc subtracted out of it. At rest the subtraction leaves a
// crescent; on load the cut circle sweeps in along the line it rests on (see .moon-mark in
// index.css), so the mark reads as a full moon first and then narrows to a crescent.
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
// drifted down-left. The window is moved until the midpoint of the crescent's bounding-box
// centre and its centre of mass sits on the page axis: centring the box alone overcorrects (the
// ink looks pushed right), centring the mass alone undercorrects.
function MoonMark({ size = 96 }) {
  const uid = useId().replace(/:/g, "");
  const grad = `moon-grad-${uid}`, mask = `moon-mask-${uid}`;
  return (
    <svg className="moon-mark" width={size} height={size} viewBox="-6 5 100 100" role="img" aria-label="Monk">
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
      <Meta style={{ fontSize: SIZE.xs, width: "62px", flexShrink: 0, textTransform: "capitalize" }}>{item.kind}</Meta>
      <span style={{ flex: 1, minWidth: 0, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      <Meta style={{ fontSize: SIZE.sm, flexShrink: 0 }}>{relativeTime(item.updatedAt, now)}</Meta>
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

// The start page: the mark, and the short list of what you last touched so you can get back
// into it.
// `folderName` is the project — the repo Monk was connected to — and `subfolder` the folder inside
// it Monk works in (monk/). With no known project, `folderName` is the connected folder itself and
// there is no subfolder.
export default function Home({ signals = [], insights = [], activities = [], specs = [], initiatives = [], onCreateSpec, recentHref, folderName, subfolder, onChangeFolder }) {
  const [now] = useState(() => Date.now());
  const recent = recentlyTouched({ signals, insights, activities, specs, initiatives }, 8);

  // No background: every page takes the app ground from body (see lib/theme.js).
  return (
    <Page landing>
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <MoonMark />
          {/* Shared with the header — see Wordmark in ui/text.jsx. Size and the negative top
              margin set the lockup: the negative margin closes the space the crescent leaves
              below its ink inside the SVG box, down to one x-height between the crescent and
              the word, and at this size the crescent carries about twice the word's visual mass.
              It was 1.6 x-heights and 3.4×, which read as a caption under a moon rather than a
              mark and a name. The word starts entering as the crescent settles. */}
          <Wordmark
            as="h1"
            size="32px"
            className="enter-up"
            style={{
              marginTop: "-12px", marginBottom: 0, marginLeft: 0,
              animationDelay: "760ms", animationFillMode: "backwards",
            }}
          >
            monk
          </Wordmark>

          {/* The one line on what this is. A step up from UI text but far enough below the
              wordmark that the name reads first, and soft ink so it sits back beside the mark.
              It follows the word in by the same 80–100ms step the rest of the page staggers on. */}
          <p
            className="enter-up"
            style={{
              margin: "10px 0 0", fontFamily: font, fontSize: SIZE.md, lineHeight: 1.4,
              color: INK_SOFT, textAlign: "center", textWrap: "balance",
              animationDelay: "840ms", animationFillMode: "backwards",
            }}
          >
            From signal to spec, for teams and agents
          </p>

          {/* Which folder you're actually in, and the way out of it. Every other route carries
              this as the first breadcrumb; the start page has no breadcrumb bar, so it sat
              under the wordmark as a subtitle instead — which is roughly where it belongs
              anyway: this is monk, and this is the workspace you have open.

              Colour is left to `.crumb` rather than set inline. Setting it here would beat the
              class's :hover and kill the hover state, which is exactly the bug the breadcrumbs
              had. */}
          {onChangeFolder && (
            <button
              className="enter-up crumb"
              onClick={onChangeFolder}
              title={subfolder ? `Working in ${folderName}/${subfolder} — switch to a different project` : "Switch to a different research folder"}
              style={{
                display: "inline-flex", alignItems: "center", gap: SPACE.sm,
                marginTop: SPACE.xl, padding: "5px 11px", borderRadius: RADIUS.pill,
                border: "none", background: "none", cursor: "pointer",
                fontFamily: font, fontSize: SIZE.sm,
                animationDelay: "920ms", animationFillMode: "backwards",
              }}
            >
              <FolderOpen size={12} style={{ flexShrink: 0 }} />
              <span translate="no">
                {folderName || "Research folder"}
                {subfolder && <span style={{ color: INK_FAINT }}>/{subfolder}</span>}
              </span>
            </button>
          )}
        </div>

        <div className="enter-up" style={{ marginTop: "68px", animationDelay: "1020ms", animationFillMode: "backwards" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.lg, marginBottom: SPACE.base }}>
            <Eyebrow section>Recently touched</Eyebrow>
            {onCreateSpec && (
              <button className="btn btn--sm btn--subtle" onClick={onCreateSpec} style={{ color: INK_SOFT, marginRight: "-6px" }}>
                <Plus size={16} /> New spec
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <Meta as="div" style={{ fontSize: SIZE.body, lineHeight: 1.6, paddingTop: SPACE.base }}>
              Nothing here yet. Start a spec, or capture your first signal in the research repository.
            </Meta>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recent.map((item, i) => (
                <RecentRow
                  key={`${item.kind}:${item.id}:${i}`}
                  item={item}
                  href={recentHref ? recentHref(item.kind, item.id) : null}
                  now={now}
                  delay={1120 + i * 40}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
