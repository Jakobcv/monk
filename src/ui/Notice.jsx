// A quiet in-flow bar between the breadcrumbs and the page: something happened that you may want
// to act on, and nothing will happen until you do.
//
// Deliberately not a Toast. A toast reports something already done and takes itself away after
// seven seconds, which is right for "removed a card, undo?" and wrong for both of the things this
// is used for — a file that changed under your cursor, and a request to edit a file in your repo.
// Those are decisions, they don't expire, and they must not cover the thing you're deciding about.
export default function Notice({ icon: Icon, children, actionLabel, onAction, onDismiss }) {
  return (
    <div className="notice" role="status">
      {Icon && <Icon size={14} />}
      <span>{children}</span>
      {onAction && (
        <button type="button" className="notice__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button type="button" className="notice__dismiss" onClick={onDismiss} title="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
