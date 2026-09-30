// The single source of truth for every visual value in the app. JS is authoritative: the
// `CSS_VARS` block at the bottom is generated from these same constants and injected once at
// boot (see main.jsx), so index.css can style :hover/:focus-visible/:active — things inline
// styles physically can't express — without the values ever drifting from what JS uses.
//
// Scales below were *extracted*, not invented: they're the values this app already used,
// normalized. Where two neighbours were doing the same job (11px vs 11.5px, 12px vs 12.5px)
// they collapsed to one; where two sizes meant genuinely different things (13px UI chrome vs
// 13.5px reading content) both survived.
//
// One rule about colour in particular. A colour exported from here is a *reference* —
// `var(--ink)`, not `#37352F` — so a call site that writes it into an inline style hands the
// browser something to resolve at paint time rather than a value baked in at render time.
// Setting `--ink` on `:root` therefore repaints every use of ink, with no re-render and no
// reload. That is what makes a second palette possible at all, and it is why no file outside
// this one ever holds a hex.

export const font = "'Inter', ui-sans-serif, -apple-system, 'Segoe UI', sans-serif";

// The typeface of a person's own words — a spec's title, the prose on a sheet, the names on the
// start page — as opposed to the app's words around them, which are always `font`. It's a choice
// (Settings → Text, lib/readingType.js): Inter by default, or Fraunces with its serifs softened.
// Both halves are references, resolved at paint time like the colours, so switching repaints
// every use without a render. The axes ride along because SOFT is what makes Fraunces friendly,
// and a family can't carry an axis setting on its own; under Inter the setting names an axis
// Inter doesn't have, and is ignored.
export const serif = "'Fraunces', ui-serif, Georgia, serif";
export const READING = { fontFamily: "var(--font-reading)", fontVariationSettings: "var(--font-reading-axes)" };

// ---------------------------------------------------------------------------
// Color — a near-monochrome ink/paper base, with accent used sparingly as
// *meaning* (which kind of card, which state), never as decoration.
// ---------------------------------------------------------------------------
// Each colour is declared once, here, as a name and the value that name gets in CSS. `color()`
// records the value and hands back the reference everything else imports, so the palette and the
// CSS_VARS block at the bottom are the same list read twice — there is no second copy to update
// and nothing to keep in step by hand.
const COLOR_VALUES = {};
const color = (name, light, dark = light) => {
  COLOR_VALUES[name] = { light, dark };
  return `var(--${name})`;
};
// A colour that *is* another colour, thinned. The value refers to the token rather than to its
// value, so it follows whatever that token becomes — which is the whole reason the old
// `withAlpha` helper had to go: it concatenated two hex digits onto a string, and a reference
// isn't a string you can append to.
const thinned = (name, token, pct) => color(name, `color-mix(in srgb, ${token} ${pct}%, transparent)`);

// Four tiers, in descending permanence. The bottom two used to be one value, which is why a
// field's placeholder — disposable scaffolding — competed with its own label for attention
// while being 35% larger. A placeholder can't shrink (it occupies the content box; the text
// would jump the moment you typed), so contrast is the only lever there is.
export const INK = color("ink", "#37352F", "#F3F0EA");          // content you wrote — near-black
export const INK_SOFT = color("ink-soft", "#636260", "#D8D5D0");     // labels: permanent structure, meant to stay legible
export const INK_FAINT = color("ink-faint", "#797976", "#C9C6C1");    // meta: dates, counts, secondary annotations
export const INK_PLACEHOLDER = color("ink-placeholder", "#888784", "#BDBAB5"); // hints that vanish the moment you type
// Ink as a *surface* — the primary button, the toast. It lifts rather than darkens on hover,
// because ink is already almost black and there is nowhere below it to go.
export const INK_HOVER = color("ink-hover", "#4b4842", "#E3E0DA");
// What sits on top of an ink or accent surface. Not `BG`: a surface colour and a foreground
// colour that happen to be the same white are two different jobs, and they stop agreeing the
// moment there's a second palette.
export const ON_INK = color("on-ink", "#FFFFFF", "#1B1A17");
export const ON_ACCENT = color("on-accent", "#FFFFFF", "#1B1A17");
export const BORDER = color("border", "#E9E9E7", "#2E2C29");    // hairline
export const BORDER_STRONG = color("border-strong", "#DDDBD6", "#3B3833");
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
export const BG = color("bg", "#FFFFFF", "#211F1C");
export const BG_APP = color("bg-app", "#FBFBFA", "#171614");
export const BG_HOVER = color("bg-hover", "#F7F7F5", "#1E1D1A");
// Hover on a row that sits on a BG surface (a card's table). In light the two agree; in dark
// BG_HOVER is a step *below* BG, which on a card reads as nothing, so this one steps up instead.
export const BG_HOVER_RAISED = color("bg-hover-raised", "#F7F7F5", "#292724");
// The selected nav item. It sits *below* the sidebar's ground rather than above it: white on
// BG_APP was all but invisible, and a recess reads as "you are here" without needing a shadow.
// Deliberately a step past BG_HOVER so hovering a neighbour never out-shouts the selection.
export const BG_ACTIVE = color("bg-active", "#ECECE9", "#2A2825");
// The selected row still answers the pointer — one more step down, not back up.
export const BG_ACTIVE_HOVER = color("bg-active-hover", "#E4E4E0", "#322F2B");
// the four card kinds of a Discovery board
export const ACCENT = {
  signal: color("accent-signal", "#D9730D", "#FF9D53"),  // amber
  insight: color("accent-insight", "#2383E2", "#8FC3FF"), // blue
  action: color("accent-action", "#0F7B6C", "#83DFCD"),  // teal
  result: color("accent-result", "#AD1A72", "#FF93C7"),  // rose
};

