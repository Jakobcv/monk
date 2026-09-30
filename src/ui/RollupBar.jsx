import { BORDER, SPEC_STATUS_COLOR } from "../lib/theme";
import { specStatusCounts } from "../lib/specRollup";

// How far a set of specs has got: one segment per spec, in status order, coloured by status. The
// initiative page's side rail and the Initiatives page's rows draw the same bar from this, so the
// two can't disagree about the same initiative. Decorative — whoever draws it says the count in
// words beside it, so the bar is never the only way to read it.
export default function RollupBar({ specs, className = "" }) {
  return (
    <div className={["rollup-bar", className].filter(Boolean).join(" ")} aria-hidden="true">
      {specStatusCounts(specs).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => (
        <span key={`${s}${i}`} style={{ backgroundColor: s === "draft" ? BORDER : SPEC_STATUS_COLOR[s] }} />
      )))}
    </div>
  );
}
