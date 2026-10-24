// Job data access. Runs with the secret key (RLS bypassed), so every query filters by owner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { Job, JobStep, type Surface } from "@tandrix/contracts";

export interface NewJob {
  ownerId: string;
  title: string;
  assetId?: string;
  language: string;
  surface: Surface;
}

export interface JobsRepo {
  create(input: NewJob): Promise<Job>;
  listForOwner(ownerId: string, limit: number): Promise<Job[]>;
  getForOwner(ownerId: string, jobId: string): Promise<{ job: Job; steps: JobStep[] } | null>;
  /** True when the asset exists and belongs to the owner. */
  ownsAsset(ownerId: string, assetId: string): Promise<boolean>;
}

type Row = Record<string, unknown>;

const toJob = (r: Row): Job =>
  Job.parse({
    id: r.id,
    ownerId: r.owner_id,
    assetId: r.asset_id,
    procedureId: r.procedure_id,
    title: r.title,
    status: r.status,
    currentStepId: r.current_step_id,
    activeSurface: r.active_surface,
    controlMode: r.control_mode,
    language: r.language,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });

const toJobStep = (r: Row): JobStep =>
  JobStep.parse({
    id: r.id,
    jobId: r.job_id,
    procedureStepId: r.procedure_step_id,
    status: r.status,
    statusEvidenceId: r.status_evidence_id,
    startedAt: r.started_at === null ? null : iso(r.started_at),
    note: r.note ?? undefined,
    updatedAt: iso(r.updated_at),
    updatedBySurface: r.updated_by_surface,
  });

const stepOrder = (r: Row) => Number((r.procedure_steps as { order?: number } | null)?.order ?? 0);

/** Postgres returns "2026-10-24 08:34:31.123+00"-style strings via PostgREST as ISO; normalise anyway. */
const iso = (v: unknown) => new Date(String(v)).toISOString();

const JOB_COLUMNS =
  "id, owner_id, asset_id, procedure_id, title, status, current_step_id, active_surface, control_mode, language, created_at, updated_at";

export function supabaseJobsRepo(db: SupabaseClient): JobsRepo {
  return {
    async create(input) {
      // Job and its job_created event in one transaction (public.create_job).
      const { data, error } = await db
        .rpc("create_job", {
          p_owner_id: input.ownerId,
          p_title: input.title,
          p_asset_id: input.assetId ?? null,
          p_language: input.language,
          p_surface: input.surface,
        })
        .single();
      if (error) throw error;
      return toJob(data as Row);
    },

    async listForOwner(ownerId, limit) {
      const { data, error } = await db
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data.map(toJob);
    },

    async getForOwner(ownerId, jobId) {
      const { data, error } = await db
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("id", jobId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const steps = await db
        .from("job_steps")
        .select(
          "id, job_id, procedure_step_id, status, status_evidence_id, started_at, note, updated_at, updated_by_surface, procedure_steps!inner(order)",
        )
        .eq("job_id", jobId);
      if (steps.error) throw steps.error;
      // Order by the procedure step's position; PostgREST's referencedTable ordering would only
      // sort inside the embedded rows.
      const ordered = [...(steps.data as Row[])].sort((a, b) => stepOrder(a) - stepOrder(b));
      return { job: toJob(data), steps: ordered.map(toJobStep) };
    },

    async ownsAsset(ownerId, assetId) {
      const { data, error } = await db
        .from("assets")
        .select("id")
        .eq("id", assetId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
  };
}
