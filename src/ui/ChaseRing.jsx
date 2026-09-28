// A comet running round the outline of whatever it sits in — the first screen's primary button.
//
// Drawn as dashes travelling along an SVG outline rather than as a conic gradient sweeping round the
// centre. A sweep at a constant angle is only even on a square: on a button three times as wide as
// it is tall, it raced along the long edges, crawled round the ends, and its tail stretched and
// shrank as it went. A dash moves at constant speed along the outline itself, whatever the shape.
// `pathLength` makes the outline 100 units long, so every length below is a share of the lap.
//
// Three dashes share their leading edge: a short bright head and two longer, fainter trails, which
// together read as a tapered tail. They share it by construction, not by offset: each pattern draws
// the 4 units after the start, then the rest of its tail at the very end of the outline, just
// before the start — so every layer animates the one plain offset, 0 to -100. (Per-layer offsets
// through a custom property looked simpler, but a var() in keyframes doesn't interpolate there:
// the dashes jumped instead of gliding.) The parent needs `position: relative`; styles are
// .chase-ring in index.css.
const LAYERS = [
  { length: 26, className: "chase-ring__trail chase-ring__trail--far" },
  { length: 12, className: "chase-ring__trail" },
  { length: 4, className: "chase-ring__head" },
];

export default function ChaseRing() {
  return (
    <svg className="chase-ring" aria-hidden="true" focusable="false">
      {LAYERS.map(({ length, className }) => (
        <rect
          key={length}
          className={className}
          x="0" y="0" width="100%" height="100%" rx="10" ry="10"
          pathLength="100"
          // Head: 4 on, 96 off. A trail of length L: the same 4 on, then off until 100 - (L - 4),
          // then on to 100 — so it ends exactly where the head does.
          strokeDasharray={length === 4 ? "4 96" : `4 ${100 - length} ${length - 4} 0`}
        />
      ))}
    </svg>
  );
}
