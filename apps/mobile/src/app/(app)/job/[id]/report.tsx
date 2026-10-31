import type { JobReportResponse, ShareLink } from "@tandrix/contracts";
import { citationSource, formatDateTime, space, stepChip } from "@tandrix/ui";
import { Button, Notice, StepRow, SummaryCard, Text, useTheme } from "@tandrix/ui/native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { env } from "@/lib/env";

/** The web page a share token opens. */
const linkUrl = (token: string) => `${env.webUrl}/r/${token}`;

const isLive = (l: ShareLink) => !l.revokedAt && Date.parse(l.expiresAt) > Date.now();

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [report, setReport] = useState<JobReportResponse>();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([api.getReport(id), api.listShares(id)]);
      setReport(r);
      setLinks(l);
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

  const create = async () => {
    setCreating(true);
    try {
      // The token is shown once: offer it straight to the share sheet.
      const { token } = await api.createShare(id);
      setLinks(await api.listShares(id));
      await Share.share({ message: linkUrl(token) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (linkId: string) => {
    setRevoking(linkId);
    try {
      await api.revokeShare(id, linkId);
      setLinks(await api.listShares(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevoking(undefined);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Report" }} />
      <ScrollView
        contentContainerStyle={{ padding: space["space-4"], gap: space["space-3"] }}
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
        {error ? (
          <Notice tone="error" testID="report-error">
            {error}
          </Notice>
        ) : null}
        {report ? (
          <SummaryCard
            testID="report-counts"
            label="Progress"
            title={report.job.title}
            facts={[
              {
                text: [
                  `${report.counts.verified} verified`,
                  `${report.counts.confirmed} confirmed`,
                  `${report.counts.attention} need attention`,
                  `${report.counts.unresolved} unresolved`,
                ].join(" · "),
              },
              ...(report.equipment ? [{ text: report.equipment }] : []),
              ...(report.manual ? [{ text: report.manual }] : []),
            ]}
          />
        ) : null}
        {report ? (
          <View testID="report-steps" style={{ gap: space["space-2"] }}>
            <Text variant="label-14" color="text-secondary">
              {report.steps.length} {report.steps.length === 1 ? "step" : "steps"}
            </Text>
            {report.steps.map((step) => {
              const chip = stepChip[step.status];
              const cite = citationSource(step.citation);
              return (
                <StepRow
                  key={`${step.index}-${step.title}`}
                  testID="report-step-row"
                  index={step.index}
                  title={step.title}
                  status={chip.status}
                  {...(chip.label ? { statusLabel: chip.label } : {})}
                  {...(cite ?? {})}
                  disabled
                />
              );
            })}
          </View>
        ) : null}
        <View testID="share-links" style={{ gap: space["space-2"] }}>
          <Text variant="label-14" color="text-secondary">
            Share links
          </Text>
          {links.map((l) => (
            <SummaryCard
              key={l.id}
              testID="share-link"
              label={
                isLive(l)
                  ? `Live until ${formatDateTime(l.expiresAt)}`
                  : l.revokedAt
                    ? "Turned off"
                    : "Expired"
              }
              title={`Created ${formatDateTime(l.createdAt)}`}
              {...(isLive(l)
                ? {
                    action: (
                      <Button
                        variant="secondary"
                        size="lg"
                        block
                        disabled={revoking === l.id}
                        onPress={() => revoke(l.id)}
                        testID="revoke-link"
                      >
                        Turn off
                      </Button>
                    ),
                  }
                : {})}
            />
          ))}
          <Button
            variant="secondary"
            size="lg"
            block
            disabled={creating}
            onPress={create}
            testID="new-link"
          >
            New 7-day link
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
