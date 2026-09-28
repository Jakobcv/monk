import { useId } from "react";
import { BRAND } from "../lib/theme";

// A scribe's writing desk in side view: a sloped board with a ledge at its low end, on a post
// and a foot. On load it assembles the way you'd set one up — the foot, then the post rises,
// then the board tips down into its slope (see .desk-mark in index.css).
//
// Everything is stroked with butt caps so the parts meet squarely. The gradient is in user
// space, not objectBoundingBox: a bounding-box gradient on the post, a vertical line with a
// zero-width box, doesn't paint at all.
//
// The viewBox is offset rather than starting at 0,0. The board's high end pulls the ink up and
// left and the foot anchors it low, so the window is moved until the midpoint of the ink's
// bounding-box centre and its centre of mass sits on the page axis — the same rule the crescent
// used: centring the box alone overcorrects, centring the mass alone undercorrects.
export default function DeskMark({ size = 96, className }) {
  const grad = `desk-grad-${useId().replace(/:/g, "")}`;
  return (
    <svg className={className ? `desk-mark ${className}` : "desk-mark"} width={size} height={size} viewBox="0 7 100 100" role="img" aria-label="Monk">
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="16" y1="24" x2="84" y2="92">
          {/* stopColor as an attribute would not resolve a var(); as a style property it does. */}
          <stop offset="0%" style={{ stopColor: BRAND.from }} />
          <stop offset="100%" style={{ stopColor: BRAND.to }} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${grad})`}>
        <path className="desk-mark__foot" d="M30 86 H70" strokeWidth="8" />
        <path className="desk-mark__post" d="M50 42 V84" strokeWidth="10" />
        {/* Board and ledge are one filled outline: as two butt-capped strokes they met at an
            angle and left a stepped notch at the joint. It's the board's centre line (18,30)–
            (80,50) at 11 wide, with the ledge rising 7 above its low end. The group is there
            because SVG transforms go on a <g>. */}
        <g className="desk-mark__board">
          <path d="M16.31 35.24 L19.69 24.76 L75.98 42.92 L78.13 36.26 L83.84 38.1 L78.31 55.24 Z" fill={`url(#${grad})`} stroke="none" />
        </g>
      </g>
    </svg>
  );
}
