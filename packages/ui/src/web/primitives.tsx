import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  genericSourceLabel,
  iconPaths,
  sourceIcon,
  statusMeta,
  type IconName,
  type SourceKind,
  type StepStatus,
} from "../shared";
import { cx } from "./cx";

export interface IconProps {
  name: IconName;
  size?: 16 | 20 | 24;
  /** Accessible name; omit for decorative icons. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  return (
    <svg
      className={cx("tx-ico", size === 20 && "tx-ico-20", size === 24 && "tx-ico-24", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {iconPaths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "mandatory";
export type ButtonSize = "sm" | "md" | "lg" | "field";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: one per view. mandatory: safety-gate confirms only. danger: destructive. */
  variant?: ButtonVariant;
  /** sm 32, md 40, lg 48, field 56 px tall. */
  size?: ButtonSize;
  icon?: IconName;
  /** Icon-only buttons must pass aria-label. */
  iconOnly?: boolean;
  block?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly,
  block,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const iconSize = size === "field" ? 24 : size === "lg" ? 20 : 16;
  return (
    <button
      type={type}
      className={cx(
        "tx-btn",
        `tx-btn-${variant}`,
        size !== "md" && `tx-btn-${size}`,
        block && "tx-btn-block",
        iconOnly && "tx-btn-icon",
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
    </button>
  );
}

export interface StatusChipProps {
  /** verified: a recorded check passed. confirmed: the user said so; never shown as verified. */
  status: StepStatus;
  size?: "md" | "lg";
  /** Overrides the default label; keep the meaning. */
  children?: ReactNode;
}

export function StatusChip({ status, size = "md", children }: StatusChipProps) {
  const meta = statusMeta[status];
  return (
    <span className={cx("tx-status", `tx-status-${status}`, size === "lg" && "tx-status-lg")}>
      <Icon name={meta.icon} />
      {children ?? meta.label}
    </span>
  );
}

export interface SourceChipProps {
  kind?: SourceKind;
  /** Citation text, e.g. "Manual p.14, fig. 3". */
  children?: ReactNode;
  href?: string;
}

export function SourceChip({ kind = "manual", children, href }: SourceChipProps) {
  const content = (
    <>
      <Icon name={sourceIcon[kind]} />
      {children ?? (kind === "generic" ? genericSourceLabel : null)}
    </>
  );
  const className = cx("tx-source", kind === "generic" && "tx-source-generic");
  return href ? (
    <a className={cx(className, "tx-focus")} href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}

export interface InputProps {
  label: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Unit shown inside the field, e.g. "Nm". */
  suffix?: string;
  mono?: boolean;
  size?: "md" | "field";
  inputMode?: "text" | "decimal" | "numeric";
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export function Input({
  label,
  id,
  value,
  defaultValue,
  placeholder,
  hint,
  error,
  suffix,
  mono,
  size = "md",
  inputMode,
  disabled,
  onChange,
}: InputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const message = error ?? hint;
  return (
    <div className={cx("tx-field", error && "is-error", size === "field" && "tx-field-lg")}>
      <label className="tx-field-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="tx-input-wrap">
        <input
          id={fieldId}
          className={cx("tx-input", mono && "tx-input-mono")}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          inputMode={inputMode}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? hintId : undefined}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
        {suffix ? <span className="tx-input-suffix">{suffix}</span> : null}
      </div>
      {message ? (
        <p id={hintId} className="tx-field-hint">
          {error ? <Icon name="alert" /> : null}
          {message}
        </p>
      ) : null}
    </div>
  );
}

export interface ToggleProps {
  label: string;
  description?: string;
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export function Toggle({
  label,
  description,
  id,
  checked,
  defaultChecked = false,
  disabled,
  onChange,
}: ToggleProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const [own, setOwn] = useState(defaultChecked);
  const on = checked ?? own;
  const flip = () => {
    if (disabled) return;
    if (checked === undefined) setOwn(!on);
    onChange?.(!on);
  };
  return (
    <div className="tx-toggle-row">
      <span className="tx-toggle-text">
        <label htmlFor={switchId} className="tx-toggle-label">
          {label}
        </label>
        {description ? <span className="tx-toggle-desc">{description}</span> : null}
      </span>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={cx("tx-toggle", on && "is-on")}
        onClick={flip}
      >
        <span className="tx-toggle-thumb" aria-hidden />
      </button>
    </div>
  );
}

export interface TabsItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabsItem[];
  value?: string;
  defaultValue?: string;
  /** Accessible name of the tab list. */
  label: string;
  size?: "md" | "field";
  onChange?: (id: string) => void;
}

export function Tabs({ items, value, defaultValue, label, size = "md", onChange }: TabsProps) {
  const [own, setOwn] = useState(defaultValue ?? items[0]?.id);
  const selected = value ?? own;
  const pick = (id: string) => {
    if (value === undefined) setOwn(id);
    onChange?.(id);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + items.length) % items.length;
    pick(items[next]!.id);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  return (
    <div
      className={cx("tx-tabs", size === "field" && "tx-tabs-lg")}
      role="tablist"
      aria-label={label}
    >
      {items.map((it, i) => {
        const on = it.id === selected;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={cx("tx-tab", on && "is-on")}
            onClick={() => pick(it.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {it.label}
            {it.count != null ? <span className="tx-tab-count">{it.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
