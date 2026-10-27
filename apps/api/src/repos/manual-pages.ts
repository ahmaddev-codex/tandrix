// Manual pages rendered as images (step visuals). Server only: the API signs their URLs after
// checking the caller can read the manual.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";

export interface ManualPage {
  manualId: string;
  page: number;
  storageKey: string;
  width: number;
  height: number;
}

export interface ManualPagesRepo {
  get(manualId: string, page: number): Promise<ManualPage | null>;
  /** Keeps the first row saved for a page, so two renders at once don't conflict. */
  save(p: ManualPage): Promise<void>;
}

export function supabaseManualPagesRepo(db: SupabaseClient): ManualPagesRepo {
  return {
    async get(manualId, page) {
      const { data, error } = await db
        .from("manual_pages")
        .select("storage_key, width, height")
        .eq("manual_id", manualId)
        .eq("page", page)
        .maybeSingle();
      if (error) throw dbError(error);
      return data
        ? {
            manualId,
            page,
            storageKey: String(data.storage_key),
            width: Number(data.width),
            height: Number(data.height),
          }
        : null;
    },

    async save(p) {
      const { error } = await db.from("manual_pages").upsert(
        {
          manual_id: p.manualId,
          page: p.page,
          storage_key: p.storageKey,
          width: p.width,
          height: p.height,
        },
        { onConflict: "manual_id,page", ignoreDuplicates: true },
      );
      if (error) throw dbError(error);
    },
  };
}
