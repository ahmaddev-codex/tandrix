import type {
  Asset,
  EvidenceWithUrl,
  Job,
  JobStep,
  Manual,
  PartsCheck,
  ProcedureDetail,
} from "@tandrix/contracts";
import { citationLabel, radius, space, stepChip, formatDateTime } from "@tandrix/ui";
import {
  ActionCard,
  Button,
  HandoffBanner,
  Notice,
  StepRow,
  SummaryCard,
  Text,
  useTheme,
  type ActionCardProps,
} from "@tandrix/ui/native";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Linking, RefreshControl, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useJobChanges } from "@/lib/realtime";
import { isOffline, loadJob, manualCache, offlineQueue, useOfflineStatus } from "@/offline";

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
  const [partsCheck, setPartsCheck] = useState<PartsCheck | null>(null);
  const [offline, setOffline] = useState(false);
  const [queuedSteps, setQueuedSteps] = useState<Set<string>>(new Set());
  const sync = useOfflineStatus();
  // When queued work has gone through, show the job as the server now has it.
  const lastWaiting = useRef(sync.waiting);
  useEffect(() => {
    if (sync.waiting < lastWaiting.current) load();
    lastWaiting.current = sync.waiting;
  }, [sync.waiting]);
  const [photos, setPhotos] = useState<EvidenceWithUrl[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ detail, offline: off }, items, queued] = await Promise.all([
        loadJob(id),
        // Photo links need the API; offline, the job's own details still show.
        api.listEvidence(id).catch(() => [] as EvidenceWithUrl[]),
        offlineQueue.pending({ jobId: id }),
      ]);
      setOffline(off);
      setQueuedSteps(
        new Set(queued.flatMap((o) => ("jobStepId" in o && o.jobStepId ? [o.jobStepId] : []))),
      );
      setJob(detail.job);
      setAsset(detail.asset);
      setManual(detail.manual);
      setProcedure(detail.procedure);
      setJobSteps(detail.steps);
      setPartsCheck(detail.partsCheck);
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
  // Steps checked on the Mac, and handoffs, show here as they happen.
  useJobChanges(id, load);

  // While the job is on the Mac, the phone says so and can take it back.
  const onMacStep =
    job?.activeSurface === "desktop"
      ? procedure?.steps.find(
          (s) => s.id === jobSteps.find((js) => js.id === job.currentStepId)?.procedureStepId,
        )
      : undefined;
  const [takingBack, setTakingBack] = useState(false);
  const takeBack = async () => {
    setTakingBack(true);
    try {
      await api.handoff(id, { to: "phone" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTakingBack(false);
    }
  };

  // Kept on the phone (see keepForSite), the manual opens in place, with or without a connection;
  // not kept yet, it opens from the server and is kept for next time.
  const openManual = async (m: Manual) => {
    setOpening(true);
    try {
      const kept = manualCache.file(m.id);
      if (kept.exists) await File.preview(kept, { title: m.title });
      else {
        const url = await api.manualUrl(id, m.id);
        void manualCache.keep(m.id, url).catch(() => {});
        await Linking.openURL(url);
      }
    } catch (e) {
      setError(
        isOffline(e)
          ? "This manual isn't on your phone yet. Open it once with a connection and it stays."
          : (e as Error).message,
      );
    } finally {
      setOpening(false);
    }
  };

  // The one thing the job is waiting on, if any (design system: one ActionCard per screen).
  const next: ActionCardProps | null =
    // A manual on file (the equipment's, or one added for this project): steps come from it.
    manual && !procedure
      ? {
          icon: "progress",
          title: "Write the steps",
          body: "Tandrix reads the manual and writes the steps for this project, each with the page it came from.",
          actionLabel: "Write the steps",
          actionTestID: "write-steps",
          onAction: () => router.push({ pathname: "/job/[id]/procedure", params: { id } }),
        }
      : asset === null && !procedure
        ? {
            // A project starts from its goal; equipment with a nameplate makes the steps better.
            icon: "file",
            title: "Write the steps",
            body: "Tandrix writes the steps for this project. Working on equipment with a nameplate? Scan it first and the steps come from its manual.",
            actionLabel: "Write the steps",
            actionTestID: "write-project-steps",
            onAction: () =>
              router.push({ pathname: "/job/[id]/procedure", params: { id, generic: "1" } }),
            secondaryLabel: "Scan a nameplate first",
            secondaryTestID: "photograph-nameplate",
            onSecondary: () =>
              router.push({ pathname: "/job/[id]/capture", params: { id, purpose: "nameplate" } }),
          }
        : asset && !procedure
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
          : procedure && procedure.parts.length && !partsCheck
            ? {
                icon: "camera",
                title: "Check the parts",
                body: "Lay the parts out and photograph them. Tandrix ticks them off against the parts list and holds any step whose part is missing.",
                actionLabel: "Check the parts",
                actionTestID: "check-parts",
                onAction: () => router.push({ pathname: "/job/[id]/parts", params: { id } }),
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
            {offline ? (
              <Notice icon="clock" testID="offline">
                {`You're offline. This is the project as it was last synced; photos and changes are kept and sent when you're back online.${
                  sync.waiting ? ` ${sync.waiting} waiting.` : ""
                }`}
              </Notice>
            ) : null}
            {onMacStep ? (
              <HandoffBanner
                testID="handoff-waiting"
                state="waiting"
                step={onMacStep.order}
                stepTitle={onMacStep.title}
                onAction={takingBack ? undefined : () => void takeBack()}
              />
            ) : null}
            {sync.problems.map((p) => (
              <Notice
                key={p}
                tone="attention"
                action={
                  <Button variant="secondary" size="lg" onPress={sync.dismiss}>
                    Dismiss
                  </Button>
                }
              >
                {p}
              </Notice>
            ))}
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
            {procedure && partsCheck ? (
              <SummaryCard
                testID="parts-card"
                label="Parts"
                title={`${partsCheck.results.filter((r) => r.status === "found").length} of ${partsCheck.results.length} parts found`}
                facts={[
                  {
                    text:
                      [
                        partsCheck.results.filter((r) => r.status === "missing").length
                          ? `${partsCheck.results.filter((r) => r.status === "missing").length} missing`
                          : null,
                        partsCheck.results.filter((r) => r.status === "possible").length
                          ? `${partsCheck.results.filter((r) => r.status === "possible").length} to confirm`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Everything on the list is here",
                  },
                ]}
                action={
                  <Button
                    variant="secondary"
                    size="lg"
                    block
                    onPress={() => router.push({ pathname: "/job/[id]/parts", params: { id } })}
                    testID="open-parts"
                  >
                    Open the parts list
                  </Button>
                }
              />
            ) : null}
            {procedure ? (
              <View testID="step-list" style={{ gap: space["space-2"] }}>
                <Text variant="label-14" color="text-secondary">
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
                      // Design system: pending is work captured offline and not yet checked.
                      status={js && queuedSteps.has(js.id) ? "pending" : chip.status}
                      {...(js && queuedSteps.has(js.id)
                        ? {}
                        : js?.status === "blocked" && js.note
                          ? { statusLabel: js.note }
                          : chip.label
                            ? { statusLabel: chip.label }
                            : {})}
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
            {procedure ? (
              <SummaryCard
                testID="report-card"
                label="Report"
                title="The project so far, ready to share"
                action={
                  <Button
                    variant="secondary"
                    size="lg"
                    block
                    onPress={() => router.push({ pathname: "/job/[id]/report", params: { id } })}
                    testID="open-report"
                  >
                    Open the report
                  </Button>
                }
              />
            ) : null}
            <Text variant="label-14" color="text-secondary">
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
              <Text variant="heading-18">No photos yet</Text>
              <Text variant="field-body" color="text-secondary">
                Photos you take for this project appear here.
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url, cacheKey: item.evidence.id }}
            accessibilityLabel={`Photo taken ${formatDateTime(item.evidence.capturedAt)}`}
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
