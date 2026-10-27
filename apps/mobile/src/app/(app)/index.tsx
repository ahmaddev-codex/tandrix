import type { Job } from "@tandrix/contracts";
import { radius, space, formatDateTime } from "@tandrix/ui";
import { Button, Icon, ProgressState, Text, useTheme, Notice } from "@tandrix/ui/native";
import { Link, router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { exampleGoals } from "@/lib/goals";
import { useAuth } from "@/lib/auth";

const statusLabel: Record<Job["status"], string> = {
  active: "In progress",
  completed: "Completed",
  stopped: "Paused",
};

const when = formatDateTime;

export default function Jobs() {
  const t = useTheme();
  const { signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const recentFirst = (a: Job, b: Job) => b.updatedAt.localeCompare(a.updatedAt);
  const activeJobs = (jobs ?? []).filter((job) => job.status === "active").sort(recentFirst);
  const otherJobs = (jobs ?? []).filter((job) => job.status !== "active").sort(recentFirst);
  const featured = activeJobs[0];

  const load = useCallback(async () => {
    try {
      setJobs(await api.listJobs());
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Reload whenever the list comes back into view, e.g. after creating a job.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
        data={featured ? activeJobs.slice(1) : []}
        keyExtractor={(j) => j.id}
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
                {featured ? (
                  <View style={{ gap: space["space-3"] }}>
                    <View style={{ gap: space["space-1"] }}>
                      <Text variant="label-14" color="text-secondary">
                        Pick up where you left off
                      </Text>
                      <Text variant="heading-24">{featured.title}</Text>
                      <Text variant="copy-13" color="text-secondary">
                        Updated {when(featured.updatedAt)}
                      </Text>
                    </View>
                    <Button
                      variant="primary"
                      block
                      icon="progress"
                      onPress={() =>
                        router.push({ pathname: "/job/[id]", params: { id: featured.id } })
                      }
                      testID="continue-project"
                    >
                      Continue project
                    </Button>
                  </View>
                ) : null}
                <View style={{ gap: space["space-3"] }}>
                  <View style={{ gap: space["space-2"] }}>
                    <Text variant="heading-24">
                      {featured
                        ? "What else are you working on?"
                        : "What are you building or fixing?"}
                    </Text>
                    <Text variant="field-body" color="text-secondary">
                      {featured
                        ? "Start another project whenever you’re ready."
                        : "Tell Tandrix what you want to do. A photo or manual can help, but you can add those later."}
                    </Text>
                  </View>
                  <Button
                    variant="primary"
                    block
                    onPress={() => router.push("/new-job")}
                    testID="new-job"
                  >
                    {featured ? "Start another project" : "Start a project"}
                  </Button>
                  {!jobs?.length && jobs !== undefined ? (
                    <View style={{ gap: space["space-2"] }}>
                      <Text variant="label-12" color="text-tertiary">
                        Or try an example
                      </Text>
                      <View
                        style={{ flexDirection: "row", flexWrap: "wrap", gap: space["space-2"] }}
                      >
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
                </View>
                {activeJobs.length > 1 ? (
                  <Text variant="label-14" color="text-secondary">
                    Also in progress
                  </Text>
                ) : null}
              </>
            )}
          </View>
        }
        ListFooterComponent={
          <View
            style={{ gap: space["space-3"], marginTop: otherJobs.length ? space["space-4"] : 0 }}
          >
            {otherJobs.some((job) => job.status === "completed") ? (
              <Text variant="label-14" color="text-secondary">
                Finished
              </Text>
            ) : null}
            {otherJobs
              .filter((job) => job.status === "completed")
              .map((job) => (
                <ProjectRow
                  key={job.id}
                  job={job}
                  onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
                />
              ))}
            {otherJobs.some((job) => job.status === "stopped") ? (
              <Text variant="label-14" color="text-secondary">
                Paused
              </Text>
            ) : null}
            {otherJobs
              .filter((job) => job.status === "stopped")
              .map((job) => (
                <ProjectRow
                  key={job.id}
                  job={job}
                  onPress={() => router.push({ pathname: "/job/[id]", params: { id: job.id } })}
                />
              ))}
          </View>
        }
        renderItem={({ item }) => (
          <ProjectRow
            job={item}
            onPress={() => router.push({ pathname: "/job/[id]", params: { id: item.id } })}
          />
        )}
      />
    </SafeAreaView>
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
          {statusLabel[job.status]} · updated {when(job.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}
