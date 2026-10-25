"use client";
// Mac overlay and panel components: pointer, control state and the Show me / Do it for me switch.
import { useId, type ReactNode } from "react";
import type { ControlMode } from "../shared";
import { cx } from "./cx";
import { Button, Icon } from "./primitives";

const POINTER_PATH = "M3 2 L3 22 L8.5 16.8 L12.4 25 L16 23.4 L12.2 15.4 L19.5 15.4 Z";

export interface PointerBuddyProps {
  /** Position inside the overlay window, already mapped from screenshot pixels and display scale. */
  x: number | string;
  y: number | string;
  caption?: ReactNode;
}

export function PointerBuddy({ x, y, caption }: PointerBuddyProps) {
  return (
    <div className="tx-ptr" style={{ left: x, top: y }} role="status" aria-live="polite">
      <svg viewBox="0 0 28 28" aria-hidden>
        <path
          d={POINTER_PATH}
          fill="var(--highlight)"
          stroke="var(--highlight-halo)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d={POINTER_PATH}
          fill="none"
          stroke="var(--highlight-keyline)"
          strokeWidth={0.75}
          strokeLinejoin="round"
        />
      </svg>
      {caption ? <div className="tx-ptr-cap">{caption}</div> : null}
    </div>
  );
}

export interface ControlIndicatorProps {
  children?: ReactNode;
  stopLabel?: string;
  onStop?: () => void;
}

/** Shown top centre of the active display for as long as Tandrix is in Do it for me mode. */
export function ControlIndicator({
  children = "Tandrix is in control",
  stopLabel = "Stop (Esc)",
  onStop,
}: ControlIndicatorProps) {
  return (
    <div className="tx-ctl" role="status">
      <span className="tx-ctl-dot" aria-hidden />
      <span>{children}</span>
      <button type="button" onClick={onStop}>
        {stopLabel}
      </button>
    </div>
  );
}

export interface ConfirmDialogProps {
  title: string;
  lead?: string;
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmDialog({
  title,
  lead,
  note,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <div className="tx-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="tx-dialog-body">
        <h2 className="tx-dialog-title" id={titleId}>
          {title}
        </h2>
        {lead ? <p className="tx-dialog-lead">{lead}</p> : null}
        {note ? <p className="tx-dialog-note">{note}</p> : null}
      </div>
      <div className="tx-dialog-foot">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

/** Copy for the Show me → Do it for me confirmation. Product-owned; keep it calm and exact. */
export const doItForMeConfirmation = {
  title: "Let Tandrix click for you?",
  lead: "Clicking this allows Tandrix to control your device.",
  note: "Press Esc or move your mouse to take back control. Tandrix still asks before paying, sending, deleting or changing security settings.",
  confirmLabel: "Turn on",
  cancelLabel: "Keep pointing only",
} as const satisfies Omit<ConfirmDialogProps, "onConfirm" | "onCancel" | "tone">;

export interface ModeToggleProps {
  mode: ControlMode;
  /** Called with the requested mode. Open ConfirmDialog before applying "do". */
  onChange?: (mode: ControlMode) => void;
  label?: string;
}

export function ModeToggle({ mode, onChange, label = "How Tandrix helps" }: ModeToggleProps) {
  const option = (id: ControlMode, text: string, icon: "pointer" | "hand") => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === id}
      className={cx("tx-mode-opt", mode === id && "is-on")}
      onClick={() => {
        if (mode !== id) onChange?.(id);
      }}
    >
      <Icon name={icon} />
      {text}
      {id === "do" && mode === "do" ? <span className="tx-mode-dot" aria-hidden /> : null}
    </button>
  );
  return (
    <div className="tx-mode" role="radiogroup" aria-label={label}>
      {option("show", "Show me", "pointer")}
      {option("do", "Do it for me", "hand")}
    </div>
  );
}
