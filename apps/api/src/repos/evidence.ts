// Evidence data access and storage. Runs with the secret key, so every query filters by owner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";
import { Evidence, type EvidenceKind, type Surface } from "@tandrix/contracts";

export interface NewEvidence {
  id: string;
  jobId: string;
  jobStepId: string | null;
  kind: EvidenceKind;
  surface: Surface;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  capturedAt: string;
}

export interface EvidenceRepo {
  ownsJob(ownerId: string, jobId: string): Promise<boolean>;
  stepInJob(jobId: string, stepId: string): Promise<boolean>;
  createPending(e: NewEvidence): Promise<Evidence>;
  getForOwner(ownerId: string, jobId: string, evidenceId: string): Promise<Evidence | null>;
  markUploaded(evidenceId: string, byteSize: number): Promise<Evidence>;
  listUploaded(jobId: string): Promise<Evidence[]>;
  /** Storage keys of every uploaded object for the job, for deletion. */
  keysForJob(jobId: string): Promise<string[]>;
}

export interface StoredObject {
  size: number;
  contentType: string | null;
}

export interface EvidenceStorage {
  createUploadUrl(path: string): Promise<{ signedUrl: string; token: string; path: string }>;
  stat(path: string): Promise<StoredObject | null>;
  signedReadUrls(paths: string[], expiresInSec: number): Promise<Map<string, string>>;
  remove(path: string): Promise<void>;
  download(path: string): Promise<Uint8Array>;
  /** Server-side write (manuals fetched or built by the API). */
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => new Date(String(v)).toISOString();

const toEvidence = (r: Row): Evidence =>
  Evidence.parse({
    id: r.id,
    jobId: r.job_id,
    jobStepId: r.job_step_id,
    kind: r.kind,
    surface: r.surface,
    storageKey: r.storage_key,
    mimeType: r.mime_type,
    byteSize: Number(r.byte_size),
    ...(r.width != null ? { width: r.width } : {}),
    ...(r.height != null ? { height: r.height } : {}),
    capturedAt: iso(r.captured_at),
    uploadedAt: r.uploaded_at == null ? null : iso(r.uploaded_at),
    deletedAt: r.deleted_at == null ? null : iso(r.deleted_at),
  });

const COLUMNS =
  "id, job_id, job_step_id, kind, surface, storage_key, mime_type, byte_size, width, height, captured_at, uploaded_at, deleted_at";

export function supabaseEvidenceRepo(db: SupabaseClient): EvidenceRepo {
  return {
    async ownsJob(ownerId, jobId) {
      const { data, error } = await db
        .from("jobs")
        .select("id")
        .eq("id", jobId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw dbError(error);
      return data !== null;
    },

    async stepInJob(jobId, stepId) {
      const { data, error } = await db
        .from("job_steps")
        .select("id")
        .eq("id", stepId)
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw dbError(error);
      return data !== null;
    },

    async createPending(e) {
      const { data, error } = await db
        .from("evidence")
        .insert({
          id: e.id,
          job_id: e.jobId,
          job_step_id: e.jobStepId,
          kind: e.kind,
          surface: e.surface,
          storage_key: e.storageKey,
          mime_type: e.mimeType,
          byte_size: e.byteSize,
          width: e.width ?? null,
          height: e.height ?? null,
          captured_at: e.capturedAt,
        })
        .select(COLUMNS)
        .single();
      if (error) throw dbError(error);
      return toEvidence(data);
    },

    async getForOwner(ownerId, jobId, evidenceId) {
      const { data, error } = await db
        .from("evidence")
        .select(`${COLUMNS}, jobs!inner(owner_id)`)
        .eq("id", evidenceId)
        .eq("job_id", jobId)
        .eq("jobs.owner_id", ownerId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toEvidence(data as Row) : null;
    },

    async markUploaded(evidenceId, byteSize) {
      const { data, error } = await db
        .from("evidence")
        .update({ uploaded_at: new Date().toISOString(), byte_size: byteSize })
        .eq("id", evidenceId)
        .select(COLUMNS)
        .single();
      if (error) throw dbError(error);
      return toEvidence(data);
    },

    async listUploaded(jobId) {
      const { data, error } = await db
        .from("evidence")
        .select(COLUMNS)
        .eq("job_id", jobId)
        .not("uploaded_at", "is", null)
        .is("deleted_at", null)
        .order("captured_at", { ascending: false })
        .limit(200);
      if (error) throw dbError(error);
      return data.map(toEvidence);
    },
    async keysForJob(jobId) {
      const keys: string[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from("evidence")
          .select("storage_key")
          .eq("job_id", jobId)
          .not("uploaded_at", "is", null)
          .is("deleted_at", null)
          .range(from, from + 999);
        if (error) throw dbError(error);
        keys.push(...(data as Row[]).map((r) => String(r.storage_key)));
        if (data.length < 1000) break;
      }
      return keys;
    },
  };
}

export function supabaseEvidenceStorage(db: SupabaseClient, bucket = "evidence"): EvidenceStorage {
  const store = () => db.storage.from(bucket);
  return {
    async createUploadUrl(path) {
      const { data, error } = await store().createSignedUploadUrl(path);
      if (error) throw dbError(error);
      return data;
    },
    async stat(path) {
      const { data, error } = await store().info(path);
      if (error) {
        // Not found is a normal answer here: the client may not have uploaded yet.
        if (
          (error as { statusCode?: string; status?: number }).status === 404 ||
          /not.?found/i.test(error.message)
        ) {
          return null;
        }
        throw dbError(error);
      }
      return { size: Number(data.size ?? 0), contentType: data.contentType ?? null };
    },
    async signedReadUrls(paths, expiresInSec) {
      if (!paths.length) return new Map();
      const { data, error } = await store().createSignedUrls(paths, expiresInSec);
      if (error) throw dbError(error);
      return new Map(
        data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]),
      );
    },
    async remove(path) {
      const { error } = await store().remove([path]);
      if (error) throw dbError(error);
    },
    async put(path, bytes, contentType) {
      const { error } = await store().upload(path, bytes, { contentType, upsert: false });
      if (error) throw dbError(error);
    },
    async download(path) {
      const { data, error } = await store().download(path);
      if (error) throw dbError(error);
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
