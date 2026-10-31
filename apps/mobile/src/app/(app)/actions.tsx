import { space } from "@tandrix/ui";
import { Notice, ProgressState } from "@tandrix/ui/native";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Page, PageTitle, Pill, Tray } from "@/components/kit";
import { HomeActionRow } from "@/components/home-rows";
import { PaginationControls } from "@/components/pagination-controls";
import type { HomeAction } from "@/lib/home";
import { useJobs } from "@/lib/jobs-store";

const PAGE_SIZE = 20;

export default function Actions() {
  const { jobs, actions: held, error, refresh: load } = useJobs();
  const actions = held ?? [];
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
    <Page
      tabs
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <PageTitle
        title="Actions"
        soft="up next."
        lead="The next useful step in each of your projects."
      />
      {jobs === undefined && !error ? (
        <ProgressState label="Finding your next steps" />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : current.length ? (
        <View style={{ gap: space["space-3"] }}>
          <Tray>
            {current.map((action, index) => (
              <HomeActionRow
                key={action.job.id}
                action={action}
                onPress={() => openAction(action)}
                featured={page === 0 && index === 0}
              />
            ))}
          </Tray>
          <PaginationControls page={page} pageCount={pageCount} onChange={setPage} />
        </View>
      ) : (
        <Notice icon="sealCheck">No open actions. You’re all caught up.</Notice>
      )}
      {actions.length === 0 && jobs?.length === 0 ? (
        <Pill block icon="plus" onPress={() => router.push("/new-job")}>
          Start a project
        </Pill>
      ) : null}
    </Page>
  );
}
