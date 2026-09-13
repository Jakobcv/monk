import { useRef, useLayoutEffect, useImperativeHandle } from "react";

// A textarea that grows to fit its content instead of scrolling inside a fixed height.
// `minRows` is the floor (applied via the rows attribute so the first paint is already
// the right size); after every value change the height is set to scrollHeight exactly.
// overflow:hidden keeps a scrollbar from flashing between the reset and the re-measure.
// `ref` is forwarded to the textarea (a checklist row focuses the one it just added).
export default function AutoTextarea({ value, minRows = 2, style, ref: outerRef, ...rest }) {
  const ref = useRef(null);
  useImperativeHandle(outerRef, () => ref.current, []);
  // Width at the last fit, so the ResizeObserver below can tell "the column changed, the text
  // rewrapped" from "we just set the height ourselves" — reacting to the latter would loop.
  const fittedWidth = useRef(-1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      const h = el.scrollHeight;
      // 0 means it's in a hidden container (e.g. an inactive spec tab) — leave the row
      // count alone and re-fit once it's actually shown (the observer below).
      if (h > 0) {
        el.style.height = `${h}px`;
        fittedWidth.current = el.clientWidth;
      }
    };
    fit();
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) fit(); });
    io.observe(el);
    // A narrower column means more wrapped lines, and the height set for the old width leaves
    // the tail of a paragraph clipped under overflow:hidden with nothing to reveal it — the
    // field only re-measured on a value change, so the text stayed cut off until you typed in
    // it. Anything that reflows the column lands here: the window, the sidebar, a tab's panel.
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== fittedWidth.current) fit();
    });
    ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); };
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      style={{ overflow: "hidden", ...style }}
      {...rest}
    />
  );
}
