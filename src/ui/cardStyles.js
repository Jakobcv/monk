import { font, INK_SOFT, ACCENT, BG, WEIGHT, RADIUS, withAlpha } from "../lib/theme";

// A board card's surface. Previously a low-alpha wash of the kind's accent — but at 12% alpha
// over white that computes to roughly a 1.10:1 luminance difference, below what's perceptible
// without a side-by-side swatch. It wasn't giving a card identity on its own; it was just
// quietly worsening the contrast of whatever text sat on it, which is what read as "muddy"
// once paired with the vividly-colored border right at its edge (simultaneous contrast).
//
// A solid left edge in the accent color carries the identity instead — it's actually visible at
// a glance, unlike the wash it replaces — while the fill goes back to pure white, so every
// text color on the card (including the already-low-contrast metadata) gets full contrast
// rather than fighting a tint for it.
export const cardSurface = (kind) => ({
  backgroundColor: BG,
  border: `1px solid ${withAlpha(ACCENT[kind], "28")}`,
  borderLeft: `3px solid ${ACCENT[kind]}`,
});

// A card's small metadata controls: quiet until you reach for them (the border only appears on
// hover/focus — see `.signal-card` in index.css), so a card full of editable values still reads
// as content rather than as a form. INK_SOFT, not the fainter INK_FAINT `meta` text elsewhere
// uses — at this size, on a card surface, INK_FAINT drops below readable contrast.
export const metaInputStyle = {
  border: "1px solid transparent", background: "transparent", borderRadius: RADIUS.xs,
  fontFamily: font, fontWeight: WEIGHT.medium, color: INK_SOFT, outline: "none",
};
