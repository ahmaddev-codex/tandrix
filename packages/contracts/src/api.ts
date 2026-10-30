// Request bodies for the Tandrix API (Architecture §5). Responses are the entities.
import { z } from "zod";
import {
  Asset,
  AssetCategory,
  Check,
  Evidence,
  EvidenceKind,
  Job,
  JobStep,
  Manual,
  PointerTarget,
  PartSpec,
  PartStatus,
  PartsCheck,
  Detection,
  Procedure,
  ProcedureStep,
  SafetyConfirmation,
  SafetyGate,
} from "./entities";
import { ManualSearchOutput, NameplateReading } from "./model-outputs";
import { DesktopAction, ScreenGeometry } from "./desktop";
import { ControlMode, Id, Language, Surface, Timestamp, optionalText, text } from "./primitives";

export const CreateJobRequest = z.strictObject({
  title: text(160),
  assetId: Id.optional(),
  language: Language.default("en"),
  surface: Surface,
});

const MB = 1024 * 1024;
/** Allowed uploads by kind. Anything else is refused before a signed URL is issued. */
export const uploadLimits = {
  photo: { mime: ["image/jpeg", "image/png", "image/heic", "image/webp"], maxBytes: 15 * MB },
  screenshot: { mime: ["image/png", "image/jpeg"], maxBytes: 15 * MB },
  video: { mime: ["video/mp4", "video/quicktime"], maxBytes: 300 * MB },
  audio: { mime: ["audio/wav", "audio/mp4", "audio/mpeg"], maxBytes: 50 * MB },
  document: { mime: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 60 * MB },
} as const satisfies Record<
  z.infer<typeof EvidenceKind>,
  { mime: readonly string[]; maxBytes: number }
>;

export const CreateEvidenceRequest = z
  .strictObject({
    kind: EvidenceKind,
    mimeType: z.string().max(100),
    byteSize: z.number().int().min(1),
    surface: Surface,
    jobStepId: Id.optional(),
    width: z.number().int().min(1).max(20_000).optional(),
    height: z.number().int().min(1).max(20_000).optional(),
    /** When the photo was taken on the device; defaults to now. */
    capturedAt: Timestamp.optional(),
  })
  .superRefine((v, ctx) => {
    const limit = uploadLimits[v.kind];
    if (!(limit.mime as readonly string[]).includes(v.mimeType)) {
      ctx.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: `Unsupported type for ${v.kind}`,
      });
    }
    if (v.byteSize > limit.maxBytes) {
      ctx.addIssue({ code: "custom", path: ["byteSize"], message: `Too large for ${v.kind}` });
    }
  });

/** Returned by POST /jobs/:id/evidence: upload the file to `upload.signedUrl`, then confirm. */
export const CreateEvidenceResponse = z.strictObject({
  evidence: Evidence,
  upload: z.strictObject({
    bucket: z.literal("evidence"),
    path: text(512),
    token: z.string().min(1),
    signedUrl: z.url(),
  }),
});
export type CreateEvidenceResponse = z.infer<typeof CreateEvidenceResponse>;

/** Uploaded evidence with a short-lived URL to show it. */
export const EvidenceWithUrl = z.strictObject({
  evidence: Evidence,
  url: z.url(),
  urlExpiresAt: Timestamp,
});
export type EvidenceWithUrl = z.infer<typeof EvidenceWithUrl>;

/** Read a nameplate photo (already uploaded as evidence on this job). */
export const IdentifyAssetRequest = z.strictObject({ evidenceId: Id });

export const IdentifyAssetResponse = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("read"), reading: NameplateReading }),
  /** The model couldn't help (unavailable, or the plate wasn't readable); the user types it. */
  z.strictObject({
    status: z.literal("unavailable"),
    reason: z.enum(["model_unavailable", "unreadable"]),
    message: text(300),
  }),
]);
export type IdentifyAssetResponse = z.infer<typeof IdentifyAssetResponse>;

