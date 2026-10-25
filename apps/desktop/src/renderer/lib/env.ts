import { z } from "zod";

// Vite compiles VITE_* (and TANDRIX_ENV) into the renderer; nothing secret belongs here.
const Env = z.object({
  tandrixEnv: z.enum(["local", "production"]),
  apiUrl: z.url(),
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(1),
});

export const env = Env.parse({
  tandrixEnv: import.meta.env.TANDRIX_ENV,
  apiUrl: import.meta.env.VITE_API_URL,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

/** Local-only conveniences (password sign-in) are gated on this. */
export const isLocal = env.tandrixEnv === "local";
