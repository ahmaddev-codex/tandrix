"use client";
// Mac overlay and panel components: pointer, control state and the Show me / Do it for me switch.
import { useEffect, useId, type ReactNode } from "react";
import type { ControlMode } from "../shared";
import { cx } from "./cx";
import { Button, Icon } from "./primitives";

export interface PointerBuddyProps {
  /** Position inside the overlay window, already mapped from screenshot pixels and display scale. */
  x: number | string;
  y: number | string;
  caption?: ReactNode;
  /**
   * Mode B (Highlight a region): Optional area contour drawn around a section (such as a ribbon in
   * Excel or a settings panel) when learning or explaining an interface.
   */
  box?: { width: number; height: number };
  /**
   * Mode C (Teach or guide): Optional step number displayed as a small badge on the pointer.
   */
  step?: number;
}

export function PointerBuddy({ x, y, box, step }: PointerBuddyProps) {
  const bw = box ? Math.max(36, Math.round(box.width)) : 0;
  const bh = box ? Math.max(24, Math.round(box.height)) : 0;
  return (
    <div className="tx-ptr" style={{ left: x, top: y }} role="status" aria-live="polite">
      {box ? (
        <svg
          className="tx-ptr-ring"
          style={{ left: -Math.round(bw / 2), top: -Math.round(bh / 2) }}
          viewBox={`0 0 ${bw} ${bh}`}
          width={bw}
          height={bh}
          aria-hidden="true"
        >
          <rect
            x="3"
            y="3"
            width={bw - 6}
            height={bh - 6}
            rx="12"
            className="tx-ptr-ring-halo"
            pathLength={1}
          />
          <rect
            x="3"
            y="3"
            width={bw - 6}
            height={bh - 6}
            rx="12"
            className="tx-ptr-ring-stroke"
            pathLength={1}
          />
        </svg>
      ) : null}
      <svg className="tx-ptr-arrow" viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
        <path d="M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z" />
      </svg>
      {step ? <span className="tx-ptr-step">{step}</span> : null}
    </div>
  );
}

export type PresenceState = "listening" | "thinking" | "looking" | "answering" | "doing";

export interface PresenceBarProps {
  state: PresenceState;
  /** One short line: "Listening", "Looking at your screen". */
  label: string;
  /** The keys that end this state, shown as keycaps after the label ("⌃⇧"). */
  keys?: string;
  /** What to do with the keys: "Let go to ask". */
  keysHint?: string;
  /** Under the pill, at most two lines: what the user asked while thinking, the reply after. */
  text?: string;
  /** Microphone level while listening, 0 to 1. */
  level?: number;
  /** Space from the display's top edge to below the menu bar (and the notch), in points. */
  top?: number;
}

const BARS = [0.55, 0.85, 1, 0.8, 0.5];

/**
 * Tandrix is active: a pill under the menu bar, ringed with a glow, saying what it's doing; what
 * was asked or the reply sits under it. Click-through, and gone when Tandrix is idle, so the screen
 * stays free.
 */
export function PresenceBar({
  state,
  label,
  keys,
  keysHint,
  level = 0,
  top = 0,
}: PresenceBarProps) {
  return (
    <div
      className="tx-presence"
      data-state={state}
      role="status"
      aria-live="polite"
      style={{ ["--tx-level" as string]: Math.max(0, Math.min(1, level)) }}
    >
      <div className="tx-presence-stack" style={{ top: top + 8 }}>
        <div className="tx-presence-pill">
          {state === "listening" ? (
            <span className="tx-presence-meter" aria-hidden>
              {BARS.map((b, i) => (
                <span key={i} style={{ ["--tx-bar" as string]: b }} />
              ))}
            </span>
          ) : state === "thinking" || state === "looking" ? (
            <span className="tx-presence-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          ) : (
            <span className="tx-ctl-dot" aria-hidden />
          )}
          <span>{label}</span>
          {keys ? (
            <span className="tx-presence-keys">
              <kbd>{keys}</kbd>
              {keysHint ? <span>{keysHint}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
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
  // A modal: focus starts on the main action (autoFocus), and Esc is the same as Cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    // Over everything, centred, with the page dimmed behind; a click outside cancels.
    <div
      className="tx-dialog-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
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
          <Button autoFocus variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Copy for the Show me → Do it for me confirmation. Product-owned; keep it calm and exact. */
export const doItForMeConfirmation = {
  title: "Let Tandrix click for you?",
  lead: "Clicking this allows Tandrix to control your device.",
  note: "Press Esc to take back control. Tandrix still asks before paying, sending, deleting or changing security settings.",
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
