import Button from "./Button";

// Cancel/Save for a create dialog. The keyboard shortcuts live inside the buttons themselves as
// small key chips, rather than as a separate hint line competing with them. Both buttons share
// a min-width so "Cancel" and "Save" read as a matched pair instead of two sizes. The shortcuts
// themselves are handled by the caller (Modal owns Escape; the form owns Cmd/Ctrl+Enter).
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export default function DialogActions({ onCancel, onSave, saveLabel = "Save" }) {
  return (
    <div className="dialog-actions">
      <Button onClick={onCancel}>
        Cancel <kbd className="kbd">Esc</kbd>
      </Button>
      <Button variant="primary" onClick={onSave}>
        {saveLabel} <kbd className="kbd">{isMac ? "⌘↵" : "Ctrl ↵"}</kbd>
      </Button>
    </div>
  );
}
