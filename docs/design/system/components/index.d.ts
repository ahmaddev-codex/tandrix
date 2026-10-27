import type { ReactNode, MouseEventHandler } from "react";

export type IconName =
  | "check" | "user" | "alert" | "info" | "eyeOff" | "stop" | "clock" | "progress" | "book" | "video"
  | "camera" | "monitor" | "file" | "mic" | "power" | "gauge" | "arrowRight"
  | "retake" | "glasses" | "laptop" | "phone" | "x" | "pointer" | "hand";

export interface IconProps {
  name: IconName;
  /** 16 (default), 20 or 24 px. */
  size?: 16 | 20 | 24;
  /** solid ("fill") below 20 px and "outline" at 20 px and up, unless set. */
  weight?: "fill" | "outline";
  /** Accessible name; omit for decorative icons. */
  label?: string;
  className?: string;
}

export interface ButtonProps {
  /** primary: one per view. mandatory: safety-gate confirms only. danger: destructive. */
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "mandatory";
  /** sm 32, md 40, lg 48, field 56 px tall. Phone primary actions use field. */
  size?: "sm" | "md" | "lg" | "field";
  icon?: IconName;
  iconOnly?: boolean;
  block?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
  children?: ReactNode;
}

export type StepStatus = "verified" | "confirmed" | "attention" | "unverifiable" | "blocked" | "pending" | "progress";

export interface StatusChipProps {
  /** verified: a recorded check passed. confirmed: the user said so; never shown as verified. */
  status: StepStatus;
  size?: "md" | "lg";
  /** Overrides the default label. Keep the meaning. */
  children?: ReactNode;
}

export interface SourceChipProps {
  kind?: "manual" | "expert" | "generic" | "screen" | "photo";
  /** Citation text, e.g. "Manual p.14, fig. 3" or "Expert recording 02:31". */
  children?: ReactNode;
  href?: string;
}

export interface StepCardProps {
  index: number;
  total: number;
  /** The one action, imperative, one sentence. */
  title: string;
  body?: string;
  caution?: string;
  status?: StepStatus;
  source?: string;
  sourceKind?: SourceChipProps["kind"];
  /** A StepVisual: the step's pictures, under its words. */
  visual?: ReactNode;
  /** Usually a field-size primary Button plus an icon-only mic Button. */
  actions?: ReactNode;
}

export interface StepVisualItem {
  id: string;
  /** Tab label: "Your reference", "Manual p.4", "Last photo". */
  label: string;
  /** SourceChip text: "Manual p.4, fig. 2", "Your reference 10:46". */
  source: string;
  sourceKind: SourceChipProps["kind"];
  src: string;
  alt: string;
  aspectRatio?: number;
}

export interface StepVisualProps {
  items: StepVisualItem[];
  value?: string;
  onChange?: (id: string) => void;
  /** Opens the picture full screen (phone) or over the panel (Mac). */
  onOpen?: (id: string) => void;
}

export interface SafetyGateProps {
  title: string;
  body: string;
  /** mandatory (default): blue, needs confirm. stop: red, refusal, no action. */
  tone?: "mandatory" | "stop";
  actionLabel?: string;
  confirmed?: boolean;
  confirmedLabel?: string;
  size?: ButtonProps["size"];
  onConfirm?: MouseEventHandler<HTMLButtonElement>;
}

export interface HighlightTarget {
  shape: "circle" | "box";
  cx?: number; cy?: number; r?: number;
  x?: number; y?: number; w?: number; h?: number;
  label?: string;
  /** Part number from the parts list. */
  part?: string;
  /** Shows "Possible match" when confidence is below the confirm threshold. */
  possible?: boolean;
  /** Fill with highlight-tint when SAM returned a mask. */
  mask?: boolean;
}

export interface PartHighlightProps {
  /** The captured frame (img or svg), filling the figure. */
  children: ReactNode;
  /** Frame coordinate space for targets: [minX, minY, width, height]. */
  viewBox: [number, number, number, number];
  targets: HighlightTarget[];
  /** Text alternative, e.g. "Highlighted: impeller, centre of image". */
  alt: string;
  preserveAspectRatio?: string;
}

export interface PointerBuddyProps {
  /** Position inside the overlay, CSS length. */
  x: number | string;
  y: number | string;
  caption?: ReactNode;
}

export interface ControlIndicatorProps {
  children?: ReactNode;
  stopLabel?: string;
  onStop?: MouseEventHandler<HTMLButtonElement>;
}

export interface ConfirmDialogProps {
  title: string;
  lead?: string;
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm?: MouseEventHandler<HTMLButtonElement>;
  onCancel?: MouseEventHandler<HTMLButtonElement>;
}

export interface LensCardProps {
  step?: number;
  /** Step text, two lines at most. */
  children: ReactNode;
  hint?: string;
}

export interface CaptureViewProps {
  /** Camera view or captured photo, filling the frame. */
  children: ReactNode;
  state?: "live" | "preview" | "analyzing";
  source?: "phone" | "glasses";
  /** One line of framing guidance, e.g. "Show the open housing from the front". */
  hint?: string;
  /** What Tandrix is looking for while analyzing, e.g. "Finding the impeller". */
  analyzingLabel?: string;
  useLabel?: string;
  onCapture?: () => void;
  onRetake?: () => void;
  onUse?: () => void;
  onTalk?: () => void;
  onSwitchSource?: () => void;
}

