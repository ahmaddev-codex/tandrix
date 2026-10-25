// Typed client for the Tandrix API. Responses are validated with the shared contracts.
import type {
  CorrectDetectionRequest,
  CreateEvidenceRequest,
  SaveAssetRequest,
  StepActionRequest,
} from "@tandrix/contracts";
import {
  Asset,
  CreateEvidenceResponse,
  CreateManualUploadResponse,
  GenerateProcedureResponse,
  HighlightResponse,
  StepActionResponse,
  Detection,
  ManualResponse,
  ManualSearchResponse,
  IdentifyAssetResponse,
  JobDetailResponse,
  Evidence,
  EvidenceWithUrl,
  Job,
  type Surface,
} from "@tandrix/contracts";
import { z } from "zod";
import { env } from "./env";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthorized", "Sign in to continue.");
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "offline", "Can't reach Tandrix. Check your connection and try again.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // The API no longer accepts this session (expired, or the account is gone): sign out so the
    // app returns to sign-in instead of failing on every request.
    if (res.status === 401) await supabase.auth.signOut({ scope: "local" });
    const e = ErrorBody.safeParse(body);
    throw new ApiError(
      res.status,
      e.success ? e.data.error.code : "unknown",
      e.success ? e.data.error.message : "Something went wrong. Try again.",
    );
  }
  return schema.parse(body);
}

export const api = {
  listJobs: () => request("/jobs", z.object({ jobs: z.array(Job) })).then((r) => r.jobs),
  getJob: (id: string) => request(`/jobs/${id}`, JobDetailResponse),
  identifyAsset: (jobId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/asset/identify`, IdentifyAssetResponse, {
      method: "POST",
      body: JSON.stringify({ evidenceId }),
    }),
  saveAsset: (jobId: string, body: z.input<typeof SaveAssetRequest>) =>
    request(`/jobs/${jobId}/asset`, z.object({ asset: Asset }), {
      method: "PUT",
      body: JSON.stringify(body),
    }).then((r) => r.asset),
  createEvidence: (jobId: string, body: z.input<typeof CreateEvidenceRequest>) =>
    request(`/jobs/${jobId}/evidence`, CreateEvidenceResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeEvidence: (jobId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/evidence/${evidenceId}/complete`, z.object({ evidence: Evidence }), {
      method: "POST",
    }).then((r) => r.evidence),
  listEvidence: (jobId: string) =>
    request(`/jobs/${jobId}/evidence`, z.object({ items: z.array(EvidenceWithUrl) })).then(
      (r) => r.items,
    ),
  searchManual: (jobId: string) =>
    request(`/jobs/${jobId}/manual/search`, ManualSearchResponse, { method: "POST" }),
  fetchManual: (jobId: string, body: { url: string; title: string; token: string }) =>
    request(`/jobs/${jobId}/manual/fetch`, ManualResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.manual),
  createManualUpload: (jobId: string, body: { byteSize: number; title: string }) =>
    request(`/jobs/${jobId}/manual/upload`, CreateManualUploadResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeManualUpload: (jobId: string, uploadId: string) =>
    request(`/jobs/${jobId}/manual/upload/${uploadId}/complete`, ManualResponse, {
      method: "POST",
    }).then((r) => r.manual),
  manualFromPhotos: (jobId: string, body: { evidenceIds: string[]; title: string }) =>
    request(`/jobs/${jobId}/manual/from-photos`, ManualResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.manual),
  manualUrl: (jobId: string, manualId: string) =>
    request(`/jobs/${jobId}/manual/${manualId}/url`, z.object({ url: z.url() })).then((r) => r.url),
  generateProcedure: (jobId: string, body: { allowGeneric?: boolean } = {}) =>
    request(`/jobs/${jobId}/procedure`, GenerateProcedureResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  highlight: (jobId: string, jobStepId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/highlight`, HighlightResponse, {
      method: "POST",
      body: JSON.stringify({ evidenceId }),
    }),
  correctDetection: (jobId: string, detectionId: string, body: CorrectDetectionRequest) =>
    request(`/jobs/${jobId}/detections/${detectionId}`, z.object({ detection: Detection }), {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => r.detection),
  stepAction: (jobId: string, jobStepId: string, body: StepActionRequest) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/actions`, StepActionResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createJob: (input: { title: string; surface: Surface }) =>
    request("/jobs", z.object({ job: Job }), { method: "POST", body: JSON.stringify(input) }).then(
      (r) => r.job,
    ),
};
