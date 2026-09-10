// One input primitive covering `input`, `select` and `textarea` (via `as`), replacing the
// four separate style objects that had grown up for the same job — smallInputStyle,
// fieldInputStyle, rowInput and metaInputStyle.
//
// `quiet` is the inline-editing variant: no visible border until you hover or focus it, so a
// page of editable values doesn't read as a form until you reach for one.
const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function Field({ as = "input", size = "sm", quiet = false, className, ...rest }) {
  const Tag = as;
  return (
    <Tag
      className={cx("field", size === "ui" && "field--ui", quiet && "field--quiet", className)}
      {...rest}
    />
  );
}