// A board card's edge, in its kind's accent. Its own token rather than an alpha computed at the
// call site, so the one place that decides how strongly a card announces its kind is here. See
// `cardSurface` in ui/cardStyles.js for why the edge carries the identity and the fill doesn't.
export const ACCENT_EDGE = {
  signal: thinned("accent-signal-edge", ACCENT.signal, 40),
  insight: thinned("accent-insight-edge", ACCENT.insight, 40),
  action: thinned("accent-action-edge", ACCENT.action, 40),
  result: thinned("accent-result-edge", ACCENT.result, 40),
};

// The halo on an armed connect handle, and the lift under the card a connector is about to land
// on. Both are a kind's accent thinned — same reason as ACCENT_EDGE, and separate from it because
// a halo and an edge are not the same strength and shouldn't have to move together.
export const ACCENT_RING = {
  signal: thinned("accent-signal-ring", ACCENT.signal, 26.667),
  insight: thinned("accent-insight-ring", ACCENT.insight, 26.667),
  action: thinned("accent-action-ring", ACCENT.action, 26.667),
  result: thinned("accent-result-ring", ACCENT.result, 26.667),
};
export const ACCENT_GLOW = {
  signal: thinned("accent-signal-glow", ACCENT.signal, 20),
  insight: thinned("accent-insight-glow", ACCENT.insight, 20),
  action: thinned("accent-action-glow", ACCENT.action, 20),
  result: thinned("accent-result-glow", ACCENT.result, 20),
};

// The ring that plays twice on a board card that just arrived. Its own gold — not the signal
// amber and not CITED, both of which it sits near without matching.
export const PULSE = color("pulse", "#D9A406", "#E2AD20");
export const PULSE_RING = thinned("pulse-ring", PULSE, 55);

// entity + state colors that were previously hardcoded at their call sites
export const ACTIVITY = color("activity", "#6741D9", "#B4ACFE"); // violet — distinct from all four card accents
export const RESEARCH_PLAN = color("research-plan", "#9F6B53", "#F4BBA1"); // umber — the study a set of signals was collected for
export const DANGER = color("danger", "#E03E3E", "#FEAEA6");   // destructive actions, "needs attention"
export const CITED = color("cited", "#946800", "#F5C573");    // muted gold — "authoritative", most-cited
// A field whose value doesn't parse. Warmer and darker than DANGER, because it underlines text
// being typed rather than labelling an action, and DANGER at that weight reads as an alarm.
export const INVALID = color("invalid", "#d44c47", "#FEAFA7");
// The connector being dragged onto the card it would disconnect. Distinct from DANGER: it's a
// 1.5px stroke over a busy board, where DANGER's lighter red disappears.
export const CONNECTOR_DELETE = color("connector-delete", "#D64545", "#FEB1AA");

// Washes: a colour thinned far enough to be a surface rather than a mark.
export const FOCUS_RING = thinned("focus-ring", ACCENT.insight, 12);
export const FOCUS_WASH = thinned("focus-wash", ACCENT.insight, 8);
// Selected text in a person's own words. The browser's default is a saturated system blue that sits
// on warm paper like a highlighter; this is the same blue the focus ring uses, thinned until the
// words under it stay the darkest thing on the line. Deeper in dark, where a thin wash disappears.
export const SELECTION = color("selection",
  `color-mix(in srgb, ${ACCENT.insight} 18%, transparent)`,
  `color-mix(in srgb, ${ACCENT.insight} 30%, transparent)`);
