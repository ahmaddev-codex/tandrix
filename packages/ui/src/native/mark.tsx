// The Tandrix mark on the phone: the pointer on a dark tile, ringed with the blue border Tandrix
// wears while it's active. Same drawing as the web mark (packages/ui/src/web/wordmark.tsx).
import { useId } from "react";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "./theme";

const POINTER =
  "M4.9 3.3C3.7 2.8 2.8 3.7 3.3 4.9L9.1 19.3C9.6 20.6 11.5 20.5 11.9 19.1L13.2 15.1C13.5 14.1 14.1 13.5 15.1 13.2L19.1 11.9C20.5 11.5 20.6 9.6 19.3 9.1L4.9 3.3Z";

export function BrandMark({ size = 28 }: { size?: number }) {
  const t = useTheme();
  const id = useId().replace(/:/g, "");
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id={id} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={t.color.highlight} />
          <Stop offset="0.5" stopColor={t.color["blue-100"]} />
          <Stop offset="1" stopColor={t.color.highlight} />
        </LinearGradient>
      </Defs>
      <Rect
        x="1.75"
        y="1.75"
        width="28.5"
        height="28.5"
        rx="9"
        fill={t.color["surface-ink"]}
        stroke={`url(#${id})`}
        strokeWidth="2.5"
      />
      <Path
        d={POINTER}
        transform="translate(6.4 6.4) scale(0.82)"
        fill={t.color["ink-on-surface"]}
      />
    </Svg>
  );
}
