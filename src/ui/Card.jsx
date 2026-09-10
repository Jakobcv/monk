import { SPACE } from "../lib/theme";

// A bordered surface. `interactive` adds the pointer + hover lift used by every clickable
// row (search results, the activities list, spec cards). This one definition replaces the
// `.el-resultcard` CSS block that was pasted three separate times inside
// ResearchRepositoryPage, plus its near-identical twin in SpecsPage.
const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function Card({ interactive = false, padded = true, className, style, ...rest }) {
  return (
    <div
      className={cx("card", interactive && "card--interactive", className)}
      style={padded ? { padding: `${SPACE.lg} ${SPACE.xl}`, ...style } : style}
      {...rest}
    />
  );
}
