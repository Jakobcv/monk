import { useState, useEffect, useRef, useCallback } from "react";

// A miniature of the sheet's sections, pinned to the desk beside it: one short line per section,
// the one you're reading picked out, and the names only when you ask for them by pointing at it.
// It's a map of a long document that costs nothing to ignore — which is the whole point, since it
// sits on a reading surface where anything permanent would compete with the writing.
//
// It reads the sheet rather than being told what's in it: any element carrying
// `data-section-label` is a section, and the attribute is its name. That keeps a page's sections
// in one place (the page), lets a label change as someone types a heading, and means a new
// section anywhere on any sheet appears here without a second list to keep in step. A
// MutationObserver is what makes that live.
//
// Not links. The app routes on the hash, so an `href="#problem"` would navigate the app rather
// than scroll the page; these are buttons that scroll their section into view (the scroll-margin
// on .paper-section is what stops a heading landing under the frame above it).
//
// Fewer than two sections is not a document worth mapping, so it renders nothing.
//
// It takes the sheet and the scrolling page as *elements*, not refs, so the page holds them with
// a callback ref (`ref={setSheet}`). A ref object's `.current` changing is invisible to an effect
// — it re-renders nothing and re-runs nothing — so a map built from one keeps measuring and
// scrolling nodes that have since been replaced. An element in state is a dependency, and the
// scan and the scroll listener rebuild themselves when the page swaps its DOM underneath them.

const OFFSET = 96; // how far down the viewport the "current" section line sits

export default function SectionMap({ container, scroller, label = "Sections" }) {
  const [sections, setSections] = useState([]);
  const [active, setActive] = useState(0);
  // The elements themselves, kept out of state: they're identity, not data to render.
  const els = useRef([]);

  const scan = useCallback(() => {
    if (!container) { els.current = []; setSections([]); return; }
    const found = [...container.querySelectorAll("[data-section-label]")];
    els.current = found;
    setSections(found.map((el, i) => el.getAttribute("data-section-label")?.trim() || `Section ${i + 1}`));
  }, [container]);

  useEffect(() => {
    // The first read has to happen here even though the linter would rather it didn't: the DOM is
    // the external system this synchronizes with, and observe() doesn't report what is already
    // there. Everything after this one is driven by the observer.
    scan();
    if (!container) return;
    const observer = new MutationObserver(scan);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-section-label"] });
    return () => observer.disconnect();
  }, [container, scan]);

  // Which section the reader is in: the last one whose top has passed the mark. Read on scroll
  // and on resize, both passive, both cheap — a handful of getBoundingClientRect calls on an
  // element count in the tens.
  useEffect(() => {
    if (!scroller) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const mark = scroller.getBoundingClientRect().top + OFFSET;
      let current = 0;
      els.current.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= mark) current = i;
      });
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scroller, sections.length]);

  if (sections.length < 2) return null;

  const go = (i) => {
    const el = els.current[i];
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Focus first, scroll second, and never the other way round: moving focus cancels a smooth
    // scroll that has already started, so the jump silently does nothing. `preventScroll` keeps
    // focus from doing its own jump in the meantime.
    //
    // Focus has to move at all, or tabbing onwards resumes back at the map. It lands on the
    // section itself (the skip-link pattern) and never on a field inside it: a jump that parks
    // the caret in a token's name is a jump where the next keystroke edits the document.
    el.tabIndex = -1;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav className="section-map" aria-label={label}>
      {sections.map((name, i) => (
        <button
          key={i}
          type="button"
          className="section-map__row"
          // The label is clipped to nothing until the map is pointed at, and a name that is not
          // rendered is not a name — so the button carries it, and the span is decoration.
          aria-label={name}
          aria-current={i === active ? "true" : undefined}
          onClick={() => go(i)}
        >
          <span className="section-map__label" aria-hidden="true">{name}</span>
          <span className="section-map__line" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
