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
export const BG = "#FFFFFF";
export const BG_SIDEBAR = "#FBFBFA";
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

export const SHADOW = {
  sm: "0 2px 6px rgba(0,0,0,0.06)",
  md: "0 4px 14px rgba(0,0,0,0.08)",
  pop: "0 8px 24px rgba(0,0,0,0.10)",
  panel: "-6px 0 12px rgba(0,0,0,0.04)", // falls left, into the page (spec sidebar)
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
  exit: "cubic-bezier(0.4, 0, 1, 1)",
};

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

// how a research activity collected its signals — lives on the Activity (see signalModel.js)
export const METHOD_OPTIONS = ["Interview", "Survey", "Usage metrics", "Client call", "Other"];

export const SPEC_STATUS_OPTIONS = ["draft", "active", "shipped"];
export const SPEC_STATUS_COLOR = { draft: INK_FAINT, active: ACCENT.insight, shipped: ACCENT.action };

export const SAVE_STATUS_COLOR = { saved: ACCENT.action, saving: INK_FAINT, error: DANGER, idle: INK_FAINT };
export const SAVE_STATUS_LABEL = { saved: "Saved", saving: "Saving…", error: "Save failed — retry", idle: "" };

// ---------------------------------------------------------------------------
// The same tokens, as CSS custom properties. Injected once at boot so index.css
// can reach them; never hand-maintained in two places.
// ---------------------------------------------------------------------------
export const CSS_VARS = `:root{
  --font:${font};
  --ink:${INK}; --ink-soft:${INK_SOFT}; --ink-faint:${INK_FAINT}; --ink-placeholder:${INK_PLACEHOLDER};
  --border:${BORDER}; --border-strong:${BORDER_STRONG};
  --bg:${BG}; --bg-sidebar:${BG_SIDEBAR}; --bg-hover:${BG_HOVER};
  --accent-signal:${ACCENT.signal}; --accent-insight:${ACCENT.insight};
  --accent-action:${ACCENT.action}; --accent-result:${ACCENT.result};
  --activity:${ACTIVITY}; --danger:${DANGER}; --cited:${CITED};
  --size-micro:${SIZE.micro}; --size-xs:${SIZE.xs}; --size-sm:${SIZE.sm};
  --size-ui:${SIZE.ui}; --size-body:${SIZE.body}; --size-md:${SIZE.md}; --size-lg:${SIZE.lg};
  --radius-xs:${RADIUS.xs}; --radius-sm:${RADIUS.sm}; --radius-md:${RADIUS.md};
  --radius-lg:${RADIUS.lg}; --radius-pill:${RADIUS.pill};
  --shadow-sm:${SHADOW.sm}; --shadow-md:${SHADOW.md}; --shadow-pop:${SHADOW.pop}; --shadow-panel:${SHADOW.panel};
  --motion-instant:${MOTION.instant}; --motion-fast:${MOTION.fast};
  --motion-base:${MOTION.base}; --motion-slow:${MOTION.slow};
  --ease:${MOTION.ease}; --ease-entrance:${MOTION.entrance}; --ease-exit:${MOTION.exit};
}`;
