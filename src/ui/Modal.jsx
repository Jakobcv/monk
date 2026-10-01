import { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SPACE } from "../lib/theme";
import { Eyebrow } from "./text";
import useModalFocus from "./useModalFocus";

// A centred dialog over a blurred, dimmed page. Portalled to <body> so it escapes the page's
// own scroll container and stacking contexts. Closes on Escape or a click on the backdrop;
// traps Tab within the panel, locks body scroll, and restores focus to whatever opened it — all of
// which is useModalFocus, shared with the narrow-screen sidebar drawer.
export default function Modal({ title, onClose, children, width = 620 }) {
  const panelRef = useRef(null);
  useModalFocus(panelRef, onClose);

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
