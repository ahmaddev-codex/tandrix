// Request bodies for the Tandrix API (Architecture §5). Responses are the entities.
import { z } from "zod";
import { Evidence, EvidenceKind, SafetyGate } from "./entities";
import { ScreenGeometry } from "./desktop";
import { ControlMode, Id, Language, Surface, Timestamp, text } from "./primitives";

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

/** What a user can do to a step. Status changes from checks come only from the check pipeline. */
export const StepActionRequest = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start") }),
  z.strictObject({ action: z.literal("confirm_done"), measuredValue: z.number().optional() }),
  z.strictObject({ action: z.literal("confirm_safety"), gate: SafetyGate }),
  z.strictObject({ action: z.literal("skip"), reason: text(400) }),
  z.strictObject({ action: z.literal("reopen") }),
]);
export type StepActionRequest = z.infer<typeof StepActionRequest>;

export const HandoffRequest = z.strictObject({ to: Surface, stepId: Id.optional() });

export const ControlModeRequest = z.strictObject({ mode: ControlMode });

export const ScreenAskRequest = z.strictObject({
  evidenceId: Id,
  transcript: text(2000),
  geometry: ScreenGeometry,
  mode: ControlMode,
});
