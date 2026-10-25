import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// The session is stored encrypted by the main process, never in localStorage.
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: window.tandrix.storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
