import type { Job } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { Button, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PaginationControls } from "@/components/pagination-controls";
import { ProjectRow } from "@/components/home-rows";
import { api } from "@/lib/api";

const PAGE_SIZE = 20;

export default function Projects() {
  const t = useTheme();
  const [jobs, setJobs] = useState<Job[]>();
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs(await api.listAllJobs());
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const all = jobs ?? [];
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
          <Text variant="heading-24">Projects</Text>
          <Text variant="copy-14" color="text-secondary">
            Keep your plans and progress together.
          </Text>
        </View>
        {jobs === undefined && !error ? (
          <ProgressState label="Loading your projects" />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : all.length ? (
          <>
            {current.map((job) => (
              <ProjectRow
                key={job.id}
                job={job}
                onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
              />
            ))}
            <PaginationControls page={page} pageCount={pageCount} onChange={setPage} />
          </>
        ) : (
          <Notice icon="projects">Your projects will appear here when you start one.</Notice>
        )}
        <Button variant="primary" block onPress={() => router.push("/new-job")}>
          Start a project
        </Button>
      </ScrollView>
      <MobileBottomNav />
    </SafeAreaView>
  );
}
