import { SPACE } from "../lib/theme";

// A bordered surface. `interactive` adds the pointer + hover lift used by every clickable
// row (search results, the activities list, spec cards). Pass `as="a"` with an `href` for a
// card that navigates — it renders a real link so Cmd/Ctrl/middle-click open a new tab, while
// staying visually identical (`.card` styles are element-agnostic).
const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function Card({ as: Tag = "div", interactive = false, padded = true, className, style, ...rest }) {
  const linkReset = Tag === "a" ? { textDecoration: "none", color: "inherit", display: "block" } : null;
  return (
    <Tag
      className={cx("card", interactive && "card--interactive", className)}
      style={{ ...(padded ? { padding: `${SPACE.lg} ${SPACE.xl}` } : null), ...linkReset, ...style }}
      {...rest}
    />
  );
}
