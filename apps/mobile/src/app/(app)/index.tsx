import type { Job } from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import { Button, Icon, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Animated, Easing, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeActionRow, OverviewTile, ProjectRow } from "@/components/home-rows";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { api } from "@/lib/api";
import { loadHomeActions, type HomeAction } from "@/lib/home";

const MAX_VISIBLE = 3;

export default function Jobs() {
  const t = useTheme();
  const [jobs, setJobs] = useState<Job[]>();
  const [actions, setActions] = useState<HomeAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const menuProgress = useRef(new Animated.Value(0)).current;

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

  const closeMenu = () => {
    setMenuOpen(false);
    Animated.timing(menuProgress, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMenuMounted(false);
    });
  };

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
      return;
    }
    menuProgress.setValue(0);
    setMenuMounted(true);
    setMenuOpen(true);
    requestAnimationFrame(() =>
      Animated.timing(menuProgress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(),
    );
  };

  const menuItems = [
    { label: "Start a project", icon: "plus", href: "/new-job", testID: "new-job" },
    { label: "Actions", icon: "actions", href: "/actions", testID: "menu-actions" },
    { label: "Projects", icon: "projects", href: "/projects", testID: "menu-projects" },
    { label: "Settings", icon: "gear", href: "/settings", testID: "menu-settings" },
  ] as const;

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <View style={{ gap: space["space-1"] }}>
            <Text variant="heading-18">Tandrix</Text>
            <Text variant="copy-12" color="text-secondary">
              Your workspace
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? "Close menu" : "Open menu"}
            accessibilityState={{ expanded: menuOpen }}
            testID="dashboard-menu"
            onPress={toggleMenu}
            style={({ pressed }) => ({
              minWidth: 92,
              height: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: space["space-2"],
              paddingHorizontal: space["space-3"],
              borderRadius: radius["radius-full"],
              backgroundColor: pressed ? t.color["gray-300"] : t.color["gray-100"],
              borderWidth: 1,
              borderColor: t.color["gray-300"],
            })}
          >
            <HamburgerMark color={t.color.text} />
            <Text variant="label-14">Menu</Text>
          </Pressable>
          {menuMounted ? (
            <Animated.View
              testID="dashboard-menu-items"
              pointerEvents={menuOpen ? "auto" : "none"}
              style={{
                position: "absolute",
                zIndex: 20,
                top: 50,
                right: 0,
                width: 256,
                padding: space["space-2"],
                gap: space["space-1"],
                borderRadius: radius["radius-lg"],
                backgroundColor: t.color["background-100"],
                borderWidth: 1,
                borderColor: t.color["gray-400"],
                opacity: menuProgress,
                transform: [
                  {
                    translateY: menuProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-5, 0],
                    }),
                  },
                  {
                    scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }),
                  },
                ],
              }}
            >
              {menuItems.map((item, index) => {
                const primary = index === 0;
                return (
                  <Pressable
                    key={item.href}
                    accessibilityRole="button"
                    testID={item.testID}
                    onPress={() => {
                      closeMenu();
                      router.push(item.href);
                    }}
                    style={({ pressed }) => ({
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space["space-3"],
                      marginTop: index === 1 ? space["space-1"] : 0,
                      paddingHorizontal: space["space-3"],
                      borderRadius: primary ? radius["radius-full"] : radius["radius-md"],
                      backgroundColor: primary
                        ? pressed
                          ? t.color["gray-100"]
                          : t.color["surface-paper"]
                        : pressed
                          ? t.color["gray-200"]
                          : "transparent",
                      borderTopWidth: index === 1 ? 1 : 0,
                      borderColor: t.color["gray-300"],
                    })}
                  >
                    <Icon
                      name={item.icon}
                      color={primary ? "ink-on-paper" : "text-secondary"}
                      size={20}
                    />
                    <Text variant="label-14" color={primary ? "ink-on-paper" : "text"}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : null}
        </View>

        <View style={{ gap: space["space-4"] }}>
          <Text variant="heading-24">Pick up where you left off.</Text>
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

function HamburgerMark({ color }: { color: string }) {
  return (
    <View accessible={false} style={{ width: 18, gap: 4 }}>
      <View style={{ width: 18, height: 1.5, borderRadius: 1, backgroundColor: color }} />
      <View
        style={{
          width: 12,
          height: 1.5,
          alignSelf: "flex-end",
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
      <View style={{ width: 18, height: 1.5, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}
