// A donut / progress ring. `segments` is [{ value, color }]; a single segment plus `track`
// gives a plain progress ring. `center` renders inside the hole.
export default function Donut({ segments, size = 108, thickness = 12, track = "var(--border)", gap = 0.012, center }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  const placed = segments.reduce((arr, s) => {
    const prev = arr[arr.length - 1];
    arr.push({ ...s, frac: s.value / total, offset: prev ? prev.offset + prev.frac : 0 });
    return arr;
  }, []);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg className="donut-in" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {placed.map((s, i) => {
          if (s.frac <= 0) return null;
          const len = Math.max(0, (s.frac - gap) * c);
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-s.offset * c}
            />
          );
        })}
      </svg>
      {center != null && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.1 }}>
          {center}
        </div>
      )}
    </div>
  );
}
