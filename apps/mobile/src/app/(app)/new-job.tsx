// Start with the goal; reference photos, manuals and notes are optional context for setup.
import { space } from "@tandrix/ui";
import { Button, Icon, Input, Notice, Text, useTheme, type IconProps } from "@tandrix/ui/native";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { IntakeRow } from "@/components/intake-row";
import { api } from "@/lib/api";
import { preparePhoto, uploadPhoto, type PreparedPhoto } from "@/lib/evidence";
import { exampleGoals } from "@/lib/goals";
import { pickPdf, titleFromFileName, uploadManualPdf, type PickedPdf } from "@/lib/manual";
import {
  newSetupState,
  runSetup,
  SetupStopped,
  type Intake,
  type SetupDeps,
  type SetupState,
  type Stage,
} from "@/lib/setup";

const MAX_NOW = 4;
const MAX_PAGES = 60;

/** Take a photo or choose some; resolves with the prepared photos (none if cancelled). */
async function addPhotos(multiple: boolean): Promise<PreparedPhoto[]> {
  const choice = await new Promise<"camera" | "library" | null>((resolve) => {
    const options = ["Take photo", multiple ? "Choose photos" : "Choose photo", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (i) =>
        resolve(i === 0 ? "camera" : i === 1 ? "library" : null),
      );
    } else {
      Alert.alert("Add a photo", undefined, [
        { text: options[0]!, onPress: () => resolve("camera") },
        { text: options[1]!, onPress: () => resolve("library") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]);
    }
  });
  if (!choice) return [];
  let r: ImagePicker.ImagePickerResult;
  if (choice === "camera") {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) {
      Alert.alert("Camera is off", "Allow the camera in Settings, or choose a photo instead.");
      return [];
    }
    try {
      r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    } catch {
      Alert.alert("No camera here", "Choose a photo instead.");
      return [];
    }
  } else {
    r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: multiple,
      orderedSelection: true,
    });
  }
  if (r.canceled) return [];
  return Promise.all(
    r.assets.map((a) => preparePhoto(a.uri, { width: a.width, height: a.height })),
  );
}

const deps: SetupDeps = {
  createJob: (goal) => api.createJob({ title: goal, surface: "phone" }),
  uploadPhoto: (jobId, p) => uploadPhoto(jobId, p),
  identify: (jobId, id) => api.identifyAsset(jobId, id),
  saveAsset: (jobId, a) => api.saveAsset(jobId, a),
  uploadManual: (jobId, pdf) => uploadManualPdf(jobId, pdf, titleFromFileName(pdf.name)),
  manualFromPhotos: (jobId, body) => api.manualFromPhotos(jobId, body),
  searchManual: (jobId) => api.searchManual(jobId),
  fetchManual: (jobId, body) => api.fetchManual(jobId, body),
  generate: (jobId, body) => api.generateProcedure(jobId, body),
  partsCheck: (jobId, id) => api.partsCheck(jobId, id),
};

