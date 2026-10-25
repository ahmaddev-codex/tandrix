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
