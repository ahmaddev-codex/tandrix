import type { Job, JobDetailResponse, JobStep } from "@tandrix/contracts";
import { formatDateTime, radius, space } from "@tandrix/ui";
import { Button, Icon, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { Link, router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { exampleGoals } from "@/lib/goals";

const statusLabel: Record<Job["status"], string> = {
  active: "In progress",
  completed: "Completed",
  stopped: "Paused",
};

interface HomeAction {
  job: Job;
  title: string;
  detail: string;
  stepId?: string;
}

function isFinished(step: JobStep) {
  return ["verified", "user_confirmed", "skipped"].includes(step.status);
}

function actionFor(detail: JobDetailResponse): HomeAction {
  const { job, procedure, steps } = detail;
  if (job.activeSurface === "desktop") {
    return { job, title: "See your progress on Mac", detail: "This project is open on your Mac." };
  }
  if (!procedure) {
    if (detail.asset && !detail.manual) {
      return {
        job,
        title: "Find the equipment manual",
        detail: `${detail.asset.make} ${detail.asset.model}`,
      };
    }
    return {
      job,
      title: "Create the project steps",
      detail: detail.manual
        ? "Use the manual saved to this project."
        : "Turn this idea into a clear plan.",
    };
  }

  const priority: Record<JobStep["status"], number> = {
    blocked: 0,
    needs_attention: 0,
    in_progress: 1,
    todo: 2,
    user_confirmed: 3,
    verified: 3,
    skipped: 3,
  };
  const candidates = procedure.steps
    .map((step) => ({
      step,
      jobStep: steps.find((candidate) => candidate.procedureStepId === step.id),
    }))
    .filter(
      (item): item is typeof item & { jobStep: JobStep } =>
        !!item.jobStep && !isFinished(item.jobStep),
    )
    .sort(
      (a, b) =>
        priority[a.jobStep.status] - priority[b.jobStep.status] || a.step.order - b.step.order,
    );
  const next = candidates[0];
  if (!next) {
    return { job, title: "Review this project", detail: "Open the project to see the full plan." };
  }

  const label: Record<JobStep["status"], string> = {
    blocked: "Resolve",
    needs_attention: "Review",
    in_progress: "Continue",
    todo: "Start",
    user_confirmed: "Review",
    verified: "Continue",
    skipped: "Continue",
  };
  const message: Record<JobStep["status"], string> = {
    blocked: next.jobStep.note ?? "This step is blocked.",
    needs_attention: "This step needs your attention.",
    in_progress: "Pick up where you left off.",
    todo: "Ready when you are.",
    user_confirmed: "Review this step.",
    verified: "This step is complete.",
    skipped: "This step was skipped.",
  };
  return {
    job,
    title: `${label[next.jobStep.status]}: ${next.step.title}`,
    detail: message[next.jobStep.status],
    stepId: next.jobStep.id,
  };
}

export default function Jobs() {
  const t = useTheme();
  const { signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>();
  const [actions, setActions] = useState<HomeAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const listed = await api.listJobs();
      const sorted = [...listed].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setJobs(sorted);
      const active = sorted.filter((job) => job.status === "active");
      setActionsLoading(active.length > 0);
      const results = await Promise.allSettled(active.map((job) => api.getJob(job.id)));
      setActions(
        results.flatMap((result) =>
          result.status === "fulfilled" ? [actionFor(result.value)] : [],
        ),
      );
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeJobs = (jobs ?? []).filter((job) => job.status === "active");
  const otherJobs = (jobs ?? []).filter((job) => job.status !== "active");

  const openAction = (action: HomeAction) => {
    router.push(
      action.stepId
        ? {
            pathname: "/job/[id]/step/[stepId]",
            params: { id: action.job.id, stepId: action.stepId },
          }
        : { pathname: "/job/[id]", params: { id: action.job.id } },
    );
  };

  const openJob = (jobId: string) => router.push({ pathname: "/job/[id]", params: { id: jobId } });

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: space["space-1"] }}>
              <Link href="/pair" asChild>
                <Button
                  variant="tertiary"
                  size="md"
                  icon="laptop"
                  accessibilityLabel="Sign in a Mac"
                  testID="sign-in-mac"
                >
                  Mac
                </Button>
              </Link>
              <Button variant="tertiary" size="md" onPress={signOut} testID="sign-out">
                Sign out
              </Button>
            </View>
          ),
        }}
      />
      <FlatList
        data={activeJobs}
        keyExtractor={(job) => job.id}
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"], flexGrow: 1 }}
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
          <View style={{ gap: space["space-5"], marginBottom: space["space-2"] }}>
            {error ? (
              <Notice
                tone="error"
                action={
                  <Button variant="secondary" size="lg" onPress={load}>
                    Try again
                  </Button>
                }
              >
                {error}
              </Notice>
            ) : null}
            {jobs === undefined && !error ? (
              <ProgressState label="Loading your projects" testID="projects-loading" />
            ) : (
              <>
                <View style={{ gap: space["space-2"] }}>
                  <Text variant="heading-24">What are you working on?</Text>
                  <Text variant="field-body" color="text-secondary">
                    Pick up where you left off, or start something new.
                  </Text>
                </View>
                <Button
                  variant="primary"
                  block
                  onPress={() => router.push("/new-job")}
                  testID="new-job"
                >
                  Start a project
                </Button>
                {!jobs?.length && jobs !== undefined ? (
                  <View style={{ gap: space["space-2"] }}>
                    <Text variant="label-12" color="text-secondary">
                      Try a starting point
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["space-2"] }}>
                      {exampleGoals.map((goal) => (
                        <Button
                          key={goal}
                          variant="secondary"
                          size="md"
                          onPress={() => router.push({ pathname: "/new-job", params: { goal } })}
                        >
                          {goal}
                        </Button>
                      ))}
                    </View>
                  </View>
                ) : null}
                <View style={{ gap: space["space-3"] }} testID="dashboard-actions">
                  <Text variant="heading-18">Actions</Text>
                  {actionsLoading ? (
                    <ProgressState label="Finding your next steps" testID="actions-loading" />
                  ) : actions.length ? (
                    actions.map((action) => (
                      <HomeActionRow
                        key={action.job.id}
                        action={action}
                        onPress={() => openAction(action)}
                      />
                    ))
                  ) : (
                    <Notice icon="check" testID="actions-empty">
                      {activeJobs.length
                        ? "Open a project below to see its next step."
                        : "Your next step will show up here when you start a project."}
                    </Notice>
                  )}
                </View>
                <Text variant="heading-18">Your projects</Text>
                {activeJobs.length ? (
                  <Text variant="label-14" color="text-secondary">
                    In progress
                  </Text>
                ) : null}
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          jobs === undefined || error || !otherJobs.length ? undefined : (
            <Text variant="copy-13" color="text-secondary">
              You don’t have a project in progress.
            </Text>
          )
        }
        ListFooterComponent={
          <View style={{ gap: space["space-3"], marginTop: space["space-4"] }}>
            {otherJobs.some((job) => job.status === "completed") ? (
              <Text variant="label-14" color="text-secondary">
                Finished
              </Text>
            ) : null}
            {otherJobs
              .filter((job) => job.status === "completed")
              .map((job) => (
                <ProjectRow key={job.id} job={job} onPress={() => openJob(job.id)} />
              ))}
            {otherJobs.some((job) => job.status === "stopped") ? (
              <Text variant="label-14" color="text-secondary">
                Paused
              </Text>
            ) : null}
            {otherJobs
              .filter((job) => job.status === "stopped")
              .map((job) => (
                <ProjectRow key={job.id} job={job} onPress={() => openJob(job.id)} />
              ))}
          </View>
        }
        renderItem={({ item }) => <ProjectRow job={item} onPress={() => openJob(item.id)} />}
      />
    </SafeAreaView>
  );
}

