// A one-time sign-in for a user, for the Mac to exchange with Supabase after the phone approves
// pairing. Uses the admin API's magic-link token; no email is sent.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SessionMinter {
  /** The token hash the client passes to verifyOtp, or null if the user can't be signed in. */
  mint(userId: string): Promise<string | null>;
}

export function supabaseSessionMinter(admin: SupabaseClient): SessionMinter {
  return {
    async mint(userId) {
      const { data: user, error: userError } = await admin.auth.admin.getUserById(userId);
      const email = user?.user?.email;
      if (userError || !email) return null;
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error) return null;
      return data.properties?.hashed_token ?? null;
    },
  };
}
