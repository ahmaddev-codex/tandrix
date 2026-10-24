// Manuals: shared ones (owner_id null, found by search) and private ones (uploaded/photographed).
import type { SupabaseClient } from "@supabase/supabase-js";
import { Id, Manual } from "@tandrix/contracts";
import { dbError } from "../errors";

/** "FlowSet" + "CR 3-10 A-A-A-E" → "flowset|cr 3-10 a-a-a-e": how manuals are shared across jobs. */
export const assetModelKey = (make: string, model: string) =>
  `${make}|${model}`.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

export interface NewManual {
  assetModelKey: string;
  title: string;
  sourceType: "search" | "upload";
  sourceUrl: string | null;
  storageKey: string;
  pageCount: number;
  ownerId: string | null;
}

export interface PendingUpload {
  id: string;
  ownerId: string;
  jobId: string;
  storageKey: string;
  title: string;
  completedAt: string | null;
}

export interface ManualsRepo {
  /** The user's own manual for the model if any, else the newest shared one. */
  findForModel(ownerId: string, key: string): Promise<Manual | null>;
  getForOwner(ownerId: string, manualId: string): Promise<Manual | null>;
  insert(m: NewManual): Promise<Manual>;
  createUpload(u: Omit<PendingUpload, "completedAt">): Promise<PendingUpload>;
  getUpload(ownerId: string, jobId: string, uploadId: string): Promise<PendingUpload | null>;
  completeUpload(uploadId: string): Promise<void>;
  /** Audit trail: which manual a job attached, and how it arrived. */
  recordAttached(
    jobId: string,
    manualId: string,
    how: "search" | "upload" | "photos",
  ): Promise<void>;
}

type Row = Record<string, unknown>;
const COLUMNS =
  "id, asset_model_key, title, source_type, source_url, storage_key, page_count, owner_id, created_at";

const toManual = (r: Row): Manual =>
  Manual.parse({
    id: r.id,
    assetModelKey: r.asset_model_key,
    title: r.title,
    sourceType: r.source_type,
    sourceUrl: r.source_url ?? null,
    storageKey: r.storage_key,
    pageCount: r.page_count,
    createdAt: new Date(String(r.created_at)).toISOString(),
  });

const toUpload = (r: Row): PendingUpload => ({
  id: String(r.id),
  ownerId: String(r.owner_id),
  jobId: String(r.job_id),
  storageKey: String(r.storage_key),
  title: String(r.title),
  completedAt: r.completed_at ? new Date(String(r.completed_at)).toISOString() : null,
});

/** The owner id goes into a PostgREST filter string, so it must be exactly a UUID. */
const ownerFilter = (ownerId: string) => `owner_id.is.null,owner_id.eq.${Id.parse(ownerId)}`;

export function supabaseManualsRepo(db: SupabaseClient): ManualsRepo {
  return {
    async findForModel(ownerId, key) {
      const { data, error } = await db
        .from("manuals")
        .select(COLUMNS)
        .eq("asset_model_key", key)
        .or(ownerFilter(ownerId))
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw dbError(error);
      const own = data.find((r) => r.owner_id === ownerId);
      const pick = own ?? data.find((r) => r.owner_id === null);
      return pick ? toManual(pick) : null;
    },

    async getForOwner(ownerId, manualId) {
      const { data, error } = await db
        .from("manuals")
        .select(COLUMNS)
        .eq("id", manualId)
        .or(ownerFilter(ownerId))
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toManual(data) : null;
    },

    async insert(m) {
      const { data, error } = await db
        .from("manuals")
        .insert({
          asset_model_key: m.assetModelKey,
          title: m.title,
          source_type: m.sourceType,
          source_url: m.sourceUrl,
          storage_key: m.storageKey,
          page_count: m.pageCount,
          owner_id: m.ownerId,
        })
        .select(COLUMNS)
        .single();
      if (error) throw dbError(error);
      return toManual(data);
    },

    async createUpload(u) {
      const { data, error } = await db
        .from("manual_uploads")
        .insert({
          id: u.id,
          owner_id: u.ownerId,
          job_id: u.jobId,
          storage_key: u.storageKey,
          title: u.title,
        })
        .select("id, owner_id, job_id, storage_key, title, completed_at")
        .single();
      if (error) throw dbError(error);
      return toUpload(data);
    },

    async getUpload(ownerId, jobId, uploadId) {
      const { data, error } = await db
        .from("manual_uploads")
        .select("id, owner_id, job_id, storage_key, title, completed_at")
        .eq("id", uploadId)
        .eq("owner_id", ownerId)
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toUpload(data) : null;
    },

    async completeUpload(uploadId) {
      const { error } = await db
        .from("manual_uploads")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", uploadId);
      if (error) throw dbError(error);
    },

    async recordAttached(jobId, manualId, how) {
      const { error } = await db
        .from("events")
        .insert({ job_id: jobId, type: "manual_attached", payload: { manualId, how } });
      if (error) throw dbError(error);
    },
  };
}
