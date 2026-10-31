// Typed client for the Tandrix API. Responses are validated with the shared contracts.
import type {
  CorrectDetectionRequest,
  CreateEvidenceRequest,
  GenerateProcedureRequest,
  LookRequest,
  RecordedProcedureRequest,
  SaveAssetRequest,
  StepActionRequest,
  UpdateProfileRequest,
} from "@tandrix/contracts";
import {
  Asset,
  CreateEvidenceResponse,
  CreateManualUploadResponse,
  GenerateProcedureResponse,
  HighlightResponse,
  StepActionResponse,
  CheckStepResponse,
  StepVisualsResponse,
  PartsCheckResponse,
  CorrectPartResponse,
  AskStepResponse,
  LookResponse,
  ProcedureRunResponse,
  TranscribeResponse,
  Detection,
  ManualResponse,
  ManualSearchResponse,
  IdentifyAssetResponse,
  ProfileResponse,
  CreateShareResponse,
  JobDetailResponse,
  JobReportResponse,
  ShareLink,
  Evidence,
  EvidenceWithUrl,
  Job,
  HandoffResponse,
  PairingApproveResponse,
  PairingLookupResponse,
  type Surface,
} from "@tandrix/contracts";
import { waitForProcedure } from "@tandrix/core";
import { z } from "zod";
import { File } from "expo-file-system";
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

/** Requests fail fast instead of hanging: thirty seconds, then the offline path. */
const REQUEST_TIMEOUT_MS = 30_000;
/** Calls that wait on a model (reading a manual, checking a photo) get longer. */
const MODEL_TIMEOUT_MS = 120_000;

/** Told of each write that went through, with the project it touched, so held lists can catch up. */
export const writes = new Set<(jobId: string | undefined) => void>();

