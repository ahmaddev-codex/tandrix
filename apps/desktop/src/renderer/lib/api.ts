// Typed client for the Tandrix API. Responses are validated with the shared contracts.
import {
  CheckStepResponse,
  CreateEvidenceResponse,
  Evidence,
  Job,
  JobDetailResponse,
  ScreenAskResponse,
  StepActionResponse,
  TranscribeResponse,
  type CreateEvidenceRequest,
  type ScreenAskRequest,
  type StepActionRequest,
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

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  /** Multipart bodies set their own content type. */
  json = true,
) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthorized", "Sign in to continue.");
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "offline", "Can't reach Tandrix. Check your connection and try again.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // The API no longer accepts this session: sign out so the panel returns to sign-in.
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
  createEvidence: (jobId: string, body: z.input<typeof CreateEvidenceRequest>) =>
    request(`/jobs/${jobId}/evidence`, CreateEvidenceResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeEvidence: (jobId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/evidence/${evidenceId}/complete`, z.object({ evidence: Evidence }), {
      method: "POST",
    }).then((r) => r.evidence),
  transcribe: (wav: Uint8Array) => {
    const form = new FormData();
    form.append("audio", new Blob([wav as BlobPart], { type: "audio/wav" }), "question.wav");
    return request("/voice/transcribe", TranscribeResponse, { method: "POST", body: form }, false);
  },
  /** Recorded as the Mac's doing in the job's history. */
  stepAction: (jobId: string, jobStepId: string, body: z.input<typeof StepActionRequest>) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/actions`, StepActionResponse, {
      method: "POST",
      headers: { "X-Tandrix-Surface": "desktop" },
      body: JSON.stringify(body),
    }),
  checkStep: (jobId: string, jobStepId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/check`, CheckStepResponse, {
      method: "POST",
      body: JSON.stringify({ evidenceId }),
    }),
  screenAsk: (jobId: string, body: z.input<typeof ScreenAskRequest>) =>
    request(`/jobs/${jobId}/screen/ask`, ScreenAskResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
