// Data for job reports and their share links. Share tokens are stored only as SHA-256 hashes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckResult, ShareLink } from "@tandrix/contracts";
import { dbError } from "../errors";

export interface StepCheck {
  jobStepId: string;
  evidenceId: string;
  result: CheckResult;
  reason: string;
  createdAt: string;
}

export interface ReportsRepo {
  /** The most recent check for each step of the job. */
  latestChecks(jobId: string): Promise<StepCheck[]>;
  createShare(jobId: string, tokenHash: string, expiresAt: string): Promise<ShareLink>;
  listShares(jobId: string): Promise<ShareLink[]>;
  /** Revokes a link of this job; false when there is no such link. */
  revokeShare(jobId: string, linkId: string, now: string): Promise<boolean>;
  /** The job a live (unrevoked, unexpired) link opens, with its owner. */
  findShare(tokenHash: string, now: string): Promise<{ jobId: string; ownerId: string } | null>;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => new Date(String(v)).toISOString();
const toLink = (r: Row): ShareLink => ({
  id: String(r.id),
  createdAt: iso(r.created_at),
  expiresAt: iso(r.expires_at),
  revokedAt: r.revoked_at ? iso(r.revoked_at) : null,
});

export function supabaseReportsRepo(db: SupabaseClient): ReportsRepo {
  return {
    async latestChecks(jobId) {
      const { data, error } = await db
        .from("checks")
        .select("job_step_id, evidence_id, result, reason, created_at, job_steps!inner(job_id)")
        .eq("job_steps.job_id", jobId)
        .order("created_at", { ascending: false });
      if (error) throw dbError(error);
      const latest = new Map<string, StepCheck>();
      for (const r of (data ?? []) as Row[]) {
        const id = String(r.job_step_id);
        if (!latest.has(id))
          latest.set(id, {
            jobStepId: id,
            evidenceId: String(r.evidence_id),
            result: r.result as CheckResult,
            reason: String(r.reason),
            createdAt: iso(r.created_at),
          });
      }
      return [...latest.values()];
    },
    async createShare(jobId, tokenHash, expiresAt) {
      const { data, error } = await db
        .from("share_links")
        .insert({ job_id: jobId, token_hash: tokenHash, expires_at: expiresAt })
        .select("id, created_at, expires_at, revoked_at")
        .single();
      if (error) throw dbError(error);
      return toLink(data as Row);
    },
    async listShares(jobId) {
      const { data, error } = await db
        .from("share_links")
        .select("id, created_at, expires_at, revoked_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (error) throw dbError(error);
      return ((data ?? []) as Row[]).map(toLink);
    },
    async revokeShare(jobId, linkId, now) {
      const { data, error } = await db
        .from("share_links")
        .update({ revoked_at: now })
        .eq("id", linkId)
        .eq("job_id", jobId)
        .is("revoked_at", null)
        .select("id");
      if (error) throw dbError(error);
      return (data ?? []).length > 0;
    },
    async findShare(tokenHash, now) {
      const { data, error } = await db
        .from("share_links")
        .select("job_id, jobs!inner(owner_id)")
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .gt("expires_at", now)
        .maybeSingle();
      if (error) throw dbError(error);
      if (!data) return null;
      const job = (data as Row).jobs as { owner_id: string };
      return { jobId: String((data as Row).job_id), ownerId: job.owner_id };
    },
  };
}
