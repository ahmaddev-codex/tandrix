// Working a step: its safety gates, its one primary action, the mic, and the ways out (skip,
// reopen). The API applies the rules (@tandrix/core transitionStep); this shows the same rules up
// front so the user sees the gate before trying to start. Hold the mic to talk: commands (next,
// repeat, start, done…) act here, questions are answered in the step's context and spoken back.
import { gateCopy, refusalFor, requiredGates, transitionStep, type StepEvent } from "@tandrix/core";
import type {
  CheckResult,
  JobStep,
  ProcedureStep,
  SafetyConfirmation,
  SafetyGate as Gate,
  StepActionRequest,
  StepActionResponse,
  VoiceCommand,
} from "@tandrix/contracts";
import { space, formatTime } from "@tandrix/ui";
import {
  Button,
  Input,
  Notice,
  SafetyGate,
  VoiceTranscript,
  type VoiceTurn,
} from "@tandrix/ui/native";
import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { api } from "@/lib/api";
import { isOffline, offlineQueue } from "@/offline";
import { usePushToTalk } from "@/voice/ptt";
import { speak, stopSpeaking } from "@/voice/tts";

const active = ["in_progress", "needs_attention"];
const done = ["verified", "user_confirmed", "skipped"];

const confirmedAt = (iso: string) => `Confirmed at ${formatTime(iso)}`;

export interface StepWork {
  /** Safety gates or the refusal, shown before the step's content. */
  gates: ReactNode;
  /** The StepCard's actions: one primary, at most, and the mic. */
  actions: ReactNode;
  /** Under the StepCard: what was said, the measurement field, skip and reopen. */
  below: ReactNode;
  /** Turns said so far, so the screen can bring a new reply into view. */
  turnCount: number;
}

export interface StepWorkInput {
  jobId: string;
  step: ProcedureStep;
  jobStep: JobStep;
  confirmations: SafetyConfirmation[];
  onChange: (jobStep: JobStep, confirmations: SafetyConfirmation[]) => void;
  /** Spoken "next" / "back". */
  onNavigate: (to: "next" | "previous") => boolean;
  /** Spoken "show me again": back to the camera. */
  onShow: () => void;
  /** Part names and the equipment, to bias recognition. */
  keywords: string[];
  language: string;
  /** "Check my work": open the camera to photograph the result. */
  onCheck: () => void;
  /** The latest check on this step since it started, if any. */
  lastCheck: CheckResult | null;
  /** An action couldn't reach the API and was queued. */
  onOffline: () => void;
}