function HomeActionRow({ action, onPress }: { action: HomeAction; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${action.title} for ${action.job.title}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space["space-3"],
        padding: space["space-4"],
        borderRadius: radius["radius-lg"],
        backgroundColor: pressed ? t.color["gray-100"] : t.color["background-100"],
        borderWidth: 1,
        borderColor: t.color.border,
      })}
    >
      <View style={{ flex: 1, gap: space["space-1"] }}>
        <Text variant="label-13" color="text-secondary" numberOfLines={1}>
          {action.job.title}
        </Text>
        <Text variant="label-14">{action.title}</Text>
        <Text variant="copy-13" color="text-secondary">
          {action.detail}
        </Text>
      </View>
      <Icon name="arrowRight" color="text-secondary" />
    </Pressable>
  );
}

function ProjectRow({ job, onPress }: { job: Job; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${statusLabel[job.status]}`}
      style={({ pressed }) => ({
        padding: space["space-3"],
        borderRadius: radius["radius-md"],
        backgroundColor: pressed ? t.color["gray-100"] : t.color["background-100"],
        borderWidth: 1,
        borderColor: t.color.border,
        gap: space["space-1"],
      })}
    >
      <Text variant="label-14" numberOfLines={2}>
        {job.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-2"] }}>
        <Icon
          name={
            job.status === "completed" ? "check" : job.status === "stopped" ? "stop" : "progress"
          }
          color="text-secondary"
        />
        <Text variant="copy-13" color="text-secondary">
          {statusLabel[job.status]} · updated {formatDateTime(job.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}
