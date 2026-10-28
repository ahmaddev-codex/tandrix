import type { Job } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { Button, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HomeActionRow } from "@/components/home-rows";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PaginationControls } from "@/components/pagination-controls";
import { api } from "@/lib/api";
import { loadHomeActions, type HomeAction } from "@/lib/home";

const PAGE_SIZE = 20;

export default function Actions() {
  const t = useTheme();
  const [jobs, setJobs] = useState<Job[]>();
  const [actions, setActions] = useState<HomeAction[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const allJobs = await api.listAllJobs();
      setJobs(allJobs);
      setActions(await loadHomeActions(allJobs));
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const pageCount = Math.max(1, Math.ceil(actions.length / PAGE_SIZE));
  const current = actions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
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
      >
        <View style={{ gap: space["space-2"] }}>
          <Text variant="heading-24">Actions</Text>
          <Text variant="copy-14" color="text-secondary">
            The next useful step across your projects.
          </Text>
        </View>
        {jobs === undefined && !error ? (
          <ProgressState label="Finding your next steps" />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : current.length ? (
          <>
            {current.map((action, index) => (
              <HomeActionRow
                key={action.job.id}
                action={action}
                onPress={() => openAction(action)}
                featured={page === 0 && index === 0}
              />
            ))}
            <PaginationControls page={page} pageCount={pageCount} onChange={setPage} />
          </>
        ) : (
          <Notice icon="check">No open actions. You’re all caught up.</Notice>
        )}
        {actions.length === 0 && jobs?.length === 0 ? (
          <Button variant="primary" block onPress={() => router.push("/new-job")}>
            Start a project
          </Button>
        ) : null}
      </ScrollView>
      <MobileBottomNav />
    </SafeAreaView>
  );
}
