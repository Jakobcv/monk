// A minimal trend line — no axes, no labels. `data` is a series of numbers; the last point
// gets a small dot. Draws into a fixed viewBox and scales with its container.
export default function Sparkline({ data, color = "var(--ink-faint)", width = 120, height = 34, strokeWidth = 1.5, fill = true }) {
  const pts = data && data.length ? data : [0, 0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const dx = pts.length > 1 ? width / (pts.length - 1) : width;
  const y = (v) => height - 2 - ((v - min) / span) * (height - 4);
  const coords = pts.map((v, i) => [i * dx, y(v)]);
  const line = coords.map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${yy.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const [lx, ly] = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      {fill && <path d={area} fill={color} opacity="0.10" />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.4" fill={color} />
    </svg>
  );
}