/** Null until the step has loaded; then nothing renders. */
export function useStepWork(input: StepWorkInput | null): StepWork {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [measured, setMeasured] = useState("");
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  // The talk handlers outlive a render; they read the latest step through this.
  const latest = useRef(input);
  latest.current = input;

  const say = (text: string, kind?: VoiceTurn["kind"]) => {
    setTurns((ts) => [...ts, { speaker: "tandrix", text, ...(kind ? { kind } : {}) }]);
    speak(text, latest.current?.language);
  };

  const send = async (body: StepActionRequest): Promise<StepActionResponse | null> => {
    const cur = latest.current;
    if (!cur) return null;
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await api.stepAction(cur.jobId, cur.jobStep.id, body);
      if (r.status === "applied") {
        cur.onChange(r.step, r.confirmations);
        setSkipping(false);
        setReason("");
      } else {
        setMessage(r.message);
      }
      return r;
    } catch (e) {
      if (!isOffline(e)) {
        setMessage((e as Error).message);
        return null;
      }
      cur.onOffline();
      return queueOffline(cur, body);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Offline: queue the action with when it happened, and show its effect now using the same rules
   * the API will apply. The step reads "Pending" until it's sent.
   */
  const queueOffline = async (
    cur: StepWorkInput,
    body: StepActionRequest,
  ): Promise<StepActionResponse | null> => {
    const at = new Date().toISOString();
    if (body.action === "confirm_safety") {
      await offlineQueue.enqueue({
        kind: "action",
        jobId: cur.jobId,
        jobStepId: cur.jobStep.id,
        body: { ...body, occurredAt: at },
      });
      const local = {
        id: `local-${body.gate}`,
        jobStepId: cur.jobStep.id,
        gate: body.gate,
        confirmedBy: "you",
        surface: "phone" as const,
        confirmedAt: at,
      };
      const confirmations = [...cur.confirmations, local];
      cur.onChange(cur.jobStep, confirmations);
      setMessage(undefined);
      return { status: "applied", step: cur.jobStep, confirmations };
    }
    const event: StepEvent =
      body.action === "start"
        ? { type: "start", at }
        : body.action === "confirm_done"
          ? {
              type: "confirm_done",
              at,
              ...(body.measuredValue !== undefined ? { measuredValue: body.measuredValue } : {}),
            }
          : body.action === "skip"
            ? { type: "skip", reason: body.reason, at }
            : { type: "reopen", at };
    const r = transitionStep(
      {
        status: cur.jobStep.status,
        startedAt: cur.jobStep.startedAt,
        statusEvidenceId: cur.jobStep.statusEvidenceId,
        lastCheck: cur.lastCheck,
      },
      event,
      {
        verification: cur.step.verification,
        hazardTags: cur.step.hazardTags,
        confirmedGates: cur.confirmations.map((c) => c.gate),
        ...(cur.step.measurement ? { measurement: cur.step.measurement } : {}),
      },
    );
    if (!r.ok) {
      setMessage(r.message);
      return null;
    }
    await offlineQueue.enqueue({
      kind: "action",
      jobId: cur.jobId,
      jobStepId: cur.jobStep.id,
      body: { ...body, occurredAt: at },
    });
    const { note: _note, ...rest } = cur.jobStep;
    const step = {
      ...rest,
      status: r.state.status,
      startedAt: r.state.startedAt,
      statusEvidenceId: r.state.statusEvidenceId,
      ...(r.state.note ? { note: r.state.note } : {}),
    };
    cur.onChange(step, cur.confirmations);
    setSkipping(false);
    setReason("");
    setMessage(undefined);
    // Same shape as the server's answer, so voice says "Started." offline too.
    return { status: "applied", step, confirmations: cur.confirmations };
  };

  const runCommand = async (command: VoiceCommand) => {
    const cur = latest.current!;
    switch (command.kind) {
      case "stop":
        stopSpeaking();
        return;
      case "repeat":
        return say(`${cur.step.title}. ${cur.step.instruction}`);
      case "next":
      case "previous":
        if (!cur.onNavigate(command.kind)) {
          say(command.kind === "next" ? "This is the last step." : "This is the first step.");
        }
        return;
      case "show":
        cur.onShow();
        return say("Show me the parts in the frame.");
      case "start": {
        const r = await send({ action: "start" });
        return say(
          r?.status === "applied" ? "Started." : (r?.message ?? "That didn't work. Try again."),
        );
      }
      case "done": {
        if (cur.step.verification === "measurement")
          return say("Enter the value you measured, then save it.");
        // Photo steps: check the photo first, unless a check already said a photo can't show it.
        if (cur.step.verification !== "user_confirm" && cur.lastCheck !== "not_verifiable") {
          cur.onCheck();
          return say("Show me the finished step, then take the photo.");
        }
        const r = await send({ action: "confirm_done" });
        return say(
          r?.status === "applied"
            ? "Marked as done."
            : (r?.message ?? "That didn't work. Try again."),
        );
      }
      case "skip": {
        if (!command.reason) {
          setSkipping(true);
          return say("Why are you skipping it? Say skip because, then the reason, or type it.");
        }
        const r = await send({ action: "skip", reason: command.reason });
        return say(
          r?.status === "applied" ? "Skipped." : (r?.message ?? "That didn't work. Try again."),
        );
      }
      case "stuck":
        return; // answered by the API as a question
    }
  };

  const onHeard = async (text: string) => {
    const cur = latest.current;
    if (!cur) return;
    setTurns((ts) => [...ts, { speaker: "you", text }]);
    try {
      const r = await api.askStep(cur.jobId, cur.jobStep.id, { text });
      if (r.status === "command") await runCommand(r.command);
      else if (r.status === "answer") say(r.answer, r.fromStep ? undefined : "general");
      else if (r.status === "refused") say(r.message, "refusal");
      else say(r.message);
    } catch (e) {
      say((e as Error).message);
    }
  };

  const talk = usePushToTalk({
    keywords: input?.keywords ?? [],
    onHeard,
    onProblem: (m) => say(m),
  });

  if (!input) return { gates: null, actions: null, below: null, turnCount: 0 };
  const { step, jobStep, confirmations } = input;

  const refusal = refusalFor(step.hazardTags);
  const gates = requiredGates(step.hazardTags);
  const confirmedGate = (g: Gate) => confirmations.find((c) => c.gate === g);
  const missing = gates.filter((g) => !confirmedGate(g));
  const status = jobStep.status;

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

  // Steps done on a computer are started and checked on the Mac; the step screen offers the
  // handoff as its one primary action instead.
  const primary =
    refusal || step.surface === "desktop" ? null : status === "todo" ? (
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
    ) : active.includes(status) && step.verification === "screen" ? null : active.includes(
        status,
      ) &&
      step.verification === "photo" &&
      input.lastCheck !== "not_verifiable" ? (
      <Button variant="primary" block disabled={busy} onPress={input.onCheck} testID="check-work">
        {/* After a check found a problem, the one action is to check again. */}
        {status === "needs_attention" ? "Check again" : "Check my work"}
      </Button>
    ) : active.includes(status) && step.verification !== "measurement" ? (
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

  // Design system: StepCard actions are one field primary plus the icon-only mic.
  const actions = (
    <>
      {primary ? <View style={{ flex: 1 }}>{primary}</View> : null}
      <Button
        variant={talk.state === "listening" ? "primary" : "secondary"}
        icon="mic"
        iconOnly
        accessibilityLabel="Talk to Tandrix"
        accessibilityHint="Hold and speak, then let go. Or tap once and speak; a pause sends it."
        disabled={talk.state === "working"}
        onPressIn={talk.start}
        onPressOut={talk.finish}
        testID="talk"
      />
    </>
  );

  const below = (
    <View style={{ gap: space["space-3"] }}>
      <VoiceTranscript
        testID="voice-transcript"
        state={talk.state}
        turns={turns}
        listeningLabel={
          talk.mode === "tap"
            ? "Listening. Pause or tap the mic to send."
            : "Listening. Let go to send."
        }
      />

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
            hint="This goes in the project report."
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

  return { gates: gateViews, actions, below, turnCount: turns.length };
}
