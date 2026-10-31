import { space } from "@tandrix/ui";
import { Button, Notice, ProgressState } from "@tandrix/ui/native";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Page, PageTitle, Pill, Tray } from "@/components/kit";
import { PaginationControls } from "@/components/pagination-controls";
import { ProjectRow } from "@/components/home-rows";
import { useJobs } from "@/lib/jobs-store";

const PAGE_SIZE = 20;

export default function Projects() {
  const { jobs, error, refresh: load } = useJobs();
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const all = jobs ?? [];
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
        title="Projects"
        soft="in one place."
        lead="Your plans and how far each one has got."
      />
      {error && jobs !== undefined ? (
        // Couldn't refresh: what's held stays on screen.
        <Notice
          tone="attention"
          testID="refresh-failed"
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
        <ProgressState label="Loading your projects" />
      ) : error && jobs === undefined ? (
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
      ) : all.length ? (
        <View style={{ gap: space["space-3"] }}>
          <Tray>
            {current.map((job) => (
              <ProjectRow
                key={job.id}
                job={job}
                onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
              />
            ))}
          </Tray>
          <PaginationControls page={page} pageCount={pageCount} onChange={setPage} />
        </View>
      ) : (
        <Notice icon="projects">Your projects will appear here when you start one.</Notice>
      )}
      <Pill block icon="plus" onPress={() => router.push("/new-job")}>
        Start a project
      </Pill>
    </Page>
  );
}
