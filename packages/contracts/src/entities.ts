// Persisted domain entities (Architecture §4). Shapes mirror the Supabase tables.
import { z } from "zod";
import {
  Box,
  Confidence,
  ControlMode,
  Id,
  Language,
  Point,
  StepSurface,
  Surface,
  Timestamp,
  optionalText,
  text,
} from "./primitives";

// ---- Safety ----

export const HazardTag = z.enum([
  "electrical_isolation", // equipment must be isolated from power before the step
  "pressure", // stored fluid or gas pressure
  "rotating_parts",
  "hot_surface",
  "heavy_lift",
  "chemical",
  "live_electrical", // out of scope: Tandrix refuses to guide this
]);
export type HazardTag = z.infer<typeof HazardTag>;

export const SafetyGate = z.enum([
  "isolate_power",
  "release_pressure",
  "lock_rotation",
  "cool_down",
  "lifting_plan",
  "chemical_ppe",
]);
export type SafetyGate = z.infer<typeof SafetyGate>;

// ---- Assets and sources ----

export const AssetCategory = z.enum(["equipment", "software"]);

export const Asset = z.strictObject({
  id: Id,
  ownerId: Id,
  category: AssetCategory,
  make: text(120),
  model: text(120),
  serial: optionalText(120),
  nameplateEvidenceId: Id.nullable(),
  createdAt: Timestamp,
});
export type Asset = z.infer<typeof Asset>;

export const Manual = z.strictObject({
  id: Id,
  /** Normalised "make|model" so a manual is reused across jobs. */
  assetModelKey: text(260),
  sourceType: z.enum(["search", "upload"]),
  sourceUrl: z.url().max(2000).nullable(),
  storageKey: text(512),
  pageCount: z.number().int().min(1).max(5000),
  createdAt: Timestamp,
});
export type Manual = z.infer<typeof Manual>;

export const Citation = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("manual"),
    manualId: Id,
    page: z.number().int().min(1).max(5000),
    figure: optionalText(40),
  }),
  z.strictObject({
    kind: z.literal("expert_recording"),
    recordingEvidenceId: Id,
    timestampSec: z
      .number()
      .min(0)
      .max(4 * 3600),
  }),
  z.strictObject({ kind: z.literal("generic") }),
]);
export type Citation = z.infer<typeof Citation>;

export const Verification = z.enum(["photo", "screen", "user_confirm", "measurement"]);
export type Verification = z.infer<typeof Verification>;

export const Measurement = z.strictObject({
  quantity: text(60), // "torque"
  unit: text(16), // "Nm"
  target: z.number(),
  tolerance: z.number().min(0).optional(),
});

export const PartSpec = z.strictObject({
  id: Id,
  procedureId: Id,
  partNumber: optionalText(60),
  name: text(120),
  qty: z.number().int().min(1).max(999),
  description: optionalText(400),
});
export type PartSpec = z.infer<typeof PartSpec>;

export const ProcedureStep = z.strictObject({
  id: Id,
  procedureId: Id,
  order: z.number().int().min(1).max(500),
  surface: StepSurface,
  title: text(120),
  instruction: text(600),
  reason: optionalText(600),
  partSpecIds: z.array(Id).max(20),
  caution: optionalText(400),
  hazardTags: z.array(HazardTag).max(7),
  verification: Verification,
  expectedState: text(600),
  measurement: Measurement.optional(),
  citation: Citation,
  referenceImageKey: optionalText(512),
});
export type ProcedureStep = z.infer<typeof ProcedureStep>;

export const Procedure = z.strictObject({
  id: Id,
  assetModelKey: text(260),
  sourceType: z.enum(["manual", "expert_recording", "generic"]),
  authorId: Id.nullable(),
  status: z.enum(["draft", "published"]),
  version: z.number().int().min(1),
  title: text(160),
  createdAt: Timestamp,
});
export type Procedure = z.infer<typeof Procedure>;

// ---- Jobs ----

export const JobStatus = z.enum(["active", "completed", "stopped"]);

