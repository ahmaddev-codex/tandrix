// Find the job's manual: search results first, and always the option to upload a PDF or
// photograph the pages, so a failed search never blocks the job.
import type { ManualSearchResponse } from "@tandrix/contracts";
import { radius, space } from "@tandrix/ui";
import { Button, Icon, SourceChip, Text, useTheme } from "@tandrix/ui/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
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
  const t = useTheme();
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
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space["space-3"] }}
      >
        <Stack.Screen options={{ title: "Manual" }} />
        <ActivityIndicator color={t.color["text-secondary"]} />
        <Text variant="field-body" color="text-secondary">
          {busy}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space["space-6"], gap: space["space-4"] }}>
      <Stack.Screen options={{ title: "Manual" }} />
      {!search ? (
        <View
          testID="manual-searching"
          style={{ flexDirection: "row", gap: space["space-3"], alignItems: "center" }}
        >
          <ActivityIndicator color={t.color["text-secondary"]} />
          <Text variant="field-body" color="text-secondary">
            {equipment ? `Searching for the ${equipment} manual` : "Searching for the manual"}
          </Text>
        </View>
      ) : search.status === "unavailable" ? (
        <View
          testID="manual-search-unavailable"
          style={{
            flexDirection: "row",
            gap: space["space-2"],
            alignItems: "flex-start",
            padding: space["space-4"],
            borderRadius: radius["radius-lg"],
            backgroundColor: t.color["gray-100"],
          }}
        >
          <Icon name="book" size={20} />
          <View style={{ flex: 1 }}>
            <Text variant="copy-16">{search.message}</Text>
          </View>
        </View>
      ) : search.status === "found" && search.candidates.length === 0 ? (
        <View testID="manual-search-empty">
          <Text variant="field-body" color="text-secondary">
            No manual turned up online. Upload it, or photograph the pages.
          </Text>
        </View>
      ) : search.status === "found" ? (
        <View style={{ gap: space["space-3"] }}>
          <Text variant="label-16" color="text-secondary">
            Found online
          </Text>
          {search.candidates.map((c) => (
            <View
              key={c.url}
              testID="manual-candidate"
              style={{
                padding: space["space-4"],
                gap: space["space-3"],
                borderRadius: radius["radius-lg"],
                borderWidth: 1,
                borderColor: t.color.border,
                backgroundColor: t.color["background-100"],
              }}
            >
              <View style={{ gap: space["space-1"] }}>
                <Text variant="heading-16">{c.title}</Text>
                <Text variant="copy-14" color="text-secondary">
                  {documentLabel[c.documentType]}
                  {c.official
                    ? ", from the manufacturer"
                    : c.publisher
                      ? `, from ${c.publisher}`
                      : ""}
                </Text>
              </View>
              <SourceChip kind="manual">{host(c.url)}</SourceChip>
              <Button variant="primary" block onPress={() => attachCandidate(c)}>
                Use this manual
              </Button>
            </View>
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
        <View testID="manual-error">
          <Text variant="copy-16" color="red-900">
            {error}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
