// Website early-access sign-ups: one row per address; signing up again changes nothing, and says so.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";

export interface EarlyAccessRepo {
  /** False when the address was already on the list. */
  add(email: string, platform: "mac" | "iphone" | null, now: string): Promise<{ added: boolean }>;
}

export function supabaseEarlyAccessRepo(db: SupabaseClient): EarlyAccessRepo {
  return {
    async add(email, platform, now) {
      // A repeat is ignored by the database itself (the address is the key), and returns no row.
      const { data, error } = await db
        .from("early_access")
        .upsert(
          { email, platform, created_at: now },
          { onConflict: "email", ignoreDuplicates: true },
        )
        .select("email");
      if (error) throw dbError(error);
      return { added: (data ?? []).length > 0 };
    },
  };
}