/** Save what the user confirmed (possibly edited from the reading) as the job's asset. */
export const SaveAssetRequest = z.strictObject({
  category: AssetCategory.default("equipment"),
  make: text(120),
  model: text(120),
  serial: z.string().trim().max(120).optional(),
  nameplateEvidenceId: Id.optional(),
  /** How the values were produced, for the audit trail. */
  source: z.enum(["model", "model_edited", "manual"]),
  confidence: z.number().min(0).max(1).optional(),
});

/** The job's procedure with its parts and steps, in step order. */
export const ProcedureDetail = z.strictObject({
  procedure: Procedure,
  parts: z.array(PartSpec),
  steps: z.array(ProcedureStep),
});
export type ProcedureDetail = z.infer<typeof ProcedureDetail>;

/** GET /jobs/:id */
export const JobDetailResponse = z.strictObject({
  job: Job,
  steps: z.array(JobStep),
  asset: Asset.nullable(),
  /** The manual on file for this asset's model, if any. */
  manual: Manual.nullable(),
  procedure: ProcedureDetail.nullable(),
  /** Safety gates confirmed on this job's steps. */
  safetyConfirmations: z.array(SafetyConfirmation),
  /** The latest parts check, if the parts have been checked. */
  partsCheck: PartsCheck.nullable(),
});

/** POST /jobs/:id/procedure. The task defaults to the job title. */
export const GenerateProcedureRequest = z.strictObject({
  task: text(300).optional(),
  /** True to proceed without a manual: every step is labelled Generic. */
  allowGeneric: z.boolean().default(false),
  /** Uploaded photos of where the work stands now, so the steps start from there. */
  contextEvidenceIds: z.array(Id).max(4).default([]),
  /** Anything else the user said about the job, in their words. */
  notes: optionalText(600),
});

export const GenerateProcedureResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("created"),
    detail: ProcedureDetail,
    /** Steps cited from the manual; the rest are Generic. */
    citedSteps: z.number().int().min(0),
  }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type GenerateProcedureResponse = z.infer<typeof GenerateProcedureResponse>;

export const ManualSearchResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("found"),
    /** Each candidate carries a server-signed token; fetch only accepts URLs the search returned. */
    candidates: z.array(
      ManualSearchOutput.shape.candidates.element.extend({ token: z.string().min(1).max(200) }),
    ),
  }),
  z.strictObject({ status: z.literal("cached"), manual: Manual }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type ManualSearchResponse = z.infer<typeof ManualSearchResponse>;

/** Attach a manual found by search: the server downloads and checks it. */
export const FetchManualRequest = z.strictObject({
  url: z
    .url()
    .max(2000)
    .refine((u) => u.startsWith("https://"), "Only https links"),
  title: text(200),
  /** The token that came with this candidate from the search. */
  token: z.string().min(1).max(200),
});

/** Attach a manual PDF the user uploads (signed upload, then complete). */
export const CreateManualUploadRequest = z.strictObject({
  byteSize: z
    .number()
    .int()
    .min(1)
    .max(60 * 1024 * 1024),
  title: text(200),
});
export const CreateManualUploadResponse = z.strictObject({
  uploadId: Id,
  upload: z.strictObject({
    bucket: z.literal("manuals"),
    path: text(512),
    token: z.string().min(1),
    signedUrl: z.url(),
  }),
});

/** Build a manual from photographed pages (uploaded photo evidence, in page order). */
export const ManualFromPhotosRequest = z.strictObject({
  evidenceIds: z.array(Id).min(1).max(60),
  title: text(200),
});

export const ManualResponse = z.strictObject({ manual: Manual });
export type JobDetailResponse = z.infer<typeof JobDetailResponse>;

/** What a user can do to a step. Status changes from checks come only from the check pipeline. */
/**
 * When the action really happened, for actions sent later from the offline queue. The API uses it
 * only within the last day and never in the future; otherwise it uses its own clock.
 */
const OccurredAt = { occurredAt: Timestamp.optional() };

export const StepActionRequest = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start"), ...OccurredAt }),
  z.strictObject({
    action: z.literal("confirm_done"),
    measuredValue: z.number().optional(),
    ...OccurredAt,
  }),
  z.strictObject({ action: z.literal("confirm_safety"), gate: SafetyGate, ...OccurredAt }),
  z.strictObject({ action: z.literal("skip"), reason: text(400), ...OccurredAt }),
  z.strictObject({ action: z.literal("reopen"), ...OccurredAt }),
]);
export type StepActionRequest = z.infer<typeof StepActionRequest>;

