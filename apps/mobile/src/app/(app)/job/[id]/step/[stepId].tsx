// One working step: the camera on top, the StepCard below (design system: Phone layout).
// Show Tandrix the parts and it highlights them on the photo; tap a label to confirm or correct
// it. When highlighting can't run, the step's parts are listed by number instead.
import type {
  Check,
  HighlightResponse,
  HighlightTarget,
  JobStep,
  SafetyConfirmation,
  PartSpec,
  ProcedureStep,
  StepVisual as StepVisualData,
} from "@tandrix/contracts";
import {
  citationLabel,
  space,
  stepChip,
  visualAspect,
  visualLabels,
  formatTime,
} from "@tandrix/ui";
import {
  Button,
  CaptureView,
  CheckResult,
  HandoffBanner,
  HighlightCorrection,
  Notice,
  PartHighlight,
  StepCard,
  StepVisual,
  Text,
  useTheme,
  type NativeHighlightTarget,
} from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { speak } from "@/voice/tts";
import { isOffline, keepPhoto, loadJob, offlineQueue, visualCache } from "@/offline";
import { preparePhoto, uploadPhoto, type PreparedPhoto } from "@/lib/evidence";
import { useStepWork } from "@/components/step-work";
import { useJobChanges } from "@/lib/realtime";
import { ImageViewer, type ViewedImage } from "@/components/image-viewer";

const finished = ["verified", "user_confirmed", "skipped"];

type Phase = "live" | "preview" | "analyzing" | "result";

interface Loaded {
  step: ProcedureStep;
  jobStep: JobStep;
  confirmations: SafetyConfirmation[];
  parts: PartSpec[];
  allParts: PartSpec[];
  index: number;
  total: number;
  /** Neighbouring job steps, for spoken "next" and "back". */
  previousId?: string;
  nextId?: string;
  nextTitle?: string;
  keywords: string[];
  language: string;
  /** The job is open on the Mac (handed off there). */
  onMac: boolean;
}

