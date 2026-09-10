// Every button in the app, in four intents and two sizes. Before this, the same ghost button
// was re-declared inline about eight times with a slightly different padding and font-size
// each time — that drift is what this exists to stop. Visual states (:hover/:active/:disabled)
// live in index.css, since inline styles can't express them.
//
// Icons are passed as children, matching how every call site already wrote them:
//   <Button variant="primary"><Plus size={14} /> New spec</Button>
const cx = (...parts) => parts.filter(Boolean).join(" ");

export default function Button({
  variant = "secondary",
  size = "sm",
  fullWidth = false,
  className,
  style,
  ...rest
}) {
  return (
    <button
      className={cx("btn", `btn--${variant}`, `btn--${size}`, className)}
      style={fullWidth ? { width: "100%", ...style } : style}
      {...rest}
    />
  );
}