/** Why the step rules (@tandrix/core transitionStep) turned an action down. */
export const StepRejectionCode = z.enum([
  "invalid_transition",
  "refused",
  "safety_gate_required",
  "stale_evidence",
  "check_not_applicable",
  "confirmation_not_allowed",
  "measurement_required",
  "measurement_out_of_range",
]);
export type StepRejectionCode = z.infer<typeof StepRejectionCode>;

/** POST /jobs/:id/steps/:stepId/actions. A rule saying no is an answer, not an error. */
export const StepActionResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("applied"),
    step: JobStep,
    confirmations: z.array(SafetyConfirmation),
  }),
  z.strictObject({
    status: z.literal("rejected"),
    code: StepRejectionCode,
    message: text(300),
    /** The gates still to confirm, for safety_gate_required. */
    gates: z.array(SafetyGate).optional(),
  }),
]);
export type StepActionResponse = z.infer<typeof StepActionResponse>;

/**
 * POST /jobs/:id/handoff: send the job to another device, optionally at a step (a job step id).
 * The other device hears it over Realtime (public.jobs).
 */
export const HandoffRequest = z.strictObject({ to: Surface, stepId: Id.optional() });
export const HandoffResponse = z.strictObject({ job: Job });
export type HandoffResponse = z.infer<typeof HandoffResponse>;

/** DELETE /jobs/:id: the job, its steps and its evidence objects are gone. */
export const DeleteJobResponse = z.strictObject({ deleted: z.literal(true) });
export type DeleteJobResponse = z.infer<typeof DeleteJobResponse>;

export const ControlModeRequest = z.strictObject({ mode: ControlMode });

/** POST /early-access: a visitor asks to hear when Tandrix is ready for their device. Public. */
export const EarlyAccessRequest = z.strictObject({
  /** Trimmed and lower-cased before it's checked, so pasted addresses with spaces still work. */
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  platform: z.enum(["mac", "iphone"]).optional(),
});
export type EarlyAccessRequest = z.infer<typeof EarlyAccessRequest>;
/** The same answer whether or not the address was already on the list. */
export const EarlyAccessResponse = z.strictObject({ ok: z.literal(true) });
export type EarlyAccessResponse = z.infer<typeof EarlyAccessResponse>;

/** GET /profile: what Tandrix calls this user, if they have said. */
export const ProfileResponse = z.strictObject({ displayName: z.string().nullable() });
export type ProfileResponse = z.infer<typeof ProfileResponse>;

