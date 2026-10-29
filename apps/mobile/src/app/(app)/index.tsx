import type { Job } from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import { BrandMark, Button, Icon, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ImageBackground, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeActionRow, OverviewTile, ProjectRow } from "@/components/home-rows";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { api } from "@/lib/api";
import sky from "../../../assets/sky.jpg";
import { loadHomeActions, type HomeAction } from "@/lib/home";

const MAX_VISIBLE = 3;

export default function Jobs() {
  const t = useTheme();
  const [jobs, setJobs] = useState<Job[]>();
  const [actions, setActions] = useState<HomeAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const allJobs = await api.listAllJobs();
      setJobs(allJobs);
      setActionsLoading(allJobs.some((job) => job.status === "active"));
      setActions(await loadHomeActions(allJobs));
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

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

  const activeCount = (jobs ?? []).filter((job) => job.status === "active").length;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.color["background-200"] }}
      edges={["top", "bottom"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-6"], flexGrow: 1 }}
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
      >
        {/* The sky header, as on the website: the mark, Tandrix's presence, and the way in. */}
        <ImageBackground
          source={sky}
          resizeMode="cover"
          imageStyle={{ borderRadius: radius["radius-lg"] * 2 }}
          style={{
            gap: space["space-5"],
            padding: space["space-4"],
            paddingBottom: space["space-6"],
            borderRadius: radius["radius-lg"] * 2,
            backgroundColor: t.color.highlight,
            zIndex: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-2"] }}>
              <BrandMark size={30} />
              <Text variant="heading-18" color="on-blue">
                Tandrix
              </Text>
            </View>
          </View>

          <View style={{ gap: space["space-3"], alignItems: "flex-start" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space["space-2"],
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: radius["radius-full"],
                backgroundColor: t.color["surface-ink"],
                borderWidth: 1.5,
                borderColor: t.color.highlight,
              }}
            >
              <View
                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.color.highlight }}
              />
              <Text variant="label-12" color="ink-on-surface">
                Tandrix is ready
              </Text>
            </View>
            <Text variant="heading-32" color="on-blue">
              Pick up where you left off.
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="new-job"
              onPress={() => router.push("/new-job")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space["space-3"],
                paddingLeft: space["space-5"],
                paddingRight: 4,
                height: 48,
                borderRadius: radius["radius-full"],
                backgroundColor: t.color["background-100"],
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text variant="button-15">Start a project</Text>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: t.color.highlight,
                }}
              >
                <Icon name="plus" size={20} color="on-blue" />
              </View>
            </Pressable>
          </View>
        </ImageBackground>

        <View style={{ gap: space["space-4"] }}>
          <View style={{ flexDirection: "row", gap: space["space-3"] }}>
            <OverviewTile
              title="Next actions"
              value={
                jobs === undefined || actionsLoading ? "—" : String(actions.length).padStart(2, "0")
              }
              detail={
                actions.length
                  ? "Ready across your projects"
                  : jobs === undefined || actionsLoading
                    ? "Loading your next steps"
                    : jobs.length
                      ? "No open actions right now"
                      : "Your next step will show here"
              }
              icon="actions"
              tone="light"
              onPress={() => router.navigate("/actions")}
            />
            <OverviewTile
              title="Projects"
              value={jobs ? String(jobs.length).padStart(2, "0") : "—"}
              detail={jobs ? `${activeCount} in progress` : "Loading projects"}
              icon="projects"
              tone="dark"
              onPress={() => router.navigate("/projects")}
            />
          </View>
        </View>

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
            <View testID="dashboard-actions" style={{ gap: space["space-3"] }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text variant="heading-18" style={{ flex: 1 }}>
                  To do next
                </Text>
                <Button variant="tertiary" size="md" onPress={() => router.navigate("/actions")}>
                  See all
                </Button>
              </View>
              {actionsLoading ? (
                <ProgressState label="Finding your next steps" testID="actions-loading" />
              ) : actions.length ? (
                actions
                  .slice(0, MAX_VISIBLE)
                  .map((action, index) => (
                    <HomeActionRow
                      key={action.job.id}
                      action={action}
                      onPress={() => openAction(action)}
                      featured={index === 0}
                    />
                  ))
              ) : (
                <Notice icon="check" testID="actions-empty">
                  {(jobs ?? []).some((job) => job.status === "active")
                    ? "Open a project below to see its next step."
                    : jobs?.length
                      ? "No open actions. Start a project whenever you’re ready to work on something new."
                      : "Your next step will show up here when you start a project."}
                </Notice>
              )}
            </View>

            <View testID="dashboard-projects" style={{ gap: space["space-3"] }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text variant="heading-18" style={{ flex: 1 }}>
                  Projects
                </Text>
                <Button variant="tertiary" size="md" onPress={() => router.navigate("/projects")}>
                  See all
                </Button>
              </View>
              {jobs?.length ? (
                jobs
                  .slice(0, 2)
                  .map((job) => (
                    <ProjectRow
                      key={job.id}
                      job={job}
                      onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
                    />
                  ))
              ) : (
                <View
                  style={{
                    padding: space["space-4"],
                    gap: space["space-3"],
                    borderRadius: radius["radius-lg"],
                    backgroundColor: t.color["background-100"],
                  }}
                >
                  <Text variant="label-14">Start with one thing you want to get done.</Text>
                  <Button variant="secondary" size="md" onPress={() => router.push("/new-job")}>
                    Start a project
                  </Button>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <MobileBottomNav />
    </SafeAreaView>
  );
}
