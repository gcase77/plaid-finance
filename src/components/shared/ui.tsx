import { useEffect, useRef, useState, type ReactNode } from "react";

function clampRound(n: number, min: number, max: number, step: number, decimals: number) {
  if (!Number.isFinite(n)) return null;
  let x = Math.min(max, Math.max(min, n));
  x = Math.round(x / step) * step;
  return decimals > 0 ? Math.round(x * 10 ** decimals) / 10 ** decimals : Math.round(x);
}

/** Click the value to type a number; Enter/blur commits, Escape cancels. */
export function ClickEditNumber({
  value, onCommit, min, max, step, decimals, format, ariaLabel
}: {
  value: number;
  onCommit: (n: number) => void;
  min: number;
  max: number;
  step: number;
  decimals: number;
  format: (n: number) => string;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skipBlurCommit = useRef(false);
  const open = () => {
    skipBlurCommit.current = false;
    setDraft(decimals ? Number(value).toFixed(decimals) : String(value));
    setEditing(true);
  };
  const commit = () => {
    if (skipBlurCommit.current) { skipBlurCommit.current = false; return; }
    const n = parseFloat(String(draft).replace(/^\$/, "").replace(/,/g, ""));
    const next = Number.isFinite(n) ? clampRound(n, min, max, step, decimals) : null;
    if (next != null) onCommit(next);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        className="input"
        style={{ width: "4.75rem", padding: "2px 6px", display: "inline-block", verticalAlign: "middle" }}
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
          if (e.key === "Escape") {
            e.preventDefault();
            skipBlurCommit.current = true;
            setDraft(decimals ? Number(value).toFixed(decimals) : String(value));
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <button type="button" className="text-brand" style={{ padding: 0, border: 0, background: "none", cursor: "pointer", font: "inherit", fontWeight: 700, textDecoration: "underline dotted", textUnderlineOffset: 2 }}
      aria-label={`Edit ${ariaLabel}`} onClick={open}>
      {format(value)}
    </button>
  );
}

export function Tooltip({ children, content, side = "bottom" }: { children: ReactNode; content: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  const [on, setOn] = useState(false);
  const pos =
    side === "top" ? { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" } :
    side === "left" ? { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" } :
    side === "right" ? { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" } :
    { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
  return (
    <span className="tip-anchor" onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onFocus={() => setOn(true)} onBlur={() => setOn(false)}>
      {children}
      {on && <span className="tip-content" style={pos}>{content}</span>}
    </span>
  );
}

export function InfoTip({ text, label = "More info" }: { text: string; label?: string }) {
  return (
    <Tooltip content={text}>
      <span className="muted" style={{ cursor: "help", fontSize: "0.95rem" }} aria-label={label}>ⓘ</span>
    </Tooltip>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <div className="error">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }> }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; id?: string }) {
  return (
    <label className="switch">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Modal({ open, title, onClose, footer, children }: { open: boolean; title?: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="btn ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Alert({ tone = "info", onClose, children }: { tone?: "info" | "success" | "danger" | "warning"; onClose?: () => void; children: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role="alert">
      <span>{children}</span>
      {onClose && <button className="close" onClick={onClose} aria-label="Dismiss">✕</button>}
    </div>
  );
}

export function Popover({ anchor, open, onClose, children, align = "right", width = 300 }: { anchor: HTMLElement | null; open: boolean; onClose: () => void; children: ReactNode; align?: "left" | "right"; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && anchor && !anchor.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchor]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className="card card-tight popover-panel"
      style={{
        position: "absolute",
        zIndex: 200,
        top: "calc(100% + 6px)",
        [align]: 0,
        width: `min(${width}px, calc(100vw - 24px))`,
        maxWidth: "calc(100vw - 24px)",
        boxSizing: "border-box",
        padding: 0,
        boxShadow: "var(--shadow-2)",
        overflowWrap: "anywhere"
      }}
    >
      {children}
    </div>
  );
}
