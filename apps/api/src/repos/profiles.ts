// What Tandrix calls the user: one row per user, shared by phone and Mac.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";

export interface ProfilesRepo {
  /** Null when the user has never said what to call them. */
  get(userId: string): Promise<{ displayName: string | null }>;
  /** Null clears the name. */
  set(userId: string, displayName: string | null, now: string): Promise<void>;
}

export function supabaseProfilesRepo(db: SupabaseClient): ProfilesRepo {
  return {
    async get(userId) {
      const { data, error } = await db
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw dbError(error);
      // A cleared name is stored as null; never turn it into the text "null".
      const name = data?.display_name;
      return { displayName: typeof name === "string" && name ? name : null };
    },
    async set(userId, displayName, now) {
      const { error } = await db
        .from("profiles")
        .upsert({ user_id: userId, display_name: displayName, updated_at: now });
      if (error) throw dbError(error);
    },
  };
}