export default function StepScreen() {
  const { id, stepId } = useLocalSearchParams<{ id: string; stepId: string }>();
  const t = useTheme();
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<Phase>("live");
  const [photo, setPhoto] = useState<PreparedPhoto>();
  const [result, setResult] = useState<HighlightResponse>();
  const [targets, setTargets] = useState<HighlightTarget[]>([]);
  const [correcting, setCorrecting] = useState<HighlightTarget>();
  // A photo finds the step's parts, checks the finished work, or becomes the step's reference.
  const [purpose, setPurpose] = useState<"find" | "check" | "reference">("find");
  // The step's pictures: the user's reference, the manual page it cites, the latest photo.
  const [visuals, setVisuals] = useState<StepVisualData[]>([]);
  const [visualId, setVisualId] = useState<string>();
  const [viewing, setViewing] = useState<ViewedImage>();
  const [check, setCheck] = useState<Check | null>(null);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState<string>();
  // Work on this step waiting in the offline queue: the step reads "Pending" until it's sent.
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    offlineQueue.pending({ jobStepId: stepId }).then((ops) => setQueued(ops.length > 0));
    return offlineQueue.subscribe((ops) =>
      setQueued(ops.some((o) => "jobStepId" in o && o.jobStepId === stepId)),
    );
  }, [stepId]);
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  const load = useCallback(() => {
    loadJob(id)
      .then(({ detail, offline: off }) => {
        setOffline(off);
        const jobStep = detail.steps.find((s) => s.id === stepId);
        const procedure = detail.procedure;
        const step = procedure?.steps.find((s) => s.id === jobStep?.procedureStepId);
        if (!jobStep || !procedure || !step) return setError("This step isn't in this project.");
        const parts = step.partSpecIds
          .map((pid) => procedure.parts.find((p) => p.id === pid))
          .filter((p) => p !== undefined);
        const nextJobStep = detail.steps[detail.steps.indexOf(jobStep) + 1];
        const nextStep = nextJobStep
          ? procedure.steps.find((candidate) => candidate.id === nextJobStep.procedureStepId)
          : undefined;
        setData({
          step,
          jobStep,
          confirmations: detail.safetyConfirmations.filter((c) => c.jobStepId === jobStep.id),
          parts,
          allParts: procedure.parts,
          index: step.order,
          total: procedure.steps.length,
          ...(detail.steps[detail.steps.indexOf(jobStep) - 1]
            ? { previousId: detail.steps[detail.steps.indexOf(jobStep) - 1]!.id }
            : {}),
          ...(nextJobStep ? { nextId: nextJobStep.id } : {}),
          ...(nextStep ? { nextTitle: nextStep.title } : {}),
          keywords: [
            ...parts.map((p) => p.name),
            ...(detail.asset ? [detail.asset.make, detail.asset.model] : []),
          ],
          language: detail.job.language,
          onMac: detail.job.activeSurface === "desktop",
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [id, stepId]);
  // Pictures help but aren't needed to work the step: offline, the ones kept on the phone show;
  // failing, the step shows without.
  const loadVisuals = useCallback(() => {
    api
      .stepVisuals(id, stepId)
      .then((r) => {
        setVisuals(r.visuals);
        void visualCache.save(stepId, r.visuals).catch(() => {});
      })
      .catch(async () => setVisuals(await visualCache.load(stepId)));
  }, [id, stepId]);
  useEffect(load, [load]);
  useEffect(loadVisuals, [loadVisuals]);
  // The Mac checking this step, or the job coming back from the Mac, shows here as it happens.
  useJobChanges(id, () => {
    load();
    loadVisuals();
  });

  const [handingOff, setHandingOff] = useState(false);
  const handOff = async (to: "desktop" | "phone") => {
    if (!data) return;
    setHandingOff(true);
    setNotice(undefined);
    try {
      await api.handoff(id, to === "desktop" ? { to, stepId: data.jobStep.id } : { to });
      if (to === "phone") return router.back();
      setData((d) => (d ? { ...d, onMac: true } : d));
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setHandingOff(false);
    }
  };

  const work = useStepWork(
    data
      ? {
          jobId: id,
          step: data.step,
          jobStep: data.jobStep,
          confirmations: data.confirmations,
          onChange: (jobStep, confirmations) =>
            setData((d) => (d ? { ...d, jobStep, confirmations } : d)),
          onNavigate: (to) => {
            const target = to === "next" ? data.nextId : data.previousId;
            if (!target) return false;
            router.replace({ pathname: "/job/[id]/step/[stepId]", params: { id, stepId: target } });
            return true;
          },
          ...(data.nextId ? { nextId: data.nextId } : {}),
          ...(data.nextTitle ? { nextTitle: data.nextTitle } : {}),
          onShow: () => {
            setPurpose("find");
            setPhoto(undefined);
            setResult(undefined);
            setTargets([]);
            setCorrecting(undefined);
            setPhase("live");
          },
          onFinish: () => router.replace({ pathname: "/job/[id]", params: { id } }),
          keywords: data.keywords,
          language: data.language,
          onCheck: () => {
            setPurpose("check");
            setCheck(null);
            setPhoto(undefined);
            setResult(undefined);
            setTargets([]);
            setCorrecting(undefined);
            setPhase("live");
            scroll.current?.scrollTo({ y: 0, animated: true });
          },
          lastCheck: check?.result ?? null,
          onOffline: () => setOffline(true),
        }
      : null,
  );

  // A new spoken reply comes into view; the transcript sits at the end of the screen.
  const scroll = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (work.turnCount) scroll.current?.scrollToEnd({ animated: true });
  }, [work.turnCount]);

  const take = async () => {
    setError(undefined);
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 1, exif: false });
      if (!shot) return;
      setPhoto(await preparePhoto(shot.uri, shot));
      setPhase("preview");
    } catch {
      setError("Couldn't take the photo. Try again, or choose one from your photos.");
    }
  };

  const choose = async () => {
    setError(undefined);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const a = r.canceled ? undefined : r.assets[0];
    if (!a) return;
    setPhoto(await preparePhoto(a.uri, { width: a.width, height: a.height }));
    setPhase("preview");
  };

  const analyse = useCallback(async () => {
    if (!photo || !data) return;
    setPhase("analyzing");
    setError(undefined);
    try {
      const evidence = await uploadPhoto(id, photo, stepId);
      if (purpose === "reference") {
        const r = await api.setStepReference(id, stepId, evidence.id);
        setVisuals(r.visuals);
        setVisualId(r.visuals[0]?.kind);
        setPhoto(undefined);
        setPurpose("find");
        setPhase("live");
        setNotice(undefined);
        scroll.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      if (purpose === "check") {
        const r = await api.checkStep(id, stepId, evidence.id);
        if (r.status !== "checked") {
          setError(r.message);
          setPhase("preview");
          return;
        }
        // Say the verdict aloud like someone standing next to them.
        const verdict =
          r.check.result === "pass"
            ? `That's correct. ${r.check.reason}`
            : [r.check.reason, r.check.whatToShowNext].filter(Boolean).join(" ");
        speak(verdict);
        setCheck(r.check);
        setData((d) => (d ? { ...d, jobStep: r.step } : d));
        setPhase("result");
        loadVisuals();
        return;
      }
      const r = await api.highlight(id, stepId, evidence.id);
      loadVisuals();
      setResult(r);
      setTargets(r.status === "found" ? r.targets : []);
      setPhase("result");
    } catch (e) {
      if (!isOffline(e)) {
        setError((e as Error).message);
        setPhase("preview");
        return;
      }
      setOffline(true);
      // Offline: a check photo is kept and checked when the phone is back online; finding parts
      // needs an answer now, so it can't wait.
      if (purpose === "reference") {
        setNotice("Adding a reference photo needs a connection. Try again when you're online.");
      } else if (purpose === "check") {
        const kept = keepPhoto(
          photo.uri,
          {
            width: photo.width,
            height: photo.height,
            byteSize: photo.byteSize,
            capturedAt: photo.capturedAt,
          },
          `${stepId}-${Date.now().toString(36)}`,
        );
        await offlineQueue.enqueue({
          kind: "photo",
          jobId: id,
          jobStepId: stepId,
          photo: kept,
          then: "check",
        });
        setNotice("Saved offline. Tandrix will check this photo when you're back online.");
      } else {
        setNotice("Finding parts needs a connection. The parts are listed below.");
      }
      setPhoto(undefined);
      setPurpose("find");
      setPhase("live");
    }
  }, [photo, data, id, stepId, purpose, loadVisuals]);

  const addReference = () => {
    setPurpose("reference");
    setPhoto(undefined);
    setResult(undefined);
    setTargets([]);
    setCorrecting(undefined);
    setPhase("live");
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const removeReference = async () => {
    try {
      const r = await api.clearStepReference(id, stepId);
      setVisuals(r.visuals);
      setVisualId(r.visuals[0]?.kind);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const retake = () => {
    setPhoto(undefined);
    setResult(undefined);
    setTargets([]);
    setCorrecting(undefined);
    setPhase("live");
  };

  const verdict = async (
    target: HighlightTarget,
    v:
      | { verdict: "confirmed" }
      | { verdict: "wrong" }
      | { verdict: "other_part"; partSpecId: string },
  ) => {
    setCorrecting(undefined);
    try {
      await api.correctDetection(id, target.detectionId, v);
      setTargets((ts) => {
        if (v.verdict === "wrong") return ts.filter((x) => x.detectionId !== target.detectionId);
        return ts.map((x) => {
          if (x.detectionId !== target.detectionId) return x;
          const part =
            v.verdict === "other_part"
              ? data?.allParts.find((p) => p.id === v.partSpecId)
              : undefined;
          return {
            ...x,
            possible: false,
            ...(part ? { label: part.name, partSpecId: part.id, partNumber: part.partNumber } : {}),
          };
        });
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: space["space-6"] }}>
        <Stack.Screen options={{ title: "Step" }} />
        <Text variant="field-body" color={error ? "red-900" : "text-secondary"}>
          {error ?? "Loading the step"}
        </Text>
      </View>
    );
  }

  const { step, jobStep, parts } = data;
  const chip = stepChip[jobStep.status];
  const cite = citationLabel(step.citation);
  const usable = permission?.granted && !cameraFailed;
  const canAskCamera = permission?.canAskAgain !== false && !cameraFailed;
  // Names as written: many are proper nouns ("Raspberry Pi 5").
  const partWord = parts[0]?.name ?? "the parts";
  const unavailable = result?.status === "unavailable" ? result.message : undefined;
  const missing =
    result?.status === "found"
      ? parts.filter((p) => !targets.some((x) => x.partSpecId === p.id))
      : [];

  const frame =
    purpose === "check" && phase === "result" && photo && check ? (
      // Design system: CheckResult, with the photo it judged.
      <CheckResult
        testID="check-result"
        result={check.result}
        reason={check.whatToShowNext ? `${check.reason} ${check.whatToShowNext}` : check.reason}
        evidence={`Photo ${formatTime(photo.capturedAt)}`}
        thumbnail={
          <Image
            source={{ uri: photo.uri }}
            style={{ width: 88, aspectRatio: photo.width / photo.height }}
            contentFit="cover"
            accessibilityLabel="The photo Tandrix checked"
          />
        }
      />
    ) : phase === "result" && photo ? (
      <View style={{ flex: 1, minHeight: 280 }}>
        <PartHighlight
          testID="part-highlight"
          size={{ width: photo.width, height: photo.height }}
          alt={
            targets.length
              ? `Highlighted: ${targets.map((x) => x.label).join(", ")}`
              : "No parts highlighted in this photo"
          }
          targets={targets.map((x): NativeHighlightTarget => ({
            id: x.detectionId,
            label: x.label,
            ...(x.partNumber ? { partNumber: x.partNumber } : {}),
            possible: x.possible,
            box: x.geometry.kind === "point" ? { ...x.geometry.point, w: 1, h: 1 } : x.geometry.box,
            ...(x.geometry.kind === "mask" ? { mask: x.geometry.mask } : {}),
          }))}
          onLabelPress={(nt) => setCorrecting(targets.find((x) => x.detectionId === nt.id))}
        >
          <Image
            source={{ uri: photo.uri }}
            style={{ flex: 1 }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        </PartHighlight>
      </View>
    ) : usable || phase !== "live" ? (
      <View style={{ height: 360 }}>
        <CaptureView
          state={phase === "result" ? "preview" : phase}
          hint={
            phase !== "live"
              ? undefined
              : purpose === "check"
                ? "Show the finished step, close and in good light"
                : purpose === "reference"
                  ? "Show how it should look when done: the box, a kit sheet, a finished one"
                  : `Show the ${partWord} in the frame`
          }
          analyzingLabel={
            purpose === "check"
              ? "Checking your work"
              : purpose === "reference"
                ? "Saving your reference"
                : `Finding the ${partWord}`
          }
          useLabel={
            purpose === "check"
              ? "Check this photo"
              : purpose === "reference"
                ? "Use as reference"
                : "Find the parts"
          }
          canCapture={cameraReady}
          onCapture={take}
          onRetake={retake}
          onUse={analyse}
          secondaryAction={
            <Button variant="tertiary" size="lg" onPress={choose} testID="choose-photo">
              Choose photo
            </Button>
          }
        >
          {phase === "live" ? (
            <CameraView
              ref={camera}
              style={{ flex: 1 }}
              facing="back"
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => setCameraFailed(true)}
            />
          ) : photo ? (
            <Image source={{ uri: photo.uri }} style={{ flex: 1 }} contentFit="contain" />
          ) : null}
        </CaptureView>
      </View>
    ) : (
      // Highlighting helps but isn't the step's action, so this asks quietly: one secondary button.
      <Notice
        icon="camera"
        testID="show-parts"
        action={
          canAskCamera ? (
            <Button variant="secondary" size="lg" onPress={requestPermission} testID="allow-camera">
              Allow camera
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onPress={choose} testID="choose-photo">
              Choose photo
            </Button>
          )
        }
      >
        {purpose === "check"
          ? "Check your work: take or choose a photo of the finished step."
          : purpose === "reference"
            ? "Add a reference: take or choose a photo of how this step should look when it's done."
            : `Show Tandrix the parts: take or choose a photo and it highlights the ${partWord}${
                parts.length > 1 ? " and the other parts" : ""
              } for this step.`}
      </Notice>
    );

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: t.color["background-200"] }}
    >
      <Stack.Screen
        options={{
          title: `Step ${data.index}`,
          animation: "slide_from_right",
          animationTypeForReplace: "push",
        }}
      />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"] }}
        // One tap on "Save measurement" saves, rather than only closing the number pad.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        {offline ? (
          <Notice icon="clock" testID="offline">
            You're offline. Steps, safety checks and your changes still work; they're sent when
            you're back online.
          </Notice>
        ) : null}
        {notice ? <Notice testID="offline-notice">{notice}</Notice> : null}
        {/* Design system: a step done on a computer is handed to the Mac. */}
        {data && data.step.surface === "desktop" && !finished.includes(data.jobStep.status) ? (
          <HandoffBanner
            testID={data.onMac ? "handoff-waiting" : "handoff-offer"}
            state={data.onMac ? "waiting" : "offer"}
            step={data.index}
            stepTitle={data.step.title}
            onAction={handingOff ? undefined : () => void handOff(data.onMac ? "phone" : "desktop")}
          />
        ) : null}
        {/* Design system: a SafetyGate stands before a hazardous step. */}
        {work.gates}
        {/* Photos are for finding parts; a step that names none has no frame. */}
        {parts.length || purpose !== "find" ? frame : null}

        {phase === "result" && purpose === "find" ? (
          <View style={{ gap: space["space-2"] }}>
            {correcting ? (
              <HighlightCorrection
                testID="correct-panel"
                label={correcting.label}
                otherParts={parts
                  .filter((p) => p.id !== correcting.partSpecId)
                  .map((p) => ({ id: p.id, name: p.name }))}
                onConfirm={() => verdict(correcting, { verdict: "confirmed" })}
                onReject={() => verdict(correcting, { verdict: "wrong" })}
                onOtherPart={(p) =>
                  verdict(correcting, { verdict: "other_part", partSpecId: p.id })
                }
              />
            ) : null}
            {result?.status === "found" && (missing.length || result.hint) ? (
              <Notice icon="camera" testID="highlight-missing">
                {[
                  missing.length
                    ? `Not found in this photo: ${missing.map((p) => p.name).join(", ")}.`
                    : "",
                  result.hint ? `${result.hint}.` : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              </Notice>
            ) : null}
            {unavailable ? <Notice testID="highlight-unavailable">{unavailable}</Notice> : null}
            <Button variant="secondary" block icon="retake" onPress={retake} testID="retake-photo">
              Retake
            </Button>
          </View>
        ) : null}

        {(unavailable || result?.status === "no_parts" || phase !== "result") && parts.length ? (
          <View testID="step-parts" style={{ gap: space["space-1"] }}>
            <Text variant="label-13" color="text-secondary">
              Parts for this step
            </Text>
            {parts.map((p, i) => (
              <Text key={p.id} variant="copy-14">
                {`${i + 1}. ${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`}
                {p.partNumber ? (
                  <Text variant="mono-12" color="text-secondary">{`  ${p.partNumber}`}</Text>
                ) : null}
              </Text>
            ))}
          </View>
        ) : null}

        {error ? (
          <Notice tone="error" testID="step-error">
            {error}
          </Notice>
        ) : null}

        <StepCard
          testID="step-card"
          index={data.index}
          total={data.total}
          title={step.title}
          body={[step.instruction, step.reason].filter(Boolean).join(" ")}
          {...(step.caution ? { caution: step.caution } : {})}
          status={queued ? "pending" : chip.status}
          {...(queued ? {} : chip.label ? { statusLabel: chip.label } : {})}
          {...(cite ? { source: cite } : { sourceKind: "generic" as const })}
          visual={
            visuals.length ? (
              <StepVisual
                testID="step-visual"
                value={visualId ?? visuals[0]!.kind}
                onChange={setVisualId}
                onOpen={(kind) => {
                  const v = visuals.find((x) => x.kind === kind);
                  if (v) setViewing({ url: v.url, ...visualLabels(v) });
                }}
                items={visuals.map((v) => {
                  const l = visualLabels(v);
                  const aspectRatio = visualAspect(v);
                  return {
                    id: v.kind,
                    ...l,
                    ...(aspectRatio ? { aspectRatio } : {}),
                    image: (
                      <Image
                        source={{
                          uri: v.url,
                          cacheKey:
                            v.kind === "manual_page" ? `${v.manualId}/${v.page}` : v.evidenceId,
                        }}
                        style={{ flex: 1 }}
                        contentFit="contain"
                        transition={150}
                        accessibilityIgnoresInvertColors
                      />
                    ),
                  };
                })}
              />
            ) : undefined
          }
          actions={work.actions}
        />
        {/* The user's own picture of the finished step, for them and for the photo check. */}
        {purpose !== "reference" ? (
          (visualId ?? visuals[0]?.kind) === "reference" ? (
            <Button
              variant="tertiary"
              size="lg"
              block
              icon="x"
              onPress={removeReference}
              testID="remove-reference"
            >
              Remove reference
            </Button>
          ) : visuals.some((v) => v.kind === "reference") ? null : (
            <Button
              variant="tertiary"
              size="lg"
              block
              icon="image"
              onPress={addReference}
              testID="add-reference"
            >
              Add a reference photo
            </Button>
          )
        ) : null}
        {work.below}
      </ScrollView>
      {work.next ? (
        <View
          testID="step-next-footer"
          style={{
            padding: space["space-4"],
            borderTopWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color["background-100"],
          }}
        >
          {work.next}
        </View>
      ) : null}
      <ImageViewer image={viewing} onClose={() => setViewing(undefined)} />
    </SafeAreaView>
  );
}
