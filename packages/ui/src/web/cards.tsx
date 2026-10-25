// Panel and report building blocks (design system: Notice, StepRow).
import type { ReactNode } from "react";
import {
  genericSourceLabel,
  statusMeta,
  type IconName,
  type SourceKind,
  type StepStatus,
} from "../shared";
import { cx } from "./cx";
import { Icon, SourceChip, StatusChip } from "./primitives";

/** No success tone: green means verified only. */
export type NoticeTone = "neutral" | "info" | "attention" | "error";

const noticeIcon: Record<NoticeTone, IconName> = {
  neutral: "file",
  info: "info",
  attention: "alert",
  error: "stop",
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  icon?: IconName;
  /** At most one Button. */
  action?: ReactNode;
}

export function Notice({ tone = "neutral", title, children, icon, action }: NoticeProps) {
  return (
    <div
      className={cx("tx-notice", `tx-notice-${tone}`)}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={icon ?? noticeIcon[tone]} size={20} />
      <div className="tx-notice-main">
        {title ? <strong className="tx-notice-title">{title}</strong> : null}
        <span>{children}</span>
        {action ? <div className="tx-notice-act">{action}</div> : null}
      </div>
    </div>
  );
}

export interface StepRowProps {
  index: number;
  title: string;
  status?: StepStatus;
  statusLabel?: string;
  /** The citation; omit for a generic step. */
  source?: string;
  sourceKind?: SourceKind;
  onSelect?: () => void;
  disabled?: boolean;
}

/** One step in a job's list; the whole row opens it, and its label carries status and source. */
export function StepRow({
  index,
  title,
  status = "pending",
  statusLabel,
  source,
  sourceKind = "manual",
  onSelect,
  disabled,
}: StepRowProps) {
  return (
    <button
      type="button"
      className="tx-steprow"
      onClick={onSelect}
      disabled={disabled}
      aria-label={`Step ${index}: ${title}, ${statusLabel ?? statusMeta[status].label}, ${
        source ?? genericSourceLabel
      }`}
    >
      <span className="tx-steprow-num">{index}</span>
      <span className="tx-steprow-main">
        <span className="tx-steprow-title">{title}</span>
        <span className="tx-steprow-chips">
          <StatusChip status={status}>{statusLabel}</StatusChip>
          {source ? (
            <SourceChip kind={sourceKind}>{source}</SourceChip>
          ) : (
            <SourceChip kind="generic" />
          )}
        </span>
      </span>
    </button>
  );
}

export interface StepCardProps {
  index: number;
  total: number;
  title: string;
  body?: string;
  caution?: string;
  status?: StepStatus;
  statusLabel?: string;
  /** The citation; omit for a generic step. */
  source?: string;
  sourceKind?: SourceKind;
  /** One primary Button (plus the mic where there is one). */
  actions?: ReactNode;
}

/** The single step being worked on: instruction, reason, caution and its one action. */
export function StepCard({
  index,
  total,
  title,
  body,
  caution,
  status,
  statusLabel,
  source,
  sourceKind = "manual",
  actions,
}: StepCardProps) {
  return (
    <section className="tx-step" aria-label={`Step ${index} of ${total}`}>
      <div className="tx-step-meta">
        <span className="tx-step-count">
          Step {index} of {total}
        </span>
        <span className="tx-step-chips">
          {status ? <StatusChip status={status}>{statusLabel}</StatusChip> : null}
          {source ? (
            <SourceChip kind={sourceKind}>{source}</SourceChip>
          ) : (
            <SourceChip kind="generic" />
          )}
        </span>
      </div>
      <h2 className="tx-step-title">{title}</h2>
      {body ? <p className="tx-step-body">{body}</p> : null}
      {caution ? (
        <div className="tx-step-caution" role="note">
          <Icon name="alert" size={20} />
          <span>{caution}</span>
        </div>
      ) : null}
      {actions ? <div className="tx-step-actions">{actions}</div> : null}
    </section>
  );
}
