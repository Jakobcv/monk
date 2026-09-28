import { INK_FAINT } from "../lib/theme";

// An icon in a rounded badge with a comet running around its edge — the connect screens' one
// piece of standing motion. One lap, then the ring rests out of sight before the next, so it reads
// as a slow pulse of attention rather than a spinner. Reduced motion stops it after a single pass
// (the global rule in index.css). The ring and its animation are .connect-icon-badge in index.css.
export default function ChasingBadge({ icon: Icon, className }) {
  return (
    <div className={className ? `connect-icon-badge ${className}` : "connect-icon-badge"} aria-hidden="true">
      <Icon size={22} strokeWidth={1.5} style={{ color: INK_FAINT }} />
    </div>
  );
}
