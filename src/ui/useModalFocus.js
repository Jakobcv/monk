import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const isField = (el) => el instanceof HTMLElement && (el.matches("input, textarea, select") || el.isContentEditable);

// What makes a surface modal, whatever it looks like: Escape closes it, Tab stays inside it, the
// page behind it doesn't scroll, focus moves in when it opens and goes back to whatever opened it
// when it closes. Shared by the centred dialog (Modal) and the narrow-screen sidebar drawer, which
// differ only in where their panel sits.
//
// `active` lets a surface that is always mounted (the drawer) switch this on and off; a dialog that
// mounts to open just leaves it true. `escapeInFields: false` hands Escape to a focused field first
// — the sidebar's rename input uses it to cancel — rather than closing the whole surface from under
// it. Modal keeps true: its forms are meant to be dismissed from anywhere (DialogActions).
export default function useModalFocus(panelRef, onClose, { active = true, escapeInFields = true } = {}) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!active) return undefined;
    const opener = document.activeElement;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (!escapeInFields && isField(e.target)) return;
        e.stopPropagation(); closeRef.current(); return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // tabIndex >= 0 drops the options a roving-tabindex group (Settings' theme control) keeps out
      // of the Tab order on purpose. Counted, one of them could be "last" while the real last stop
      // came before it, and Tab from that stop walked out of the dialog.
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null && n.tabIndex >= 0);
      if (nodes.length === 0) { e.preventDefault(); panelRef.current.focus(); return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown, true);

    // Leave focus alone if the content already claimed it (e.g. an autoFocus field inside).
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      (panel.querySelector(FOCUSABLE) || panel).focus();
    }

    return () => {
      body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
      opener?.focus?.();
    };
  }, [active, escapeInFields, panelRef]);
}
