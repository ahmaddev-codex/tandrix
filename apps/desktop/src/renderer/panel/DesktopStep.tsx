// The step the Mac works on: start it, check the screen when it's done, or confirm what the
// screen can't show.
import type { Check, StepActionRequest } from "@tandrix/contracts";
import { citationLabel, stepChip } from "@tandrix/ui";
import { Button, CheckResult, Notice, StepCard } from "@tandrix/ui/web";
import { useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { DesktopStep as Current } from "../lib/desktop-step";
import { uploadScreenshot } from "../lib/screenshot";
import { speak } from "../lib/speech";

/** The last screen check, kept after the step it checked moves on. */
export interface ScreenCheck {
  check: Check;
  capturedAt: string;
  jobStepId: string;
  stepOrder: number;
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function DesktopStep({
  jobId,
  current,
  lastCheck,
  onChecked,
  onChanged,
}: {
  jobId: string;
  current: Current | undefined;
  lastCheck: ScreenCheck | undefined;
  onChecked: (c: ScreenCheck) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const result = lastCheck;
  if (!current)
    return result ? (
      <div id="desktop-step">
        <ScreenCheckResult result={result} />
      </div>
    ) : null;
  const { step, jobStep, total } = current;
  const ownResult = result?.jobStepId === jobStep.id ? result : undefined;

  const work = async (fn: () => Promise<void>) => {
    setBusy(true);
    setProblem(undefined);
    try {
      await fn();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const act = (body: StepActionRequest) =>
    work(async () => {
      const r = await api.stepAction(jobId, jobStep.id, body);
      if (r.status === "rejected") return setProblem(r.message);
      onChanged();
    });

  const check = () =>
    work(async () => {
      // The panel steps aside for the screenshot, then comes back with the answer.
      const capture = await window.tandrix.screen.capture();
      void window.tandrix.panel.show();
      const evidence = await uploadScreenshot(jobId, capture, jobStep.id);
      const r = await api.checkStep(jobId, jobStep.id, evidence.id);
      if (r.status !== "checked") return setProblem(r.message);
      onChecked({
        check: r.check,
        capturedAt: capture.capturedAt,
        jobStepId: jobStep.id,
        stepOrder: step.order,
      });
      speak(r.check.reason);
      onChanged();
    });

  const status = jobStep.status;
  const chip = stepChip[status];
  const cite = citationLabel(step.citation);
  const working = status === "in_progress" || status === "needs_attention";
  const unverifiable = ownResult?.check.result === "not_verifiable" && working;

  const primary =
    status === "todo" ? (
      <Button variant="primary" disabled={busy} onClick={() => void act({ action: "start" })}>
        Start step {step.order}
      </Button>
    ) : !working ? null : step.verification === "screen" ? (
      unverifiable ? (
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void act({ action: "confirm_done" })}
        >
          I've done it
        </Button>
      ) : (
        <Button variant="primary" disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : status === "needs_attention" ? "Check again" : "Check my screen"}
        </Button>
      )
    ) : step.verification === "user_confirm" ? (
      <Button
        variant="primary"
        disabled={busy}
        onClick={() => void act({ action: "confirm_done" })}
      >
        Mark as done
      </Button>
    ) : null;

  return (
    <div className="panel-stack-2" id="desktop-step">
      <StepCard
        index={step.order}
        total={total}
        title={step.title}
        body={step.instruction}
        {...(step.caution ? { caution: step.caution } : {})}
        status={chip.status}
        {...(status === "blocked" && jobStep.note
          ? { statusLabel: jobStep.note }
          : chip.label
            ? { statusLabel: chip.label }
            : {})}
        {...(cite ? { source: cite } : {})}
        actions={primary}
      />
      {working && (step.verification === "photo" || step.verification === "measurement") ? (
        <Notice>Check this step on your phone.</Notice>
      ) : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {result ? (
        <ScreenCheckResult
          result={result}
          {...(unverifiable
            ? {
                actions: (
                  <Button disabled={busy} onClick={() => void check()}>
                    Check again
                  </Button>
                ),
              }
            : {})}
        />
      ) : null}
    </div>
  );
}

function ScreenCheckResult({ result, actions }: { result: ScreenCheck; actions?: ReactNode }) {
  const { check } = result;
  return (
    <CheckResult
      result={check.result}
      reason={check.reason}
      title={
        check.result === "pass"
          ? `Step ${result.stepOrder} looks right`
          : check.result === "fail"
            ? `Step ${result.stepOrder} needs attention`
            : "Can't check this on the screen"
      }
      evidence={`Screen ${time(result.capturedAt)}`}
      evidenceKind="screen"
      {...(actions ? { actions } : {})}
    />
  );
}