export const DANGER_WASH = thinned("danger-wash", DANGER, 8);
export const INVALID_RING = thinned("invalid-ring", INVALID, 12);

// The dimmed page behind a modal. Ink rather than black, so the dim shares the app's hue.
export const BACKDROP = color("backdrop", "rgba(20, 19, 17, 0.28)", "rgba(0, 0, 0, 0.55)");

// A sketch's mat. Sketches are greys on white by definition, so the frame behind one is its own
// colour and not the app's surface — a sketch is a picture, and a picture doesn't restyle itself
// to match the room.
export const SKETCH_MAT = color("sketch-mat", "#FFFFFF");

// Monochrome — one warm-neutral ramp from near-black to a light grey. The mark is the only
// thing that carries it, and a mark doesn't need to say hue and depth at the same time.
export const BRAND = {
  from: color("brand-from", "#2E2C28", "#EDEAE4"),
  to: color("brand-to", "#9A968D", "#8C877D"),
};
export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.from} 0%, ${BRAND.to} 100%)`;

// What a shadow is cast in, and what an edge ring is drawn in. On a light ground both are black
// at a low alpha. On a dark one they part company: a black ring is invisible against a dark
// surface, so the ring goes light and only the penumbra stays black — see EDGE below.
const cast = (alpha) => `rgb(0 0 0 / ${alpha})`;
const ring = (alpha) => `rgb(255 255 255 / ${alpha})`;

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
// Every margin, padding and gap in a page comes from here. Values between the steps (7px, 10px,
// 14px, 18px, 22px, 30px, 34px) used to be scattered through the pages; they were each rounded to
// the nearest step, which is the whole point of having steps.
export const SPACE = {
  px: "1px", xs: "2px", sm: "4px", md: "6px", base: "8px",
  lg: "12px", xl: "16px", "2xl": "20px", "3xl": "24px", "4xl": "32px", "5xl": "40px",
};

// `paper` is the sheet's corner — paper has square corners, and the radius only exists to keep
// the shadow from ending in a hard point. Every other surface is xs–lg.
export const RADIUS = { paper: "3px", xs: "4px", sm: "6px", md: "8px", lg: "10px", pill: "999px" };

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
  // The gutter of a paper page's chrome (ui/PaperFrame): the breadcrumb bar, the kind/title/tabs
  // block and the side rail all start their content here, so they share one left edge.
  chromeX: "20px",
  // The column widths a centred page uses. `wide` is also the paper sheet's width, so a list and
  // the record it opens can sit on the same measure. `table` is for a page that is one wide table:
  // it fills a laptop screen, and stops before its columns drift away from the titles on an
  // ultra-wide one.
  narrow: "560px", // the start page
  wide: "840px",   // Research Repository, the paper sheet
  table: "1600px", // Initiatives
};

// A drop shadow on a dark ground has less room to be seen in, so every alpha here is deeper in
// dark than in light — the geometry is the same, only what it's cast in changes.
export const SHADOW = {
  sm: color("shadow-sm", `0 2px 6px ${cast(0.06)}`, `0 2px 6px ${cast(0.45)}`),
  md: color("shadow-md", `0 4px 14px ${cast(0.08)}`, `0 4px 14px ${cast(0.5)}`),
  pop: color("shadow-pop", `0 8px 24px ${cast(0.1)}`, `0 8px 24px ${cast(0.6)}`),
  // falls left, into the page (spec sidebar)
  panel: color("shadow-panel", `-6px 0 12px ${cast(0.04)}`, `-6px 0 12px ${cast(0.35)}`),
  // A card that lifts a little under the pointer, and the one-off ring under a popover row.
  card: color("shadow-card", `0 2px 6px ${cast(0.07)}`, `0 2px 6px ${cast(0.5)}`),
  // The small label that floats over a board while a connector is being dragged to it.
  drag: color("shadow-drag", `0 1px 4px ${cast(0.18)}`, `0 1px 4px ${cast(0.6)}`),
  // The ring around a design system swatch, which has to stay visible whatever colour the
  // workspace put in it. It inverts with the theme, and between the two of them every case is
  // covered: a dark swatch is edged by the light ring, and a light swatch is edged by the dark
  // page it sits on (and the other way round in light).
  inset: color("shadow-inset", `inset 0 0 0 1px ${cast(0.12)}`, `inset 0 0 0 1px ${ring(0.14)}`),
  chip: color("shadow-chip", `0 0 0 1px ${cast(0.06)}, 0 1px 2px ${cast(0.06)}`, `0 0 0 1px ${ring(0.08)}, 0 1px 2px ${cast(0.4)}`),
};

// The primary button wears the mark's ramp, in the same direction. Only the first half of it,
// though: the ramp ends on a mid-grey that on-ink text can't stand on, so the fill stops halfway
// down — about 6:1 against white at its light end in light, about 9:1 in dark. One value serves
// both themes because the stops are references and resolve per theme.
export const BUTTON_FILL = color("button-fill",
  `linear-gradient(135deg, ${BRAND.from} 0%, color-mix(in srgb, ${BRAND.from} 50%, ${BRAND.to}) 100%)`);
// A faint light catching the button's top edge, and the hairline of shadow under it — enough to
// read as a raised thing you press, not a sticker. The dark button is already pale, so its
// highlight needs a much stronger white to show at all.
export const BUTTON_SHEEN = color("button-sheen",
  `inset 0 1px 0 ${ring(0.16)}, 0 1px 2px ${cast(0.14)}`,
  `inset 0 1px 0 ${ring(0.6)}, 0 1px 2px ${cast(0.45)}`);

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
//
// In dark the two halves swap jobs. The ring is drawn in light rather than black, because a black
// hairline against a dark surface is nothing at all; the penumbra keeps its geometry but is cast
// deeper, and on the flat step — which was only ever a ring — it stays absent. What says "this
// surface is above the page" in dark is being lighter than the page, and the ring is what draws
// that edge.
export const EDGE = {
  flat: color("edge-flat", `0 0 0 1px ${cast(0.06)}`, `0 0 0 1px ${ring(0.07)}`),
  raised: color("edge-raised",
    `0 0 0 1px ${cast(0.06)}, 0 1px 2px -1px ${cast(0.06)}, 0 2px 4px ${cast(0.04)}`,
    `0 0 0 1px ${ring(0.08)}, 0 1px 2px -1px ${cast(0.4)}`),
  lifted: color("edge-lifted",
    `0 0 0 1px ${cast(0.08)}, 0 2px 4px -1px ${cast(0.06)}, 0 8px 16px -4px ${cast(0.06)}`,
    `0 0 0 1px ${ring(0.1)}, 0 4px 10px -4px ${cast(0.45)}`),
  float: color("edge-float",
    `0 0 0 1px ${cast(0.08)}, 0 4px 8px -2px ${cast(0.08)}, 0 16px 32px -8px ${cast(0.12)}`,
    `0 0 0 1px ${ring(0.12)}, 0 12px 28px -10px ${cast(0.6)}`),
  // A sheet of paper on the app ground. Same ring, but the lift is spread over a much wider,
  // softer penumbra than `float`'s — a popover hovers a few millimetres over the page and wants
  // a crisp edge shadow; a page just rests on the desk. The ring carries more weight here than
  // in the steps above because it is doing the whole job: the ground behind the sheet is the
  // app's own, four units off white, so the hairline is what says "edge" and the penumbra only
  // says "lift". Weaken it and the sheet stops reading as a sheet.
  paper: color("edge-paper",
    `0 0 0 1px ${cast(0.07)}, 0 1px 1px ${cast(0.03)}, 0 4px 10px -4px ${cast(0.04)}, 0 14px 32px -14px ${cast(0.06)}`,
    `0 0 0 1px ${ring(0.09)}, 0 10px 30px -16px ${cast(0.5)}`),
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
  // Prose: Problem/Goals, every list row, the Plan, a document. 17px rather than 16: long-form
  // reading surfaces (Medium, Substack) sit at 18–21px, and 16px Inter at arm's length read as UI
  // text — right for a form, a size too small for a page you read top to bottom.
  body: "17px",
  label: "14px",   // a list's number, set a step under the line it marks
  eyebrow: "12px", // section labels — up from the 10px eyebrow used in chrome
  leading: 1.65,
  // Sheet width, and its margins. The side margins are what set the measure: 840 less 2 × 88 leaves
  // 664px, about 72 characters of 17px prose — inside the 60–75 a line can run before the eye
  // starts losing its way back to the next one. At 64px the line ran to ~88. On a narrower page
  // the margins give way first (a percentage of the page, floored at 40px), so a split-screen
  // window loses paper before it loses words; the breakpoints in index.css take over from there.
  width: PAGE.wide,
  pad: "64px clamp(40px, 10.5%, 88px) 80px",
  // The rhythm of a sheet: the space between two sections, and between a section's label and what
  // it labels. The first is well over twice the second, so a label always reads as belonging to the
  // field under it and not to the one above.
  sectionGap: SPACE["4xl"],
  labelGap: SPACE.lg,
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

export const SPEC_STATUS_OPTIONS = ["draft", "active", "shipped"];
export const SPEC_STATUS_COLOR = { draft: INK_FAINT, active: ACCENT.insight, shipped: ACCENT.action };

export const SAVE_STATUS_COLOR = { saved: ACCENT.action, saving: INK_FAINT, error: DANGER, conflict: ACCENT.signal, idle: INK_FAINT };
// "conflict" is not an error: the save worked, it just left some files alone because
// something outside the app had edited them since we last wrote. Amber, not red.
export const SAVE_STATUS_LABEL = { saved: "Saved", saving: "Saving…", error: "Save failed — retry", conflict: "Kept newer changes on disk", idle: "" };

// ---------------------------------------------------------------------------
// The same tokens, as CSS custom properties. Injected once at boot so index.css
// can reach them; never hand-maintained in two places. The colour half is
// generated from the declarations above, so adding a colour there is the whole
// job — there is no list down here to remember.
// ---------------------------------------------------------------------------
const varsFor = (theme) => Object.entries(COLOR_VALUES)
  .map(([name, value]) => `  --${name}:${value[theme]};`)
  .join("\n");

// `color-scheme` rides along with the palette rather than sitting in index.css, so scrollbars,
// native controls and the canvas beyond the page can never disagree with the tokens about which
// theme is in force.
// Four blocks, not two. The first two are the desktop's answer: light by default, dark when the
// system asks for it. The last two are a person overriding that answer from Settings — they win on
// specificity wherever they appear, so the order here doesn't have to be load-bearing.
const themeBlock = (theme) => `  color-scheme:${theme};
${varsFor(theme)}`;

export const CSS_VARS = `:root{
  color-scheme:light;
${varsFor("light")}
  --font:${font};
  --font-reading:var(--font); --font-reading-axes:normal; --font-reading-tracking:-0.012em;
  --size-micro:${SIZE.micro}; --size-xs:${SIZE.xs}; --size-sm:${SIZE.sm};
  --size-ui:${SIZE.ui}; --size-body:${SIZE.body}; --size-md:${SIZE.md}; --size-lg:${SIZE.lg};
  --size-title:${SIZE.title};
  --radius-paper:${RADIUS.paper}; --radius-xs:${RADIUS.xs}; --radius-sm:${RADIUS.sm}; --radius-md:${RADIUS.md};
  --radius-lg:${RADIUS.lg}; --radius-pill:${RADIUS.pill};
  --page-pad-x:${PAGE.padX}; --page-pad-top:${PAGE.padTop};
  --page-pad-top-header:${PAGE.padTopUnderHeader}; --page-pad-bottom:${PAGE.padBottom};
  --page-landing-top:${PAGE.landingTop}; --page-bleed:${PAGE.bleed}; --page-chrome-x:${PAGE.chromeX};
  --paper-body:${PAPER.body}; --paper-leading:${PAPER.leading}; --paper-eyebrow:${PAPER.eyebrow};
  --paper-width:${PAPER.width}; --paper-pad:${PAPER.pad}; --paper-marker:${PAPER.marker};
  --paper-section-gap:${PAPER.sectionGap}; --paper-label-gap:${PAPER.labelGap};
  --motion-instant:${MOTION.instant}; --motion-fast:${MOTION.fast};
  --motion-base:${MOTION.base}; --motion-slow:${MOTION.slow};
  --ease:${MOTION.ease}; --ease-entrance:${MOTION.entrance}; --ease-exit:${MOTION.exit};
}
@media (prefers-color-scheme: dark){:root{
  color-scheme:dark;
${varsFor("dark")}
}}
:root[data-theme="light"]{
${themeBlock("light")}
}
:root[data-theme="dark"]{
${themeBlock("dark")}
}
:root[data-reading="serif"]{
  --font-reading:${serif}; --font-reading-axes:"SOFT" 100, "WONK" 0; --font-reading-tracking:0;
}`;
