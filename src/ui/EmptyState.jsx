import { font, INK_FAINT, BORDER_STRONG, SIZE, SPACE } from "../lib/theme";

// The "nothing here yet" line. Two shapes, both already in use: the centred one that holds a
// whole empty page open, and the `compact` left-aligned one that sits under a section heading.
// The centred form takes an optional icon — enough shape that an empty page doesn't read as a
// loading failure, without tipping into illustration.
export default function EmptyState({ compact = false, icon: Icon, children, style, ...rest }) {
  if (compact) {
    return (
      <div
        style={{
          fontFamily: font, fontSize: SIZE.ui, color: INK_FAINT,
          textAlign: "left", padding: `${SPACE.base} 0`, ...style,
        }}
        {...rest}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE.lg,
        fontFamily: font, fontSize: SIZE.body, color: INK_FAINT,
        textAlign: "center", padding: `${SPACE["5xl"]} 0`, ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={24} strokeWidth={1.5} style={{ color: BORDER_STRONG }} />}
      <div>{children}</div>
    </div>
  );
}
