// Working a step: its safety gates, its one primary action and the ways out (skip, reopen). The
// API applies the rules (@tandrix/core transitionStep); this shows the same rules up front so the
// user sees the gate before trying to start.
import { gateCopy, refusalFor, requiredGates } from "@tandrix/core";
import type {
  JobStep,
  ProcedureStep,
  SafetyConfirmation,
  SafetyGate as Gate,
  StepActionRequest,
} from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { Button, Input, Notice, SafetyGate } from "@tandrix/ui/native";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { api } from "@/lib/api";

const active = ["in_progress", "needs_attention"];
const done = ["verified", "user_confirmed", "skipped"];

const confirmedAt = (iso: string) =>
  `Confirmed at ${new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

export interface StepWork {
  /** Safety gates or the refusal, shown before the step's content. */
  gates: ReactNode;
  /** The StepCard's actions: one primary, at most. */
  actions: ReactNode;
  /** Under the StepCard: the measurement field, skip and reopen, and any answer from the rules. */
  below: ReactNode;
}

export interface StepWorkInput {
  jobId: string;
  step: ProcedureStep;
  jobStep: JobStep;
  confirmations: SafetyConfirmation[];
  onChange: (jobStep: JobStep, confirmations: SafetyConfirmation[]) => void;
}

/** Null until the step has loaded; then nothing renders. */
export function useStepWork(input: StepWorkInput | null): StepWork {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [measured, setMeasured] = useState("");
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");
  if (!input) return { gates: null, actions: null, below: null };
  const { jobId, step, jobStep, confirmations, onChange } = input;

  const refusal = refusalFor(step.hazardTags);
  const gates = requiredGates(step.hazardTags);
  const confirmedGate = (g: Gate) => confirmations.find((c) => c.gate === g);
  const missing = gates.filter((g) => !confirmedGate(g));
  const status = jobStep.status;

  const send = async (body: StepActionRequest) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await api.stepAction(jobId, jobStep.id, body);
      if (r.status === "applied") {
        onChange(r.step, r.confirmations);
        setSkipping(false);
        setReason("");
      } else {
        setMessage(r.message);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Gates stand between the step and its start, so they show until it starts.
  const gateViews = refusal ? (
    <SafetyGate
      testID="safety-refusal"
      tone="stop"
      title="Tandrix won't guide this step"
      body={refusal.reason}
    />
  ) : status === "todo" && gates.length ? (
    <View style={{ gap: space["space-3"] }}>
      {gates.map((g) => {
        const c = confirmedGate(g);
        return (
          <SafetyGate
            key={g}
            testID={`gate-${g}`}
            title={gateCopy[g].title}
            body={gateCopy[g].body}
            actionLabel={gateCopy[g].action}
            confirmed={!!c}
            {...(c ? { confirmedLabel: confirmedAt(c.confirmedAt) } : {})}
            onConfirm={() => send({ action: "confirm_safety", gate: g })}
          />
        );
      })}
    </View>
  ) : null;

  const measuring = step.verification === "measurement" && active.includes(status);
  const measuredValue = Number(measured.replace(",", "."));
  const canSave = !busy && !!measured.trim() && !Number.isNaN(measuredValue);
  const saveMeasurement = () => send({ action: "confirm_done", measuredValue });

  const actions = refusal ? null : status === "todo" ? (
    missing.length ? null : (
      <Button
        variant="primary"
        block
        disabled={busy}
        onPress={() => send({ action: "start" })}
        testID="start-step"
      >
        Start step
      </Button>
    )
  ) : active.includes(status) && step.verification === "user_confirm" ? (
    <Button
      variant="primary"
      block
      disabled={busy}
      onPress={() => send({ action: "confirm_done" })}
      testID="mark-done"
    >
      Mark as done
    </Button>
  ) : null;

  const below = (
    <View style={{ gap: space["space-3"] }}>
      {measuring && step.measurement ? (
        // The value and its save sit together, above the keyboard; Done saves too.
        <View style={{ gap: space["space-3"] }}>
          <Input
            testID="measured-value"
            label={`${step.measurement.quantity[0]!.toUpperCase()}${step.measurement.quantity.slice(1)} applied`}
            hint={`Target ${step.measurement.target} ${step.measurement.unit}${
              step.measurement.tolerance ? ` ± ${step.measurement.tolerance}` : ""
            }`}
            {...(message ? { error: message } : {})}
            value={measured}
            onChangeText={(v) => {
              setMeasured(v);
              setMessage(undefined);
            }}
            mono
            suffix={step.measurement.unit}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            onSubmitEditing={() => canSave && saveMeasurement()}
          />
          <Button
            variant="primary"
            block
            disabled={!canSave}
            onPress={saveMeasurement}
            testID="save-measurement"
          >
            Save measurement
          </Button>
        </View>
      ) : null}
      {message && !measuring ? (
        <Notice tone="attention" testID="step-rejected">
          {message}
        </Notice>
      ) : null}
      {skipping ? (
        <View style={{ gap: space["space-2"] }}>
          <Input
            testID="skip-reason"
            label="Why skip this step?"
            hint="This goes in the job report."
            value={reason}
            onChangeText={setReason}
            maxLength={400}
          />
          <Button
            variant="secondary"
            size="lg"
            block
            disabled={busy || !reason.trim()}
            onPress={() => send({ action: "skip", reason: reason.trim() })}
            testID="confirm-skip"
          >
            Skip step
          </Button>
          <Button variant="tertiary" size="lg" block onPress={() => setSkipping(false)}>
            Cancel
          </Button>
        </View>
      ) : done.includes(status) ? (
        <Button
          variant="tertiary"
          size="lg"
          block
          disabled={busy}
          onPress={() => send({ action: "reopen" })}
          testID="reopen-step"
        >
          Reopen step
        </Button>
      ) : (
        <Button
          variant="tertiary"
          size="lg"
          block
          onPress={() => setSkipping(true)}
          testID="skip-step"
        >
          Skip this step
        </Button>
      )}
    </View>
  );

  return { gates: gateViews, actions, below };
}
