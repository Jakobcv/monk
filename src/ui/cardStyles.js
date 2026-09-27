import { font, INK_SOFT, ACCENT_EDGE, BG, BORDER_STRONG, WEIGHT, RADIUS } from "../lib/theme";

// The small round control hanging off a card's top corner — the Discovery board's unlink/delete,
// and SignalCard's delete and select box elsewhere. One definition, so a signal card's corners
// look the same wherever it appears. Pair with `.icon-btn` (the 26px `--hit` target — capped by
// the 12px grid gap between cards) and add the side: `{ ...cornerBadge, right: "-7px" }`.
export const cornerBadge = {
  position: "absolute", top: "-7px", width: "16px", height: "16px", borderRadius: "50%",
  border: `1px solid ${BORDER_STRONG}`, background: BG, color: INK_SOFT,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 0, zIndex: 4,
  cursor: "pointer", "--hit": "26px",
};

// A board card's surface. Previously a low-alpha wash of the kind's accent — but at 12% alpha
// over white that computes to roughly a 1.10:1 luminance difference, below what's perceptible
// without a side-by-side swatch. It wasn't giving a card identity on its own; it was just
// quietly worsening the contrast of whatever text sat on it, which is what read as "muddy"
// once paired with the vividly-colored border right at its edge (simultaneous contrast).
//
// The border carries the identity instead: one even 1px edge in the kind's accent, strong enough
// (40% alpha, up from a barely-there 16%) to name the kind at a glance. It used to be that faint
// hairline plus a 3px solid stripe down the left side — the stock "accent bar" card, which read
// as generic decoration rather than as this product's. The fill stays pure white, so every text
// colour on the card (including the already-low-contrast metadata) gets full contrast.
//
// That 40% is a token of its own (ACCENT_EDGE) rather than an alpha applied here, because an
// accent arrives as a reference rather than a value and there is nothing at a call site to apply
// an alpha to.
export const cardSurface = (kind) => ({
  backgroundColor: BG,
  border: `1px solid ${ACCENT_EDGE[kind]}`,
});

// A card's small metadata controls: quiet until you reach for them (the border only appears on
// hover/focus — see `.signal-card` in index.css), so a card full of editable values still reads
// as content rather than as a form. INK_SOFT, not the fainter INK_FAINT `meta` text elsewhere
// uses — at this size, on a card surface, INK_FAINT drops below readable contrast.
export const metaInputStyle = {
  border: "1px solid transparent", background: "transparent", borderRadius: RADIUS.xs,
  fontFamily: font, fontWeight: WEIGHT.medium, color: INK_SOFT, outline: "none",
};
