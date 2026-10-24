// Local-only gallery of the native design-system components, in every theme (moved from T0.7).
import { radius, space, themeNames, type ThemeName } from "@tandrix/ui";
import {
  Button,
  Icon,
  Input,
  SourceChip,
  StatusChip,
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
