// The "+ Add" that ends a list on the paper surface — a spec's Solution tab, Overview's
// checklists. Deliberately not ui/Button: that one is chrome, sized for chrome (12px, semibold,
// shrink-wrapped to its label), and next to 16px prose it reads as a caption *about* the list
// rather than part of it. This sits in the list's own grid instead — the icon in the marker
// gutter where a bullet, a number or a checkbox would be, the label on the text column, at the
// size and weight of the rows above it. What you get is a ghost row: the next item, not yet
// written. Everything visual lives in .paper-btn (index.css), including the gutter, which comes
// from the same --paper-marker the real rows use.
export default function PaperButton({ icon: Icon, children, ...rest }) {
  return (
    <button className="paper-btn" {...rest}>
      <span className="paper-btn__marker" aria-hidden="true"><Icon size={18} /></span>
      <span>{children}</span>
    </button>
  );
}
