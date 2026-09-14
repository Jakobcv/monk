// The app's text primitives. Each one is a class in index.css and a component here; nothing
// carries its typography as an inline style any more.
//
// That distinction is the point, not tidiness. These used to be exported style *objects* spread
// into `style={{ ... }}`, and an inline font-size outranks every stylesheet rule — so "the same
// label, one step larger on the paper surface" was inexpressible in CSS and had to be threaded
// through the tree as a `paper` prop, once per component that rendered one, plus a second copy
// of the token (`paperEyebrow`) to hold the larger value. As classes, the surface states it once
// (`.paper-sheet .eyebrow`) and every component below stops needing to know where it is.
//
// `className` and `style` pass through untouched: a call site still adds layout — a margin, a
// flex row, a status colour — without redeclaring what the text *is*.
const cx = (...parts) => parts.filter(Boolean).join(" ");

// The small uppercase section label. `as` because a few of these are buttons (a collapsible
// section's header) rather than plain labels; `section` is the step-up used where the label
// heads a whole region rather than naming one field.
export function Eyebrow({ as: As = "div", section = false, className, ...rest }) {
  return <As className={cx("eyebrow", section && "eyebrow--section", className)} {...rest} />;
}

// Small grey metadata on a card's top line — a date, an author, a count.
export function Meta({ as: As = "span", className, ...rest }) {
  return <As className={cx("meta", className)} {...rest} />;
}

// A page's own heading ("Specs", "Insights", "Activities"). Always an h1: every call site was
// already writing one by hand, so the element belongs in here with the type.
export function PageHeading({ className, ...rest }) {
  return <h1 className={cx("page-heading", className)} {...rest} />;
}

// What kind of record a paper page is — "Spec", "Research plan", "Initiative" — set just above its
// title. The pages share one frame on purpose, so this is what names the difference outright.
export function PageKind({ icon: Icon, className, children, ...rest }) {
  return (
    <div className={cx("eyebrow page-kind", className)} {...rest}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </div>
  );
}

// The big editable name at the top of a spec, an activity or a document.
export function PageTitle({ className, ...rest }) {
  return <input className={cx("page-title", className)} {...rest} />;
}

// The brand wordmark. Size is the one thing that genuinely varies between the header and the
// start page, so it stays a prop rather than becoming two classes.
export function Wordmark({ size, as: As = "span", className, style, ...rest }) {
  return <As className={cx("wordmark", className)} style={{ fontSize: size, ...style }} {...rest} />;
}
