// The bare square controls — delete ×, add +, reorder chevrons. Takes the icon as children.
// `style`/`className` pass through untouched because several of these are absolutely
// positioned by their parent (a card's hover-revealed delete button, for instance).
const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function IconButton({ danger = false, className, ...rest }) {
  return <button className={cx("icon-btn", danger && "icon-btn--danger", className)} {...rest} />;
}