export const Job = z.strictObject({
  id: Id,
  ownerId: Id,
  assetId: Id.nullable(),
  procedureId: Id.nullable(),
  title: text(160),
  status: JobStatus,
  currentStepId: Id.nullable(),
  activeSurface: Surface,
  /** Desktop control mode for this job; resets to "show" on every new job. */
  controlMode: ControlMode,
  language: Language,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Job = z.infer<typeof Job>;

export const JobStepStatus = z.enum([
  "todo",
  "in_progress",
  "needs_attention",
  "user_confirmed",
  "verified",
  "blocked",
  "skipped",
]);
export type JobStepStatus = z.infer<typeof JobStepStatus>;

export const JobStep = z.strictObject({
  id: Id,
  jobId: Id,
  procedureStepId: Id,
  status: JobStepStatus,
  /** Evidence behind the current status: the passing check's photo, or null. */
  statusEvidenceId: Id.nullable(),
  startedAt: Timestamp.nullable(),
  /** Skip or block reason, shown in the report. */
  note: optionalText(400),
  updatedAt: Timestamp,
  updatedBySurface: Surface,
});
export type JobStep = z.infer<typeof JobStep>;

// ---- Evidence ----

export const EvidenceKind = z.enum(["photo", "screenshot", "video", "audio", "document"]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

export const Evidence = z.strictObject({
  id: Id,
  jobId: Id,
  jobStepId: Id.nullable(),
  kind: EvidenceKind,
  surface: Surface,
  storageKey: text(512),
  mimeType: text(100),
  byteSize: z.number().int().min(1),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
  capturedAt: Timestamp,
  /** Set when the API has confirmed the file is in storage; clients only see uploaded evidence. */
  uploadedAt: Timestamp.nullable(),
  deletedAt: Timestamp.nullable(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Detection = z.strictObject({
  id: Id,
  evidenceId: Id,
  label: text(120),
  partSpecId: Id.nullable(),
  box: Box,
  maskKey: optionalText(512),
  confidence: Confidence,
  /** null until the user reviews it. */
  confirmedByUser: z.boolean().nullable(),
  correctedLabel: optionalText(120),
});
export type Detection = z.infer<typeof Detection>;

/** One shape for the camera highlight and the screen pointer. Pixels are in the source image. */
export const PointerTarget = z.strictObject({
  surface: z.enum(["camera", "screen"]),
  evidenceId: Id,
  label: text(120),
  confidence: Confidence,
  geometry: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("point"), point: Point }),
    z.strictObject({ kind: z.literal("box"), box: Box }),
    z.strictObject({ kind: z.literal("mask"), box: Box, maskKey: text(512) }),
  ]),
});
export type PointerTarget = z.infer<typeof PointerTarget>;

export const CheckResult = z.enum(["pass", "fail", "not_verifiable"]);
export type CheckResult = z.infer<typeof CheckResult>;

export const Check = z.strictObject({
  id: Id,
  jobStepId: Id,
  evidenceId: Id,
  result: CheckResult,
  reason: text(600),
  whatToShowNext: optionalText(300),
  createdAt: Timestamp,
});
export type Check = z.infer<typeof Check>;

export const PartStatus = z.enum(["found", "possible", "missing"]);
export type PartStatus = z.infer<typeof PartStatus>;

export const PartsCheck = z.strictObject({
  id: Id,
  jobId: Id,
  evidenceIds: z.array(Id).min(1).max(4),
  results: z
    .array(
      z.strictObject({
        partSpecId: Id,
        status: PartStatus,
        detectionIds: z.array(Id).max(999),
      }),
    )
    .max(200),
  createdAt: Timestamp,
});
export type PartsCheck = z.infer<typeof PartsCheck>;

export const SafetyConfirmation = z.strictObject({
  id: Id,
  jobStepId: Id,
  gate: SafetyGate,
  confirmedBy: Id,
  surface: Surface,
  confirmedAt: Timestamp,
});
export type SafetyConfirmation = z.infer<typeof SafetyConfirmation>;

export const EventType = z.enum([
  "job_created",
  "asset_identified",
  "manual_attached",
  "procedure_generated",
  "parts_checked",
  "step_status_changed",
  "safety_confirmed",
  "check_recorded",
  "handoff",
  "control_mode_changed",
  "desktop_action_executed",
  "desktop_action_blocked",
  "evidence_deleted",
]);

export const Event = z.strictObject({
  id: Id,
  jobId: Id,
  type: EventType,
  surface: Surface.nullable(),
  /** Compact, non-sensitive payload. Never raw media or transcripts. */
  payload: z.record(z.string().max(64), z.json()),
  createdAt: Timestamp,
});
export type Event = z.infer<typeof Event>;
