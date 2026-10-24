// Typed client for the Tandrix API. Responses are validated with the shared contracts.
import { Job, JobStep, type Surface } from "@tandrix/contracts";
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
  getJob: (id: string) => request(`/jobs/${id}`, z.object({ job: Job, steps: z.array(JobStep) })),
  createJob: (input: { title: string; surface: Surface }) =>
    request("/jobs", z.object({ job: Job }), { method: "POST", body: JSON.stringify(input) }).then(
      (r) => r.job,
    ),
};
