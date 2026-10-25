// One working step: the camera on top, the StepCard below (design system: Phone layout).
// Show Tandrix the parts and it highlights them on the photo; tap a label to confirm or correct
// it. When highlighting can't run, the step's parts are listed by number instead.
import type {
  HighlightResponse,
  HighlightTarget,
  JobStep,
  PartSpec,
  ProcedureStep,
} from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import {
  Button,
  CaptureView,
  PartHighlight,
  StepCard,
  Text,
  useTheme,
  type NativeHighlightTarget,
} from "@tandrix/ui/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { preparePhoto, uploadPhoto, type PreparedPhoto } from "@/lib/evidence";
import { citationLabel, stepChip } from "@/lib/steps";

type Phase = "live" | "preview" | "analyzing" | "result";

interface Loaded {
  step: ProcedureStep;
  jobStep: JobStep;
  parts: PartSpec[];
  allParts: PartSpec[];
  index: number;
  total: number;
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
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  useEffect(() => {
    api
      .getJob(id)
      .then((detail) => {
        const jobStep = detail.steps.find((s) => s.id === stepId);
        const procedure = detail.procedure;
        const step = procedure?.steps.find((s) => s.id === jobStep?.procedureStepId);
        if (!jobStep || !procedure || !step) return setError("This step isn't on the job.");
        const parts = step.partSpecIds
          .map((pid) => procedure.parts.find((p) => p.id === pid))
          .filter((p) => p !== undefined);
        setData({
          step,
          jobStep,
          parts,
          allParts: procedure.parts,
          index: step.order,
          total: procedure.steps.length,
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [id, stepId]);

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
      const r = await api.highlight(id, stepId, evidence.id);
      setResult(r);
      setTargets(r.status === "found" ? r.targets : []);
      setPhase("result");
    } catch (e) {
      setError((e as Error).message);
      setPhase("preview");
    }
  }, [photo, data, id, stepId]);

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
  const partWord = parts[0]?.name.toLowerCase() ?? "the parts";
  const unavailable = result?.status === "unavailable" ? result.message : undefined;
  const missing =
    result?.status === "found"
      ? parts.filter((p) => !targets.some((x) => x.partSpecId === p.id))
      : [];

  const frame =
    phase === "result" && photo ? (
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
          hint={phase === "live" ? `Show the ${partWord} in the frame` : undefined}
          analyzingLabel={`Finding the ${partWord}`}
          useLabel="Find the parts"
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
      <View
        style={{
          gap: space["space-3"],
          padding: space["space-4"],
          borderRadius: radius["radius-lg"],
          backgroundColor: t.color["background-100"],
          borderWidth: 1,
          borderColor: t.color.border,
        }}
      >
        <Text variant="heading-20">Show Tandrix the parts</Text>
        <Text variant="field-body" color="text-secondary">
          {parts.length
            ? `Take or choose a photo and Tandrix highlights the ${partWord}${parts.length > 1 ? " and the other parts" : ""} for this step.`
            : "This step doesn't name any parts."}
        </Text>
        {permission?.canAskAgain !== false && !cameraFailed ? (
          <Button variant="primary" block onPress={requestPermission} testID="allow-camera">
            Allow camera
          </Button>
        ) : null}
        <Button variant="secondary" block onPress={choose} testID="choose-photo">
          Choose photo
        </Button>
      </View>
    );

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: t.color["background-200"] }}
    >
      <Stack.Screen options={{ title: `Step ${data.index}` }} />
      <ScrollView contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"] }}>
        {frame}

        {phase === "result" ? (
          <View style={{ gap: space["space-2"] }}>
            {correcting ? (
              <View
                testID="correct-panel"
                style={{
                  gap: space["space-2"],
                  padding: space["space-4"],
                  borderRadius: radius["radius-lg"],
                  backgroundColor: t.color["background-100"],
                  borderWidth: 1,
                  borderColor: t.color.border,
                }}
              >
                <Text variant="heading-16">{`Is this the ${correcting.label.toLowerCase()}?`}</Text>
                <Button
                  variant="primary"
                  block
                  onPress={() => verdict(correcting, { verdict: "confirmed" })}
                  testID="confirm-highlight"
                >
                  {`Yes, that's the ${correcting.label.toLowerCase()}`}
                </Button>
                <Button
                  variant="secondary"
                  block
                  onPress={() => verdict(correcting, { verdict: "wrong" })}
                  testID="reject-highlight"
                >
                  No, that's not it
                </Button>
                {parts
                  .filter((p) => p.id !== correcting.partSpecId)
                  .map((p) => (
                    <Button
                      key={p.id}
                      variant="tertiary"
                      block
                      onPress={() =>
                        verdict(correcting, { verdict: "other_part", partSpecId: p.id })
                      }
                    >
                      {`It's the ${p.name.toLowerCase()}`}
                    </Button>
                  ))}
              </View>
            ) : null}
            {result?.status === "found" && (missing.length || result.hint) ? (
              <View testID="highlight-missing" style={{ gap: space["space-1"] }}>
                {missing.length ? (
                  <Text variant="copy-16">{`Not found in this photo: ${missing.map((p) => p.name).join(", ")}.`}</Text>
                ) : null}
                {result.hint ? (
                  <Text variant="copy-16" color="text-secondary">
                    {result.hint}.
                  </Text>
                ) : null}
              </View>
            ) : null}
            {unavailable ? (
              <View testID="highlight-unavailable" style={{ gap: space["space-2"] }}>
                <Text variant="copy-16">{unavailable}</Text>
              </View>
            ) : null}
            <Button variant="secondary" block icon="retake" onPress={retake} testID="retake-photo">
              Retake
            </Button>
          </View>
        ) : null}

        {(unavailable || result?.status === "no_parts" || phase !== "result") && parts.length ? (
          <View testID="step-parts" style={{ gap: space["space-1"] }}>
            <Text variant="label-14" color="text-secondary">
              Parts for this step
            </Text>
            {parts.map((p, i) => (
              <Text key={p.id} variant="copy-16">
                {`${i + 1}. ${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`}
                {p.partNumber ? (
                  <Text variant="mono-14" color="text-secondary">{`  ${p.partNumber}`}</Text>
                ) : null}
              </Text>
            ))}
          </View>
        ) : null}

        {error ? (
          <Text variant="copy-16" color="red-900">
            {error}
          </Text>
        ) : null}

        <StepCard
          testID="step-card"
          index={data.index}
          total={data.total}
          title={step.title}
          body={[step.instruction, step.reason].filter(Boolean).join(" ")}
          {...(step.caution ? { caution: step.caution } : {})}
          status={chip.status}
          {...(chip.label ? { statusLabel: chip.label } : {})}
          {...(cite ? { source: cite } : { sourceKind: "generic" as const })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
