import { useId, useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import {
  font, INK, INK_SOFT, INK_FAINT, ACCENT, ACTIVITY, RESEARCH_PLAN, SIZE, SPACE, RADIUS, BRAND, PAGE,
} from "./lib/theme";
import { Dot, Eyebrow, Meta, Wordmark } from "./ui/text";
import { recentlyTouched, relativeTime } from "./lib/recentActivity";
import Page from "./ui/Page";

const KIND_COLOR = {
  signal: ACCENT.signal,
  insight: ACCENT.insight,
  spec: ACTIVITY,
  initiative: ACCENT.action,
  researchPlan: RESEARCH_PLAN,
};
// A kind's name where it isn't just the kind itself.
const KIND_LABEL = { researchPlan: "plan" };

// The line under the wordmark: one of these, picked fresh on each load. European monks only,
// and only lines that are really theirs — nothing from the quote-site apocrypha.
const MONK_QUOTES = [
  { text: "Listen with the ear of your heart.", by: "Rule of St Benedict" },
  { text: "Idleness is the enemy of the soul.", by: "Rule of St Benedict" },
  { text: "Let all things be done in moderation.", by: "Rule of St Benedict" },
  { text: "Ora et labora.", by: "Benedictine motto" },
  { text: "You will find more in woods than in books.", by: "Bernard of Clairvaux" },
  { text: "What you need is not a sceptre but a hoe.", by: "Bernard of Clairvaux" },
  { text: "I believe so that I may understand.", by: "Anselm of Canterbury" },
  { text: "Faith seeking understanding.", by: "Anselm of Canterbury" },
  { text: "We shall not be asked what we have read, but what we have done.", by: "Thomas à Kempis" },
  { text: "Of two evils, the lesser is always to be chosen.", by: "Thomas à Kempis" },
];

// A scribe's writing desk in side view: a sloped board with a ledge at its low end, on a post
// and a foot. On load it assembles the way you'd set one up — the foot, then the post rises,
// then the board tips down into its slope (see .desk-mark in index.css).
//
// Everything is stroked with butt caps so the parts meet squarely. The gradient is in user
// space, not objectBoundingBox: a bounding-box gradient on the post, a vertical line with a
// zero-width box, doesn't paint at all.
//
// The viewBox is offset rather than starting at 0,0. The board's high end pulls the ink up and
// left and the foot anchors it low, so the window is moved until the midpoint of the ink's
// bounding-box centre and its centre of mass sits on the page axis — the same rule the crescent
// used: centring the box alone overcorrects, centring the mass alone undercorrects.
function DeskMark({ size = 96 }) {
  const grad = `desk-grad-${useId().replace(/:/g, "")}`;
  return (
    <svg className="desk-mark" width={size} height={size} viewBox="0 7 100 100" role="img" aria-label="Monk">
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="16" y1="24" x2="84" y2="92">
          <stop offset="0%" stopColor={BRAND.from} />
          <stop offset="100%" stopColor={BRAND.to} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${grad})`}>
        <path className="desk-mark__foot" d="M30 86 H70" strokeWidth="8" />
        <path className="desk-mark__post" d="M50 42 V84" strokeWidth="10" />
        {/* Board and ledge are one filled outline: as two butt-capped strokes they met at an
            angle and left a stepped notch at the joint. It's the board's centre line (18,30)–
            (80,50) at 11 wide, with the ledge rising 7 above its low end. The group is there
            because SVG transforms go on a <g>. */}
        <g className="desk-mark__board">
          <path d="M16.31 35.24 L19.69 24.76 L75.98 42.92 L78.13 36.26 L83.84 38.1 L78.31 55.24 Z" fill={`url(#${grad})`} stroke="none" />
        </g>
      </g>
    </svg>
  );
}

function RecentRow({ item, href, now, delay }) {
  const inner = (
    <>
      <Dot color={KIND_COLOR[item.kind] || INK_FAINT} />
      <Meta style={{ fontSize: SIZE.xs, width: "62px", flexShrink: 0, textTransform: "capitalize" }}>{KIND_LABEL[item.kind] || item.kind}</Meta>
      <span style={{ flex: 1, minWidth: 0, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      <Meta style={{ fontSize: SIZE.sm, flexShrink: 0 }}>{relativeTime(item.updatedAt, now)}</Meta>
    </>
  );
  const style = {
    display: "flex", alignItems: "center", gap: SPACE.lg,
    fontFamily: font, fontSize: SIZE.body, textDecoration: "none",
    padding: `${SPACE.base} ${SPACE.lg}`, margin: `0 -${SPACE.lg}`, borderRadius: RADIUS.md,
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
export default function Home({ signals = [], insights = [], specs = [], initiatives = [], researchPlans = [], onCreateSpec, recentHref, folderName, subfolder, onChangeFolder }) {
  const [now] = useState(() => Date.now());
  const [quote] = useState(() => MONK_QUOTES[Math.floor(Math.random() * MONK_QUOTES.length)]);
  const recent = recentlyTouched({ signals, insights, specs, initiatives, researchPlans }, 8);

  // No background: every page takes the app ground from body (see lib/theme.js).
  return (
    <Page landing>
      <div style={{ maxWidth: PAGE.narrow, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <DeskMark />
          {/* Shared with the header — see Wordmark in ui/text.jsx. Size and the negative top
              margin set the lockup: the negative margin closes the space the desk leaves below
              its foot inside the SVG box, down to about one x-height between the mark and the
              word. The word starts entering as the board settles. */}
          <Wordmark
            as="h1"
            size="32px"
            className="enter-up"
            style={{
              marginTop: "-8px", marginBottom: 0, marginLeft: 0,
              animationDelay: "760ms", animationFillMode: "backwards",
            }}
          >
            monk
          </Wordmark>

          {/* A monk quote in place of a tagline. A step up from UI text but far enough below the
              wordmark that the name reads first, and soft ink so it sits back beside the mark;
              the attribution drops to faint ink. It follows the word in by the same 80–100ms
              step the rest of the page staggers on. */}
          <p
            className="enter-up"
            style={{
              margin: `${SPACE.lg} 0 0`, fontFamily: font, fontSize: SIZE.md, lineHeight: 1.4,
              color: INK_SOFT, textAlign: "center", textWrap: "balance",
              animationDelay: "840ms", animationFillMode: "backwards",
            }}
          >
            “{quote.text}”{" "}
            <span style={{ color: INK_FAINT, whiteSpace: "nowrap" }}>— {quote.by}</span>
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
              title={subfolder ? `Working in ${folderName}/${subfolder} — switch to a different project` : "Switch to a different repository"}
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
                {folderName || "Repository"}
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
