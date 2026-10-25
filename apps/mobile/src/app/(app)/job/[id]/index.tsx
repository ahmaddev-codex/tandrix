import type {
  Asset,
  EvidenceWithUrl,
  Job,
  JobStep,
  Manual,
  ProcedureDetail,
} from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import {
  ActionCard,
  Button,
  Notice,
  StepRow,
  SummaryCard,
  Text,
  useTheme,
  type ActionCardProps,
} from "@tandrix/ui/native";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Linking, RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { citationLabel, stepChip } from "@/lib/steps";

const COLUMNS = 3;

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [job, setJob] = useState<Job>();
  const [asset, setAsset] = useState<Asset | null>();
  const [manual, setManual] = useState<Manual | null>(null);
  const [opening, setOpening] = useState(false);
  const [procedure, setProcedure] = useState<ProcedureDetail | null>(null);
  const [jobSteps, setJobSteps] = useState<JobStep[]>([]);
  const [photos, setPhotos] = useState<EvidenceWithUrl[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, items] = await Promise.all([api.getJob(id), api.listEvidence(id)]);
      setJob(detail.job);
      setAsset(detail.asset);
      setManual(detail.manual);
      setProcedure(detail.procedure);
      setJobSteps(detail.steps);
      setPhotos(items);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openManual = async (m: Manual) => {
    setOpening(true);
    try {
      await Linking.openURL(await api.manualUrl(id, m.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  };

  // The one thing the job is waiting on, if any (design system: one ActionCard per screen).
  const next: ActionCardProps | null =
    asset === null
      ? {
          icon: "camera",
          title: "Identify the equipment",
          body: "Photograph the nameplate. Tandrix reads the make and model and uses them to find the manual.",
          actionLabel: "Photograph the nameplate",
          actionTestID: "photograph-nameplate",
          onAction: () =>
            router.push({ pathname: "/job/[id]/capture", params: { id, purpose: "nameplate" } }),
        }
      : asset && !manual && !procedure
        ? {
            icon: "book",
            title: "Add the manual",
            body: "Tandrix builds the steps from the manufacturer's manual, so every step cites a page.",
            actionLabel: "Find the manual",
            actionTestID: "find-manual",
            onAction: () =>
              router.push({
                pathname: "/job/[id]/manual",
                params: { id, equipment: `${asset.make} ${asset.model}` },
              }),
            secondaryLabel: "Use general steps instead",
            secondaryTestID: "generic-steps",
            onSecondary: () =>
              router.push({ pathname: "/job/[id]/procedure", params: { id, generic: "1" } }),
          }
        : asset && manual && !procedure
          ? {
              icon: "progress",
              title: "Write the steps",
              body: "Tandrix reads the manual and writes the steps for this job, each with the page it came from.",
              actionLabel: "Write the steps",
              actionTestID: "write-steps",
              onAction: () => router.push({ pathname: "/job/[id]/procedure", params: { id } }),
            }
          : null;

  const gap = space["space-2"];
  const tile = (width - space["space-4"] * 2 - gap * (COLUMNS - 1)) / COLUMNS;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Screen options={{ title: job?.title ?? "Job" }} />
      <FlatList
        data={photos ?? []}
        keyExtractor={(p) => p.evidence.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ padding: space["space-4"], gap, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={t.color["text-secondary"]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: space["space-3"], marginBottom: space["space-2"] }}>
            {error ? (
              <Notice tone="error" testID="job-error">
                {error}
              </Notice>
            ) : null}
            {asset ? (
              <SummaryCard
                testID="asset-card"
                label="Equipment"
                title={`${asset.make} ${asset.model}`}
                facts={asset.serial ? [{ text: `Serial ${asset.serial}`, mono: true }] : []}
              />
            ) : null}
            {asset && manual ? (
              <SummaryCard
                testID="manual-card"
                label="Manual"
                title={manual.title}
                facts={[
                  { text: `${manual.pageCount} ${manual.pageCount === 1 ? "page" : "pages"}` },
                ]}
                source={
                  manual.sourceUrl
                    ? new URL(manual.sourceUrl).hostname.replace(/^www\./, "")
                    : "Your copy"
                }
                action={
                  <Button
                    variant="secondary"
                    size="lg"
                    block
                    icon="book"
                    disabled={opening}
                    onPress={() => openManual(manual)}
                    testID="open-manual"
                  >
                    Open manual
                  </Button>
                }
              />
            ) : null}
            {next ? <ActionCard {...next} /> : null}
            {procedure ? (
              <View testID="step-list" style={{ gap: space["space-2"] }}>
                <Text variant="label-16" color="text-secondary">
                  {procedure.steps.length} {procedure.steps.length === 1 ? "step" : "steps"}
                </Text>
                {procedure.steps.map((step) => {
                  const js = jobSteps.find((s) => s.procedureStepId === step.id);
                  const chip = stepChip[js?.status ?? "todo"];
                  const cite = citationLabel(step.citation);
                  return (
                    <StepRow
                      key={step.id}
                      testID="step-row"
                      index={step.order}
                      title={step.title}
                      status={chip.status}
                      {...(chip.label ? { statusLabel: chip.label } : {})}
                      {...(cite ? { source: cite } : {})}
                      disabled={!js}
                      onSelect={() =>
                        js &&
                        router.push({
                          pathname: "/job/[id]/step/[stepId]",
                          params: { id, stepId: js.id },
                        })
                      }
                    />
                  );
                })}
              </View>
            ) : null}
            <Text variant="label-16" color="text-secondary">
              {photos ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"}` : " "}
            </Text>
          </View>
        }
        ListEmptyComponent={
          photos && !error ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                gap: space["space-3"],
                padding: space["space-6"],
              }}
            >
              <Text variant="heading-24">No photos yet</Text>
              <Text variant="field-body" color="text-secondary">
                Photos you take for this job appear here.
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url, cacheKey: item.evidence.id }}
            accessibilityLabel={`Photo taken ${new Date(item.evidence.capturedAt).toLocaleString()}`}
            testID="evidence-photo"
            contentFit="cover"
            style={{
              width: tile,
              height: tile,
              borderRadius: radius["radius-md"],
              backgroundColor: t.color["gray-200"],
            }}
          />
        )}
      />
      <View
        style={{
          padding: space["space-4"],
          borderTopWidth: 1,
          borderColor: t.color.border,
          backgroundColor: t.color["background-100"],
        }}
      >
        <Button
          // One primary per view: the ActionCard's, when there is one.
          variant={next ? "secondary" : "primary"}
          block
          icon="camera"
          onPress={() => router.push({ pathname: "/job/[id]/capture", params: { id } })}
          testID="take-photo"
        >
          Take photo
        </Button>
      </View>
    </SafeAreaView>
  );
}
