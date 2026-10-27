"use client";
// Panel and report building blocks (design system: Notice, StepRow).
import { useState, type ReactNode } from "react";
import {
  genericSourceLabel,
  statusMeta,
  type IconName,
  type SourceKind,
  type StepStatus,
} from "../shared";
import { cx } from "./cx";
import { Icon, SourceChip, StatusChip, Tabs } from "./primitives";

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
        {/* Status first, on the title's line, so every row's state reads down one edge. */}
        <span className="tx-steprow-head">
          <StatusChip status={status}>{statusLabel}</StatusChip>
          <span className="tx-steprow-title">{title}</span>
        </span>
        <span className="tx-steprow-chips">
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
  /** A StepVisual: the pictures that go with the step, under its words. */
  visual?: ReactNode;
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
  visual,
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
      {visual}
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

export interface StepVisualItem {
  id: string;
  /** Short tab label: "Your reference", "Manual p.4", "Last photo". */
  label: string;
  /** The SourceChip under the picture: "Manual p.4, fig. 2", "Screenshot 10:46". */
  source: string;
  sourceKind: SourceKind;
  src: string;
  alt: string;
  /** Width over height, so the frame has its size before the picture loads. */
  aspectRatio?: number;
}

export interface StepVisualProps {
  items: StepVisualItem[];
  value?: string;
  onChange?: (id: string) => void;
  /** Opens the picture larger to read a figure; the frame shows the whole picture. */
  onOpen?: (id: string) => void;
}

/** The pictures that go with a step: the user's reference, the manual page, the latest photo. */
export function StepVisual({ items, value, onChange, onOpen }: StepVisualProps) {
  const [own, setOwn] = useState(items[0]?.id);
  const item = items.find((i) => i.id === (value ?? own)) ?? items[0];
  if (!item) return null;
  const image = (
    <img
      src={item.src}
      alt={item.alt}
      loading="lazy"
      style={item.aspectRatio ? { aspectRatio: item.aspectRatio } : undefined}
    />
  );
  return (
    <figure className="tx-visual">
      {items.length > 1 ? (
        <Tabs
          label="Pictures for this step"
          items={items.map((i) => ({ id: i.id, label: i.label }))}
          value={item.id}
          onChange={(id) => {
            if (value === undefined) setOwn(id);
            onChange?.(id);
          }}
        />
      ) : null}
      {onOpen ? (
        <button
          type="button"
          className="tx-visual-frame"
          onClick={() => onOpen(item.id)}
          aria-label={`${item.alt}. Open it larger`}
        >
          {image}
          <span className="tx-visual-open" aria-hidden>
            <Icon name="expand" />
          </span>
        </button>
      ) : (
        <div className="tx-visual-frame">{image}</div>
      )}
      <figcaption>
        <SourceChip kind={item.sourceKind}>{item.source}</SourceChip>
      </figcaption>
    </figure>
  );
}
