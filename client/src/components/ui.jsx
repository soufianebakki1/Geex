import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, CircleAlert, Inbox, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import { errorMessage } from "../api/errors.js";
import { initials } from "../utils/format.js";

export function Button({ variant = "secondary", size = "md", icon: Icon, iconOnly = false, loading = false, className = "", children, type = "button", ...props }) {
  const classes = ["btn", `btn--${variant}`, size !== "md" && `btn--${size}`, iconOnly && "btn--icon", className].filter(Boolean).join(" ");
  const iconSize = size === "sm" ? 15 : 16;
  return (
    <button type={type} className={classes} {...props} disabled={loading || props.disabled}>
      {loading ? <LoaderCircle size={iconSize} className="spin" /> : Icon ? <Icon size={iconSize} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant = "secondary", size = "md", icon: Icon, className = "", children, ...props }) {
  const classes = ["btn", `btn--${variant}`, size !== "md" && `btn--${size}`, className].filter(Boolean).join(" ");
  return (
    <Link to={to} className={classes} {...props}>
      {Icon ? <Icon size={size === "sm" ? 15 : 16} /> : null}
      {children}
    </Link>
  );
}

function pageWindow(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const keep = new Set([1, count, page - 1, page, page + 1]);
  if (page <= 4) [2, 3, 4, 5].forEach((value) => keep.add(value));
  if (page >= count - 3) [count - 4, count - 3, count - 2, count - 1].forEach((value) => keep.add(value));
  const sorted = [...keep].filter((value) => value >= 1 && value <= count).sort((a, b) => a - b);
  return sorted.flatMap((value, index) => (index > 0 && value - sorted[index - 1] > 1 ? ["gap", value] : [value]));
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="pagination__btn" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Page précédente">
        <ChevronLeft size={16} />
      </button>
      {pageWindow(page, pageCount).map((value, index) =>
        value === "gap" ? (
          <span key={`gap-${index}`} className="pagination__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={value}
            type="button"
            className={`pagination__btn num ${value === page ? "is-active" : ""}`}
            onClick={() => onChange(value)}
            aria-current={value === page ? "page" : undefined}
            aria-label={`Page ${value}`}
          >
            {value}
          </button>
        ),
      )}
      <button type="button" className="pagination__btn" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Page suivante">
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export function Badge({ tone = "neutral", dot = false, children, className = "" }) {
  return (
    <span className={`badge badge--${tone} ${className}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ map, value, dot = true }) {
  const meta = map[value];
  if (!meta) return <Badge>{value ?? "—"}</Badge>;
  return (
    <Badge tone={meta.tone} dot={dot}>
      {meta.label}
    </Badge>
  );
}

export function FormStep({ number, title, children }) {
  return (
    <section className="pre-step">
      <header className="pre-step__head">
        <span className="pre-step__number">{number}</span>
        <h3 className="pre-step__title">{title}</h3>
      </header>
      <div className="pre-step__body">{children}</div>
    </section>
  );
}

export function Card({ title, subtitle, actions, children, footer, className = "", bodyClassName = "", flush = false }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__header">
          <div className="grow">
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={`${flush ? "card__body--flush" : "card__body"} ${bodyClassName}`}>{children}</div>
      {footer && <footer className="card__footer">{footer}</footer>}
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions, back, meta }) {
  return (
    <header className={`page-header ${eyebrow || description ? "" : "page-header--compact"}`}>
      <div className="grow">
        {back && (
          <Link to={back.to} className="page-header__back">
            <ArrowLeft size={15} />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
        {meta && <div className="page-header__meta">{meta}</div>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Field({ label, hint, error, required, children, className = "" }) {
  const id = useId();
  const child = typeof children === "function" ? children(id) : children;
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {child}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Rechercher…", label = "Rechercher" }) {
  return (
    <div className="input-icon">
      <Search size={16} />
      <input className="input" type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

export function Segmented({ items, value, onChange, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={`segmented__item ${value === item.value ? "is-active" : ""}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count != null && <span className="segmented__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, size = "md", tone }) {
  return (
    <span className={`avatar ${size !== "md" ? `avatar--${size}` : ""} ${tone ? `avatar--${tone}` : ""}`} title={name} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value, max = 100, tone, size, label }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`progress ${tone ? `progress--${tone}` : ""} ${size ? `progress--${size}` : ""}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }) {
  return (
    <div className={`state ${compact ? "state--compact" : ""}`}>
      <span className="state__icon">
        <Icon size={22} />
      </span>
      <p className="state__title">{title}</p>
      {description && <p className="state__description">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact = false }) {
  return (
    <div className={`state state--error ${compact ? "state--compact" : ""}`} role="alert">
      <span className="state__icon">
        <CircleAlert size={22} />
      </span>
      <p className="state__title">Chargement impossible</p>
      <p className="state__description">{errorMessage(error)}</p>
      {onRetry && (
        <Button icon={RefreshCw} size="sm" onClick={() => onRetry()}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function LoadingBlock({ rows = 4 }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={44} />
      ))}
    </div>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert">
      <CircleAlert size={16} />
      <span>{typeof error === "string" ? error : errorMessage(error)}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size, busy = false }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector("[data-autofocus], .modal__body input:not([type=hidden]), .modal__body select, .modal__body textarea, .modal__body button");
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className={`modal ${size ? `modal--${size}` : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
        <div className="modal__header">
          <div className="grow">
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} disabled={busy} aria-label="Fermer" />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmer", tone = "primary", onConfirm, onClose, busy, error, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack">
        {description && <p className="muted">{description}</p>}
        {children}
        <FormError error={error} />
      </div>
    </Modal>
  );
}
