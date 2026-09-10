import { useRef, useLayoutEffect } from "react";

// A textarea that grows to fit its content instead of scrolling inside a fixed height.
// `minRows` is the floor (applied via the rows attribute so the first paint is already
// the right size); after every value change the height is set to scrollHeight exactly.
// overflow:hidden keeps a scrollbar from flashing between the reset and the re-measure.
export default function AutoTextarea({ value, minRows = 2, style, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
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
