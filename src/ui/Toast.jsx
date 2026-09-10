import { useEffect } from "react";

// One toast at a time, bottom-left, auto-dismissing. Deliberately plain: it reports something
// that already happened and offers exactly one way to reverse it. A second delete replaces the
// first toast (and with it, that first undo) — which is the standard bargain, and keeps the
// screen from stacking up with things demanding attention.
const DISMISS_AFTER = 7000;

export default function Toast({ toast, onDismiss }) {
  const id = toast?.id;

  useEffect(() => {
    if (id == null) return;
    const t = setTimeout(onDismiss, DISMISS_AFTER);
    return () => clearTimeout(t);
    // keyed on `id` so each new toast restarts the clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.onUndo && (
        <button
          className="toast__undo"
          onClick={() => { toast.onUndo(); onDismiss(); }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
