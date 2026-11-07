// Typed client for the Tandrix API. Responses are validated with the shared contracts.
import type {
  DoContinueRequest,
  DoNotesRequest,
  DoStartRequest,
  BackgroundRequest,
} from "@tandrix/contracts";
import {
  BackgroundResponse,
  CheckStepResponse,
  DoNotesResponse,
  DoTurnResponse,
  ProcedureRunResponse,
  StepVisualsResponse,
  CreateEvidenceResponse,
  Evidence,
  Job,
  JobDetailResponse,
  ProfileResponse,
  ScreenAskResponse,
  StepActionResponse,
  TranscribeResponse,
  type ControlMode,
  type CreateEvidenceRequest,
  type GenerateProcedureRequest,
  type ScreenAskInlineRequest,
  type ScreenAskRequest,
  type StepActionRequest,
  type UpdateProfileRequest,
} from "@tandrix/contracts";
import { waitForProcedure } from "@tandrix/core";
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

/**
 * A reply in Tandrix's voice as WAV audio, or null when the voice isn't available (no model, rate
 * limited, offline) so the caller falls back.
 */
async function speech(text: string, signal: AbortSignal): Promise<Blob | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  // The voice can still be loading on the server (204): wait a moment and ask once more, rather
  // than going quiet on the first reply.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${env.apiUrl}/voice/speak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
      if (res.status === 200) return await res.blob();
      if (res.status !== 204 || attempt > 0) return null;
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (signal.aborted) return null;
  }
  return null;
}

export const api = {
  speech,
  getProfile: () => request("/profile", ProfileResponse),
  updateProfile: (body: UpdateProfileRequest) =>
    request("/profile", ProfileResponse, { method: "PUT", body: JSON.stringify(body) }),
  setControlMode: (jobId: string, mode: ControlMode) =>
    request(`/jobs/${jobId}/control-mode`, z.object({ job: Job }), {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }).then((r) => r.job),
  listJobs: () => request("/jobs", z.object({ jobs: z.array(Job) })).then((r) => r.jobs),
  /** A project started here: it opens on this Mac. */
  createJob: (title: string) =>
    request("/jobs", z.object({ job: Job }), {
      method: "POST",
      body: JSON.stringify({ title, surface: "desktop" }),
    }).then((r) => r.job),
  /** Writes the steps in the background and waits; a dropped connection doesn't lose them. */
  generateProcedure: (jobId: string, body: z.input<typeof GenerateProcedureRequest>) =>
    waitForProcedure({
      start: () =>
        request(`/jobs/${jobId}/procedure/start`, ProcedureRunResponse, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      check: () => request(`/jobs/${jobId}/procedure/run`, ProcedureRunResponse),
      isOffline: (e) => e instanceof ApiError && e.status === 0,
    }),
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
  transcribe: (wav: Uint8Array, words: string[] = []) => {
    const form = new FormData();
    form.append("audio", new Blob([wav as BlobPart], { type: "audio/wav" }), "question.wav");
    form.append(
      "keywords",
      JSON.stringify(["Tandrix", "Hey Tandrix", "Wake up Tandrix", ...words].slice(0, 20)),
    );
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
  stepVisuals: (jobId: string, jobStepId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/visuals`, StepVisualsResponse),
  /** Do it for me: the first turn of a task on the screen shown (inline, not kept). */
  doStart: (body: z.input<typeof DoStartRequest>) =>
    request("/screen/do", DoTurnResponse, { method: "POST", body: JSON.stringify(body) }),
  /** The next turn of the same model conversation: the screen after the last batch ran. */
  doNotes: (body: z.input<typeof DoNotesRequest>) =>
    request("/screen/do/notes", DoNotesResponse, { method: "POST", body: JSON.stringify(body) }),
  doContinue: (body: z.input<typeof DoContinueRequest>) =>
    request("/screen/do/continue", DoTurnResponse, { method: "POST", body: JSON.stringify(body) }),
  /** A task that needs no screen, done in the background. */
  background: (body: BackgroundRequest) =>
    request("/screen/background", BackgroundResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** A question outside any job: the screenshot travels inline and isn't kept. */
  screenAskInline: (body: z.input<typeof ScreenAskInlineRequest>) =>
    request("/screen/ask", ScreenAskResponse, { method: "POST", body: JSON.stringify(body) }),
  screenAsk: (jobId: string, body: z.input<typeof ScreenAskRequest>) =>
    request(`/jobs/${jobId}/screen/ask`, ScreenAskResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
