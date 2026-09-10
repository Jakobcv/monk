import { useEffect } from "react";

// Escape-to-close and click-outside-to-close for transient surfaces (today: the board's signal
// picker). Both were missing entirely — the picker could only be closed by hitting the same
// "+" that opened it, which is not where anyone's cursor is by the time they've changed
// their mind.
// The control that *opens* a surface usually sits outside it, so an unqualified
// outside-click would close and immediately reopen it. Mark that control with
// `data-dismiss-ignore` and it's treated as part of the surface for dismissal purposes.
export function useDismiss(active, ref, onDismiss) {
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onDismiss(); }
    };
    const onPointerDown = (e) => {
      if (e.target.closest?.("[data-dismiss-ignore]")) return;
      if (ref.current && !ref.current.contains(e.target)) onDismiss();
    };

    document.addEventListener("keydown", onKeyDown);
    // pointerdown rather than click: dismiss on press, so it doesn't wait for a release that
    // might land somewhere else entirely
    document.addEventListener("pointerdown", onPointerDown);
    // A surface anchored to a button in a scrolling container would drift away from its anchor
    // the moment anything scrolls, so close instead of floating somewhere meaningless. Capture
    // phase, because the scroll happens on an inner element and doesn't bubble.
    document.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
    };
  }, [active, ref, onDismiss]);
}
