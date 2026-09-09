import { useEffect, useRef } from "react";
import { X, ArrowUpRight, ArrowDownRight, Inbox } from "lucide-react";
import { money, percent } from "../lib/portfolio";
import { catalog } from "../lib/seed";
export function Return({ value, pct, currency = "USD", compact = false }) {
  return (
    <span
      className={`return ${value > 0 ? "positive" : value < 0 ? "negative" : "neutral"} ${compact ? "compact" : ""}`}
    >
      {money(value, currency, true)}
      {pct != null && <small>{percent(pct)}</small>}
    </span>
  );
}
export function Company({ symbol, name, exchange, small = false }) {
  const c = catalog.find((c) => c.symbol === symbol);
  return (
    <div className={`company ${small ? "small" : ""}`}>
      <span
        className="company-mark"
        style={{ "--mark": c?.color || "#6255df" }}
      >
        {symbol === "AAPL"
          ? "a"
          : symbol === "NVDA"
            ? "n"
            : symbol === "MSFT"
              ? "m"
              : symbol === "GOOGL"
                ? "G"
                : symbol === "AMZN"
                  ? "a"
                  : symbol[0]}
      </span>
      <div>
        <strong>
          {symbol}
          {exchange && <em className="exchange-label">{exchange}</em>}
        </strong>
        <span>{name}</span>
      </div>
    </div>
  );
}
export function Empty({ title = "Nothing here yet", text, action }) {
  return (
    <div className="empty">
      <span>
        <Inbox size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-head">
        <div>
          <h2 id="modal-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Metric({ label, value, change, hint, positive }) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {positive !== undefined &&
          (positive ? (
            <ArrowUpRight size={16} />
          ) : (
            <ArrowDownRight size={16} />
          ))}
      </div>
      <div
        className={`metric-value ${positive === true ? "positive" : positive === false ? "negative" : ""}`}
      >
        {value}
      </div>
      <div className="metric-foot">
        {change && (
          <span className={positive ? "positive" : "negative"}>{change}</span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
export function Field({ label, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
