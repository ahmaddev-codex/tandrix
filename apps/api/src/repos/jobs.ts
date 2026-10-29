// Job data access. Runs with the secret key (RLS bypassed), so every query filters by owner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";
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
  listForOwner(ownerId: string, limit: number, offset?: number): Promise<Job[]>;
  getForOwner(ownerId: string, jobId: string): Promise<{ job: Job; steps: JobStep[] } | null>;
  /** True when the asset exists and belongs to the owner. */
  ownsAsset(ownerId: string, assetId: string): Promise<boolean>;
  /** Sends the job to another device (public.hand_off_job). Not found: the job or step isn't the owner's. */
  handOff(input: {
    ownerId: string;
    jobId: string;
    to: Surface;
    jobStepId?: string;
    by: Surface;
  }): Promise<Job>;
  /**
   * Mirrors the desktop's Show me / Do it for me mode onto the job and records a
   * control_mode_changed event. Null when the job isn't the owner's.
   */
  setControlMode(input: {
    ownerId: string;
    jobId: string;
    mode: "show" | "do";
    surface: Surface;
  }): Promise<Job | null>;
  /**
   * Deletes the owner's job: steps first (status_evidence_id is delete-restrict), then the
   * job row, which cascades evidence, detections, checks, events and share links. Storage
   * objects are removed by the caller first. False when the job isn't the owner's.
   */
  remove(ownerId: string, jobId: string): Promise<boolean>;
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

export const toJobStep = (r: Row): JobStep =>
  JobStep.parse({
    id: r.id,
    jobId: r.job_id,
    procedureStepId: r.procedure_step_id,
    status: r.status,
    statusEvidenceId: r.status_evidence_id,
    startedAt: r.started_at === null ? null : iso(r.started_at),
    note: r.note ?? undefined,
    blockedBy: r.blocked_by ?? undefined,
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
    async handOff(input) {
      const { data, error } = await db
        .rpc("hand_off_job", {
          p_owner_id: input.ownerId,
          p_job_id: input.jobId,
          p_to: input.to,
          p_job_step_id: input.jobStepId ?? null,
          p_by: input.by,
        })
        .single();
      if (error) throw dbError(error);
      return toJob(data as Row);
    },

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
      if (error) throw dbError(error);
      return toJob(data as Row);
    },

    async listForOwner(ownerId, limit, offset = 0) {
      const { data, error } = await db
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw dbError(error);
      return data.map(toJob);
    },

    async getForOwner(ownerId, jobId) {
      // The steps need only the job id, so both reads run together; a missing job still returns
      // null without surfacing the steps result.
      const [job, steps] = await Promise.all([
        db.from("jobs").select(JOB_COLUMNS).eq("id", jobId).eq("owner_id", ownerId).maybeSingle(),
        db
          .from("job_steps")
          .select(
            "id, job_id, procedure_step_id, status, status_evidence_id, started_at, note, blocked_by, updated_at, updated_by_surface, procedure_steps!inner(order)",
          )
          .eq("job_id", jobId),
      ]);
      if (job.error) throw dbError(job.error);
      if (!job.data) return null;
      if (steps.error) throw dbError(steps.error);
      // Order by the procedure step's position; PostgREST's referencedTable ordering would only
      // sort inside the embedded rows.
      const ordered = [...(steps.data as Row[])].sort((a, b) => stepOrder(a) - stepOrder(b));
      return { job: toJob(job.data), steps: ordered.map(toJobStep) };
    },

    async setControlMode(input) {
      const { data, error } = await db
        .from("jobs")
        .update({ control_mode: input.mode })
        .eq("id", input.jobId)
        .eq("owner_id", input.ownerId)
        .select(JOB_COLUMNS)
        .maybeSingle();
      if (error) throw dbError(error);
      if (!data) return null;
      const { error: eventError } = await db.from("events").insert({
        job_id: input.jobId,
        type: "control_mode_changed",
        surface: input.surface,
        payload: { mode: input.mode },
      });
      if (eventError) throw dbError(eventError);
      return toJob(data);
    },

    async remove(ownerId, jobId) {
      const { data, error } = await db
        .from("jobs")
        .select("id")
        .eq("id", jobId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw dbError(error);
      if (!data) return false;
      const { error: stepsError } = await db.from("job_steps").delete().eq("job_id", jobId);
      if (stepsError) throw dbError(stepsError);
      const { error: jobError } = await db.from("jobs").delete().eq("id", jobId);
      if (jobError) throw dbError(jobError);
      return true;
    },

    async ownsAsset(ownerId, assetId) {
      const { data, error } = await db
        .from("assets")
        .select("id")
        .eq("id", assetId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw dbError(error);
      return data !== null;
    },
  };
}
