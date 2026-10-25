// Local-only gallery of the native design-system components, in every theme (moved from T0.7).
import { radius, space, themeNames, type ThemeName } from "@tandrix/ui";
import {
  Button,
  Icon,
  ActionCard,
  CheckResult,
  HandoffBanner,
  HighlightCorrection,
  Input,
  Notice,
  PartHighlight,
  PartsList,
  ProgressState,
  SafetyGate,
  StepRow,
  SummaryCard,
  VoiceTranscript,
  SourceChip,
  StatusChip,
  StepCard,
  Text,
  ThemeProvider,
  useTheme,
} from "@tandrix/ui/native";
import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";

export default function Gallery() {
  const [theme, setTheme] = useState<ThemeName>("light");
  return (
    <ThemeProvider override={theme}>
      <Sheet theme={theme} onTheme={setTheme} />
    </ThemeProvider>
  );
}

function Sheet({ theme, onTheme }: { theme: ThemeName; onTheme: (t: ThemeName) => void }) {
  const t = useTheme();
  const [value, setValue] = useState("18");
  const section = (title: string, children: ReactNode) => (
    <View style={{ gap: space["space-3"] }}>
      <Text variant="label-14" color="text-secondary">
        {title}
      </Text>
      {children}
    </View>
  );
  return (
    <ScrollView
      style={{ backgroundColor: t.color["background-200"] }}
      contentContainerStyle={{ padding: space["space-4"], gap: space["space-8"] }}
    >
      <View style={{ flexDirection: "row", gap: space["space-2"] }}>
        {themeNames.map((n) => (
          <Button
            key={n}
            variant={n === theme ? "primary" : "secondary"}
            size="md"
            onPress={() => onTheme(n)}
          >
            {n}
          </Button>
        ))}
      </View>
      {section(
        "Type",
        <View style={{ gap: space["space-2"] }}>
          <Text variant="field-instruction">Fit the impeller onto the shaft</Text>
          <Text variant="field-body" color="text-secondary">
            Vanes face the inlet. Push until it seats against the shaft shoulder.
          </Text>
          <Text variant="mono-14">Part 96513247, 25 Nm</Text>
        </View>,
      )}
      {section(
        "Buttons",
        <View style={{ gap: space["space-2"] }}>
          <Button variant="primary" block>
            Check my work
          </Button>
          <Button variant="secondary" block icon="retake">
            Retake
          </Button>
          <Button variant="mandatory" block>
            Confirm isolated
          </Button>
          <Button variant="danger" block>
            Delete job
          </Button>
          <Button variant="secondary" disabled block>
            Syncing
          </Button>
          <Button variant="secondary" icon="mic" iconOnly accessibilityLabel="Hold to talk" />
        </View>,
      )}
      {section(
        "Statuses",
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["space-2"] }}>
          {(
            [
              "verified",
              "confirmed",
              "attention",
              "unverifiable",
              "blocked",
              "pending",
              "progress",
            ] as const
          ).map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </View>,
      )}
      {section(
        "Sources",
        <View style={{ gap: space["space-2"] }}>
          <SourceChip kind="manual">Manual p.14, fig. 3</SourceChip>
          <SourceChip kind="expert">Expert recording 02:31</SourceChip>
          <SourceChip kind="generic" />
        </View>,
      )}
      {section(
        "Step card",
        <StepCard
          index={3}
          total={9}
          title="Fit the impeller onto the shaft"
          body="Vanes face the inlet. Push until it seats against the shaft shoulder."
          caution="The impeller edges are sharp. Wear gloves."
          status="progress"
          source="Manual p.14, fig. 3"
          actions={
            <>
              <Button variant="primary" size="field" block>
                Check my work
              </Button>
              <Button
                variant="secondary"
                size="field"
                icon="mic"
                iconOnly
                accessibilityLabel="Hold to talk"
              />
            </>
          }
        />,
      )}
      {section(
        "Part highlight",
        <View style={{ height: 240 }}>
          <PartHighlight
            size={{ width: 400, height: 300 }}
            alt="Highlighted: impeller in the centre, seal at the top left, possible match"
            targets={[
              {
                id: "impeller",
                label: "Impeller",
                partNumber: "96513247",
                box: { x: 140, y: 120, w: 140, h: 120 },
                mask: {
                  path: "M12 0L28 0L40 12L40 28L28 40L12 40L0 28L0 12Z",
                  raster: { width: 40, height: 40 },
                },
              },
              { id: "seal", label: "Seal", possible: true, box: { x: 30, y: 70, w: 70, h: 60 } },
            ]}
          >
            <View style={{ flex: 1, backgroundColor: t.color["gray-700"] }} />
          </PartHighlight>
        </View>,
      )}
      {section(
        "Highlight correction",
        <HighlightCorrection
          label="Impeller"
          otherParts={[
            { id: "nut", name: "Impeller nut" },
            { id: "key", name: "Shaft key" },
          ]}
        />,
      )}
      {section(
        "Voice",
        <View style={{ gap: space["space-3"] }}>
          <VoiceTranscript
            state="listening"
            turns={[
              { speaker: "you", text: "Which way round does the impeller go?" },
              {
                speaker: "tandrix",
                text: "Vanes face the inlet. Push it on until it seats against the shaft shoulder.",
              },
            ]}
          />
          <VoiceTranscript
            state="working"
            turns={[
              { speaker: "you", text: "How do I wire the motor?" },
              {
                speaker: "tandrix",
                text: "Electrical wiring and live work need a qualified electrician. Tandrix will continue with the other steps.",
                kind: "refusal",
              },
              {
                speaker: "tandrix",
                text: "A thin film of clean grease on the shaft is common practice. Check the manual first.",
                kind: "general",
              },
            ]}
          />
        </View>,
      )}
      {section(
        "Notices",
        <View style={{ gap: space["space-2"] }}>
          <Notice>
            Tandrix can't search for the manual right now. Upload it, or photograph the pages.
          </Notice>
          <Notice tone="info">Read from the nameplate. Check the details, then save.</Notice>
          <Notice tone="attention">Possible match. Check these against the nameplate.</Notice>
          <Notice tone="error">
            The photo didn't upload. Check your connection and try again.
          </Notice>
        </View>,
      )}
      {section(
        "Action and summary cards",
        <View style={{ gap: space["space-3"] }}>
          <ActionCard
            icon="book"
            title="Add the manual"
            body="Tandrix builds the steps from the manufacturer's manual, so every step cites a page."
            actionLabel="Find the manual"
            secondaryLabel="Use general steps instead"
          />
          <SummaryCard
            label="Equipment"
            title="FlowSet CR 3-10"
            facts={[{ text: "Serial 4521-0098", mono: true }]}
          />
          <SummaryCard
            label="Manual"
            title="CR 3-10 installation and operating instructions"
            facts={[{ text: "48 pages" }]}
            source="flowset.example"
            action={
              <Button variant="secondary" size="lg" block icon="book">
                Open manual
              </Button>
            }
          />
        </View>,
      )}
      {section(
        "Step rows",
        <View style={{ gap: space["space-2"] }}>
          <StepRow
            index={1}
            title="Isolate and drain the pump"
            status="verified"
            source="Manual p.2"
          />
          <StepRow
            index={2}
            title="Fit the mechanical seal"
            status="progress"
            source="Manual p.3, fig. 2"
          />
          <StepRow index={3} title="Fit the impeller" status="pending" statusLabel="To do" />
        </View>,
      )}
      {section(
        "Progress",
        <View style={{ gap: space["space-3"] }}>
          <ProgressState label="Reading the manual" />
          <ProgressState
            label="Writing the steps"
            failed="Tandrix can't write the steps right now. Try again in a minute."
            backLabel="Back to the job"
          />
        </View>,
      )}
      {section(
        "Safety gates",
        <View style={{ gap: space["space-3"] }}>
          <SafetyGate
            title="Isolate the pump"
            body="Switch off and lock out the supply at the panel, then release line pressure."
            actionLabel="Confirm isolated"
          />
          <SafetyGate
            title="Isolate the pump"
            body="Switch off and lock out the supply at the panel, then release line pressure."
            confirmed
            confirmedLabel="Confirmed at 10:42"
          />
          <SafetyGate
            tone="stop"
            title="Tandrix won't guide this step"
            body="Electrical wiring and live work need a qualified electrician. Tandrix will continue with the other steps."
          />
        </View>,
      )}
      {section(
        "Check results",
        <View style={{ gap: space["space-3"] }}>
          <CheckResult
            result="pass"
            reason="The impeller is seated against the shaft shoulder."
            evidence="Photo 10:42"
          />
          <CheckResult
            result="fail"
            reason="The vanes face away from the inlet. Turn the impeller round and refit it."
            actions={
              <Button variant="secondary" size="lg">
                Check again
              </Button>
            }
          />
          <CheckResult
            result="not_verifiable"
            reason="Tandrix can't check torque from a photo. Confirm you tightened to 25 Nm."
          />
        </View>,
      )}
      {section(
        "Parts list",
        <PartsList
          parts={[
            { part: "96-01", name: "Impeller", qty: 1, status: "found" },
            {
              part: "96-07",
              name: "Mechanical seal",
              qty: 1,
              status: "possible",
              note: "Check the spring",
            },
            { part: "96-12", name: "Casing bolt", qty: 8, status: "missing" },
          ]}
        />,
      )}
      {section(
        "Handoff",
        <View style={{ gap: space["space-3"] }}>
          <HandoffBanner state="offer" step={9} stepTitle="Set the motor speed in the drive app" />
          <HandoffBanner state="waiting" step={9} device="Studio Mac" />
        </View>,
      )}
      {section(
        "Inputs",
        <View style={{ gap: space["space-4"] }}>
          <Input
            label="Model number"
            value="CR 3-10 A-A-A-E"
            onChangeText={() => {}}
            mono
            hint="Read from the nameplate."
          />
          <Input
            label="Torque applied"
            value={value}
            onChangeText={setValue}
            mono
            suffix="Nm"
            keyboardType="decimal-pad"
            error={value === "25" ? undefined : "The manual specifies 25 Nm for these bolts."}
          />
        </View>,
      )}
      {section(
        "Icons",
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space["space-4"],
            padding: space["space-4"],
            borderRadius: radius["radius-lg"],
            backgroundColor: t.color["background-100"],
          }}
        >
          {(
            [
              "check",
              "user",
              "alert",
              "info",
              "eyeOff",
              "stop",
              "camera",
              "mic",
              "glasses",
              "laptop",
              "phone",
              "hand",
              "pointer",
            ] as const
          ).map((n) => (
            <Icon key={n} name={n} size={24} label={n} />
          ))}
        </View>,
      )}
    </ScrollView>
  );
}
