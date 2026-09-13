// The single source of truth for every visual value in the app. JS is authoritative: the
// `CSS_VARS` block at the bottom is generated from these same constants and injected once at
// boot (see main.jsx), so index.css can style :hover/:focus-visible/:active — things inline
// styles physically can't express — without the values ever drifting from what JS uses.
//
// Scales below were *extracted*, not invented: they're the values this app already used,
// normalized. Where two neighbours were doing the same job (11px vs 11.5px, 12px vs 12.5px)
// they collapsed to one; where two sizes meant genuinely different things (13px UI chrome vs
// 13.5px reading content) both survived.

export const font = "'Inter', ui-sans-serif, -apple-system, 'Segoe UI', sans-serif";

// ---------------------------------------------------------------------------
// Color — a near-monochrome ink/paper base, with accent used sparingly as
// *meaning* (which kind of card, which state), never as decoration.
// ---------------------------------------------------------------------------
// Four tiers, in descending permanence. The bottom two used to be one value, which is why a
// field's placeholder — disposable scaffolding — competed with its own label for attention
// while being 35% larger. A placeholder can't shrink (it occupies the content box; the text
// would jump the moment you typed), so contrast is the only lever there is.
export const INK = "#37352F";          // content you wrote — near-black
export const INK_SOFT = "#787774";     // labels: permanent structure, meant to stay legible
export const INK_FAINT = "#A9A9A5";    // meta: dates, counts, secondary annotations
export const INK_PLACEHOLDER = "#B9B8B3"; // hints that vanish the moment you type
export const BORDER = "#E9E9E7";    // hairline
export const BORDER_STRONG = "#DDDBD6";
// The ground. One tone, under every page: lists, boards, the start page, a document, and the
// desk a sheet of paper sits on. White surfaces need a ground that isn't white, which is the
// whole reason this isn't #FFF; it doubles as the colour of the chrome (both sidebars),
// deliberately, so the app reads as one recessed field with surfaces laid on it.
//
// The writing tabs are still their own kind of page — a centred sheet rather than a column of
// cards — but that is a difference in *what sits on* the ground, not in the ground itself, and
// it is carried by the sheet's own edge (EDGE.paper) rather than by tinting the page behind it.
// A reading surface deeper than the rest of the app reads as a frame around the page instead of
// a room it sits in.
//
// A page never paints itself white, either. BG is for surfaces *on* the ground — a card, the
// paper sheet, a popover, a field — never for the ground. Two pages used to break that rule
// (Home and the Dashboard, the latter with fourteen white cards on a white page), which is what
// made the app look like it had three or four grounds depending where you stood.
export const BG = "#FFFFFF";
export const BG_APP = "#FBFBFA";
export const BG_HOVER = "#F7F7F5";
// the four card kinds of a Discovery board
export const ACCENT = {
  signal: "#D9730D",  // amber
  insight: "#2383E2", // blue
  action: "#0F7B6C",  // teal
  result: "#AD1A72",  // rose
};

// entity + state colors that were previously hardcoded at their call sites
export const ACTIVITY = "#6741D9"; // violet — distinct from all four card accents
export const DANGER = "#E03E3E";   // destructive actions, "needs attention"
export const CITED = "#946800";    // muted gold — "authoritative", most-cited

