// Asset data access. Runs with the secret key, so every query filters by owner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";
import { Asset, type AssetCategory } from "@tandrix/contracts";
import type { z } from "zod";

export interface SaveAsset {
  ownerId: string;
  jobId: string;
  category: z.infer<typeof AssetCategory>;
  make: string;
  model: string;
  serial?: string;
  nameplateEvidenceId?: string;
  source: "model" | "model_edited" | "manual";
  confidence?: number;
}

export interface AssetsRepo {
  getForOwner(ownerId: string, assetId: string): Promise<Asset | null>;
  /** Creates the asset, links it to the job and records the event, in one transaction. */
  saveForJob(input: SaveAsset): Promise<Asset>;
}

type Row = Record<string, unknown>;

const toAsset = (r: Row): Asset =>
  Asset.parse({
    id: r.id,
    ownerId: r.owner_id,
    category: r.category,
    make: r.make,
    model: r.model,
    ...(r.serial ? { serial: r.serial } : {}),
    nameplateEvidenceId: r.nameplate_evidence_id ?? null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  });

export function supabaseAssetsRepo(db: SupabaseClient): AssetsRepo {
  return {
    async getForOwner(ownerId, assetId) {
      const { data, error } = await db
        .from("assets")
        .select("id, owner_id, category, make, model, serial, nameplate_evidence_id, created_at")
        .eq("id", assetId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toAsset(data) : null;
    },

    async saveForJob(input) {
      const { data, error } = await db
        .rpc("set_job_asset", {
          p_owner_id: input.ownerId,
          p_job_id: input.jobId,
          p_category: input.category,
          p_make: input.make,
          p_model: input.model,
          p_serial: input.serial ?? null,
          p_nameplate_evidence_id: input.nameplateEvidenceId ?? null,
          p_source: input.source,
          p_confidence: input.confidence ?? null,
        })
        .single();
      if (error) throw dbError(error);
      return toAsset(data as Row);
    },
  };
}
