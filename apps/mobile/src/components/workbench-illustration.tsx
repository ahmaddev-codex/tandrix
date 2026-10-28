import { useTheme } from "@tandrix/ui/native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

/** Small, theme-aware drawing of a piece of equipment beside its guided work list. */
export function WorkbenchIllustration() {
  const t = useTheme();

  return (
    <Svg
      width={104}
      height={82}
      viewBox="0 0 128 100"
      accessible={false}
      importantForAccessibility="no"
    >
      <Rect x="12" y="27" width="38" height="53" rx="8" fill={t.color["gray-100"]} />
      <Rect
        x="12"
        y="27"
        width="38"
        height="53"
        rx="8"
        fill="none"
        stroke={t.color.border}
        strokeWidth="1.5"
      />
      <Line x1="22" y1="36" x2="40" y2="36" stroke={t.color["gray-600"]} strokeWidth="2" />
      <Circle cx="31" cy="55" r="10" fill={t.color["background-100"]} />
      <Circle cx="31" cy="55" r="10" fill="none" stroke={t.color["blue-700"]} strokeWidth="2" />
      <Circle cx="31" cy="55" r="3" fill={t.color["blue-700"]} />
      <Line x1="22" y1="71" x2="40" y2="71" stroke={t.color.border} strokeWidth="2" />

      <Rect x="57" y="14" width="59" height="70" rx="8" fill={t.color["background-100"]} />
      <Rect
        x="57"
        y="14"
        width="59"
        height="70"
        rx="8"
        fill="none"
        stroke={t.color.border}
        strokeWidth="1.5"
      />
      <Line x1="68" y1="27" x2="103" y2="27" stroke={t.color.text} strokeWidth="2.5" />
      <Circle cx="72" cy="42" r="5" fill={t.color["blue-100"]} />
      <Path
        d="m69.5 42 1.7 1.7 3.4-3.5"
        fill="none"
        stroke={t.color["blue-900"]}
        strokeWidth="1.5"
      />
      <Line x1="82" y1="42" x2="105" y2="42" stroke={t.color["gray-600"]} strokeWidth="2" />
      <Circle cx="72" cy="57" r="5" fill={t.color["gray-100"]} />
      <Line x1="82" y1="57" x2="105" y2="57" stroke={t.color.border} strokeWidth="2" />
      <Circle cx="72" cy="71" r="5" fill={t.color["gray-100"]} />
      <Line x1="82" y1="71" x2="98" y2="71" stroke={t.color.border} strokeWidth="2" />
    </Svg>
  );
}
