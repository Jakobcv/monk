// Small grouped/single bar chart. `series` is [{ values:number[], color }]; every series must
// share the same length (one entry per category). No axes — just the bars, with the tallest
// value setting the scale. CSS handles the rise-in on mount.
export default function Bars({ series, height = 96, gap = 3, groupGap = 10, rounded = 2 }) {
  const cats = series[0]?.values.length || 0;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: `${groupGap}px`, height }}>
      {Array.from({ length: cats }, (_, i) => (
        <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: `${gap}px`, height: "100%" }}>
          {series.map((s, si) => {
            const h = (s.values[i] / max) * 100;
            return (
              <div
                key={si}
                className="bar-rise"
                title={String(s.values[i])}
                style={{
                  width: `${100 / series.length}%`,
                  maxWidth: "14px",
                  height: `${Math.max(h, s.values[i] > 0 ? 3 : 0)}%`,
                  minHeight: s.values[i] > 0 ? "2px" : 0,
                  background: s.color,
                  borderRadius: `${rounded}px ${rounded}px 0 0`,
                  animationDelay: `${Math.min(i * 24, 260)}ms`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