export default function NewJob() {
  const params = useLocalSearchParams<{ goal?: string }>();
  const [goal, setGoal] = useState(params.goal ?? "");
  const [label, setLabel] = useState<PreparedPhoto>();
  const [parts, setParts] = useState<PreparedPhoto>();
  const [now, setNow] = useState<PreparedPhoto[]>([]);
  const [pdf, setPdf] = useState<PickedPdf>();
  const [pages, setPages] = useState<PreparedPhoto[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [setup, setSetup] = useState<SetupState>();
  const [stopped, setStopped] = useState<string>();
  const state = useRef<SetupState>(undefined);

  const intake = (): Intake => ({
    goal,
    ...(label ? { label } : {}),
    ...(parts ? { parts } : {}),
    now,
    ...(pdf ? { manualPdf: pdf } : {}),
    manualPages: pdf ? [] : pages,
    ...(notes.trim() ? { notes } : {}),
  });

  const start = async () => {
    if (!goal.trim()) return setError("Say what you're doing, like Assemble a home server rack.");
    setError(undefined);
    setStopped(undefined);
    const i = intake();
    state.current ??= newSetupState(i);
    setSetup({ ...state.current });
    try {
      const jobId = await runSetup(i, state.current, deps, setSetup);
      // Straight into the project when everything went to plan; otherwise the summary says what
      // needs the user, and they open the project from there.
      if (!state.current.stages.some((s) => s.status === "attention")) openProject(jobId);
    } catch (e) {
      setStopped(e instanceof SetupStopped ? e.message : (e as Error).message);
    }
  };

  const openProject = (jobId: string) => {
    router.dismiss();
    router.push({ pathname: "/job/[id]", params: { id: jobId } });
  };

  if (setup) {
    const done =
      !stopped && setup.stages.every((s) => s.status !== "waiting" && s.status !== "working");
    return (
      <ScrollView contentContainerStyle={{ padding: space["space-6"], gap: space["space-5"] }}>
        <Stack.Screen options={{ title: "Setting up", gestureEnabled: !!stopped || done }} />
        <Text variant="heading-24">{goal.trim()}</Text>
        <View testID="setup-stages" style={{ gap: space["space-4"] }}>
          {setup.stages.map((s) => (
            <StageRow key={s.id} stage={s} />
          ))}
        </View>
        {stopped ? (
          <View style={{ gap: space["space-3"] }}>
            <Notice tone="error" testID="setup-stopped">
              {stopped}
            </Notice>
            <Button variant="primary" block onPress={start} testID="setup-retry">
              Try again
            </Button>
            {setup.jobId ? (
              <Button variant="tertiary" size="lg" block onPress={() => openProject(setup.jobId!)}>
                Open the project
              </Button>
            ) : null}
          </View>
        ) : done && setup.jobId ? (
          <Button
            variant="primary"
            block
            onPress={() => openProject(setup.jobId!)}
            testID="open-project"
          >
            Open the project
          </Button>
        ) : (
          <Text variant="copy-14" color="text-secondary">
            Writing steps from a long manual can take a couple of minutes. You can leave this
            screen: the project keeps what's done.
          </Text>
        )}
      </ScrollView>
    );
  }

  const thumbs = (ps: PreparedPhoto[], what: string) =>
    ps.map((p, i) => ({ key: p.uri, uri: p.uri, label: `${what} ${i + 1}` }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: space["space-6"], gap: space["space-4"] }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Input
          testID="job-title"
          label="What are you building or fixing?"
          value={goal}
          onChangeText={(v) => {
            setGoal(v);
            setError(undefined);
          }}
          placeholder="Assemble a 12U home server rack"
          autoFocus={!params.goal}
          maxLength={160}
          returnKeyType="done"
          {...(error ? { error } : {})}
        />
        {!goal ? (
          <View style={{ gap: space["space-2"] }}>
            <Text variant="label-13" color="text-secondary">
              For example
            </Text>
            {exampleGoals.map((g) => (
              <Button key={g} variant="tertiary" size="md" onPress={() => setGoal(g)}>
                {g}
              </Button>
            ))}
          </View>
        ) : null}

        <View style={{ gap: space["space-1"], marginTop: space["space-2"] }}>
          <Text variant="heading-18">Add details</Text>
          <Text variant="copy-14" color="text-secondary">
            Optional. Your goal is enough to get started.
          </Text>
        </View>

        <IntakeRow
          testID="intake-label"
          icon="camera"
          title="The label or box"
          body="Read the model and look for the right manual."
          canAdd={!label}
          onAdd={async () => setLabel((await addPhotos(false))[0] ?? label)}
          thumbs={label ? thumbs([label], "Label photo") : []}
          onRemove={() => setLabel(undefined)}
        />
        <IntakeRow
          testID="intake-now"
          icon="image"
          title="Where it stands now"
          body="Start from where the work is now and skip what's done."
          canAdd={now.length < MAX_NOW}
          onAdd={async () => {
            const more = await addPhotos(true);
            setNow((n) => [...n, ...more].slice(0, MAX_NOW));
          }}
          thumbs={thumbs(now, "Photo")}
          onRemove={(k) => setNow((n) => n.filter((p) => p.uri !== k))}
        />
        <IntakeRow
          testID="intake-manual"
          icon="book"
          title="The manual"
          body={
            pdf || pages.length
              ? "The steps come from this, with the page for each."
              : "Choose a PDF or photograph the pages. If you skip it, Tandrix can search."
          }
          canAdd={!pdf && pages.length < MAX_PAGES}
          addLabel={pages.length ? "Add pages" : "Add"}
          onAdd={async () => {
            if (pages.length) return setPages([...pages, ...(await addPhotos(true))]);
            const choice = await new Promise<"pdf" | "pages" | null>((resolve) =>
              Platform.OS === "ios"
                ? ActionSheetIOS.showActionSheetWithOptions(
                    {
                      options: ["PDF from Files", "Photograph the pages", "Cancel"],
                      cancelButtonIndex: 2,
                    },
                    (i) => resolve(i === 0 ? "pdf" : i === 1 ? "pages" : null),
                  )
                : Alert.alert("Add the manual", undefined, [
                    { text: "PDF from Files", onPress: () => resolve("pdf") },
                    { text: "Photograph the pages", onPress: () => resolve("pages") },
                    { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
                  ]),
            );
            if (choice === "pdf") setPdf((await pickPdf()) ?? undefined);
            if (choice === "pages") setPages(await addPhotos(true));
          }}
          thumbs={
            pdf ? [{ key: pdf.uri, label: titleFromFileName(pdf.name) }] : thumbs(pages, "Page")
          }
          onRemove={(k) =>
            pdf ? setPdf(undefined) : setPages((ps) => ps.filter((p) => p.uri !== k))
          }
        />
        <IntakeRow
          testID="intake-parts"
          icon="camera"
          title="The parts, laid out"
          body="Check what you have against the parts list."
          canAdd={!parts}
          onAdd={async () => setParts((await addPhotos(false))[0] ?? parts)}
          thumbs={parts ? thumbs([parts], "Parts photo") : []}
          onRemove={() => setParts(undefined)}
        />
        <IntakeRow
          testID="intake-notes"
          icon="file"
          title="Anything else"
          body="Add context or describe how you want the job to end."
        >
          <Input
            testID="intake-notes-input"
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="The case is already open"
            maxLength={600}
            size="lg"
          />
        </IntakeRow>

        <Button variant="primary" block onPress={start} testID="create-job">
          Create project
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stageIcon: Record<Stage["status"], { name: IconProps["name"]; color: IconProps["color"] }> = {
  waiting: { name: "clock", color: "text-tertiary" },
  working: { name: "progress", color: "text" },
  done: { name: "check", color: "text" },
  attention: { name: "alert", color: "amber-900" },
  failed: { name: "stop", color: "red-900" },
};

function StageRow({ stage }: { stage: Stage }) {
  const icon = stageIcon[stage.status];
  const t = useTheme();
  return (
    <View
      testID={`stage-${stage.id}`}
      accessibilityLabel={`${stage.title}: ${stage.status}${stage.note ? `. ${stage.note}` : ""}`}
      style={{ flexDirection: "row", gap: space["space-3"], alignItems: "flex-start" }}
    >
      <View style={{ width: 20, height: 22, justifyContent: "center", alignItems: "center" }}>
        {stage.status === "working" ? (
          <ActivityIndicator size="small" color={t.color.text} />
        ) : (
          <Icon name={icon.name} size={20} color={icon.color} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label-14" color={stage.status === "waiting" ? "text-tertiary" : "text"}>
          {stage.title}
        </Text>
        {stage.note ? (
          <Text
            variant="copy-13"
            color={
              stage.status === "attention"
                ? "amber-900"
                : stage.status === "failed"
                  ? "red-900"
                  : "text-secondary"
            }
          >
            {stage.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