// Monochrome — one warm-neutral ramp from near-black to a light grey. The mark is the only
// thing that carries it, and a mark doesn't need to say hue and depth at the same time.
export const BRAND = { from: "#2E2C28", to: "#9A968D" };
export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.from} 0%, ${BRAND.to} 100%)`;

// 8-digit hex alpha — used for the low-alpha card tints on the board
export const withAlpha = (hex, alpha) => `${hex}${alpha}`;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
export const SIZE = {
  micro: "10px",   // uppercase eyebrows / section labels
  xs: "11px",      // meta, chips, counts
  sm: "12px",      // small UI: pills, ghost buttons
  ui: "13px",      // default UI: buttons, inputs, nav
  body: "13.5px",  // reading content: card text, search results
  md: "14px",      // the one step up — hero search input, header brand
  lg: "16px",      // page headings
  title: "26px",   // page title (a spec's or activity's name)
  display: "80px", // Home wordmark
};

export const WEIGHT = { normal: 400, medium: 500, semibold: 600, bold: 700, black: 800 };
export const LEADING = { tight: 1, snug: 1.35, normal: 1.5 };

// ---------------------------------------------------------------------------
// Space / radius / elevation
// ---------------------------------------------------------------------------
export const SPACE = {
  px: "1px", xs: "2px", sm: "4px", md: "6px", base: "8px",
  lg: "12px", xl: "16px", "2xl": "20px", "3xl": "24px", "4xl": "32px", "5xl": "40px",
};

export const RADIUS = { xs: "4px", sm: "6px", md: "8px", lg: "10px", pill: "999px" };

// ---------------------------------------------------------------------------
// Page — the frame every full page sits in (ui/Page.jsx). These were seven
// hand-written paddings before, four of which meant to be the same value and
// drifted: 32px, 36px and 24px tops against a 40px side that everyone agreed
// on, and three different bottoms. One set now, with the two differences that
// are real kept as named cases: a page under a header needs less room above it
// because the header already spaced it, and the landing drops down the
// viewport on purpose.
// ---------------------------------------------------------------------------
export const PAGE = {
  padX: "40px",
  padTop: "32px",
  padTopUnderHeader: "24px",
  padBottom: "48px",
  landingTop: "10vh",
  bleed: "12px", // a canvas gets a margin, not padding to read against
};

export const SHADOW = {
  sm: "0 2px 6px rgba(0,0,0,0.06)",
  md: "0 4px 14px rgba(0,0,0,0.08)",
  pop: "0 8px 24px rgba(0,0,0,0.10)",
  panel: "-6px 0 12px rgba(0,0,0,0.04)", // falls left, into the page (spec sidebar)
};

// An enclosing surface's edge, drawn as a shadow ring rather than a border. Three reasons it
// beats `border: 1px solid BORDER` for anything box-shaped:
//
//   - It costs no layout. A surface can gain or lose its edge, or change its weight on hover,
//     without nudging a single pixel of what's inside it.
//   - Alpha composites correctly on anything. BORDER is an opaque #E9E9E7 picked against
//     white, so it reads slightly wrong on the sidebar tint or on a card inside a card; a
//     black-at-6% ring darkens whatever is actually behind it.
//   - The ring and the lift are one property, so they can't drift out of step — the old .card
//     animated border-color and box-shadow separately to do one thing.
//
// Each step keeps the same 1px ring and only changes how far the surface sits off the page.
// Borders that are *dividers* rather than edges (a rule under the header, a 1px spacer between
// sections) stay as borders — a ring around a line means nothing.
export const EDGE = {
  flat: "0 0 0 1px rgba(0,0,0,0.06)",
  raised: "0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)",
  lifted: "0 0 0 1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.06), 0 8px 16px -4px rgba(0,0,0,0.06)",
  float: "0 0 0 1px rgba(0,0,0,0.08), 0 4px 8px -2px rgba(0,0,0,0.08), 0 16px 32px -8px rgba(0,0,0,0.12)",
  // A sheet of paper on the app ground. Same ring, but the lift is spread over a much wider,
  // softer penumbra than `float`'s — a popover hovers a few millimetres over the page and wants
  // a crisp edge shadow; a page just rests on the desk. The ring carries more weight here than
  // in the steps above because it is doing the whole job: the ground behind the sheet is the
  // app's own, four units off white, so the hairline is what says "edge" and the penumbra only
  // says "lift". Weaken it and the sheet stops reading as a sheet.
  paper: "0 0 0 1px rgba(0,0,0,0.07), 0 1px 1px rgba(0,0,0,0.04), 0 6px 14px -4px rgba(0,0,0,0.07), 0 18px 36px -12px rgba(0,0,0,0.12)",
};

// ---------------------------------------------------------------------------
// Paper — the writing surface behind a spec's Overview, Design and Plan tabs.
// These three are the only place in the app where you write prose at length,
// and they run their own, larger scale: 13.5px is right for a card in a dense
// board and wrong for a page you draft into. Everything around the sheet — the
// title, the tab bar, the metadata sidebar — stays on the UI scale above, which
// is what keeps the sheet reading as content and the rest as chrome.
// ---------------------------------------------------------------------------
export const PAPER = {
  body: "16px",    // prose: Problem/Goals, every list row, the Plan
  label: "14px",   // a list's number, set a step under the line it marks
  eyebrow: "12px", // section labels — up from the 10px eyebrow used in chrome
  leading: 1.6,
  width: "840px",  // sheet width; ~70 characters of measure inside the padding
  pad: "56px 64px 64px",
  // The gutter every list row hangs its marker in — a bullet, a number, a checkbox, or the
  // "+" of the row that adds the next one. With SPACE.base after it the text lands at 34px,
  // which is the one indent a list gets on either tab. Four files need to agree on it, which
  // is why it's here and not a constant in whichever of them was written first.
  marker: "26px",
};

// ---------------------------------------------------------------------------
// Motion — this is a document tool, so motion is functional, not expressive:
// fast, small, and mostly opacity/transform. Nothing bounces, nothing waits on
// an animation to become usable. `fast` (120ms) is what every hover already
// used before this file existed; the rest fall in around it.
// ---------------------------------------------------------------------------
export const MOTION = {
  instant: "80ms",  // pressed/active feedback
  fast: "120ms",    // hover: borders, background, opacity
  base: "180ms",    // panels, popovers, list items arriving
  slow: "280ms",    // route-level transitions
  // decelerating standard curve for most things
  ease: "cubic-bezier(0.2, 0, 0.2, 1)",
  // entrances get a touch more character without overshooting
  entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
  // Exits decelerate too. This was cubic-bezier(0.4, 0, 1, 1) — an ease-*in*, which accelerates
  // the element away and pulls the eye toward something that's leaving. An exit should be
  // quicker and smaller than its enter, not sharper.
  exit: "cubic-bezier(0.3, 0, 0.4, 1)",
};

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

// how a research activity collected its signals — lives on the Activity (see signalModel.js).
// "Codebase review" is research done by reading the product's code or docs: how an agent usually
// researches, and a different kind of evidence from talking to people.
export const METHOD_OPTIONS = ["Interview", "Survey", "Usage metrics", "Client call", "Codebase review", "Other"];

export const SPEC_STATUS_OPTIONS = ["draft", "active", "shipped"];
export const SPEC_STATUS_COLOR = { draft: INK_FAINT, active: ACCENT.insight, shipped: ACCENT.action };

export const SAVE_STATUS_COLOR = { saved: ACCENT.action, saving: INK_FAINT, error: DANGER, conflict: ACCENT.signal, idle: INK_FAINT };
// "conflict" is not an error: the save worked, it just left some files alone because
// something outside the app had edited them since we last wrote. Amber, not red.
export const SAVE_STATUS_LABEL = { saved: "Saved", saving: "Saving…", error: "Save failed — retry", conflict: "Kept newer changes on disk", idle: "" };

// ---------------------------------------------------------------------------
// The same tokens, as CSS custom properties. Injected once at boot so index.css
// can reach them; never hand-maintained in two places.
// ---------------------------------------------------------------------------
export const CSS_VARS = `:root{
  --font:${font};
  --ink:${INK}; --ink-soft:${INK_SOFT}; --ink-faint:${INK_FAINT}; --ink-placeholder:${INK_PLACEHOLDER};
  --border:${BORDER}; --border-strong:${BORDER_STRONG};
  --bg:${BG}; --bg-app:${BG_APP}; --bg-hover:${BG_HOVER};
  --accent-signal:${ACCENT.signal}; --accent-insight:${ACCENT.insight};
  --accent-action:${ACCENT.action}; --accent-result:${ACCENT.result};
  --activity:${ACTIVITY}; --danger:${DANGER}; --cited:${CITED};
  --size-micro:${SIZE.micro}; --size-xs:${SIZE.xs}; --size-sm:${SIZE.sm};
  --size-ui:${SIZE.ui}; --size-body:${SIZE.body}; --size-md:${SIZE.md}; --size-lg:${SIZE.lg};
  --size-title:${SIZE.title};
  --radius-xs:${RADIUS.xs}; --radius-sm:${RADIUS.sm}; --radius-md:${RADIUS.md};
  --radius-lg:${RADIUS.lg}; --radius-pill:${RADIUS.pill};
  --page-pad-x:${PAGE.padX}; --page-pad-top:${PAGE.padTop};
  --page-pad-top-header:${PAGE.padTopUnderHeader}; --page-pad-bottom:${PAGE.padBottom};
  --page-landing-top:${PAGE.landingTop}; --page-bleed:${PAGE.bleed};
  --shadow-sm:${SHADOW.sm}; --shadow-md:${SHADOW.md}; --shadow-pop:${SHADOW.pop}; --shadow-panel:${SHADOW.panel};
  --edge-flat:${EDGE.flat}; --edge-raised:${EDGE.raised};
  --edge-lifted:${EDGE.lifted}; --edge-float:${EDGE.float}; --edge-paper:${EDGE.paper};
  --paper-body:${PAPER.body}; --paper-leading:${PAPER.leading}; --paper-eyebrow:${PAPER.eyebrow};
  --paper-width:${PAPER.width}; --paper-pad:${PAPER.pad}; --paper-marker:${PAPER.marker};
  --motion-instant:${MOTION.instant}; --motion-fast:${MOTION.fast};
  --motion-base:${MOTION.base}; --motion-slow:${MOTION.slow};
  --ease:${MOTION.ease}; --ease-entrance:${MOTION.entrance}; --ease-exit:${MOTION.exit};
}`;
