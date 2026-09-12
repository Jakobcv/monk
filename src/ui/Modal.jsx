import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SPACE } from "../lib/theme";
import { Eyebrow } from "./text";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// A centred dialog over a blurred, dimmed page. Portalled to <body> so it escapes the page's
// own scroll container and stacking contexts. Closes on Escape or a click on the backdrop;
// traps Tab within the panel, locks body scroll, and restores focus to whatever opened it.
export default function Modal({ title, onClose, children, width = 620 }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    const opener = document.activeElement;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
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
  }, []);

  return createPortal(
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        className="modal-panel enter-up"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width: `min(${width}px, 100%)` }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.lg }}>
          <Eyebrow as="span">{title}</Eyebrow>
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
