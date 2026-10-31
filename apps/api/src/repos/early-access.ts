// Website early-access sign-ups: one row per address; signing up again changes nothing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";

export interface EarlyAccessRepo {
  add(email: string, platform: "mac" | "iphone" | null, now: string): Promise<void>;
}

export function supabaseEarlyAccessRepo(db: SupabaseClient): EarlyAccessRepo {
  return {
    async add(email, platform, now) {
      const { error } = await db
        .from("early_access")
        .upsert(
          { email, platform, created_at: now },
          { onConflict: "email", ignoreDuplicates: true },
        );
      if (error) throw dbError(error);
    },
  };
}