/** Concurrent requests share one session read instead of each queuing on storage. */
let sessionFlight: Promise<string | null> | null = null;
function accessToken(): Promise<string | null> {
  sessionFlight ??= supabase.auth.getSession().then(
    ({ data }) => {
      sessionFlight = null;
      return data.session?.access_token ?? null;
    },
    () => {
      sessionFlight = null;
      return null;
    },
  );
  return sessionFlight;
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  { timeoutMs = REQUEST_TIMEOUT_MS, ...init }: RequestInit & { timeoutMs?: number } = {},
  /** Multipart bodies set their own content type. */
  json = true,
): Promise<T> {
  const token = await accessToken();
  if (!token) throw new ApiError(401, "unauthorized", "Sign in to continue.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError")
      throw new ApiError(0, "timeout", "Tandrix is taking too long. Try again.");
    throw new ApiError(0, "offline", "Can't reach Tandrix. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
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
  if (init.method && init.method !== "GET")
    for (const w of writes) w(/^\/jobs\/([^/?]+)/.exec(path)?.[1]);
  return schema.parse(body);
}

/**
 * A reply in Tandrix's voice as WAV bytes, or null when the voice isn't available (no model, rate
 * limited, offline) so the caller falls back.
 */
async function speech(text: string, signal: AbortSignal): Promise<Uint8Array | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  // The voice can still be loading on the server (204): wait a moment and ask once more, rather
  // than going quiet on the first reply.
  for (let attempt = 0; attempt < 2; attempt++) {
    // Hermes has no AbortSignal.any: follow the caller's signal, and give up after 20 s.
    const ctl = new AbortController();
    const stop = () => ctl.abort();
    const timer = setTimeout(stop, 20_000);
    signal.addEventListener("abort", stop);
    try {
      const res = await fetch(`${env.apiUrl}/voice/speak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: ctl.signal,
      });
      if (res.status === 200) return new Uint8Array(await res.arrayBuffer());
      if (res.status !== 204 || attempt > 0) return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (signal.aborted) return null;
  }
  return null;
}

export const api = {
  speech,
  /** What a Mac's sign-in code would sign in, before approving it. */
  lookupPairing: (code: string) =>
    request("/pairing/lookup", PairingLookupResponse, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  approvePairing: (code: string) =>
    request("/pairing/approve", PairingApproveResponse, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  /** Sends the job to another device (the Mac hears it over Realtime). */
  handoff: (jobId: string, body: { to: Surface; stepId?: string }) =>
    request(`/jobs/${jobId}/handoff`, HandoffResponse, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.job),
  listJobs: (options?: { limit?: number; offset?: number }) => {
    const query = options ? `?limit=${options.limit ?? 50}&offset=${options.offset ?? 0}` : "";
    return request(`/jobs${query}`, z.object({ jobs: z.array(Job) })).then((r) => r.jobs);
  },
  listAllJobs: async () => {
    const all: Job[] = [];
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const page = await api.listJobs({ limit, offset });
      all.push(...page);
      if (page.length < limit) return all;
    }
  },
  getJob: (id: string) => request(`/jobs/${id}`, JobDetailResponse),
  identifyAsset: (jobId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/asset/identify`, IdentifyAssetResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
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
    request(`/jobs/${jobId}/manual/search`, ManualSearchResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "POST",
    }),
  fetchManual: (jobId: string, body: { url: string; title: string; token: string }) =>
    request(`/jobs/${jobId}/manual/fetch`, ManualResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
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
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "POST",
    }).then((r) => r.manual),
  manualFromPhotos: (jobId: string, body: { evidenceIds: string[]; title: string }) =>
    request(`/jobs/${jobId}/manual/from-photos`, ManualResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.manual),
  manualUrl: (jobId: string, manualId: string) =>
    request(`/jobs/${jobId}/manual/${manualId}/url`, z.object({ url: z.url() })).then((r) => r.url),
  /** Record mode: the steps from someone doing the job and saying what they do. */
  recordedProcedure: (jobId: string, body: z.input<typeof RecordedProcedureRequest>) =>
    request(`/jobs/${jobId}/procedure/recorded`, GenerateProcedureResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "POST",
      body: JSON.stringify(body),
    }),
  /** Writes the steps in the background and waits; a dropped connection doesn't lose them. */
  generateProcedure: (jobId: string, body: z.input<typeof GenerateProcedureRequest> = {}) =>
    waitForProcedure({
      start: () =>
        request(`/jobs/${jobId}/procedure/start`, ProcedureRunResponse, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      check: () => request(`/jobs/${jobId}/procedure/run`, ProcedureRunResponse),
      isOffline: (e) => e instanceof ApiError && e.status === 0,
    }),
  highlight: (jobId: string, jobStepId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/highlight`, HighlightResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
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
  /** Point the camera: a frame and a question; the answer, and what to outline on the frame. */
  look: (body: z.input<typeof LookRequest>) =>
    request("/look", LookResponse, {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: MODEL_TIMEOUT_MS,
    }),
  transcribe: (wavUri: string, keywords: string[]) => {
    const form = new FormData();
    // Expo's fetch doesn't take React Native's { uri } FormData parts; expo-file-system's File is a Blob.
    form.append("audio", new File(wavUri), "turn.wav");
    form.append("keywords", JSON.stringify(keywords.slice(0, 20)));
    return request(
      "/voice/transcribe",
      TranscribeResponse,
      { method: "POST", body: form, timeoutMs: MODEL_TIMEOUT_MS },
      false,
    );
  },
  checkStep: (jobId: string, jobStepId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/check`, CheckStepResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "POST",
      body: JSON.stringify({ evidenceId }),
    }),
  stepVisuals: (jobId: string, jobStepId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/visuals`, StepVisualsResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
    }),
  setStepReference: (jobId: string, jobStepId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/reference`, StepVisualsResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "PUT",
      body: JSON.stringify({ evidenceId }),
    }),
  clearStepReference: (jobId: string, jobStepId: string) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/reference`, StepVisualsResponse, {
      method: "DELETE",
    }),
  partsCheck: (jobId: string, evidenceId: string) =>
    request(`/jobs/${jobId}/parts-check`, PartsCheckResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "POST",
      body: JSON.stringify({ evidenceId }),
    }),
  correctPart: (
    jobId: string,
    partsCheckId: string,
    partSpecId: string,
    status: "found" | "possible" | "missing",
  ) =>
    request(`/jobs/${jobId}/parts-check/${partsCheckId}/parts/${partSpecId}`, CorrectPartResponse, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  askStep: (
    jobId: string,
    jobStepId: string,
    body: { text: string; stuck?: boolean; userName?: string },
  ) =>
    request(`/jobs/${jobId}/steps/${jobStepId}/ask`, AskStepResponse, {
      timeoutMs: MODEL_TIMEOUT_MS,
      method: "POST",
      body: JSON.stringify(body),
    }),
  getProfile: () => request("/profile", ProfileResponse),
  updateProfile: (body: UpdateProfileRequest) =>
    request("/profile", ProfileResponse, { method: "PUT", body: JSON.stringify(body) }),
  createJob: (input: { title: string; surface: Surface }) =>
    request("/jobs", z.object({ job: Job }), { method: "POST", body: JSON.stringify(input) }).then(
      (r) => r.job,
    ),
  getReport: (jobId: string) => request(`/jobs/${jobId}/report`, JobReportResponse),
  listShares: (jobId: string) =>
    request(`/jobs/${jobId}/share`, z.object({ links: z.array(ShareLink) })).then((r) => r.links),
  createShare: (jobId: string, days = 7) =>
    request(`/jobs/${jobId}/share`, CreateShareResponse, {
      method: "POST",
      body: JSON.stringify({ days }),
    }),
  revokeShare: (jobId: string, linkId: string) =>
    request(`/jobs/${jobId}/share/${linkId}`, z.null(), { method: "DELETE" }),
};
