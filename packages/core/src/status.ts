// Step status rules. The only path to `verified` is a passing check on evidence captured after
// the step started; everything a user can do on their own ends at `user_confirmed` or `skipped`.
import type {
  CheckResult,
  HazardTag,
  JobStepStatus,
  SafetyGate,
  Verification,
} from "@tandrix/contracts";
import { missingGates, refusalFor } from "./safety";

export interface StepState {
  status: JobStepStatus;
  startedAt: string | null;
  statusEvidenceId: string | null;
  /** Most recent check result since the step started, if any. */
  lastCheck: CheckResult | null;
  note?: string;
}

export interface StepContext {
  verification: Verification;
  hazardTags: readonly HazardTag[];
  confirmedGates: readonly SafetyGate[];
  measurement?: { target: number; tolerance?: number; unit: string };
}

export type StepEvent =
  | { type: "start"; at: string }
  | {
      type: "check";
      result: CheckResult;
      evidenceId: string;
      evidenceCapturedAt: string;
      at: string;
    }
  | { type: "confirm_done"; at: string; measuredValue?: number }
  | { type: "skip"; reason: string; at: string }
  | { type: "block"; reason: string; at: string }
  | { type: "unblock"; at: string }
  | { type: "reopen"; at: string };

export type TransitionErrorCode =
  | "invalid_transition"
  | "refused"
  | "safety_gate_required"
  | "stale_evidence"
  | "check_not_applicable"
  | "confirmation_not_allowed"
  | "measurement_required"
  | "measurement_out_of_range";

export type TransitionResult =
  | { ok: true; state: StepState }
  | { ok: false; code: TransitionErrorCode; message: string; gates?: SafetyGate[] };

const fail = (
  code: TransitionErrorCode,
  message: string,
  gates?: SafetyGate[],
): TransitionResult => (gates ? { ok: false, code, message, gates } : { ok: false, code, message });

const active: JobStepStatus[] = ["in_progress", "needs_attention"];
export const terminalStatuses: readonly JobStepStatus[] = ["verified", "user_confirmed", "skipped"];

export function transitionStep(
  state: StepState,
  event: StepEvent,
  ctx: StepContext,
): TransitionResult {
  const s = state.status;
  switch (event.type) {
    case "start": {
      if (s !== "todo") return fail("invalid_transition", `Can't start a step that is ${s}.`);
      const refusal = refusalFor(ctx.hazardTags);
      if (refusal) return fail("refused", refusal.reason);
      const gates = missingGates(ctx.hazardTags, ctx.confirmedGates);
      if (gates.length)
        return fail("safety_gate_required", "Confirm the safety steps first.", gates);
      return ok({
        status: "in_progress",
        startedAt: event.at,
        statusEvidenceId: null,
        lastCheck: null,
      });
    }

    case "check": {
      if (!active.includes(s))
        return fail("invalid_transition", `Can't check a step that is ${s}.`);
      if (ctx.verification !== "photo" && ctx.verification !== "screen") {
        return fail(
          "check_not_applicable",
          "This step is confirmed by the user, not by a photo or screen check.",
        );
      }
      if (!state.startedAt || Date.parse(event.evidenceCapturedAt) < Date.parse(state.startedAt)) {
        return fail("stale_evidence", "The photo was taken before this step started.");
      }
      if (event.result === "pass") {
        return ok({
          ...state,
          status: "verified",
          statusEvidenceId: event.evidenceId,
          lastCheck: "pass",
        });
      }
      if (event.result === "fail") {
        return ok({
          ...state,
          status: "needs_attention",
          statusEvidenceId: null,
          lastCheck: "fail",
        });
      }
      return ok({ ...state, status: "in_progress", lastCheck: "not_verifiable" });
    }

    case "confirm_done": {
      if (!active.includes(s))
        return fail("invalid_transition", `Can't confirm a step that is ${s}.`);
      if (ctx.verification === "measurement") {
        if (event.measuredValue === undefined || !ctx.measurement) {
          return fail("measurement_required", "Enter the measured value.");
        }
        const tol = ctx.measurement.tolerance ?? 0;
        if (Math.abs(event.measuredValue - ctx.measurement.target) > tol) {
          return fail(
            "measurement_out_of_range",
            `The manual specifies ${ctx.measurement.target} ${ctx.measurement.unit}.`,
          );
        }
      } else if (ctx.verification !== "user_confirm" && state.lastCheck !== "not_verifiable") {
        return fail(
          "confirmation_not_allowed",
          state.lastCheck === "fail"
            ? "The last check found a problem. Fix it and check again, or skip the step with a reason."
            : "Check this step with a photo first.",
        );
      }
      return ok({ ...state, status: "user_confirmed", statusEvidenceId: null });
    }

    case "skip": {
      if (terminalStatuses.includes(s))
        return fail("invalid_transition", `Can't skip a step that is ${s}.`);
      return ok({ ...state, status: "skipped", statusEvidenceId: null, note: event.reason });
    }

    case "block": {
      if (!["todo", ...active].includes(s))
        return fail("invalid_transition", `Can't block a step that is ${s}.`);
      return ok({ ...state, status: "blocked", note: event.reason });
    }

    case "unblock": {
      if (s !== "blocked") return fail("invalid_transition", "Step isn't blocked.");
      return ok({ status: "todo", startedAt: null, statusEvidenceId: null, lastCheck: null });
    }

    case "reopen": {
      if (!terminalStatuses.includes(s))
        return fail("invalid_transition", `Can't reopen a step that is ${s}.`);
      // Reopening needs fresh evidence: earlier photos no longer count.
      return ok({
        status: "in_progress",
        startedAt: event.at,
        statusEvidenceId: null,
        lastCheck: null,
      });
    }
  }
}

function ok(state: StepState): TransitionResult {
  return { ok: true, state };
}