/** PUT /profile: set or clear it (null clears). */
export const UpdateProfileRequest = z.strictObject({
  displayName: z.string().trim().min(1).max(40).nullable(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

/**
 * POST /jobs/:id/screen/ask: a question about an uploaded screenshot (evidence kind
 * "screenshot"). The job's current step, if any, is the context.
 */
export const ScreenAskRequest = z.strictObject({
  evidenceId: Id,
  transcript: text(2000),
  geometry: ScreenGeometry,
  mode: ControlMode,
  /** "Teach me…": one step at a time with check-ins, instead of a single answer. */
  lesson: z.boolean().default(false),
  /** What Tandrix calls the user; used rarely, never in every reply. */
  userName: z.string().trim().min(1).max(40).optional(),
});

/** The largest inline screenshot a question outside a job may carry (base64 of a 1280 px JPEG is far smaller). */
export const INLINE_SCREENSHOT_MAX_BYTES = 4 * 1024 * 1024;

/** One earlier exchange, so a follow-up ("and then?") makes sense. Text only. */
export const ScreenTurn = z.strictObject({ question: text(2000), reply: text(600) });

/**
 * POST /screen/ask: a question about the screen outside any job ("teach me Photoshop"). The
 * screenshot travels inline and is never stored.
 */
/** A screenshot sent inline (base64), never stored. */
export const InlineScreenshot = z.strictObject({
  mimeType: z.enum(["image/jpeg", "image/png"]),
  /** Base64 of the image bytes. */
  data: z
    .string()
    .min(1)
    .max(Math.ceil((INLINE_SCREENSHOT_MAX_BYTES * 4) / 3) + 4)
    .regex(/^[A-Za-z0-9+/]+=*$/),
});

export const ScreenAskInlineRequest = z.strictObject({
  screenshot: InlineScreenshot,
  transcript: text(2000),
  geometry: ScreenGeometry,
  mode: ControlMode,
  /** Oldest first; the last four at most. */
  history: z.array(ScreenTurn).max(4).default([]),
  /** "Teach me…": one step at a time with check-ins, instead of a single answer. */
  lesson: z.boolean().default(false),
  /** What Tandrix calls the user; used rarely, never in every reply. */
  userName: z.string().trim().min(1).max(40).optional(),
});

export const ScreenAskResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("answered"),
    reply: text(600),
    /** Where to look, in screenshot pixels (point geometry); null when Tandrix can't point. */
    target: PointerTarget.nullable(),
    /**
     * What the model would do, in screenshot pixels. Show me only draws it; Do it for me runs it
     * only after the action guard in @tandrix/core.
     */
    proposed: z.array(DesktopAction).max(16),
  }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type ScreenAskResponse = z.infer<typeof ScreenAskResponse>;

// ---- Do it for me ----

/** A check the model attaches to an action that needs the user's sign-off. */
export const SafetyCheck = z.strictObject({
  /** Opaque, and long: the model's ids run to about a thousand characters. */
  id: z.string().min(1).max(8000),
  code: text(200),
  message: z.string().max(2000),
});

/**
 * The check the model puts on every computer action ("Review and confirm before executing this
 * computer action"). Tandrix's own action guard is that review: it classifies every action, asks
 * the user before anything sensitive, and announces each one with time to stop it. Other checks
 * always go to the user.
 */
export const ROUTINE_ACTION_CHECK = "computer_action_requires_confirmation";
export type SafetyCheck = z.infer<typeof SafetyCheck>;

/** Turns in one Do it for me task before Tandrix stops and hands back. */
/** A hard ceiling on one task's turns; well before it, the Mac checks in with the user. */
export const DO_MAX_TURNS = 200;

/** POST /screen/background: a task that needs no screen, done while the user carries on. */
export const BackgroundRequest = z.strictObject({ task: text(2000) });
export const BackgroundResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("done"),
    /** Said aloud when it's ready. */
    spoken: z.string().max(400),
    /** The full answer, to read. */
    detail: z.string().max(6000),
    sources: z.array(z.string().max(2000)).max(8),
  }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type BackgroundResponse = z.infer<typeof BackgroundResponse>;

/** POST /screen/do: start doing a task on the screen shown. The screenshot isn't stored here. */
export const DoStartRequest = z.strictObject({
  screenshot: InlineScreenshot,
  task: text(2000),
  geometry: ScreenGeometry,
  /** Apps installed on the Mac, so the task can start in the one it needs. */
  apps: z.array(text(120)).max(500).default([]),
  /** The app in front when the task was asked. */
  frontApp: optionalText(120),
  /** The Mac already opened the app the plan chose: start on this screen. */
  planned: z.boolean().default(false),
  /**
   * What's been done so far, one line each, kept by the Mac. Each turn is a fresh model call with
   * this memory and the current screen, so turns stay fast instead of growing with every screenshot.
   */
  memory: z.array(text(300)).max(40).default([]),
  /** Which turn of the task this is (1 for the first). */
  turn: z.number().int().min(1).max(DO_MAX_TURNS).default(1),
});

/** POST /screen/do/continue: the screen after the last batch ran, with the checks accepted. */
export const DoContinueRequest = z.strictObject({
  /** From the last turn; it ties the task to this user and counts its turns. */
  session: z.string().min(1).max(800),
  screenshot: InlineScreenshot,
  geometry: ScreenGeometry,
  acknowledged: z.array(SafetyCheck).max(10).default([]),
});

export const DoTurnResponse = z.discriminatedUnion("status", [
  /** Run these (each through the action guard), then continue with a fresh screenshot. */
  z.strictObject({
    status: z.literal("act"),
    session: z.string().min(1).max(800),
    turn: z.number().int().min(1).max(DO_MAX_TURNS),
    actions: z.array(DesktopAction).max(16),
    safetyChecks: z.array(SafetyCheck).max(10),
    reply: z.string().max(600),
  }),
  /** Open this installed app first, then start again with `planned: true` on the new screen. */
  z.strictObject({ status: z.literal("open_app"), app: text(120) }),
  /** Finished, or can't be done: what the model said. */
  z.strictObject({ status: z.literal("done"), reply: z.string().max(600) }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type DoTurnResponse = z.infer<typeof DoTurnResponse>;

/** POST /jobs/:id/steps/:stepId/highlight: find the step's parts in an uploaded photo. */
export const HighlightRequest = z.strictObject({ evidenceId: Id });

export const HighlightTarget = PointerTarget.extend({
  detectionId: Id,
  partSpecId: Id,
  /** Part number from the parts list, shown in mono on the label. */
  partNumber: z.string().max(60).optional(),
  /** Below HIGHLIGHT_CONFIDENT: label shows "Possible match". */
  possible: z.boolean(),
});
export type HighlightTarget = z.infer<typeof HighlightTarget>;

export const HighlightResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("found"),
    evidenceId: Id,
    /** The photo's pixel size: the coordinate space of every target. */
    size: z.strictObject({ width: z.number().int().min(1), height: z.number().int().min(1) }),
    /** At most three, per the design system. */
    targets: z.array(HighlightTarget).max(3),
    /** Step parts that weren't found in this photo. */
    missing: z.array(z.strictObject({ partSpecId: Id, name: text(120) })),
    /** Framing advice when something wasn't found, e.g. "Show the housing from the front". */
    hint: text(200).optional(),
  }),
  /** The step names no parts, so there is nothing to highlight. */
  z.strictObject({ status: z.literal("no_parts") }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type HighlightResponse = z.infer<typeof HighlightResponse>;

/** PATCH /jobs/:id/detections/:detectionId: the user's verdict on a highlight. */
export const CorrectDetectionRequest = z.discriminatedUnion("verdict", [
  z.strictObject({ verdict: z.literal("confirmed") }),
  z.strictObject({ verdict: z.literal("wrong") }),
  /** It's a different part of this step. */
  z.strictObject({ verdict: z.literal("other_part"), partSpecId: Id }),
]);
export type CorrectDetectionRequest = z.infer<typeof CorrectDetectionRequest>;

/** A spoken command on a step (@tandrix/core parseVoiceCommand). */
export const VoiceCommand = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("next") }),
  z.strictObject({ kind: z.literal("previous") }),
  z.strictObject({ kind: z.literal("repeat") }),
  z.strictObject({ kind: z.literal("show") }),
  z.strictObject({ kind: z.literal("stuck"), detail: z.string().max(200).optional() }),
  z.strictObject({ kind: z.literal("skip"), reason: z.string().max(400).optional() }),
  z.strictObject({ kind: z.literal("stop") }),
  z.strictObject({ kind: z.literal("start") }),
  z.strictObject({ kind: z.literal("done") }),
]);
export type VoiceCommand = z.infer<typeof VoiceCommand>;

