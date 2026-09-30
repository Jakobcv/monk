import { useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import {
  font, READING, INK, INK_SOFT, INK_FAINT, ACCENT, ACTIVITY, RESEARCH_PLAN, SIZE, SPACE, RADIUS, PAGE,
} from "./lib/theme";
import { Dot, Eyebrow, Meta, Wordmark } from "./ui/text";
import { recentlyTouched, relativeTime } from "./lib/recentActivity";
import Page from "./ui/Page";
import DeskMark from "./ui/DeskMark";

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


function RecentRow({ item, href, now, delay }) {
  const inner = (
    <>
      <Dot color={KIND_COLOR[item.kind] || INK_FAINT} />
      <Meta style={{ fontSize: SIZE.xs, width: "62px", flexShrink: 0, textTransform: "capitalize" }}>{KIND_LABEL[item.kind] || item.kind}</Meta>
      <span style={{ ...READING, flex: 1, minWidth: 0, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
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

// The folder you're in, under the wordmark — a button when it can be switched, plain text when not.
const folderChipStyle = {
  display: "inline-flex", alignItems: "center", gap: SPACE.sm,
  marginTop: SPACE.xl, padding: "5px 11px", borderRadius: RADIUS.pill,
  border: "none", background: "none", cursor: "pointer",
  fontFamily: font, fontSize: SIZE.sm,
  animationDelay: "920ms", animationFillMode: "backwards",
};

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
              margin: `${SPACE.lg} 0 0`, ...READING, fontSize: SIZE.md, lineHeight: 1.4,
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
          {onChangeFolder ? (
            <button
              className="enter-up crumb"
              onClick={onChangeFolder}
              title={subfolder ? `Working in ${folderName}/${subfolder} — switch to a different project` : "Switch to a different repository"}
              style={folderChipStyle}
            >
              <FolderOpen size={12} style={{ flexShrink: 0 }} />
              <span translate="no">
                {folderName || "Repository"}
                {subfolder && <span style={{ color: INK_FAINT }}>/{subfolder}</span>}
              </span>
            </button>
          ) : folderName && (
            // No folder to switch from (the demo): the name, and no way out of it here.
            <span className="enter-up" style={{ ...folderChipStyle, cursor: "default", color: INK_SOFT }}>
              <FolderOpen size={12} style={{ flexShrink: 0 }} />
              <span translate="no">{folderName}</span>
            </span>
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
