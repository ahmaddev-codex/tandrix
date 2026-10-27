import { z } from "zod";

// EXPO_PUBLIC_* values are compiled into the app, so each must be read by its full name.
const Env = z.object({
  tandrixEnv: z.enum(["local", "production"]),
  apiUrl: z.url(),
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(1),
});

export const env = Env.parse({
  tandrixEnv: process.env.EXPO_PUBLIC_TANDRIX_ENV,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

/** Local-only conveniences (such as password sign-in) are gated on this. */
export const isLocal = env.tandrixEnv === "local";
