// Find the job's manual: search results first, and always the option to upload a PDF or
// photograph the pages, so a failed search never blocks the job.
import type { ManualSearchResponse } from "@tandrix/contracts";
import { space } from "@tandrix/ui";
import { Button, Notice, ProgressState, SummaryCard, Text } from "@tandrix/ui/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { api } from "@/lib/api";
import { pickPdf, titleFromFileName, uploadManualPdf } from "@/lib/manual";

type Candidate = Extract<ManualSearchResponse, { status: "found" }>["candidates"][number];

const documentLabel: Record<Candidate["documentType"], string> = {
  installation_manual: "Installation manual",
  service_manual: "Service manual",
  datasheet: "Datasheet",
  other: "Document",
};

const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export default function ManualScreen() {
  const { id, equipment } = useLocalSearchParams<{ id: string; equipment?: string }>();
  const [search, setSearch] = useState<ManualSearchResponse>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    api
      .searchManual(id)
      .then((r) => {
        if (!live) return;
        // Already on file for this model: nothing to choose.
        if (r.status === "cached") router.back();
        else setSearch(r);
      })
      .catch((e: Error) => live && setSearch({ status: "unavailable", message: e.message }));
    return () => {
      live = false;
    };
  }, [id]);

  const attempt = async (label: string, work: () => Promise<unknown>) => {
    setBusy(label);
    setError(undefined);
    try {
      await work();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(undefined);
    }
  };

  const attachCandidate = (c: Candidate) =>
    attempt(`Downloading from ${host(c.url)}`, () =>
      api.fetchManual(id, { url: c.url, title: c.title, token: c.token }),
    );

  const upload = async () => {
    setError(undefined);
    const pdf = await pickPdf();
    if (!pdf) return;
    await attempt("Uploading the manual", () =>
      uploadManualPdf(id, pdf, titleFromFileName(pdf.name)),
    );
  };

  if (busy) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: space["space-6"] }}>
        <Stack.Screen options={{ title: "Manual" }} />
        <ProgressState label={busy} testID="manual-busy" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space["space-6"], gap: space["space-4"] }}>
      <Stack.Screen options={{ title: "Manual" }} />
      {!search ? (
        <ProgressState
          testID="manual-searching"
          label={equipment ? `Searching for the ${equipment} manual` : "Searching for the manual"}
        />
      ) : search.status === "unavailable" ? (
        <Notice icon="book" testID="manual-search-unavailable">
          {search.message}
        </Notice>
      ) : search.status === "found" && search.candidates.length === 0 ? (
        <Notice icon="book" testID="manual-search-empty">
          No manual turned up online. Upload it, or photograph the pages.
        </Notice>
      ) : search.status === "found" ? (
        <View style={{ gap: space["space-3"] }}>
          <Text variant="label-16" color="text-secondary">
            Found online
          </Text>
          {search.candidates.map((c) => (
            <SummaryCard
              key={c.url}
              testID="manual-candidate"
              label={documentLabel[c.documentType]}
              title={c.title}
              facts={
                c.official
                  ? [{ text: "From the manufacturer" }]
                  : c.publisher
                    ? [{ text: `From ${c.publisher}` }]
                    : []
              }
              source={host(c.url)}
              action={
                // Several results, so none is the screen's primary action.
                <Button variant="secondary" size="lg" block onPress={() => attachCandidate(c)}>
                  Use this manual
                </Button>
              }
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: space["space-3"], marginTop: space["space-2"] }}>
        <Text variant="label-16" color="text-secondary">
          {search?.status === "found" && search.candidates.length
            ? "Or add your own"
            : "Add it yourself"}
        </Text>
        <Button variant="secondary" block icon="file" onPress={upload} testID="upload-manual">
          Upload a PDF
        </Button>
        <Button
          variant="secondary"
          block
          icon="camera"
          onPress={() =>
            router.push({
              pathname: "/job/[id]/pages",
              params: { id, ...(equipment ? { equipment } : {}) },
            })
          }
          testID="photograph-pages"
        >
          Photograph the pages
        </Button>
        <Text variant="copy-14" color="text-secondary">
          Manuals you upload or photograph stay private to you.
        </Text>
      </View>

      {error ? (
        <Notice tone="error" testID="manual-error">
          {error}
        </Notice>
      ) : null}
    </ScrollView>
  );
}
