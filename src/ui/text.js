import { font, INK, INK_SOFT, INK_FAINT, SIZE, WEIGHT, LEADING } from "../lib/theme";

// The small uppercase section label. It was defined — character for character — in four
// separate files (Board, SpecPage, ActivityPage, ChecklistEditor) before this.
//
// INK_SOFT, not INK_FAINT: a label is permanent structure and the field's placeholder is not,
// so the label has to win. They were the same grey before, which meant the placeholder — 35%
// larger — quietly outranked the thing naming it.
export const eyebrow = {
  fontFamily: font,
  fontWeight: WEIGHT.semibold,
  fontSize: SIZE.micro,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: INK_SOFT,
};

// The brand wordmark. Lowercase "monk", set at medium weight and opened up — it serves the
// crescent rather than competing with it (see Home's MoonMark). One definition because the
// header and the start page had drifted into three different decisions: "Monk" vs "monk",
// 600 vs 500, and no tracking vs +0.07em.
//
// marginRight cancels the trailing letterspace, which otherwise pads the box on the right and
// leaves the glyphs sitting a hair left of wherever you centred it.
export const wordmark = (size) => ({
  fontFamily: font,
  fontWeight: WEIGHT.medium,
  fontSize: size,
  letterSpacing: "0.07em",
  marginRight: "-0.07em",
  lineHeight: LEADING.tight,
  color: INK,
});

// A borderless textarea/input that inherits the page rather than looking like a form control —
// used for the long-form fields on a spec and for card bodies on the board.
export const editArea = {
  width: "100%",
  border: "none",
  background: "transparent",
  outline: "none",
  resize: "none",
  fontFamily: font,
  fontWeight: WEIGHT.normal,
  fontSize: SIZE.body,
  lineHeight: LEADING.normal,
  color: INK,
  padding: 0,
  boxSizing: "border-box",
};

// The big editable name at the top of a spec or an activity.
export const pageTitleInput = {
  display: "block",
  width: "100%",
  border: "none",
  outline: "none",
  background: "none",
  fontFamily: font,
  fontWeight: WEIGHT.bold,
  fontSize: SIZE.title,
  color: INK,
  padding: 0,
};

// A page's own heading ("Specs", "Activities", "Recent insights").
export const pageHeading = {
  fontFamily: font,
  fontSize: SIZE.lg,
  fontWeight: WEIGHT.semibold,
  color: INK,
  margin: 0,
};

// Small grey metadata that sits on a card's top line — a date, an author, a count.
export const meta = {
  fontFamily: font,
  fontSize: SIZE.xs,
  color: INK_FAINT,
};
