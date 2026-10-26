// The job report: every step with its status, source and evidence; the safety confirmations;
// the parts check. Read by the owner in the apps and by anyone holding a share link.
import { z } from "zod";
import { Citation, CheckResult, JobStatus, JobStepStatus, SafetyGate } from "./entities";
import { Id, Timestamp, optionalText, text } from "./primitives";

export const ReportStep = z.strictObject({
  index: z.number().int().min(1),
  title: text(200),
  surface: z.enum(["physical", "desktop"]),
  status: JobStepStatus,
  /** Why it was skipped or is blocked, in the user's or Tandrix's words. */
  note: optionalText(400),
  citation: Citation,
  /** When the step last changed. */
  updatedAt: Timestamp,
  /** The photo or screenshot that verified it or was last checked, as a short-lived link. */
  evidence: z
    .strictObject({
      kind: z.enum(["photo", "screenshot"]),
      url: z.url(),
      capturedAt: Timestamp,
    })
    .nullable(),
  /** The latest check on the step, if any. */
  check: z.strictObject({ result: CheckResult, reason: text(600) }).nullable(),
});
export type ReportStep = z.infer<typeof ReportStep>;

export const JobReportResponse = z.strictObject({
  job: z.strictObject({
    title: text(160),
    status: JobStatus,
    createdAt: Timestamp,
    updatedAt: Timestamp,
  }),
  /** "FlowSet CR 3-10, serial A1234", or null for a project without equipment. */
  equipment: text(300).nullable(),
  /** The manual the steps cite, or null when every step is Generic. */
  manual: text(200).nullable(),
  steps: z.array(ReportStep),
  counts: z.strictObject({
    verified: z.number().int().min(0),
    confirmed: z.number().int().min(0),
    attention: z.number().int().min(0),
    unresolved: z.number().int().min(0),
  }),
  safety: z.array(
    z.strictObject({
      stepIndex: z.number().int().min(1),
      gate: SafetyGate,
      confirmedAt: Timestamp,
    }),
  ),
  parts: z
    .strictObject({
      found: z.number().int().min(0),
      possible: z.number().int().min(0),
      missing: z.number().int().min(0),
    })
    .nullable(),
  generatedAt: Timestamp,
});
export type JobReportResponse = z.infer<typeof JobReportResponse>;

/** POST /jobs/:id/share: a read-only link to the report. */
export const CreateShareRequest = z.strictObject({
  /** 1 to 30 days; 7 by default. */
  days: z.number().int().min(1).max(30).default(7),
});
export const ShareLink = z.strictObject({
  id: Id,
  createdAt: Timestamp,
  expiresAt: Timestamp,
  revokedAt: Timestamp.nullable(),
});
export type ShareLink = z.infer<typeof ShareLink>;
export const CreateShareResponse = z.strictObject({
  link: ShareLink,
  /** Shown once; only its hash is stored. The report lives at <web>/r/<token>. */
  token: z.string().min(32).max(128),
});
export type CreateShareResponse = z.infer<typeof CreateShareResponse>;
export const ShareLinksResponse = z.strictObject({ links: z.array(ShareLink) });
