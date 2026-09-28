import React, { useEffect, useId, useRef } from "react";
import Icon from "./Icon";
import Button from "./Button";
export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </header>
  );
}
export function LoadingState({
  title = "Getting things ready",
  detail = "Your saved data is on its way.",
}) {
  return (
    <div className="page page-mid" role="status" aria-live="polite">
      <div className="loading-card">
        <span className="loader" />
        <h2>{title}</h2>
        <p className="muted">{detail}</p>
        <div className="skeleton" />
        <div className="skeleton short" />
      </div>
    </div>
  );
}
export function EmptyState({ icon = "today", title, description, children }) {
  return (
    <section className="empty-state">
      <span className="icon-tile">
        <Icon name={icon} size={26} />
      </span>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {children && <div className="button-row">{children}</div>}
    </section>
  );
}
export function SourceBadge({ source, stale = false }) {
  const text = stale
    ? "Earlier insight"
    : source === "fallback"
      ? "General guidance"
      : source === "cache"
        ? "Saved AI insight"
        : source === "ai"
          ? "AI insight"
          : "Saved plan";
  return (
    <span
      className={`source-badge${source === "fallback" || stale ? " is-fallback" : ""}`}
    >
      <Icon name={source === "fallback" ? "info" : "coach"} size={13} />
      {text}
    </span>
  );
}
export function Ring({ value = 0, total = 1, label, size = 120, children }) {
  const percentage =
    total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `${value} of ${total} complete`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r="51" />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r="51"
          pathLength="100"
          strokeDasharray={`${percentage} 100`}
        />
      </svg>
      <div className="ring-content">
        {children || (
          <>
            <strong>
              {value}
              <small>/{total}</small>
            </strong>
            <span>complete</span>
          </>
        )}
      </div>
    </div>
  );
}
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  busy = false,
  onCancel,
  onConfirm,
}) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={id}>{title}</h2>
      <div className="muted">{children}</div>
      <div className="button-row">
        <Button
          type="button"
          variant="ghost"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
