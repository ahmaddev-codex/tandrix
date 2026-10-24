# @tandrix/ui

Code form of the [Tandrix design system](https://claude.ai/artifact/JXT7ErJARYzNkiv8EQjpvp). Every Tandrix UI builds on this package; raw colour values anywhere else fail lint.

## Entry points

| Import                                           | For                              | Contents                                                                                                                                                                                     |
| ------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tandrix/ui`                                    | any TS                           | Typed tokens (`colors`, `space`, `radius`, `size`, `textStyles`, `shadows`), status and source meanings, `resolveTheme`, `contrastRatio`                                                     |
| `@tandrix/ui/tokens.css`                         | Mac renderer, web report         | CSS custom properties per theme (`data-theme="light" \| "dark" \| "sunlight"`) and type-style classes                                                                                        |
| `@tandrix/ui/web` + `@tandrix/ui/web/styles.css` | Mac renderer, web report         | Icon, Button, StatusChip, SourceChip, Input, Toggle, Tabs, PointerBuddy, ControlIndicator, ConfirmDialog (+ `doItForMeConfirmation` copy), ModeToggle, HandoffBanner, CheckResult, JobReport |
| `@tandrix/ui/native`                             | Phone app (Expo SDK 58, RN 0.88) | ThemeProvider, useTheme, Text, Icon, Button, StatusChip, SourceChip, `nativeTextStyle`, `nativeFontNames`                                                                                    |

Phone feature components (CaptureView, PartHighlight, StepCard, SafetyGate, CheckResult, PartsList, HandoffBanner, LensCard) are built in `native/` by the tasks that need them, from these primitives and the design system specs.

## Setup

**Web / Electron**

```ts
import "@tandrix/ui/tokens.css";
import "@tandrix/ui/web/styles.css";
// Load Geist and Geist Mono locally (e.g. the `geist` npm package); no network fonts in the Mac app.
document.documentElement.dataset.theme = "light"; // or "dark" / "sunlight"
```

**React Native**

```tsx
import { ThemeProvider, nativeFontNames } from "@tandrix/ui/native";
// Register every name in nativeFontNames with expo-font before first render.
<ThemeProvider override="system" ambientLux={lux}>
  {app}
</ThemeProvider>;
```

`resolveTheme` picks the theme: an explicit user choice wins, then Sunlight above 10,000 lux, then the OS scheme.

## Tokens workflow

1. Change tokens in the design system (the source of truth), then copy its `tokens.json` to `tokens/tokens.json` and to `docs/design/system/tokens.json`.
2. `pnpm --filter @tandrix/ui build` regenerates `src/generated/tokens.ts` and `tokens.css`.
3. `pnpm test` fails if the generated files are stale, the two copies differ, or any text/control pair drops below its contrast minimum in any theme.