/** POST /voice/transcribe (multipart: `audio` WAV, optional `keywords` JSON array). */
export const TranscribeResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("heard"),
    transcript: text(2000),
    durationMs: z.number().int().min(0),
  }),
  /** Nothing intelligible: ask the user to try again. */
  z.strictObject({ status: z.literal("unclear"), message: text(300) }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type TranscribeResponse = z.infer<typeof TranscribeResponse>;

/** POST /jobs/:id/steps/:stepId/ask: what the user said or typed on a step. */
export const AskStepRequest = z.strictObject({
  text: text(1000),
  /** From the "I'm stuck" command: ask for the next physical thing to do. */
  stuck: z.boolean().default(false),
  /** What Tandrix calls the user; used rarely, never in every reply. */
  userName: z.string().trim().min(1).max(40).optional(),
});

export const AskStepResponse = z.discriminatedUnion("status", [
  /** A command the app carries out (next, repeat, start…). */
  z.strictObject({ status: z.literal("command"), command: VoiceCommand }),
  z.strictObject({
    status: z.literal("answer"),
    answer: text(600),
    /** From the step and its manual (true) or general practice (false). */
    fromStep: z.boolean(),
  }),
  /** Work Tandrix won't guide (wiring, live work): the reason, said plainly. */
  z.strictObject({ status: z.literal("refused"), message: text(300) }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type AskStepResponse = z.infer<typeof AskStepResponse>;

/** POST /jobs/:id/steps/:stepId/check: judge an uploaded photo against the step. */
export const CheckStepRequest = z.strictObject({ evidenceId: Id });

export const CheckStepResponse = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("checked"), check: Check, step: JobStep }),
  /** The step rules turned the check down (photo taken before the step started, step not active…). */
  z.strictObject({ status: z.literal("rejected"), code: StepRejectionCode, message: text(300) }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type CheckStepResponse = z.infer<typeof CheckStepResponse>;

// ---- Step visuals ----

const visualSize = {
  width: z.number().int().min(1).max(20_000).optional(),
  height: z.number().int().min(1).max(20_000).optional(),
};

/** An image that helps with a step. URLs are signed and short-lived. */
export const StepVisual = z.discriminatedUnion("kind", [
  /** The user's own picture of how the result should look: from the box, a kit sheet, a past job. */
  z.strictObject({
    kind: z.literal("reference"),
    evidenceId: Id,
    evidenceKind: z.enum(["photo", "screenshot"]),
    url: z.url(),
    ...visualSize,
    capturedAt: Timestamp,
  }),
  /** The manual page the step cites, as an image. */
  z.strictObject({
    kind: z.literal("manual_page"),
    manualId: Id,
    page: z.number().int().min(1).max(5000),
    figure: optionalText(40),
    url: z.url(),
    width: z.number().int().min(1).max(20_000),
    height: z.number().int().min(1).max(20_000),
  }),
  /** The latest photo or screenshot taken for the step. */
  z.strictObject({
    kind: z.literal("latest"),
    evidenceId: Id,
    evidenceKind: z.enum(["photo", "screenshot"]),
    url: z.url(),
    ...visualSize,
    capturedAt: Timestamp,
  }),
]);
export type StepVisual = z.infer<typeof StepVisual>;

/** GET /jobs/:id/steps/:stepId/visuals: reference first, then the manual page, then the latest photo. */
export const StepVisualsResponse = z.strictObject({
  visuals: z.array(StepVisual).max(3),
  urlExpiresAt: Timestamp,
});
export type StepVisualsResponse = z.infer<typeof StepVisualsResponse>;

/** PUT /jobs/:id/steps/:stepId/reference: an uploaded photo or screenshot on this job. */
export const SetStepReferenceRequest = z.strictObject({ evidenceId: Id });

/** POST /jobs/:id/parts-check: match one photo of the laid-out parts to the parts list. */
export const PartsCheckRequest = z.strictObject({ evidenceId: Id });

export const PartsCheckResponse = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("checked"),
    partsCheck: PartsCheck,
    /** The boxes found for each part, for highlighting on the photo. */
    detections: z.array(Detection),
    /** The job's steps after missing parts blocked (or found parts unblocked) them. */
    steps: z.array(JobStep),
  }),
  /** The procedure lists no parts. */
  z.strictObject({ status: z.literal("no_parts") }),
  z.strictObject({ status: z.literal("unavailable"), message: text(300) }),
]);
export type PartsCheckResponse = z.infer<typeof PartsCheckResponse>;

/** PATCH /jobs/:id/parts-check/:partsCheckId/parts/:partSpecId: the user corrects one part. */
export const CorrectPartRequest = z.strictObject({ status: PartStatus });

export const CorrectPartResponse = z.strictObject({
  partsCheck: PartsCheck,
  steps: z.array(JobStep),
});