export interface PartsListItem {
  part: string;
  name: string;
  qty?: number;
  status: "found" | "possible" | "missing";
  note?: string;
}

export interface PartsListProps {
  parts: PartsListItem[];
  onSelect?: (part: PartsListItem, index: number) => void;
}

export interface CheckResultProps {
  /** pass sets verified; not_verifiable can only lead to confirmed. */
  result: "pass" | "fail" | "not_verifiable";
  reason: string;
  title?: string;
  thumbnail?: ReactNode;
  /** Evidence label, e.g. "Photo 10:46". */
  evidence?: string;
  actions?: ReactNode;
}

export interface HandoffBannerProps {
  state: "offer" | "waiting" | "incoming";
  step: number;
  stepTitle?: string;
  device?: string;
  job?: string;
  size?: ButtonProps["size"];
  onAction?: MouseEventHandler<HTMLButtonElement>;
}

export interface ModeToggleProps {
  mode: "show" | "do";
  /** Called with the requested mode. Open ConfirmDialog before applying "do". */
  onChange?: (mode: "show" | "do") => void;
  label?: string;
}

export interface JobReportStep {
  index: number;
  title: string;
  status: StepStatus;
  source?: string;
  sourceKind?: SourceChipProps["kind"];
  time?: string;
  thumbnail?: ReactNode;
}

export interface JobReportProps {
  title: string;
  meta?: string;
  counts: { verified?: number; confirmed?: number; attention?: number; unresolved?: number };
  steps: JobReportStep[];
  footnote?: string;
}

export interface InputProps {
  label: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  /** Unit shown inside the field, e.g. "Nm". */
  suffix?: string;
  mono?: boolean;
  size?: "md" | "field";
  inputMode?: "text" | "decimal" | "numeric";
  disabled?: boolean;
  onChange?: (e: { target: { value: string } }) => void;
}

export interface ToggleProps {
  label: string;
  description?: string;
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export interface TabsItem { id: string; label: string; count?: number }

export interface TabsProps {
  items: TabsItem[];
  value?: string;
  defaultValue?: string;
  label?: string;
  size?: "md" | "field";
  onChange?: (id: string) => void;
}

export interface NoticeProps {
  /** neutral (default), info, attention, error. There is no success tone: green means verified. */
  tone?: "neutral" | "info" | "attention" | "error";
  title?: string;
  children: ReactNode;
  /** Overrides the tone's icon. */
  icon?: IconName;
  /** At most one Button, e.g. "Try again". */
  action?: ReactNode;
}

export interface ActionCardProps {
  title: string;
  body?: string;
  icon?: IconName;
  /** The one primary action, named for what happens: "Find the manual". */
  actionLabel: string;
  onAction?: MouseEventHandler<HTMLButtonElement>;
  /** An optional quieter alternative: "Use general steps instead". */
  secondaryLabel?: string;
  onSecondary?: MouseEventHandler<HTMLButtonElement>;
  size?: ButtonProps["size"];
}

export interface SummaryCardProps {
  /** What it is: "Equipment", "Manual". */
  label: string;
  title: string;
  /** Short facts; set mono for serials, part numbers and values. */
  facts?: Array<{ text: string; mono?: boolean }>;
  source?: string;
  sourceKind?: SourceChipProps["kind"];
  /** At most one secondary Button: "Open manual". */
  action?: ReactNode;
}

export interface StepRowProps {
  index: number;
  title: string;
  status?: StepStatus;
  statusLabel?: string;
  /** The citation; omit for a generic step. */
  source?: string;
  sourceKind?: SourceChipProps["kind"];
  onSelect?: MouseEventHandler<HTMLButtonElement>;
}

export interface HighlightCorrectionProps {
  /** The highlighted part's name. */
  label: string;
  /** The step's other parts, offered as "It's the …". */
  otherParts?: Array<{ name: string }>;
  onConfirm?: MouseEventHandler<HTMLButtonElement>;
  onReject?: MouseEventHandler<HTMLButtonElement>;
  onOtherPart?: (part: { name: string }, index: number) => void;
}

export interface ProgressStateProps {
  /** What is happening now: "Reading the manual". Change it as time passes. */
  label: string;
  /** Set when the work stopped: why, in plain words. Shows the retry. */
  failed?: string;
  retryLabel?: string;
  onRetry?: MouseEventHandler<HTMLButtonElement>;
  backLabel?: string;
  onBack?: MouseEventHandler<HTMLButtonElement>;
}

export interface VoiceTurn {
  speaker: "you" | "tandrix";
  text: string;
  /** refusal: work Tandrix won't guide. general: advice not from the step or its manual. */
  kind?: "refusal" | "general";
}

export interface VoiceTranscriptProps {
  /** listening while the talk button is held; working while the turn is transcribed and answered. */
  state?: "idle" | "listening" | "working";
  /** Oldest first; the last four are shown. */
  turns: VoiceTurn[];
}
