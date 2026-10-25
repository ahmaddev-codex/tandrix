// Job-level components shared by the Mac panel and the web report.
import type { ReactNode } from "react";
import { checkMeta, type CheckOutcome, type SourceKind, type StepStatus } from "../shared";
import { cx } from "./cx";
import { Button, Icon, SourceChip, StatusChip, type ButtonSize } from "./primitives";

export interface HandoffBannerProps {
  /** offer and waiting are phone states; incoming is the Mac side. */
  state: "offer" | "waiting" | "incoming";
  step: number;
  stepTitle?: string;
  device?: string;
  job?: string;
  size?: ButtonSize;
  onAction?: () => void;
}

export function HandoffBanner({
  state,
  step,
  stepTitle,
  device,
  job = "Job",
  size,
  onAction,
}: HandoffBannerProps) {
  const copy = {
    offer: {
      icon: "laptop" as const,
      title: "Next step is on your Mac",
      body: stepTitle ? `Step ${step}: ${stepTitle}` : `Open it on ${device ?? "your Mac"}.`,
      action: (
        <Button variant="primary" size={size ?? "field"} block={size !== "md"} onClick={onAction}>
          Continue on Mac
        </Button>
      ),
    },
    waiting: {
      icon: "laptop" as const,
      title: `Waiting on ${device ?? "your Mac"}`,
      body: `Step ${step} is open there. You can still go back to the physical steps.`,
      action: (
        <Button variant="secondary" size={size ?? "lg"} onClick={onAction}>
          Back to physical steps
        </Button>
      ),
    },
    incoming: {
      icon: "phone" as const,
      title: `${job}: step ${step} is ready`,
      body: `Sent from ${device ?? "your phone"}${stepTitle ? `. ${stepTitle}` : "."}`,
      action: (
        <Button variant="primary" onClick={onAction}>
          Open step {step}
        </Button>
      ),
    },
  }[state];
  return (
    <section className={cx("tx-handoff", `tx-handoff-${state}`)} role="status">
      <div className="tx-handoff-ico">
        <Icon name={copy.icon} size={20} />
      </div>
      <div className="tx-handoff-text">
        <strong>{copy.title}</strong>
        <span>{copy.body}</span>
      </div>
      <div className="tx-handoff-act">{copy.action}</div>
    </section>
  );
}

export interface CheckResultProps {
  /** pass sets verified; not_verifiable can only lead to confirmed. */
  result: CheckOutcome;
  reason: string;
  title?: string;
  thumbnail?: ReactNode;
  /** Evidence label, e.g. "Photo 10:46" or "Screen 10:52". */
  evidence?: string;
  /** What the evidence is; a Mac screen check shows a screen chip. */
  evidenceKind?: "photo" | "screen";
  actions?: ReactNode;
}

const checkClass: Record<CheckOutcome, string> = {
  pass: "pass",
  fail: "fail",
  not_verifiable: "nv",
};

export function CheckResult({
  result,
  reason,
  title,
  thumbnail,
  evidence,
  evidenceKind = "photo",
  actions,
}: CheckResultProps) {
  const meta = checkMeta[result];
  return (
    <section
      className={cx("tx-check", `tx-check-${checkClass[result]}`)}
      role="status"
      aria-live="polite"
    >
      {thumbnail ? <div className="tx-check-thumb">{thumbnail}</div> : null}
      <div className="tx-check-main">
        <h3 className="tx-check-title">
          <Icon name={meta.icon} size={20} />
          {title ?? meta.title}
        </h3>
        <p className="tx-check-reason">{reason}</p>
        {evidence ? <SourceChip kind={evidenceKind}>{evidence}</SourceChip> : null}
        {actions ? <div className="tx-check-actions">{actions}</div> : null}
      </div>
    </section>
  );
}

export interface JobReportStep {
  index: number;
  title: string;
  status: StepStatus;
  source?: string;
  sourceKind?: SourceKind;
  time?: string;
  thumbnail?: ReactNode;
}

export interface JobReportProps {
  title: string;
  meta?: string;
  counts: { verified?: number; confirmed?: number; attention?: number; unresolved?: number };
  steps: JobReportStep[];
  footnote?: string;
}

export const reportFootnote =
  "Verified steps passed a recorded photo or screen check. You-confirmed steps rely on your confirmation. This report does not certify the installation.";

export function JobReport({
  title,
  meta,
  counts,
  steps,
  footnote = reportFootnote,
}: JobReportProps) {
  const stats: Array<[StepStatus, number, string]> = [
    ["verified", counts.verified ?? 0, "Verified"],
    ["confirmed", counts.confirmed ?? 0, "You confirmed"],
    ["attention", counts.attention ?? 0, "Needs attention"],
    ["blocked", counts.unresolved ?? 0, "Unresolved"],
  ];
  return (
    <article className="tx-report">
      <header className="tx-report-head">
        <h2 className="tx-report-title">{title}</h2>
        {meta ? <p className="tx-report-meta">{meta}</p> : null}
      </header>
      <ul className="tx-report-stats">
        {stats.map(([status, n, label]) => (
          <li key={status}>
            <span className="tx-report-n">{n}</span>
            <StatusChip status={status}>{label}</StatusChip>
          </li>
        ))}
      </ul>
      <ol className="tx-report-steps">
        {steps.map((st) => (
          <li key={st.index} className="tx-report-step">
            <span className="tx-report-idx">{st.index}</span>
            {st.thumbnail ? (
              <span className="tx-report-thumb">{st.thumbnail}</span>
            ) : (
              <span className="tx-report-thumb tx-report-thumb-none">
                <Icon name="file" />
              </span>
            )}
            <span className="tx-report-body">
              <span className="tx-report-step-title">{st.title}</span>
              <span className="tx-report-tags">
                <StatusChip status={st.status} />
                {st.source ? (
                  <SourceChip kind={st.sourceKind ?? "manual"}>{st.source}</SourceChip>
                ) : null}
              </span>
            </span>
            <span className="tx-report-time">{st.time}</span>
          </li>
        ))}
      </ol>
      {footnote ? <p className="tx-report-foot">{footnote}</p> : null}
    </article>
  );
}
