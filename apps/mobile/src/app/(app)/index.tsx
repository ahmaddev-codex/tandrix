import { space } from "@tandrix/ui";
import { BrandMark, Button, Notice, ProgressState, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ImageBackground, View } from "react-native";
import { Page, Pill, Row, SectionTitle, Tray } from "@/components/kit";
import { HomeActionRow, OverviewTile, ProjectRow } from "@/components/home-rows";

import sky from "../../../assets/sky.jpg";
import type { HomeAction } from "@/lib/home";
import { useJobs } from "@/lib/jobs-store";

const MAX_VISIBLE = 3;

export default function Jobs() {
  const t = useTheme();
  const { jobs, actions: held, error, refresh: load } = useJobs();
  const [refreshing, setRefreshing] = useState(false);
  // Held actions stay on screen while changed projects are looked at again.
  const actionsLoading = jobs !== undefined && held === undefined;
  const actions = held ?? [];

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
      {/* The sky header, as on the website: the mark, a big line, and the way in. */}
      <ImageBackground
        source={sky}
        resizeMode="cover"
        imageStyle={{ borderRadius: 28 }}
        style={{
          gap: space["space-6"],
          padding: space["space-5"],
          paddingBottom: space["space-6"],
          borderRadius: 28,
          backgroundColor: t.color.highlight,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space["space-2"] }}>
          <BrandMark size={30} />
          <Text variant="heading-18" color="on-blue">
            Tandrix
          </Text>
        </View>
        <View style={{ gap: space["space-4"], alignItems: "flex-start" }}>
          <Text
            variant="heading-32"
            color="on-blue"
            style={{ fontSize: 36, lineHeight: 39, letterSpacing: -1.6 }}
          >
            Pick up where you left off.
          </Text>
          <Pill tone="white" icon="plus" onPress={() => router.push("/new-job")} testID="new-job">
            Start a project
          </Pill>
        </View>
      </ImageBackground>

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
            <SectionTitle title="To do next" action={<SeeAll href="/actions" />} />
            {actionsLoading ? (
              <ProgressState label="Finding your next steps" testID="actions-loading" />
            ) : actions.length ? (
              <Tray>
                {actions.slice(0, MAX_VISIBLE).map((action, index) => (
                  <HomeActionRow
                    key={action.job.id}
                    action={action}
                    onPress={() => openAction(action)}
                    featured={index === 0}
                  />
                ))}
              </Tray>
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
            <SectionTitle title="Projects" action={<SeeAll href="/projects" />} />
            {jobs?.length ? (
              <Tray>
                {jobs.slice(0, 2).map((job) => (
                  <ProjectRow
                    key={job.id}
                    job={job}
                    onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
                  />
                ))}
              </Tray>
            ) : (
              <Tray>
                <Row
                  icon="plus"
                  title="Start with one thing you want to get done"
                  detail="A goal is enough; Tandrix works out the steps."
                  onPress={() => router.push("/new-job")}
                />
              </Tray>
            )}
          </View>
        </>
      )}
    </Page>
  );
}

/** "See all", quiet, beside a section title. */
function SeeAll({ href }: { href: "/actions" | "/projects" }) {
  return (
    <Button variant="tertiary" size="md" onPress={() => router.navigate(href)}>
      See all
    </Button>
  );
}
